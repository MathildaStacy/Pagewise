"""把苹果风原型源文件拼成单文件 docs/design/prototype-apple.html。用法：python3 build.py"""
import pathlib
here = pathlib.Path(__file__).resolve().parent
CSS = ["base.css", "pages.css"]
JS = ["icons.js", "data.js", "core.js", "ui-base.js", "ui-shelf.js", "ui-map.js", "ui-listen.js", "ui-study.js", "ui-reader.js", "ui-done.js", "ui-review.js", "ui-me.js", "ui-console.js"]
shell = (here / "shell.html").read_text(encoding="utf-8")
css = "\n".join((here / f).read_text(encoding="utf-8") for f in CSS)
js = "\n".join((here / f).read_text(encoding="utf-8") for f in JS)
out = shell.replace("/*CSS*/", css).replace("/*JS*/", js.replace("</script>", "<\\/script>"))
(here.parent / "prototype-apple.html").write_text(out, encoding="utf-8")
print("wrote", here.parent / "prototype-apple.html", len(out.encode()) // 1024, "KB")
