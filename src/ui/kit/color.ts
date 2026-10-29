export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Tokens use CSS hex or rgb(a); reject unsupported values instead of guessing. */
export function parseColor(value: string): RgbaColor {
  const color = value.trim();
  if (color === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  const hex = /^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.exec(color);
  if (hex) {
    const full =
      hex[1].length <= 4
        ? hex[1]
            .split('')
            .map(digit => digit + digit)
            .join('')
        : hex[1];
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1,
    };
  }
  const rgb =
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d*\.?\d+))?\s*\)$/i.exec(
      color,
    );
  if (rgb) {
    const channels = rgb.slice(1, 4).map(Number);
    const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]);
    if (channels.every(channel => channel <= 255) && alpha <= 1) {
      return { r: channels[0], g: channels[1], b: channels[2], a: alpha };
    }
  }
  throw new Error(`不支持的颜色：${value}`);
}

/** Scale a token colour's alpha, e.g. for fading text in. */
export function withAlpha(value: string, alpha: number): string {
  const { r, g, b, a } = parseColor(value);
  return `rgba(${r}, ${g}, ${b}, ${+(a * alpha).toFixed(3)})`;
}

/** Porter–Duff source-over in sRGB, before computing WCAG relative luminance. */
export function compositeColor(
  foreground: RgbaColor,
  background: RgbaColor,
): RgbaColor {
  const alpha = foreground.a + background.a * (1 - foreground.a);
  if (alpha === 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  const channel = (fg: number, bg: number) =>
    (fg * foreground.a + bg * background.a * (1 - foreground.a)) / alpha;
  return {
    r: channel(foreground.r, background.r),
    g: channel(foreground.g, background.g),
    b: channel(foreground.b, background.b),
    a: alpha,
  };
}

function luminance(color: RgbaColor): number {
  const linear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return (
    linear(color.r) * 0.2126 +
    linear(color.g) * 0.7152 +
    linear(color.b) * 0.0722
  );
}

/** Compose both translucent colors onto the actual canvas before measuring. */
export function contrastRatio(
  foreground: string,
  background: string,
  canvas = '#FFFFFF',
): number {
  const opaqueCanvas = compositeColor(
    parseColor(canvas),
    parseColor('#FFFFFF'),
  );
  const renderedBackground = compositeColor(
    parseColor(background),
    opaqueCanvas,
  );
  const renderedForeground = compositeColor(
    parseColor(foreground),
    renderedBackground,
  );
  const light = Math.max(
    luminance(renderedForeground),
    luminance(renderedBackground),
  );
  const dark = Math.min(
    luminance(renderedForeground),
    luminance(renderedBackground),
  );
  return (light + 0.05) / (dark + 0.05);
}
