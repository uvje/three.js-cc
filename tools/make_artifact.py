"""Writes an Artifact-ready copy of index.html (the host adds its own document skeleton)."""
import re, sys, pathlib
src = pathlib.Path(__file__).resolve().parent.parent / 'index.html'
out = pathlib.Path(sys.argv[1])
s = src.read_text(encoding='utf-8')
s = re.sub(r'<!doctype html>\s*', '', s, flags=re.I)
s = re.sub(r'</?html[^>]*>\s*', '', s)
s = re.sub(r'</?head>\s*', '', s)
s = re.sub(r'</?body>\s*', '', s)
s = re.sub(r'<meta charset[^>]*>\s*', '', s)
s = re.sub(r'<meta name="viewport"[^>]*>\s*', '', s)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(s, encoding='utf-8')
print('wrote', out, len(s))
