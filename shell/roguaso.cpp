// RoguSo v0.5.0 - the Windows shell: one small exe that opens the game in an internal WebView2 (Edge) tab,
// keeps the data in Documents/RoguSo (save.json, settings.json, controls.json next to the runtime folder),
// and carries the whole web build inside itself, extracted on first run. No bundled browser, no Electron.
#include <windows.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <WebView2.h>
#include <wrl/client.h>
#include <algorithm>
#include <cstdio>
#include <string>
#include "embed.h"

#define ROGUSO_VERSION "0.5.0"

static const wchar_t WINDOW_CLASS[] = L"RoguSoWindow";
static const wchar_t VIRTUAL_HOST[] = L"app.roguaso";
static const wchar_t* DATA_FILES[] = { L"save.json", L"settings.json", L"controls.json" };

using Microsoft::WRL::ComPtr;

static ComPtr<ICoreWebView2> g_web;
static ComPtr<ICoreWebView2Controller> g_controller;

static std::wstring DocumentsDir() {
    PWSTR p = nullptr;
    std::wstring out;
    if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_Documents, 0, nullptr, &p))) {
        out.assign(p);
        CoTaskMemFree(p);
    } else {
        wchar_t buf[MAX_PATH];
        GetEnvironmentVariableW(L"USERPROFILE", buf, MAX_PATH);
        out = std::wstring(buf) + L"\\Documents";
    }
    return out;
}

static const std::wstring DataRoot() { return DocumentsDir() + L"\\RoguSo"; }
static const std::wstring AppDir() { return DataRoot() + L"\\app"; }
static const std::wstring RuntimeDir() { return DataRoot() + L"\\runtime"; }

static void MkDir(const std::wstring& path) {
    if (CreateDirectoryW(path.c_str(), nullptr)) return;
    if (GetLastError() == ERROR_PATH_NOT_FOUND) {
        size_t cut = path.find_last_of(L'\\');
        if (cut != std::wstring::npos) {
            MkDir(path.substr(0, cut));
            CreateDirectoryW(path.c_str(), nullptr);
        }
    }
}

static void RmTree(const std::wstring& path) {
    std::wstring from = path;
    from.push_back(L'\0');
    from.push_back(L'\0');
    SHFILEOPSTRUCTW op = {};
    op.wFunc = FO_DELETE;
    op.pFrom = from.c_str();
    op.fFlags = FOF_NOCONFIRMATION | FOF_SILENT | FOF_NOERRORUI;
    SHFileOperationW(&op);
}

static std::string WideToUtf8(const std::wstring& w) {
    int n = WideCharToMultiByte(CP_UTF8, 0, w.c_str(), (int)w.size(), nullptr, 0, nullptr, nullptr);
    std::string out((size_t)n, '\0');
    WideCharToMultiByte(CP_UTF8, 0, w.c_str(), (int)w.size(), out.data(), n, nullptr, nullptr);
    return out;
}

static std::wstring Utf8ToWide(const std::string& s) {
    int n = MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), nullptr, 0);
    std::wstring out((size_t)n, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), out.data(), n);
    return out;
}

static std::string ReadFileBytes(const std::wstring& path) {
    HANDLE h = CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, 0, nullptr);
    if (h == INVALID_HANDLE_VALUE) return {};
    LARGE_INTEGER sz;
    if (!GetFileSizeEx(h, &sz)) { CloseHandle(h); return {}; }
    std::string out((size_t)sz.QuadPart, '\0');
    DWORD got = 0;
    ReadFile(h, out.data(), (DWORD)sz.QuadPart, &got, nullptr);
    CloseHandle(h);
    out.resize(got);
    return out;
}

static void WriteFileBytes(const std::wstring& path, const void* data, DWORD size) {
    HANDLE h = CreateFileW(path.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, 0, nullptr);
    if (h == INVALID_HANDLE_VALUE) return;
    DWORD wrote = 0;
    WriteFile(h, data, size, &wrote, nullptr);
    CloseHandle(h);
}

static std::string JsonEscape(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 16);
    char b[8];
    for (unsigned char c : s) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\b': out += "\\b"; break;
            case '\f': out += "\\f"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (c < 0x20) { sprintf_s(b, sizeof(b), "\\u%04x", c); out += b; }
                else out += (char)c;
        }
    }
    return out;
}

static bool NameOk(const std::wstring& name) {
    if (name.empty() || name.size() > 64) return false;
    for (wchar_t c : name)
        if (!((c >= L'a' && c <= L'z') || (c >= L'A' && c <= L'Z') || (c >= L'0' && c <= L'9') || c == L'.' || c == L'_' || c == L'-'))
            return false;
    return true;
}

static void ExtractGame() {
    MkDir(DataRoot());
    const std::wstring app = AppDir(), ver = app + L"\\.ver";
    if (ReadFileBytes(ver) == ROGUSO_VERSION) return;
    RmTree(app);
    MkDir(app);
    for (int i = 0; i < EMBED_COUNT; i++) {
        std::wstring rel = Utf8ToWide(EMBED_FILES[i].path);
        std::replace(rel.begin(), rel.end(), L'/', L'\\');
        const std::wstring full = app + L"\\" + rel;
        size_t cut = full.find_last_of(L'\\');
        if (cut != std::wstring::npos) MkDir(full.substr(0, cut));
        WriteFileBytes(full, EMBED_FILES[i].data, (DWORD)EMBED_FILES[i].size);
    }
    WriteFileBytes(ver, ROGUSO_VERSION, (DWORD)strlen(ROGUSO_VERSION));
}

static void HandleMessage(const std::wstring& msg) {
    static bool pendingWrite = false;
    static std::wstring pendingName;
    if (pendingWrite) {
        pendingWrite = false;
        const std::string utf8 = WideToUtf8(msg);
        WriteFileBytes(DataRoot() + L"\\" + pendingName, utf8.data(), (DWORD)utf8.size());
        return;
    }
    if (msg.rfind(L"ROGUSO W ", 0) == 0) {
        size_t sp = msg.find(L' ', 9);
        if (sp == std::wstring::npos) return;
        const std::wstring name = msg.substr(9, sp - 9);
        if (!NameOk(name)) return;
        pendingWrite = true;
        pendingName = name;
        return;
    }
    if (msg.rfind(L"ROGUSO R ", 0) == 0) {
        const std::wstring name = msg.substr(9);
        if (!NameOk(name)) return;
        const std::wstring full = DataRoot() + L"\\" + name;
        SetFileAttributesW(full.c_str(), FILE_ATTRIBUTE_NORMAL);
        DeleteFileW(full.c_str());
        return;
    }
    if (msg == L"ROGUSO Q") {
        std::string json = "{\"op\":\"readAll\",\"files\":{";
        bool first = true;
        for (const wchar_t* n : DATA_FILES) {
            const bool exists = GetFileAttributesW((DataRoot() + L"\\" + n).c_str()) != INVALID_HANDLE_VALUE;
            if (!first) json += ",";
            first = false;
            json += "\"" + WideToUtf8(n) + "\":";
            if (!exists) { json += "null"; continue; }
            json += "\"" + JsonEscape(ReadFileBytes(DataRoot() + L"\\" + n)) + "\"";
        }
        json += "}}";
        g_web->PostWebMessageAsJson(Utf8ToWide(json).c_str());
        return;
    }
}

class MessageHandler : public ICoreWebView2WebMessageReceivedEventHandler {
public:
    HRESULT STDMETHODCALLTYPE Invoke(ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* args) override {
        PWSTR raw = nullptr;
        if (SUCCEEDED(args->TryGetWebMessageAsString(&raw)) && raw) {
            std::wstring msg(raw);
            CoTaskMemFree(raw);
            HandleMessage(msg);
        } else if (raw) {
            CoTaskMemFree(raw);
        }
        return S_OK;
    }
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** out) override {
        if (riid == __uuidof(ICoreWebView2WebMessageReceivedEventHandler) || riid == __uuidof(IUnknown)) {
            *out = static_cast<ICoreWebView2WebMessageReceivedEventHandler*>(this);
            AddRef();
            return S_OK;
        }
        *out = nullptr;
        return E_NOINTERFACE;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return 2; }
    ULONG STDMETHODCALLTYPE Release() override { return 1; }
};

class ControllerHandler : public ICoreWebView2CreateCoreWebView2ControllerCompletedHandler {
public:
    HRESULT STDMETHODCALLTYPE Invoke(HRESULT, ICoreWebView2Controller* controller) override {
        g_controller = controller;
        ComPtr<ICoreWebView2> web;
        g_controller->get_Webview(&web);
        g_web = web;
        ICoreWebView2Settings* settings = nullptr;
        if (SUCCEEDED(web->get_Settings(&settings)) && settings) {
            settings->put_AreDefaultContextMenusEnabled(FALSE);
            settings->put_IsStatusBarEnabled(FALSE);
            settings->put_IsZoomControlEnabled(FALSE);
            settings->Release();
        }
        ICoreWebView2_3* web3 = nullptr;
        if (SUCCEEDED(web->QueryInterface(__uuidof(ICoreWebView2_3), (void**)&web3)) && web3) {
            web3->SetVirtualHostNameToFolderMapping(VIRTUAL_HOST, AppDir().c_str(),
                COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW);
            web3->Release();
        }
        static MessageHandler handler;
        web->add_WebMessageReceived(&handler, nullptr);
        const std::wstring url = std::wstring(L"https://") + VIRTUAL_HOST + L"/index.html";
        web->Navigate(url.c_str());
        RECT rc;
        GetClientRect(g_hwnd, &rc);
        if (rc.right > 0 && rc.bottom > 0) g_controller->put_Bounds(rc);
        return S_OK;
    }
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** out) override {
        if (riid == __uuidof(ICoreWebView2CreateCoreWebView2ControllerCompletedHandler) || riid == __uuidof(IUnknown)) {
            *out = static_cast<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler*>(this);
            AddRef();
            return S_OK;
        }
        *out = nullptr;
        return E_NOINTERFACE;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return 2; }
    ULONG STDMETHODCALLTYPE Release() override { return 1; }
    static HWND g_hwnd;
};
HWND ControllerHandler::g_hwnd = nullptr;

class EnvironmentHandler : public ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler {
public:
    HRESULT STDMETHODCALLTYPE Invoke(HRESULT, ICoreWebView2Environment* env) override {
        env->CreateCoreWebView2Controller(ControllerHandler::g_hwnd, &controllerHandler);
        return S_OK;
    }
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** out) override {
        if (riid == __uuidof(ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler) || riid == __uuidof(IUnknown)) {
            *out = static_cast<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler*>(this);
            AddRef();
            return S_OK;
        }
        *out = nullptr;
        return E_NOINTERFACE;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return 2; }
    ULONG STDMETHODCALLTYPE Release() override { return 1; }
    static ControllerHandler controllerHandler;
};
ControllerHandler EnvironmentHandler::controllerHandler;

static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    switch (msg) {
        case WM_SIZE: {
            if (g_controller) {
                RECT rc;
                GetClientRect(hwnd, &rc);
                if (rc.right > 0 && rc.bottom > 0) g_controller->put_Bounds(rc);
            }
            return 0;
        }
        case WM_GETMINMAXINFO: {
            auto* mmi = reinterpret_cast<MINMAXINFO*>(lp);
            mmi->ptMinTrackSize.x = 640;
            mmi->ptMinTrackSize.y = 400;
            return 0;
        }
        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;
        default:
            return DefWindowProcW(hwnd, msg, wp, lp);
    }
}

int WINAPI wWinMain(HINSTANCE hInst, HINSTANCE, PWSTR, int nCmdShow) {
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    HeapSetInformation(nullptr, HeapEnableTerminationOnCorruption, nullptr, 0);

    WNDCLASSW wc = {};
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInst;
    wc.lpszClassName = WINDOW_CLASS;
    wc.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    wc.hIcon = LoadIconW(hInst, MAKEINTRESOURCEW(1));
    RegisterClassW(&wc);

    int w = 1280, h = 720;
    RECT work;
    SystemParametersInfoW(SPI_GETWORKAREA, 0, &work, 0);
    const int x = work.left + (work.right - work.left - w) / 2;
    const int y = work.top + (work.bottom - work.top - h) / 2;
    HWND hwnd = CreateWindowExW(0, WINDOW_CLASS, L"RoguSo",
        WS_OVERLAPPEDWINDOW, x, y, w, h, nullptr, nullptr, hInst, nullptr);
    ControllerHandler::g_hwnd = hwnd;
    ShowWindow(hwnd, nCmdShow);

    ExtractGame();
    MkDir(RuntimeDir());

    COREWEBVIEW2_ENVIRONMENT_OPTIONS options;
    wchar_t args[] = L"--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection";
    options.AdditionalBrowserArguments = args;
    options.Language = nullptr;
    options.TargetCompatibleBrowserVersion = L"95.0.1020.44";
    options.AllowSingleSignOnUsingOSPrimaryAccount = FALSE;

    static EnvironmentHandler envHandler;
    CreateCoreWebView2EnvironmentWithOptions(nullptr, RuntimeDir().c_str(), &options, &envHandler);

    MSG msg;
    while (GetMessageW(&msg, nullptr, 0, 0) > 0) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }
    CoUninitialize();
    return 0;
}
