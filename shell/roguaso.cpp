// RoguSo v0.6.0 - the Windows shell: one small exe that opens the game in an internal WebView2 (Edge) tab.
// The whole web build lives inside the exe and is served straight from memory (WebResourceRequested -> memory
// streams): no unpacking, no app folder on disk, no bundled browser, no Electron. Documents/RoguSo carries only the
// data the game needs (save.json, settings.json, controls.json) through a JSON message bridge; the WebView2 runtime
// profile lives in %LOCALAPPDATA%/RoguSo/runtime. F11 toggles a borderless fullscreen on the host window.
#include <windows.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <WebView2.h>
#include <WebView2EnvironmentOptions.h>
#include <wrl/client.h>
#include <wrl/implements.h>
#include <algorithm>
#include <cstdio>
#include <string>
#include "embed.h"

#define ROGUSO_VERSION "0.6.0"

static const wchar_t WINDOW_CLASS[] = L"RoguSoWindow";
static const wchar_t ORIGIN[] = L"https://app.roguaso/";
static const wchar_t* DATA_FILES[] = { L"save.json", L"settings.json", L"controls.json" };

using Microsoft::WRL::ComPtr;

static ComPtr<ICoreWebView2> g_web;
static ComPtr<ICoreWebView2Environment> g_env;
static ComPtr<ICoreWebView2Controller> g_controller;

static std::wstring KnownDir(REFKNOWNFOLDERID id, const wchar_t* fallbackSub) {
    PWSTR p = nullptr;
    std::wstring out;
    if (SUCCEEDED(SHGetKnownFolderPath(id, 0, nullptr, &p))) {
        out.assign(p);
        CoTaskMemFree(p);
    } else {
        wchar_t buf[MAX_PATH];
        GetEnvironmentVariableW(L"USERPROFILE", buf, MAX_PATH);
        out = std::wstring(buf) + fallbackSub;
    }
    return out;
}

static const std::wstring DataRoot() { return KnownDir(FOLDERID_Documents, L"\\Documents") + L"\\RoguSo"; }
static const std::wstring RuntimeDir() { return KnownDir(FOLDERID_LocalAppData, L"\\AppData\\Local") + L"\\RoguSo\\runtime"; }

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

// minimal JSON: extract a top-level string field ("op", "name") or the decoded "data" string payload
static bool JsonField(const std::string& json, const char* key, std::string& out) {
    std::string pat = "\"" + std::string(key) + "\":";
    size_t p = json.find(pat);
    if (p == std::string::npos) return false;
    p += pat.size();
    while (p < json.size() && (json[p] == ' ' || json[p] == '\t')) p++;
    if (p >= json.size() || json[p] != '"') return false;
    p++;
    out.clear();
    while (p < json.size()) {
        char c = json[p++];
        if (c == '"') return true;
        if (c == '\\' && p < json.size()) {
            char e = json[p++];
            switch (e) {
                case '"': out += '"'; break;
                case '\\': out += '\\'; break;
                case '/': out += '/'; break;
                case 'b': out += '\b'; break;
                case 'f': out += '\f'; break;
                case 'n': out += '\n'; break;
                case 'r': out += '\r'; break;
                case 't': out += '\t'; break;
                case 'u': {
                    if (p + 4 > json.size()) return false;
                    unsigned int v = 0;
                    for (int k = 0; k < 4; k++) {
                        char c = json[p + k];
                        v = v * 16 + (unsigned int)(c <= '9' ? c - '0' : (c | 0x20) - 'a' + 10);
                    }
                    p += 4;
                    wchar_t wc = (wchar_t)v;
                    char mb[8];
                    int n = WideCharToMultiByte(CP_UTF8, 0, &wc, 1, mb, sizeof(mb), nullptr, nullptr);
                    out.append(mb, n > 0 ? n : 0);
                    break;
                }
                default: out += e;
            }
        } else out += c;
    }
    return false;
}

static bool NameOk(const std::wstring& name) {
    if (name.empty() || name.size() > 64) return false;
    for (wchar_t c : name)
        if (!((c >= L'a' && c <= L'z') || (c >= L'A' && c <= L'Z') || (c >= L'0' && c <= L'9') || c == L'.' || c == L'_' || c == L'-'))
            return false;
    return true;
}

void ToggleFullscreen();

// ---- the bridge: JSON messages from the game (storage.js) -> the Documents/RoguSo data files
static void HandleJson(const std::string& j) {
    std::string op, name, data;
    if (!JsonField(j, "op", op)) return;
    if (op == "readAll") {
        std::string json = "{\"op\":\"readAll\",\"files\":{";
        bool first = true;
        for (const wchar_t* n : DATA_FILES) {
            const bool exists = GetFileAttributesW((DataRoot() + L"\\" + n).c_str()) != INVALID_FILE_ATTRIBUTES;
            if (!first) json += ",";
            first = false;
            json += "\"" + WideToUtf8(n) + "\":";
            if (!exists) { json += "null"; continue; }
            json += "\"" + JsonEscape(ReadFileBytes(DataRoot() + L"\\" + n)) + "\"";
        }
        json += "}}";
        if (g_web) g_web->PostWebMessageAsJson(Utf8ToWide(json).c_str());
        return;
    }
    if (!JsonField(j, "name", name)) return;
    const std::wstring wname = Utf8ToWide(name);
    if (!NameOk(wname)) return;
    if (op == "write" && JsonField(j, "data", data)) {
        MkDir(DataRoot());
        WriteFileBytes(DataRoot() + L"\\" + wname, data.data(), (DWORD)data.size());
        return;
    }
    if (op == "remove") {
        const std::wstring full = DataRoot() + L"\\" + wname;
        SetFileAttributesW(full.c_str(), FILE_ATTRIBUTE_NORMAL);
        DeleteFileW(full.c_str());
        return;
    }
}

static void HandleMessage(const std::wstring& msg) {
    if (!msg.empty() && (msg[0] == L'{')) { HandleJson(WideToUtf8(msg)); return; }
    if (msg == L"ROGUSO FULLSCREEN") { ToggleFullscreen(); return; }
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

// ---- the app from RAM: every request under the origin is answered from the embedded byte arrays
static const EmbeddedFile* FindEmbed(const std::string& path) {
    for (int i = 0; i < EMBED_COUNT; i++)
        if (_stricmp(EMBED_FILES[i].path, path.c_str()) == 0) return &EMBED_FILES[i];
    return nullptr;
}

static const wchar_t* MimeOf(const std::string& path) {
    size_t dot = path.find_last_of('.');
    const char* ext = dot == std::string::npos ? "" : path.c_str() + dot;
    if (!_stricmp(ext, ".html")) return L"text/html; charset=utf-8";
    if (!_stricmp(ext, ".js")) return L"text/javascript; charset=utf-8";
    if (!_stricmp(ext, ".css")) return L"text/css; charset=utf-8";
    if (!_stricmp(ext, ".png")) return L"image/png";
    if (!_stricmp(ext, ".jpg") || !_stricmp(ext, ".jpeg")) return L"image/jpeg";
    if (!_stricmp(ext, ".svg")) return L"image/svg+xml";
    if (!_stricmp(ext, ".ico")) return L"image/x-icon";
    if (!_stricmp(ext, ".json") || !_stricmp(ext, ".map")) return L"application/json";
    if (!_stricmp(ext, ".woff2")) return L"font/woff2";
    return L"application/octet-stream";
}

class ResourceHandler : public ICoreWebView2WebResourceRequestedEventHandler {
public:
    HRESULT STDMETHODCALLTYPE Invoke(ICoreWebView2*, ICoreWebView2WebResourceRequestedEventArgs* args) override {
        ComPtr<ICoreWebView2WebResourceRequest> req;
        if (FAILED(args->get_Request(&req)) || !req) return S_OK;
        PWSTR raw = nullptr;
        if (FAILED(req->get_Uri(&raw)) || !raw) return S_OK;
        std::wstring uri(raw);
        CoTaskMemFree(raw);
        if (uri.rfind(ORIGIN, 0) != 0) return S_OK;
        std::wstring relW = uri.substr(wcslen(ORIGIN));
        size_t q = relW.find(L'?');
        if (q != std::wstring::npos) relW = relW.substr(0, q);
        std::string rel = WideToUtf8(relW);
        if (rel.empty()) rel = "index.html";
        const EmbeddedFile* f = FindEmbed(rel);
        ComPtr<ICoreWebView2Environment2> env2;
        if (FAILED(g_env.As(&env2)) || !env2) return S_OK;
        ComPtr<ICoreWebView2WebResourceResponse> resp;
        if (!f) {
            if (FAILED(env2->CreateWebResourceResponse(nullptr, 404, L"Not Found", L"", &resp)) || !resp) return S_OK;
            args->put_Response(resp.Get());
            return S_OK;
        }
        HGLOBAL h = GlobalAlloc(GMEM_MOVEABLE, f->size);
        if (h) {
            void* p = GlobalLock(h);
            if (p) { memcpy(p, f->data, f->size); GlobalUnlock(h); }
        }
        ComPtr<IStream> stream;
        if (!h || FAILED(CreateStreamOnHGlobal(h, TRUE, &stream))) {
            GlobalFree(h);
            return S_OK;
        }
        std::wstring headers = std::wstring(L"Content-Type: ") + MimeOf(rel) + L"\r\nCache-Control: no-cache\r\n";
        if (SUCCEEDED(env2->CreateWebResourceResponse(stream.Get(), 200, L"OK", headers.c_str(), &resp)) && resp) {
            args->put_Response(resp.Get());      // setting the response is what answers the request
        }
        return S_OK;
    }
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** out) override {
        if (riid == __uuidof(ICoreWebView2WebResourceRequestedEventHandler) || riid == __uuidof(IUnknown)) {
            *out = static_cast<ICoreWebView2WebResourceRequestedEventHandler*>(this);
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
        g_controller->get_CoreWebView2(&web);
        g_web = web;
        ICoreWebView2Settings* settings = nullptr;
        if (SUCCEEDED(web->get_Settings(&settings)) && settings) {
            settings->put_AreDefaultContextMenusEnabled(FALSE);
            settings->put_IsStatusBarEnabled(FALSE);
            settings->put_IsZoomControlEnabled(FALSE);
            settings->Release();
        }
        web->AddWebResourceRequestedFilter((std::wstring(ORIGIN) + L"*").c_str(), COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL);
        static ResourceHandler resHandler;
        web->add_WebResourceRequested(&resHandler, nullptr);
        static MessageHandler msgHandler;
        web->add_WebMessageReceived(&msgHandler, nullptr);
        const std::wstring url = std::wstring(ORIGIN) + L"index.html";
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
        g_env = env;
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

// ---- F11 fullscreen: borderless on the monitor, restored with the exact old placement
static bool g_full = false;
static RECT g_saved = { 0, 0, 0, 0 };
void ToggleFullscreen() {
    HWND hwnd = ControllerHandler::g_hwnd;
    if (!hwnd) return;
    g_full = !g_full;
    if (g_full) {
        GetWindowRect(hwnd, &g_saved);
        MONITORINFO mi = { sizeof(mi) };
        GetMonitorInfoW(MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST), &mi);
        SetWindowLongW(hwnd, GWL_STYLE, (GetWindowLongW(hwnd, GWL_STYLE) & ~WS_OVERLAPPEDWINDOW) | WS_POPUP);
        SetWindowPos(hwnd, HWND_TOP, mi.rcMonitor.left, mi.rcMonitor.top,
            mi.rcMonitor.right - mi.rcMonitor.left, mi.rcMonitor.bottom - mi.rcMonitor.top, SWP_FRAMECHANGED);
    } else {
        SetWindowLongW(hwnd, GWL_STYLE, (GetWindowLongW(hwnd, GWL_STYLE) & ~WS_POPUP) | WS_OVERLAPPEDWINDOW);
        SetWindowPos(hwnd, nullptr, g_saved.left, g_saved.top,
            g_saved.right - g_saved.left, g_saved.bottom - g_saved.top, SWP_FRAMECHANGED | SWP_NOZORDER);
    }
    if (g_controller) {
        RECT rc;
        GetClientRect(hwnd, &rc);
        if (rc.right > 0 && rc.bottom > 0) g_controller->put_Bounds(rc);
    }
}

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

    MkDir(DataRoot());
    MkDir(RuntimeDir());

    auto options = Microsoft::WRL::Make<CoreWebView2EnvironmentOptions>();
    // a game must never throttle: no renderer backgrounding, no occluded-window pause, no timer throttling
    options->put_AdditionalBrowserArguments(L"--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection "
        L"--disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling");
    options->put_TargetCompatibleBrowserVersion(L"95.0.1020.44");

    static EnvironmentHandler envHandler;
    CreateCoreWebView2EnvironmentWithOptions(nullptr, RuntimeDir().c_str(), options.Get(), &envHandler);

    MSG msg;
    while (GetMessageW(&msg, nullptr, 0, 0) > 0) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }
    CoUninitialize();
    return 0;
}
