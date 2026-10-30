import Prism from 'prismjs';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-diff';

export type SyntaxKind =
  | 'comment'
  | 'keyword'
  | 'string'
  | 'number'
  | 'function'
  | 'type';
export interface CodeSpan {
  text: string;
  kind?: SyntaxKind;
}
const languages: Record<string, [string, string]> = {
  c: ['c', 'C'],
  cpp: ['cpp', 'C++'],
  'c++': ['cpp', 'C++'],
  cc: ['cpp', 'C++'],
  cxx: ['cpp', 'C++'],
  java: ['java', 'Java'],
  go: ['go', 'Go'],
  golang: ['go', 'Go'],
  py: ['python', 'Python'],
  python: ['python', 'Python'],
  js: ['javascript', 'JavaScript'],
  javascript: ['javascript', 'JavaScript'],
  ts: ['typescript', 'TypeScript'],
  typescript: ['typescript', 'TypeScript'],
  jsx: ['jsx', 'JSX'],
  tsx: ['tsx', 'TSX'],
  json: ['json', 'JSON'],
  sh: ['bash', 'Shell'],
  shell: ['bash', 'Shell'],
  bash: ['bash', 'Bash'],
  sql: ['sql', 'SQL'],
  rs: ['rust', 'Rust'],
  rust: ['rust', 'Rust'],
  kt: ['kotlin', 'Kotlin'],
  kotlin: ['kotlin', 'Kotlin'],
  yml: ['yaml', 'YAML'],
  yaml: ['yaml', 'YAML'],
  swift: ['swift', 'Swift'],
  cs: ['csharp', 'C#'],
  csharp: ['csharp', 'C#'],
  'c#': ['csharp', 'C#'],
  html: ['markup', 'HTML'],
  xml: ['markup', 'XML'],
  css: ['css', 'CSS'],
  diff: ['diff', 'Diff'],
};
export function codeLanguage(language?: string) {
  const name = language?.replace(/^language-/, '').toLowerCase() ?? '';
  const known = languages[name];
  return { grammar: known?.[0], label: known?.[1] ?? language ?? '代码' };
}
function tokenKind(type: string): SyntaxKind | undefined {
  if (['comment', 'prolog', 'doctype'].includes(type)) return 'comment';
  if (['keyword', 'boolean', 'atrule', 'important'].includes(type))
    return 'keyword';
  if (['string', 'char', 'attr-value', 'regex'].includes(type)) return 'string';
  if (type === 'number') return 'number';
  if (['function', 'function-variable'].includes(type)) return 'function';
  if (
    [
      'class-name',
      'builtin',
      'constant',
      'tag',
      'selector',
      'annotation',
    ].includes(type)
  )
    return 'type';
  return undefined;
}
/** Native Text spans, never HTML: quotes, angle brackets, whitespace and Unicode stay intact. */
export function highlightCode(text: string, language?: string): CodeSpan[] {
  const grammar = codeLanguage(language).grammar;
  if (!grammar || !Prism.languages[grammar]) return [{ text }];
  const spans: CodeSpan[] = [];
  function walk(
    token: string | Prism.Token | (string | Prism.Token)[],
    kind?: SyntaxKind,
  ) {
    if (Array.isArray(token)) return token.forEach(part => walk(part, kind));
    if (typeof token !== 'string')
      return walk(token.content, tokenKind(token.type) ?? kind);
    const last = spans.at(-1);
    if (last && last.kind === kind) last.text += token;
    else if (token) spans.push({ text: token, ...(kind ? { kind } : {}) });
  }
  walk(Prism.tokenize(text, Prism.languages[grammar]));
  return spans;
}

/** Dedicated code ink keeps syntax readable in each of the app's light and dark skins. */
export const codeColors = {
  light: {
    bg: '#F7F8FA',
    text: '#27282E',
    comment: '#626C6C',
    keyword: '#9B3D00',
    string: '#26732D',
    number: '#1755A5',
    function: '#005BB9',
    type: '#7543A0',
  },
  dark: {
    bg: '#1E1F22',
    text: '#BCBEC4',
    comment: '#8B929E',
    keyword: '#CF8E6D',
    string: '#6AAB73',
    number: '#2AACB8',
    function: '#56A8F5',
    type: '#C7A6DE',
  },
};
