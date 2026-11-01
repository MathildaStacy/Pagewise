/** MathJax stretches delimiters inside nested SVG viewports. Android's SVG
 * renderer clips those viewports incorrectly under MathJax's inverted Y axis.
 * Flatten its equal-scale viewports, keeping their original clipping region. */
export function nativeMathSvg(svg: string): string {
  let index = 0;
  return svg.replace(
    /<svg\s+((?=[^>]*\bviewBox=")(?=[^>]*\bx=")(?=[^>]*\by=")[^>]*)>([\s\S]*?)<\/svg>/g,
    (original, attributes: string, content: string) => {
      const attrs = Object.fromEntries(
        [...attributes.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]),
      );
      const x = Number(attrs.x),
        y = Number(attrs.y),
        width = Number(attrs.width),
        height = Number(attrs.height);
      const box = attrs.viewBox
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      // This is the viewport shape emitted by MathJax's delimiter assembly;
      // leave other SVG constructs to the SVG renderer.
      if (
        box.length !== 4 ||
        ![x, y, width, height, ...box].every(Number.isFinite) ||
        width !== box[2] ||
        height !== box[3] ||
        width <= 0 ||
        height <= 0 ||
        attrs.transform ||
        attrs.preserveAspectRatio
      )
        return original;
      const id = `pw-math-viewport-${index++}`;
      return `<defs><clipPath id="${id}" clipPathUnits="userSpaceOnUse"><rect x="${x}" y="${y}" width="${width}" height="${height}"/></clipPath></defs><g clip-path="url(#${id})"><g transform="translate(${
        x - box[0]
      },${y - box[1]})">${content}</g></g>`;
    },
  );
}
