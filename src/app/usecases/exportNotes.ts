import type { Card, Section } from '@core/types';
import { pageLabel } from '@core/ids';
import { truncateText } from '@core/text';
import type { Container } from '../container';
import { loadBookNotes, type BookNotesData } from './notes';
import { storageRuntime } from './storage';
export interface ExportFile {
  path: string;
  content: string;
}
export const exportFileName = (value: string) =>
  Array.from(value)
    .filter(char => (char.codePointAt(0) ?? 0) >= 32)
    .join('')
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/^\.+|\.+$/g, '')
    .trim()
    .slice(0, 100) || '未命名';
function chapterPath(sections: Section[], section: Section): string {
  let current = section;
  const seen = new Set<string>();
  while (current.parent_id && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = sections.find(item => item.id === current.parent_id);
    if (!parent) break;
    current = parent;
  }
  if (current.level !== 1 || current.id === section.id) return '未分章';
  const title = exportFileName(current.title),
    no = current.no?.trim();
  return no ? `第${no.padStart(2, '0')}章-${title}` : title;
}
const trimSource = (text: string, strip: boolean) =>
  strip ? truncateText(text, 30) : text;
const cleanAnswer = (text: string, strip: boolean) =>
  strip ? text.replace(/\[\[(?:q|fig):\d+\]\]/g, '（原文引用已省略）') : text;
export function markdownNotes(data: BookNotesData, strip = true): ExportFile[] {
  const book = data.book;
  if (!book) throw new Error('书籍不存在');
  const files: ExportFile[] = [],
    links: string[] = [];
  for (const section of data.sections) {
    const qa = data.qa.filter(item => item.section_id === section.id),
      stuck = data.stuck.filter(item => item.section_id === section.id),
      notes =
        data.userNotes.find(item => item.section_id === section.id)
          ?.user_text ?? '',
      highlights = data.highlights.filter(item =>
        data.blocks.some(
          block =>
            block.seq === item.block_seq && block.section_id === section.id,
        ),
      ),
      pins = data.pins.filter(item => item.section_id === section.id);
    if (
      !section.summary &&
      !qa.length &&
      !stuck.length &&
      !notes &&
      !highlights.length &&
      !pins.length
    )
      continue;
    const title = `${section.no ?? section.id} ${section.title}`.trim(),
      file = `课程讲义/${chapterPath(data.sections, section)}/${exportFileName(
        `${section.no ?? section.id}-${section.title}`,
      )}.md`,
      lines = [`# ${title}`, '', `来源：${book.title}`, ''];
    if (section.summary) lines.push('## 小结', '', section.summary, '');
    if (qa.length) {
      lines.push('## 问答', '');
      for (const item of qa)
        lines.push(
          `### ${item.q}`,
          '',
          ...(item.from_section
            ? [`> 学 ${item.from_section} 时回来问的`, '']
            : []),
          cleanAnswer(item.a, strip),
          '',
        );
    }
    if (stuck.length)
      lines.push(
        '## 卡点',
        '',
        ...stuck.map(
          item => `- [${item.resolved_at ? 'x' : ' '}] ${item.text}`,
        ),
        '',
      );
    if (highlights.length) {
      lines.push('## 高亮', '');
      for (const item of highlights) {
        const block = data.blocks.find(value => value.seq === item.block_seq)!;
        lines.push(
          `> ${trimSource(block.text, strip).replace(/\n/g, '\n> ')}`,
          '',
          `${pageLabel(book, block.page, block.loc)} · b${block.seq}${
            item.note ? ` · ${item.note}` : ''
          }`,
          '',
        );
      }
    }
    if (pins.length)
      lines.push(
        '## 问答便签',
        '',
        ...pins.map(
          pin =>
            `- ${pin.question}：${pin.answer_summary}（b${pin.block_seq}）`,
        ),
        '',
      );
    if (notes) lines.push('## 我的笔记', '', notes, '');
    files.push({ path: file, content: lines.join('\n') });
    links.push(`- [${title}](${encodeURI(file)})`);
  }
  files.unshift({
    path: 'README.md',
    content: [
      `# ${book.title} · 学习笔记`,
      '',
      book.author ? `作者：${book.author}` : '',
      strip ? '已省略大段原文，高亮仅保留前 30 字。' : '包含所选原文高亮。',
      '',
      ...links,
      '',
    ]
      .filter((line, index) => line !== '' || index > 0)
      .join('\n'),
  });
  return files;
}
const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
export function ankiCsv(title: string, cards: readonly Card[]): string {
  const tag = (text: string) =>
    text.replace(/\s+/g, '_').replace(/[":,;]/g, '_');
  return (
    [
      '#separator:comma',
      '#html:true',
      '#tags column:3',
      ...cards.map(card =>
        [card.front, card.back, `${tag(title)}::${tag(card.section_id)}`]
          .map(value =>
            csvCell(
              value
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\r?\n/g, '<br>'),
            ),
          )
          .join(','),
      ),
    ].join('\r\n') + '\r\n'
  );
}
let exportSerial = 0;
export async function exportNotes(
  c: Container,
  bookId: string,
  format: 'md' | 'anki',
  strip = true,
  destination: 'downloads' | 'share' = 'downloads',
): Promise<string> {
  const io = storageRuntime(c),
    data = await loadBookNotes(c, bookId);
  if (!data.book) throw new Error('书籍不存在');
  const root = `${io.cacheDir}/notes-export-${++exportSerial}`,
    title = exportFileName(data.book.title),
    name = format === 'md' ? `${title}-笔记.zip` : `${title}-闪卡.csv`,
    file = `${root}/${name}`;
  await io.mkdir(root);
  try {
    if (format === 'anki') {
      const cards = await c.db.all<Card>(
        'SELECT * FROM card WHERE book_id=? ORDER BY section_id,id',
        [bookId],
      );
      await io.writeText(file, ankiCsv(data.book.title, cards));
    } else {
      const directory = `${root}/${title}`;
      await io.mkdir(directory);
      for (const item of markdownNotes(data, strip)) {
        const target = `${directory}/${item.path}`;
        await io.mkdir(target.split('/').slice(0, -1).join('/'));
        await io.writeText(target, item.content);
      }
      await io.zip(directory, file);
    }
    const mime = format === 'md' ? 'application/zip' : 'text/csv';
    if (destination === 'share') {
      await io.share(file, mime);
      return file;
    }
    return await io.saveDownloads(file, name, mime);
  } finally {
    if (destination === 'downloads') await io.remove(root);
  }
}
