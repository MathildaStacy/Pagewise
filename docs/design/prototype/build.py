"""把原型源文件拼成单文件 docs/design/prototype.html。用法：python3 build.py"""
import pathlib
here = pathlib.Path(__file__).resolve().parent
FILES = ["data.js", "core.js", "ui-base.js", "ui-shelf.js", "ui-map.js", "ui-study.js", "ui-study2.js", "ui-reader.js", "ui-review.js", "ui-me.js"]
shell = (here / "shell.html").read_text(encoding="utf-8")
js = "\n".join((here / f).read_text(encoding="utf-8") for f in FILES)
out = shell.replace("/*JS*/", js.replace("</script>", "<\\/script>"))
(here.parent / "prototype.html").write_text(out, encoding="utf-8")
print("wrote", here.parent / "prototype.html", len(out.encode()) // 1024, "KB")
