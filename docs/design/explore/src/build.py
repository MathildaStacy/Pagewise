"""把 src/ 拼成单文件页面 ../apple.html、../google.html、../microsoft.html、../meta.html、../play.html、../windows11.html。用法：python3 build.py"""
import pathlib
here = pathlib.Path(__file__).resolve().parent
js = "\n".join((here / f).read_text(encoding="utf-8") for f in ["data.js", "app.js"]).replace("</script>", "<\\/script>")
for name in ["apple", "google", "microsoft", "meta", "play", "windows11"]:
    src = here / f"{name}.html"
    if src.exists():
        out = here.parent / f"{name}.html"
        css = "\n".join((here / f).read_text(encoding="utf-8") for f in [f"{name}.css", f"{name}2.css"] if (here / f).exists())
        out.write_text(src.read_text(encoding="utf-8").replace("/*CSS*/", css).replace("/*JS*/", js), encoding="utf-8")
        print("wrote", out.name, len(out.read_bytes()) // 1024, "KB")
