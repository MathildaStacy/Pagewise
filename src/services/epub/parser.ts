import { parseDocument, DomUtils } from 'htmlparser2';
import type { AnyNode, Element } from 'domhandler';
import type { Block, Section } from '@core/types';
import { buildSectionParts } from '@core/map';
import {
  EpubError,
  type EpubInspection,
  type EpubIo,
  type EpubManifestItem,
  type EpubParseResult,
  type EpubParser,
  type EpubTocEntry,
  type EpubWarning,
} from './types';

const name = (node: AnyNode) =>
  'name' in node ? node.name.split(':').at(-1)!.toLowerCase() : '';
const children = (node: AnyNode): AnyNode[] =>
  'children' in node ? node.children : [];
const isElement = (node: AnyNode): node is Element => 'attribs' in node;
const attr = (node: AnyNode, key: string) =>
  isElement(node)
    ? node.attribs[key] ??
      Object.entries(node.attribs).find(
        ([attributeName]) => attributeName.toLowerCase() === key.toLowerCase(),
      )?.[1] ??
      ''
    : '';
const direct = (node: AnyNode, tag: string) =>
  children(node).filter(child => name(child) === tag);
function all(node: AnyNode, tag: string): Element[] {
  return [
    ...(name(node) === tag && isElement(node) ? [node] : []),
    ...children(node).flatMap(child => all(child, tag)),
  ];
}
const plain = (node: AnyNode): string =>
  node.type === 'text' ? node.data : children(node).map(plain).join('');
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
const xml = (text: string) =>
  parseDocument(text, { xmlMode: true, decodeEntities: true });
const trimSlash = (path: string) => path.replace(/\/+$/, '');
function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new EpubError('invalid_path', 'EPUB 中包含无法读取的文件位置');
  }
}
/** Resolve archive-local links, rejecting absolute URLs and paths that leave the archive. */
export function resolveEpubPath(
  baseFile: string,
  href: string,
): { path: string; anchor: string | null } {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(href))
    throw new EpubError('invalid_path', 'EPUB 中的资源位置必须在书内');
  const hash = href.indexOf('#'),
    rawPath = (hash < 0 ? href : href.slice(0, hash)).split('?')[0],
    anchor = hash < 0 ? null : decode(href.slice(hash + 1)) || null;
  if (!rawPath) return { path: baseFile, anchor };
  const decoded = decode(rawPath);
  if (decoded.includes('\\') || decoded.startsWith('/'))
    throw new EpubError('invalid_path', 'EPUB 资源位置无效');
  const segments = baseFile.split('/').slice(0, -1);
  for (const segment of decoded.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (!segments.length)
        throw new EpubError('invalid_path', 'EPUB 资源位置超出书籍目录');
      segments.pop();
    } else segments.push(segment);
  }
  return { path: segments.join('/'), anchor };
}
function readNav(text: string, path: string): EpubTocEntry[] {
  const doc = xml(text),
    nav =
      all(doc, 'nav').find(
        node =>
          `${attr(node, 'epub:type')} ${attr(node, 'type')}`
            .split(/\s+/)
            .includes('toc') || attr(node, 'role') === 'doc-toc',
      ) ?? all(doc, 'nav')[0];
  if (!nav) return [];
  function list(node: AnyNode, level: number): EpubTocEntry[] {
    return direct(node, 'li').flatMap(li => {
      const label = children(li).find(child =>
          ['a', 'span'].includes(name(child)),
        ),
        nested = direct(li, 'ol').flatMap(ol => list(ol, level + 1));
      if (!label) return nested;
      const title = normalize(plain(label));
      if (!title) return nested;
      let link: { path: string; anchor: string | null } | null = null;
      const href = attr(label, 'href');
      if (href) {
        try {
          link = resolveEpubPath(path, href);
        } catch {
          return nested;
        }
      }
      return [
        {
          title,
          path: link?.path ?? null,
          anchor: link?.anchor ?? null,
          level,
          children: nested,
        },
      ];
    });
  }
  const lists = direct(nav, 'ol');
  return (lists.length ? lists : all(nav, 'ol').slice(0, 1)).flatMap(ol =>
    list(ol, 1),
  );
}
function readNcx(text: string, path: string): EpubTocEntry[] {
  const doc = xml(text),
    map = all(doc, 'navmap')[0];
  if (!map) return [];
  function points(node: AnyNode, level: number): EpubTocEntry[] {
    return direct(node, 'navpoint').flatMap(point => {
      const title = normalize(plain(direct(point, 'navlabel')[0] ?? point)),
        href = attr(direct(point, 'content')[0] ?? point, 'src'),
        nested = points(point, level + 1);
      if (!href || !title) return nested;
      try {
        const link = resolveEpubPath(path, href);
        return [{ title, ...link, level, children: nested }];
      } catch {
        return nested;
      }
    });
  }
  return points(map, 1);
}
const flattened = (toc: readonly EpubTocEntry[]): EpubTocEntry[] =>
  toc.flatMap(entry => [entry, ...flattened(entry.children)]);
function titleId(
  title: string,
  fallback: number,
  level: number,
): { id: string; no: string | null } {
  const chapter = /^(?:Chapter\s+|第\s*)(\d+)(?:\s*章|\s+)/i.exec(title);
  if (chapter) return { id: `ch${Number(chapter[1])}`, no: chapter[1] };
  const appendix = /^(?:Appendix|附录)\s*([A-Z])/i.exec(title);
  if (appendix)
    return {
      id: `app${appendix[1].toUpperCase()}`,
      no: appendix[1].toUpperCase(),
    };
  const numbered = /^(\d+(?:\.\d+)*)(?!\d)(?:\s+|[.:：]\s*)/.exec(title);
  if (numbered)
    return {
      id:
        level === 1 && !numbered[1].includes('.')
          ? `ch${numbered[1]}`
          : numbered[1],
      no: numbered[1],
    };
  return { id: `u${fallback}`, no: null };
}
function sectionsFromToc(
  bookId: string,
  toc: readonly EpubTocEntry[],
  blocks: Block[],
  anchors: Map<string, number>,
  warnings: EpubWarning[],
): Section[] {
  const entries = flattened(toc),
    position = (entry: EpubTocEntry): number | null =>
      entry.path
        ? anchors.get(`${entry.path}#${entry.anchor ?? ''}`) ??
          anchors.get(`${entry.path}#`) ??
          null
        : entry.children.map(position).find(seq => seq !== null) ?? null;
  const ready = entries
    .map((entry, index) => ({ entry, index, start: position(entry) }))
    .filter(
      (item): item is typeof item & { start: number } => item.start !== null,
    )
    .sort((a, b) => a.start - b.start || a.index - b.index);
  if (ready.length && blocks[0] && ready[0].start > blocks[0].seq)
    ready.unshift({
      entry: {
        title: '书前内容',
        path: null,
        anchor: null,
        level: 1,
        children: [],
      },
      index: -1,
      start: blocks[0].seq,
    });
  const stack: Section[] = [],
    used = new Set<string>();
  const sections = ready.map(({ entry, start, index }, ord): Section => {
    const level = Math.max(1, Math.min(3, entry.level)) as 1 | 2 | 3;
    while (stack.length && stack.at(-1)!.level >= level) stack.pop();
    const { id: base, no } = titleId(entry.title, start, level),
      id = used.has(base) ? `${base}_toc${index + 1}` : base;
    used.add(id);
    const next = ready
        .slice(ord + 1)
        .find(item => Math.min(3, item.entry.level) <= level),
      own = blocks.filter(
        block => block.seq >= start && (!next || block.seq < next.start),
      );
    const missing =
      !!entry.path &&
      entry.anchor !== null &&
      !anchors.has(`${entry.path}#${entry.anchor}`);
    if (missing)
      warnings.push({
        code: 'missing_toc_anchor',
        path: `${entry.path}#${entry.anchor}`,
      });
    const section: Section = {
      book_id: bookId,
      id,
      no,
      title: entry.title,
      parent_id: stack.at(-1)?.id ?? null,
      level,
      ord,
      is_leaf: true,
      block_from: own[0]?.seq ?? start,
      block_to: own.at(-1)?.seq ?? start,
      page_from: null,
      page_to: null,
      chars: own.reduce((sum, block) => sum + block.chars, 0),
      parts: 1,
      status: 'new',
      summary: null,
      guide: null,
      source: 'bookmark',
      flag: missing ? 'missing' : null,
      flag_detail: missing ? { anchor: entry.anchor, path: entry.path } : null,
      merged_into: null,
    };
    stack.push(section);
    return section;
  });
  for (const section of sections)
    section.is_leaf = !sections.some(child => child.parent_id === section.id);
  for (const section of sections) {
    const child = sections.find(item => item.parent_id === section.id);
    if (
      child &&
      section.block_from !== null &&
      child.block_from !== null &&
      section.block_from < child.block_from
    ) {
      child.block_from = section.block_from;
      child.chars = blocks
        .filter(
          block =>
            block.seq >= child.block_from! && block.seq <= child.block_to!,
        )
        .reduce((sum, block) => sum + block.chars, 0);
    }
  }
  for (const block of blocks) {
    const candidates = sections
      .filter(
        section =>
          section.block_from !== null &&
          section.block_to !== null &&
          block.seq >= section.block_from &&
          block.seq <= section.block_to,
      )
      .sort((a, b) => b.level - a.level || b.ord - a.ord);
    block.section_id = candidates[0]?.id ?? null;
  }
  const counts = new Map<string, number>();
  for (const block of blocks) {
    const section = sections.find(item => item.id === block.section_id),
      key = section?.id ?? 'body',
      count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    block.loc = `${section?.title ?? '正文'} · ${count}`;
  }
  return sections;
}

export function createEpubParser(io: EpubIo): EpubParser {
  const inspections = new Map<string, Promise<EpubInspection>>();
  async function inspect(
    source: string,
    destination: string,
  ): Promise<EpubInspection> {
    const key = JSON.stringify([source, destination]);
    const existing = inspections.get(key);
    if (existing) return existing;
    const work = (async () => {
      const rootPath = `${trimSlash(destination)}/epub`;
      await io.unzip(source, rootPath);
      let container: ReturnType<typeof xml>;
      try {
        container = xml(
          await io.readText(`${rootPath}/META-INF/container.xml`),
        );
      } catch {
        throw new EpubError(
          'invalid_archive',
          'EPUB 缺少 META-INF/container.xml',
        );
      }
      const rootfile =
          all(container, 'rootfile').find(
            node =>
              attr(node, 'media-type') === 'application/oebps-package+xml',
          ) ?? all(container, 'rootfile')[0],
        href = rootfile ? attr(rootfile, 'full-path') : '';
      if (!href)
        throw new EpubError('invalid_archive', 'EPUB 没有声明内容清单');
      const opfPath = resolveEpubPath('', href).path;
      const doc = xml(await io.readText(`${rootPath}/${opfPath}`)),
        pkg = all(doc, 'package')[0];
      if (!pkg) throw new EpubError('invalid_metadata', 'EPUB 内容清单无效');
      const metadata = direct(pkg, 'metadata')[0],
        manifestNode = direct(pkg, 'manifest')[0],
        spineNode = direct(pkg, 'spine')[0];
      if (!manifestNode || !spineNode)
        throw new EpubError('invalid_metadata', 'EPUB 缺少 manifest 或 spine');
      const manifest: EpubManifestItem[] = direct(manifestNode, 'item').map(
        item => ({
          id: attr(item, 'id'),
          path: resolveEpubPath(opfPath, attr(item, 'href')).path,
          mediaType: attr(item, 'media-type'),
          properties: attr(item, 'properties').split(/\s+/).filter(Boolean),
        }),
      );
      const spine = direct(spineNode, 'itemref').map(item => ({
        idref: attr(item, 'idref'),
        linear: attr(item, 'linear') !== 'no',
      }));
      if (!spine.length)
        throw new EpubError('invalid_metadata', 'EPUB 没有可读的正文顺序');
      let toc: EpubTocEntry[] = [];
      const nav = manifest.find(item => item.properties.includes('nav'));
      if (nav)
        toc = readNav(await io.readText(`${rootPath}/${nav.path}`), nav.path);
      if (!toc.length) {
        const ncx =
          manifest.find(item => item.id === attr(spineNode, 'toc')) ??
          manifest.find(item => item.mediaType === 'application/x-dtbncx+xml');
        if (ncx)
          toc = readNcx(await io.readText(`${rootPath}/${ncx.path}`), ncx.path);
      }
      const coverId = metadata
          ? all(metadata, 'meta').find(node => attr(node, 'name') === 'cover')
          : null,
        cover =
          manifest.find(item => item.properties.includes('cover-image')) ??
          manifest.find(
            item => item.id === (coverId ? attr(coverId, 'content') : ''),
          );
      const value = (tag: string) =>
        metadata
          ? normalize(
              all(metadata, tag)
                .map(plain)
                .join(tag === 'creator' ? '、' : ' '),
            )
          : '';
      return {
        title:
          value('title') ||
          (source.split('/').at(-1) ?? 'EPUB').replace(/\.epub$/i, ''),
        author: value('creator'),
        language: value('language'),
        identifier: value('identifier'),
        rootPath,
        opfPath,
        manifest,
        spine,
        toc,
        coverPath: cover ? `${rootPath}/${cover.path}` : null,
      };
    })();
    inspections.set(key, work);
    try {
      return await work;
    } catch (error) {
      inspections.delete(key);
      throw error;
    }
  }
  async function parse(
    source: string,
    destination: string,
    bookId: string,
  ): Promise<EpubParseResult> {
    const info = await inspect(source, destination),
      blocks: Block[] = [],
      warnings: EpubWarning[] = [],
      anchors = new Map<string, number>(),
      files: { path: string; title: string }[] = [],
      assets = new Map<string, string>();
    const imagesPath = `${trimSlash(destination)}/images`;
    let imagesReady = false;
    for (const spine of info.spine) {
      const item = info.manifest.find(value => value.id === spine.idref);
      if (!item)
        throw new EpubError('unreadable_spine', 'EPUB 正文引用的文件不存在');
      if (
        !/^(?:application\/xhtml\+xml|text\/html)$/.test(item.mediaType) &&
        !/[.]x?html?$/i.test(item.path)
      ) {
        warnings.push({ code: 'unsupported_resource', path: item.path });
        continue;
      }
      let content: string;
      try {
        content = await io.readText(`${info.rootPath}/${item.path}`);
      } catch {
        throw new EpubError('unreadable_spine', 'EPUB 正文文件无法读取');
      }
      const doc = xml(content),
        body = all(doc, 'body')[0] ?? doc,
        pending = new Set<string>(),
        start = blocks.length;
      files.push({
        path: item.path,
        title:
          normalize(
            plain(all(doc, 'h1')[0] ?? all(doc, 'title')[0] ?? body),
          ).slice(0, 80) || item.path.split('/').at(-1)!,
      });
      const nodeIds = (node: AnyNode) => {
        for (const key of ['id', 'xml:id', 'name']) {
          const value = attr(node, key);
          if (value) pending.add(value);
        }
      };
      const allIds = (node: AnyNode) => {
        nodeIds(node);
        children(node).forEach(allIds);
      };
      const emit = (
        node: AnyNode,
        type: Block['type'],
        text: string,
        extra: Partial<Block> = {},
        captureIds = true,
      ) => {
        if (captureIds) allIds(node);
        if (!text.trim() && type !== 'image' && type !== 'equation') return;
        const seq = blocks.length + 1;
        for (const id of pending) anchors.set(`${item.path}#${id}`, seq);
        pending.clear();
        if (!anchors.has(`${item.path}#`)) anchors.set(`${item.path}#`, seq);
        blocks.push({
          id: seq,
          book_id: bookId,
          seq,
          page: null,
          loc: null,
          x0: null,
          y0: null,
          x1: null,
          y1: null,
          type,
          level: null,
          text,
          latex: null,
          html: null,
          image_path: null,
          section_id: null,
          chars: Array.from(text).length,
          ...extra,
        });
      };
      const mathText = (node: AnyNode) =>
        attr(node, 'alttext') ||
        attr(node, 'data-tex') ||
        all(node, 'annotation')
          .filter(value => /tex/i.test(attr(value, 'encoding')))
          .map(plain)
          .join('') ||
        normalize(plain(node));
      const inline = (node: AnyNode): string => {
        if (node.type === 'text') return node.data;
        if (['script', 'style'].includes(name(node))) return '';
        if (name(node) === 'br') return '\n';
        if (name(node) === 'img') return attr(node, 'alt');
        if (name(node) === 'math') return `$${mathText(node)}$`;
        const text = children(node).map(inline).join('');
        return ['strong', 'b'].includes(name(node)) && text.trim()
          ? `**${text}**`
          : text;
      };
      const listText = (node: AnyNode, depth = 0): string =>
        direct(node, 'li')
          .map((li, index) => {
            const nested = children(li).filter(child =>
                ['ul', 'ol'].includes(name(child)),
              ),
              text = normalize(
                children(li)
                  .filter(child => !nested.includes(child))
                  .map(inline)
                  .join(''),
              );
            return `${'  '.repeat(depth)}${
              name(node) === 'ol' ? `${index + 1}.` : '-'
            } ${text}${
              nested.length
                ? '\n' +
                  nested.map(child => listText(child, depth + 1)).join('\n')
                : ''
            }`;
          })
          .join('\n');
      async function image(node: AnyNode) {
        const src =
          attr(node, 'src') || attr(node, 'xlink:href') || attr(node, 'href');
        let imagePath: string | null = null;
        if (src) {
          try {
            const local = resolveEpubPath(item!.path, src).path;
            imagePath = assets.get(local) ?? null;
            if (!imagePath) {
              if (!imagesReady) {
                await io.mkdir(imagesPath);
                imagesReady = true;
              }
              const ext = /\.([a-z0-9]{1,8})$/i.exec(local)?.[1] ?? 'img';
              const target = `${imagesPath}/image${assets.size + 1}.${ext}`;
              await io.copyFile(`${info.rootPath}/${local}`, target);
              assets.set(local, target);
              imagePath = target;
            }
          } catch {
            warnings.push({ code: 'missing_image', path: src });
          }
        }
        emit(node, 'image', attr(node, 'alt'), { image_path: imagePath });
      }
      async function walk(node: AnyNode): Promise<void> {
        const tag = name(node);
        if (['script', 'style', 'head', 'nav'].includes(tag)) return;
        nodeIds(node);
        if (/^h[1-6]$/.test(tag)) {
          emit(node, 'title', normalize(inline(node)), {
            level: Number(tag.slice(1)),
          });
          return;
        }
        if (tag === 'img' || tag === 'image') {
          await image(node);
          return;
        }
        if (tag === 'math') {
          emit(node, 'equation', mathText(node), { latex: mathText(node) });
          return;
        }
        if (tag === 'pre') {
          emit(node, 'code', plain(node).replace(/^\n|\n$/g, ''));
          return;
        }
        if (tag === 'ul' || tag === 'ol') {
          emit(node, 'list', listText(node));
          return;
        }
        if (tag === 'table') {
          const text = all(node, 'tr')
            .map(row =>
              children(row)
                .filter(cell => ['td', 'th'].includes(name(cell)))
                .map(cell => normalize(inline(cell)))
                .join('\t'),
            )
            .join('\n');
          emit(node, 'table', text || normalize(inline(node)), {
            html: DomUtils.getOuterHTML(node),
          });
          return;
        }
        if (tag === 'p' || tag === 'figcaption' || tag === 'caption') {
          const inlineChildren = children(node),
            math = inlineChildren.filter(child => name(child) === 'math');
          if (
            math.length === 1 &&
            inlineChildren.every(
              child => child === math[0] || !plain(child).trim(),
            )
          ) {
            emit(node, 'equation', mathText(math[0]), {
              latex: mathText(math[0]),
            });
            return;
          }
          const images = [...all(node, 'img'), ...all(node, 'image')];
          if (images.length) {
            let text = '';
            const flush = () => {
              if (text.trim()) emit(node, 'text', normalize(text), {}, false);
              text = '';
            };
            const visit = async (child: AnyNode): Promise<void> => {
              if (['img', 'image'].includes(name(child))) {
                flush();
                await image(child);
                return;
              }
              nodeIds(child);
              if (all(child, 'img').length || all(child, 'image').length) {
                for (const nested of children(child)) await visit(nested);
              } else text += inline(child);
            };
            for (const child of inlineChildren) await visit(child);
            flush();
            return;
          }
          emit(node, tag === 'p' ? 'text' : 'caption', normalize(inline(node)));
          return;
        }
        if (node.type === 'text') {
          const text = normalize(node.data);
          if (text) emit(node, 'text', text);
          return;
        }
        for (const child of children(node)) await walk(child);
      }
      await walk(body);
      if (blocks.length === start)
        warnings.push({ code: 'empty_spine_item', path: item.path });
      for (const id of pending)
        if (blocks.length > start)
          anchors.set(`${item.path}#${id}`, blocks.at(-1)!.seq);
    }
    if (!blocks.length)
      throw new EpubError('unreadable_spine', 'EPUB 没有可读取的正文');
    const toc = info.toc.length
      ? info.toc
      : files.map(file => ({
          title: file.title,
          path: file.path,
          anchor: null,
          level: 1,
          children: [],
        }));
    let sections = sectionsFromToc(bookId, toc, blocks, anchors, warnings);
    if (!sections.length)
      sections = sectionsFromToc(
        bookId,
        files.map(file => ({
          title: file.title,
          path: file.path,
          anchor: null,
          level: 1,
          children: [],
        })),
        blocks,
        anchors,
        warnings,
      );
    const parts = sections
      .filter(section => section.is_leaf)
      .flatMap(section => buildSectionParts(section, blocks));
    for (const section of sections)
      section.parts = parts.filter(
        part => part.section_id === section.id,
      ).length;
    return {
      title: info.title,
      author: info.author,
      language: info.language,
      identifier: info.identifier,
      blocks: blocks.map(({ id: _id, ...block }) => block),
      sections,
      parts,
      toc,
      warnings,
    };
  }
  return { inspect, parse };
}
