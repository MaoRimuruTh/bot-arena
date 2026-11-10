#!/usr/bin/env python3
"""Cache-busting: stamp every local JS/CSS reference with ?v=<version> so a deploy is
picked up immediately (GitHub Pages caches files for 10 minutes). Run before each commit."""
import re, sys, pathlib, time
root = pathlib.Path(__file__).resolve().parent.parent
v = sys.argv[1] if len(sys.argv) > 1 else time.strftime("%Y%m%d%H%M%S")
pat = re.compile(r'''((?:from|import)\s*\(?\s*["'])(\.{1,2}/[^"'?]+?\.js)(?:\?v=[\w.-]+)?(["'])''')
for f in list((root / "js").rglob("*.js")):
    s = f.read_text(encoding="utf-8"); n = pat.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={v}{m.group(3)}", s)
    if n != s: f.write_text(n, encoding="utf-8")
h = root / "index.html"; s = h.read_text(encoding="utf-8")
s = re.sub(r'(src="js/main\.js|href="css/app\.css)(?:\?v=[\w.-]+)?"', lambda m: f'{m.group(1)}?v={v}"', s)
h.write_text(s, encoding="utf-8")
(root / "version.json").write_text('{"v":"%s"}\n' % v, encoding="utf-8"); print("stamped", v)
