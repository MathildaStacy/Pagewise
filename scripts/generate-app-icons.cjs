/* Original Pagewise mark. Run npm run android:icons after changing the artwork. */
const fs = require('node:fs');
const path = require('node:path');
const { Resvg } = require('@resvg/resvg-js');

const root = path.resolve(__dirname, '..');
const res = 'android/app/src/main/res';
const brand = 'docs/design/brand';
const ink = '#24467F';
const paper = '#FBF8F1';
const bookmark = '#E7B66B';

// 108dp adaptive canvas; all artwork fits inside the central 66dp safe circle.
const pages = [
  'M29 36C37 33 45 34 52 39V73C45 68 37 67 29 69Z',
  'M56 39C59.5 36.8 63.4 35.2 67 34.7V51L70 48L73 51V34.8C75.2 34.9 77.2 35.3 79 36V69C71 67 63 68 56 73Z',
];
const ribbon = 'M67 34.7C69 34.4 71 34.4 73 34.8V51L70 48L67 51Z';
const shapes = [
  ...pages.map(d => ({ d, fill: paper })),
  { d: ribbon, fill: bookmark },
];
const svgPaths = shapes
  .map(({ d, fill }) => `  <path fill="${fill}" d="${d}"/>`)
  .join('\n');
const header = '<?xml version="1.0" encoding="utf-8"?>\n';

function write(file, content) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function svg(background) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="18 18 72 72">
  <title>Pagewise — open pages and a bookmark</title>
${background}
${svgPaths}
</svg>\n`;
}

function png(source, size) {
  return new Resvg(source, { fitTo: { mode: 'width', value: size } })
    .render()
    .asPng();
}

function vector(paths) {
  return `${header}<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp"
    android:viewportWidth="108" android:viewportHeight="108">
${paths
  .map(
    ({ d, fill }) =>
      `    <path android:fillColor="${fill}" android:pathData="${d}"/>`,
  )
  .join('\n')}
</vector>\n`;
}

const square = svg(`<rect x="18" y="18" width="72" height="72" fill="${ink}"/>`);
const legacy = svg(
  `<rect x="18" y="18" width="72" height="72" rx="16" fill="${ink}"/>`,
);
const round = svg(`<circle cx="54" cy="54" r="36" fill="${ink}"/>`);

write(`${brand}/pagewise-icon.svg`, square);
write(`${brand}/pagewise-icon.png`, png(square, 512));
write(`${res}/drawable/ic_launcher_foreground.xml`, vector(shapes));
write(
  `${res}/drawable/ic_launcher_monochrome.xml`,
  vector(pages.map(d => ({ d, fill: '#000000' }))),
);
write(
  `${res}/values/ic_launcher_background.xml`,
  `${header}<resources>\n    <color name="ic_launcher_background">${ink}</color>\n</resources>\n`,
);

for (const [density, size] of Object.entries({
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
})) {
  write(`${res}/mipmap-${density}/ic_launcher.png`, png(legacy, size));
  write(`${res}/mipmap-${density}/ic_launcher_round.png`, png(round, size));
}

for (const api of [26, 33]) {
  const adaptive = `${header}<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
${api >= 33 ? '    <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>\n' : ''}</adaptive-icon>\n`;
  for (const name of ['ic_launcher', 'ic_launcher_round']) {
    write(`${res}/mipmap-anydpi-v${api}/${name}.xml`, adaptive);
  }
}

console.log('Generated Pagewise brand artwork, legacy, adaptive and themed icons.');
