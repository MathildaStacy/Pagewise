const { presentationImports } = require('./scripts/architecture.cjs');

const sourceLayers = [
  'core',
  'data',
  'services',
  'platform',
  'app',
  'features',
  'ui/screens',
  'ui/kit',
  'ui/skins',
  'ui/navigation',
];

const allowedLayers = {
  core: ['core'],
  data: ['data', 'core'],
  services: ['services', 'core', 'platform'],
  platform: ['platform'],
  app: ['app', 'core', 'data', 'services', 'platform'],
  features: ['features', 'app', 'core', 'ui/kit', 'ui/screens'],
  'ui/screens': ['ui/screens', 'ui/kit', 'features'],
  'ui/kit': ['ui/kit', 'ui/skins'],
  'ui/skins': ['ui/kit', 'ui/skins'],
};

const zones = Object.entries(allowedLayers).map(([target, allowed]) => ({
  target: `./src/${target}`,
  from: sourceLayers
    .filter(layer => !allowed.includes(layer))
    .map(layer => `./src/${layer}`),
  message: '请遵守 docs/dev/01-architecture.md 的分层依赖方向。',
}));

const styleKeys =
  'color|.*Color|fontSize|borderRadius|borderTopLeftRadius|borderTopRightRadius|' +
  'borderBottomLeftRadius|borderBottomRightRadius|shadowRadius|shadowOpacity|elevation';

module.exports = {
  root: true,
  extends: '@react-native',
  plugins: ['import'],
  settings: {
    'import/resolver': {
      typescript: { project: './tsconfig.json' },
      node: { extensions: ['.js', '.jsx', '.ts', '.tsx', '.cjs'] },
    },
  },
  rules: {
    'import/no-restricted-paths': ['error', { basePath: __dirname, zones }],
  },
  overrides: [
    {
      files: ['**/*.cjs'],
      env: { node: true, es2022: true },
      parserOptions: { ecmaVersion: 2022 },
    },
    {
      files: ['src/core/**/*.{ts,tsx,js,jsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '*',
                  '!@core',
                  '!@core/**',
                  '!.',
                  '!./**',
                  '!..',
                  '!../**',
                ],
                message: 'core 只能依赖纯 TypeScript 的 core 模块。',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['src/ui/screens/**/*.{ts,tsx,js,jsx}'],
      rules: {
        'react-native/no-color-literals': 'error',
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '*',
                  '!react',
                  '!react/jsx-runtime',
                  '!react-native',
                  '!@ui',
                  '!@ui/kit',
                  '!@ui/kit/**',
                  '!@ui/screens',
                  '!@ui/screens/**',
                  '!@features',
                  '!@features/*',
                  '!@features/*/types',
                  '!@features/*/types.ts',
                  '!.',
                  '!./**',
                  '!..',
                  '!../**',
                ],
                message: '页面只依赖 React/RN 展示 API、kit 和 VM 类型。',
              },
            ],
          },
        ],
        'no-restricted-syntax': [
          'error',
          {
            selector:
              'ImportDeclaration[source.value="react-native"][specifiers.length=0]',
            message: '页面只导入 RN 展示 API。',
          },
          {
            selector: `ImportDeclaration[source.value="react-native"][importKind!="type"] > ImportSpecifier[importKind!="type"][imported.name=/^(?!(${presentationImports.join(
              '|',
            )})$).+/], ImportDeclaration[source.value="react-native"][importKind!="type"] > ImportDefaultSpecifier, ImportDeclaration[source.value="react-native"][importKind!="type"] > ImportNamespaceSpecifier`,
            message: 'TODO(Q-9): RN 副作用入口应由平台/应用层封装。',
          },
          {
            selector: `ExportNamedDeclaration[source.value="react-native"][exportKind!="type"] > ExportSpecifier[exportKind!="type"][local.name=/^(?!(${presentationImports.join(
              '|',
            )})$).+/], ExportAllDeclaration[source.value="react-native"][exportKind!="type"]`,
            message: '页面不能转导出 RN 副作用入口。',
          },
          {
            selector:
              'CallExpression[callee.name="require"] > Literal[value="react-native"], ImportExpression[source.value="react-native"]',
            message: '页面必须静态导入 RN 展示 API。',
          },
          {
            selector: `Property[key.name=/^(${styleKeys})$/] > Literal.value`,
            message: '字号、圆角和阴影从设计 Token 读取。',
          },
          {
            selector: `Property[key.value=/^(${styleKeys})$/] > Literal.value`,
            message: '字号、圆角和阴影从设计 Token 读取。',
          },
          {
            selector:
              'Property[key.name="shadowOffset"] > ObjectExpression.value Property > Literal.value',
            message: '阴影从设计 Token 读取。',
          },
          {
            selector:
              'ImportDeclaration[source.value=/types(?:\\.ts)?$/][importKind!="type"] > ImportSpecifier[importKind!="type"], ImportDeclaration[source.value=/types(?:\\.ts)?$/][importKind!="type"] > ImportDefaultSpecifier, ImportDeclaration[source.value=/types(?:\\.ts)?$/][importKind!="type"] > ImportNamespaceSpecifier',
            message: '页面必须用 import type 读取 VM 契约。',
          },
        ],
        // features 的唯一例外是契约文件，运行时导入由上面的 AST 选择器限制。
        'import/no-restricted-paths': [
          'error',
          {
            basePath: __dirname,
            zones: [
              ...zones,
              {
                target: './src/ui/screens',
                from: './src/features/**/*',
                except: [`${__dirname}/src/features/*/types.ts`],
                message: '页面只能导入 features/*/types.ts 的类型。',
              },
            ],
          },
        ],
      },
    },
  ],
};
