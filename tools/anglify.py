#!/usr/bin/env python3
"""Collapse the bilingual zh/en text structures into English-only ones.

Patterns (all with straight single quotes):
  1. { zh: 'X', en: 'Y' }            -> 'Y'            (objects holding ONLY zh+en)
  2. { en: 'Y', zh: 'X' }            -> 'Y'
  3. zh: 'X', en: 'Y' inside a bigger object (obj/act/...) -> drop the zh key, keep en:
     { go: [...], zh: 'X', en: 'Y' }  -> { go: [...], en: 'Y' }
  4. [ 'X..zh', 'Y..en' ] two-string arrays where the FIRST string carries CJK -> 'Y'
"""
import re
import sys
from pathlib import Path

STR = r"'(?:[^'\\\n]|\\.)*'"
CJK = re.compile(r'[\u4e00-\u9fff]')

PAIR_SAME_LINE = re.compile(
    rf"\{{\s*zh:\s*({STR})\s*,\s*en:\s*({STR})\s*,?\s*\}}")
PAIR_REV = re.compile(
    rf"\{{\s*en:\s*({STR})\s*,\s*zh:\s*({STR})\s*,?\s*\}}")
ZH_KEY_DROP = re.compile(rf"zh:\s*({STR})\s*,\s*(?=\s*en:)")
EN_KEY_DROP = re.compile(rf"en:\s*({STR})\s*,\s*(?=\s*zh:)")

def unquote(s):
    return s[1:-1]

def fix_arrays(text):
    # ['zh...', 'en...'] -> 'en...' only when the first string has CJK and the second has none
    def repl(m):
        a, b = unquote(m.group(1)), unquote(m.group(2))
        if CJK.search(a) and not CJK.search(b):
            return "'" + b.replace('\\', '\\\\') + "'" if False else m.group(2)
        return m.group(0)
    pat = re.compile(rf"\[({STR})\s*,\s*({STR})\]")
    prev = None
    while prev != text:
        prev = text
        text = pat.sub(repl, text)
    return text

def process(path):
    t = path.read_text(encoding='utf-8')
    orig = t
    t = PAIR_SAME_LINE.sub(lambda m: m.group(2), t)
    t = PAIR_REV.sub(lambda m: m.group(1), t)
    t = ZH_KEY_DROP.sub("", t)          # zh: 'X',  directly before en:  -> gone
    t = fix_arrays(t)
    if t != orig:
        path.write_text(t, encoding='utf-8')
    return len(CJK.findall(orig)), len(CJK.findall(t))

if __name__ == '__main__':
    root = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
    total_before = total_after = 0
    for p in sorted(root.rglob('*')):
        if p.suffix not in ('.js', '.html', '.mjs') or 'vendor' in p.parts:
            continue
        b, a = process(p)
        if b or a:
            print(f"{b:5d} -> {a:4d}  {p}")
        total_before += b
        total_after += a
    print(f"TOTAL {total_before} -> {total_after}")
