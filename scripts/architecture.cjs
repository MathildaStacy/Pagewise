const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// TODO(Q-9): 页面只读取 RN 展示 API，副作用入口留在平台/应用层。
const presentationImports = [
  'View',
  'Text',
  'TextInput',
  'ScrollView',
  'FlatList',
  'SectionList',
  'VirtualizedList',
  'Pressable',
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'TouchableNativeFeedback',
  'Image',
  'ImageBackground',
  'ActivityIndicator',
  'KeyboardAvoidingView',
  'RefreshControl',
  'Modal',
  'StatusBar',
  'StyleSheet',
  'useColorScheme',
  'useWindowDimensions',
  'PixelRatio',
];

const aliases = [
  'core',
  'data',
  'services',
  'platform',
  'app',
  'features',
  'ui',
];

/** @param {string} file @param {string} specifier */
function resolveImport(file, specifier) {
  for (const alias of aliases) {
    if (specifier === `@${alias}` || specifier.startsWith(`@${alias}/`)) {
      return `src/${specifier.slice(1)}`;
    }
  }
  if (specifier.startsWith('.')) {
    return path.posix.normalize(
      path.posix.join(path.posix.dirname(file), specifier),
    );
  }
  return specifier.startsWith('src/') ? specifier : null;
}

/** @param {string} file @param {string} source */
function collectImports(file, source) {
  const ast = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  /** @type {{specifier: string | null, typeOnly: boolean, names: string[], line: number}[]} */
  const imports = [];
  const add = (node, value, typeOnly, names = ['*']) => {
    imports.push({
      specifier: value && ts.isStringLiteralLike(value) ? value.text : null,
      typeOnly,
      names,
      line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
    });
  };
  const visit = node => {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const typeOnly =
        !!clause?.isTypeOnly ||
        (!!bindings &&
          ts.isNamedImports(bindings) &&
          !clause.name &&
          bindings.elements.length > 0 &&
          bindings.elements.every(item => item.isTypeOnly));
      const names =
        bindings && ts.isNamedImports(bindings)
          ? bindings.elements
              .filter(item => !item.isTypeOnly)
              .map(item => (item.propertyName || item.name).text)
          : [];
      if (clause?.name || (bindings && ts.isNamespaceImport(bindings))) {
        names.push('*');
      }
      add(node, node.moduleSpecifier, typeOnly, names);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const clause = node.exportClause;
      const typeOnly =
        node.isTypeOnly ||
        (!!clause &&
          ts.isNamedExports(clause) &&
          clause.elements.length > 0 &&
          clause.elements.every(item => item.isTypeOnly));
      const names =
        clause && ts.isNamedExports(clause)
          ? clause.elements
              .filter(item => !item.isTypeOnly)
              .map(item => (item.propertyName || item.name).text)
          : ['*'];
      add(node, node.moduleSpecifier, typeOnly, names);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(node, node.moduleReference.expression, node.isTypeOnly);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument)
    ) {
      add(node, node.argument.literal, true);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === 'require'))
    ) {
      add(node, node.arguments[0], false);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return imports;
}

/** @param {string} file @param {string} source */
function checkSource(file, source) {
  const normalized = file.replaceAll(path.sep, '/');
  const localFile = path.isAbsolute(file)
    ? path.relative(process.cwd(), file).replaceAll(path.sep, '/')
    : normalized;
  const core = localFile.startsWith('src/core/');
  const screen = localFile.startsWith('src/ui/screens/');
  if (!core && !screen) {
    return [];
  }
  return collectImports(localFile, source).flatMap(item => {
    const target = item.specifier && resolveImport(localFile, item.specifier);
    const allowed = core
      ? target?.startsWith('src/core/')
      : target
      ? target.startsWith('src/ui/kit/') ||
        target === 'src/ui/kit' ||
        target.startsWith('src/ui/screens/') ||
        (item.typeOnly && /^src\/features\/[^/]+\/types(?:\.ts)?$/.test(target))
      : ['react', 'react/jsx-runtime'].includes(item.specifier) ||
        (item.specifier === 'react-native' &&
          (item.typeOnly ||
            (item.names.length > 0 &&
              item.names.every(name => presentationImports.includes(name)))));
    return allowed
      ? []
      : [
          `${localFile}:${item.line}: ${
            item.specifier ?? '(动态模块名)'
          } 违反 ${core ? 'core 纯函数' : '页面展示'}边界`,
        ];
  });
}

/** @param {string} directory @returns {string[]} */
function sourceFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(file)
      : /\.[jt]sx?$/.test(entry.name)
      ? [file]
      : [];
  });
}

/** @param {string[]} directories */
function checkDirectories(directories) {
  return directories
    .flatMap(sourceFiles)
    .flatMap(file => checkSource(file, fs.readFileSync(file, 'utf8')));
}

module.exports = {
  checkSource,
  checkDirectories,
  collectImports,
  presentationImports,
};
