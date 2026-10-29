import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const { init } = require('mathjax') as {
  init(options: object): Promise<unknown>;
};

const root = path.resolve(__dirname, '../../..');
const asset = path.join(root, 'android/app/src/main/assets/math');
it('ships the exact offline MathJax runtime and its Apache license', () => {
  const bundled = fs.readFileSync(path.join(asset, 'tex-svg.js'));
  const installed = fs.readFileSync(require.resolve('mathjax/es5/tex-svg.js'));
  expect(bundled.equals(installed)).toBe(true);
  expect(fs.readFileSync(path.join(asset, 'version.txt'), 'utf8').trim()).toBe(
    '3.2.2',
  );
  expect(fs.readFileSync(path.join(asset, 'LICENSE'), 'utf8')).toContain(
    'Apache License',
  );
});
it('runs the HTML request protocol and rejects bad TeX using the real offline MathJax engine', async () => {
  const html = fs.readFileSync(path.join(asset, 'index.html'), 'utf8');
  expect(html).not.toMatch(/https?:\/\//);
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1];
  const messages: Record<string, unknown>[] = [],
    listeners: Record<string, (event: { data: string }) => void> = {};
  const window: {
    MathJax?: unknown;
    ReactNativeWebView: { postMessage(value: string): void };
    addEventListener(
      name: string,
      listener: (event: { data: string }) => void,
    ): void;
  } = {
    ReactNativeWebView: {
      postMessage: value =>
        messages.push(JSON.parse(value) as Record<string, unknown>),
    },
    addEventListener: (name, listener) => {
      listeners['window.' + name] = listener;
    },
  };
  const sandbox = {
    window,
    document: {
      addEventListener: (
        name: string,
        listener: (event: { data: string }) => void,
      ) => {
        listeners['document.' + name] = listener;
      },
    },
    MathJax: undefined as unknown,
  };
  vm.runInNewContext(script, sandbox);
  type Engine = {
    tex2svgPromise(tex: string, options: object): Promise<unknown>;
    startup: {
      adaptor: { outerHTML(node: unknown): string };
      defaultReady(): void;
      promise: Promise<void>;
    };
  };
  const configuration = window.MathJax as {
    tex: object;
    svg: object;
    startup: { ready(): void };
  };
  const engine = (await init({
    loader: { load: ['input/tex', 'output/svg'] },
    tex: configuration.tex,
    svg: configuration.svg,
  })) as Engine;
  sandbox.MathJax = {
    ...engine,
    tex2svgPromise: async (tex: string, options: object) => {
      const rendered = engine.startup.adaptor.outerHTML(
        await engine.tex2svgPromise(tex, options),
      );
      const svg = /<svg\b[\s\S]*<\/svg>/.exec(rendered)![0];
      return {
        querySelector: (selector: string) =>
          selector === 'svg'
            ? {
                outerHTML: svg,
                getAttribute: (name: string) =>
                  new RegExp(name + '="([^"]+)"').exec(svg)?.[1],
                style: {
                  verticalAlign: /vertical-align:\s*([^;]+);/.exec(svg)?.[1],
                },
              }
            : null,
      };
    },
    startup: { defaultReady: jest.fn(), promise: Promise.resolve() },
  };
  configuration.startup.ready();
  await new Promise(resolve => setImmediate(resolve));
  expect(messages).toContainEqual({ type: 'ready' });
  const request = { id: 'fraction', tex: '\\frac{a}{b}', display: true };
  listeners['document.message']({ data: JSON.stringify(request) });
  // Android and web message targets can both report the same request; render once.
  listeners['window.message']({ data: JSON.stringify(request) });
  listeners['window.message']({ data: 'invalid JSON' });
  listeners['window.message']({ data: JSON.stringify({ id: 3 }) });
  await new Promise(resolve => setImmediate(resolve));
  const fraction = messages.filter(message => message.id === 'fraction');
  expect(fraction).toHaveLength(1);
  expect(fraction[0]).toMatchObject({
    svg: expect.stringContaining('currentColor'),
    w: expect.any(Number),
    h: expect.any(Number),
    baseline: expect.any(Number),
  });
  listeners['window.message']({
    data: JSON.stringify({
      id: 'invalid',
      tex: '\\badcommand{1}',
      display: false,
    }),
  });
  await new Promise(resolve => setImmediate(resolve));
  expect(messages).toContainEqual({ id: 'invalid', error: 'render' });
});
