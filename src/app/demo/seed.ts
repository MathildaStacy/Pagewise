import type {
  BlockInsert,
  BlockType,
  LessonStep,
  Section,
  SectionStatus,
} from '@core/types';
import type { Db } from '@data/db';
import { createRepos, type Repos } from '@data/repos';
import type { Clock } from '../clock';
import { exploreSource, prototypeSource } from './source';

const DEMO_VERSION = 1;
const DEMO_KEY = 'demo.seed.version';
const EXAMPLE = '[示意内容] ';

type DemoBlock = Omit<BlockInsert, 'book_id'> & {
  source_id: string;
  step?: number;
};
function section(
  input: Pick<
    Section,
    'book_id' | 'id' | 'title' | 'level' | 'ord' | 'is_leaf'
  > &
    Partial<Section>,
): Section {
  return {
    parent_id: null,
    no: null,
    block_from: null,
    block_to: null,
    page_from: null,
    page_to: null,
    chars: 0,
    parts: 1,
    status: 'new',
    summary: null,
    guide: null,
    source: 'auto',
    flag: null,
    flag_detail: null,
    merged_into: null,
    ...input,
  };
}

function aimaSections(): Section[] {
  const sections: Section[] = [];
  let ord = 0;
  const summaries: Readonly<Record<string, string>> = prototypeSource.SUMMARY;
  for (const chapter of prototypeSource.CHAPTERS.slice(0, 3)) {
    const [no, title, page_from, page_to] = chapter;
    const parent = `ch${no}`;
    sections.push(
      section({
        book_id: 'aima',
        id: parent,
        no,
        title,
        level: 1,
        ord: ord++,
        is_leaf: false,
        page_from,
        page_to,
        status: no === '3' ? 'learning' : 'done',
      }),
    );
    if (no === '3') {
      for (const [id, name, from, to, children] of prototypeSource.CH3) {
        const status: SectionStatus = children.every(
          child => child[4] === 'done',
        )
          ? 'done'
          : children.some(child => child[4] === 'learning')
          ? 'learning'
          : 'new';
        sections.push(
          section({
            book_id: 'aima',
            id,
            no: id,
            title: name,
            parent_id: parent,
            level: 2,
            ord: ord++,
            is_leaf: false,
            page_from: from,
            page_to: to,
            status,
          }),
        );
        for (const [
          leafId,
          leafTitle,
          leafFrom,
          leafTo,
          leafStatus,
        ] of children) {
          sections.push(
            section({
              book_id: 'aima',
              id: leafId,
              no: leafId,
              title: leafTitle,
              parent_id: id,
              level: 3,
              ord: ord++,
              is_leaf: true,
              page_from: leafFrom,
              page_to: leafTo,
              status: leafStatus,
              summary: summaries[leafId] ?? null,
              guide: leafId === '3.5.2' ? exploreSource.GUIDE : null,
            }),
          );
        }
      }
    } else {
      // 原型未给第1、2章各节页码，这里只给 Demo 分配均匀的示意页范围。
      const children = chapter[4]!;
      children.forEach((entry, index) => {
        const matched = /^(\S+)\s+(.+)$/.exec(entry)!;
        const from =
          page_from +
          Math.floor((index * (page_to - page_from + 1)) / children.length);
        const to =
          index + 1 === children.length
            ? page_to
            : page_from +
              Math.floor(
                ((index + 1) * (page_to - page_from + 1)) / children.length,
              ) -
              1;
        sections.push(
          section({
            book_id: 'aima',
            id: matched[1],
            no: matched[1],
            title: matched[2],
            parent_id: parent,
            level: 2,
            ord: ord++,
            is_leaf: true,
            page_from: from,
            page_to: to,
            status: 'done',
            summary: summaries[matched[1]] ?? null,
          }),
        );
      });
    }
  }
  return sections;
}

function block(
  source_id: string,
  page: number,
  section_id: string,
  type: BlockType,
  text: string,
  level: number | null = null,
  step?: number,
): DemoBlock {
  const marked = EXAMPLE + text;
  const latex =
    type === 'equation'
      ? text
          .replace(/^\$+|\$+$/g, '')
          .replace(/≤/g, '\\le ')
          .replace(/≥/g, '\\ge ')
          .replace(/′/g, "'")
      : null;
  return {
    source_id,
    seq: 0,
    page,
    loc: null,
    x0: null,
    y0: null,
    x1: null,
    y1: null,
    type,
    level,
    text: marked,
    latex,
    html: null,
    image_path: null,
    section_id,
    chars: Array.from(marked).length,
    ...(step === undefined ? {} : { step }),
  };
}

function buildAima() {
  const sections = aimaSections();
  const drafts: DemoBlock[] = [];
  for (const leaf of sections.filter(value => value.is_leaf)) {
    if (leaf.id === '3.5.2') {
      for (const item of exploreSource.BLOCKS.filter(value => value.s >= 0)) {
        const type = (
          { h: 'title', p: 'text', eq: 'equation', fig: 'image' } as const
        )[item.t];
        drafts.push(
          block(
            item.id,
            item.p,
            leaf.id,
            type,
            item.x,
            type === 'title' ? leaf.level : null,
            item.s,
          ),
        );
      }
    } else {
      const existing = prototypeSource.BLOCKS.filter(
        item => item.sec === leaf.id,
      );
      for (const item of existing) {
        const type = (
          {
            title: 'title',
            text: 'text',
            eq: 'equation',
            image: 'image',
          } as const
        )[item.t];
        drafts.push(
          block(
            item.id,
            item.p,
            leaf.id,
            type,
            item.x,
            type === 'title' ? leaf.level : null,
          ),
        );
      }
      for (const item of exploreSource.BLOCKS.filter(value => value.s < 0)) {
        if ('sec' in item && item.sec === leaf.id)
          drafts.push(block(item.id, item.p, leaf.id, 'text', item.x));
      }
      if (!existing.length) {
        drafts.push(
          block(
            `${leaf.id}:title`,
            leaf.page_from!,
            leaf.id,
            'title',
            `${leaf.id}　${leaf.title}`,
            leaf.level,
          ),
        );
        drafts.push(
          block(
            `${leaf.id}:text`,
            leaf.page_from!,
            leaf.id,
            'text',
            leaf.summary ??
              `${leaf.title}的演示正文；仅用于体验地图、笔记和学习流程，不代表原书内容。`,
          ),
        );
      }
    }
  }
  const order = new Map(sections.map(value => [value.id, value.ord]));
  drafts.sort(
    (a, b) =>
      order.get(a.section_id!)! - order.get(b.section_id!)! ||
      a.page! - b.page!,
  );
  const perPage = new Map<number, number>();
  const refs: Record<string, number> = {};
  const blocks = drafts.map(item => {
    const index = perPage.get(item.page!) ?? 0;
    perPage.set(item.page!, index + 1);
    const value = { ...item, seq: item.page! * 1000 + index };
    refs[item.source_id] = value.seq;
    return value;
  });
  // 旧原型3.5.2改用新版12块，别名用于迁移示意引用；T6主讲以 explore LESSON 为准。
  const aliases: Record<string, string> = {
    b1020: 'b1',
    b1021: 'b2',
    b1022: 'b3',
    b1023: 'b4',
    b1024: 'b6',
    b1025: 'b5',
    b1026: 'b8',
    b1027: 'b10',
    b1028: 'b12',
    b1029: 'b12',
    f318: 'b6',
    f310: 'b0903',
  };
  for (const [oldId, newId] of Object.entries(aliases))
    refs[oldId] = refs[newId];
  for (const leaf of sections.filter(value => value.is_leaf)) {
    const own = blocks.filter(value => value.section_id === leaf.id);
    leaf.block_from = own[0].seq;
    leaf.block_to = own[own.length - 1].seq;
    leaf.chars = own.reduce((sum, value) => sum + value.chars, 0);
  }
  for (const parent of [...sections]
    .reverse()
    .filter(value => !value.is_leaf)) {
    const children = sections.filter(value => value.parent_id === parent.id);
    parent.block_from = children[0].block_from;
    parent.block_to = children[children.length - 1].block_to;
    parent.chars = children.reduce((sum, value) => sum + value.chars, 0);
  }
  return { sections, blocks, refs };
}

const aima = buildAima();
/** 原型/探索稿的内容块ID及自绘图ID → Demo数据库中稳定的块seq。 */
export const demoRefBySourceId: Readonly<Record<string, number>> = aima.refs;

export function remapDemoCitations(text: string): string {
  return text
    .replace(/\[\[(?:b:)?(b\d+|d\d+)\]\]/g, (original, id: string) =>
      demoRefBySourceId[id] === undefined
        ? original
        : `[[b:${demoRefBySourceId[id]}]]`,
    )
    .replace(/\{\{fig:(\w+)\}\}/g, (original, id: string) =>
      demoRefBySourceId[id] === undefined
        ? original
        : `[[fig:${demoRefBySourceId[id]}]]`,
    );
}

function offsetDay(day: string, offset: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + offset * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

async function addQuestion(
  repos: Repos,
  sectionId: string,
  question: string,
  answer: string,
  at: string,
  quote?: number,
) {
  const user = await repos.messages.append({
    book_id: 'aima',
    section_id: sectionId,
    part_no: sectionId === '3.5.2' ? 0 : null,
    step_no: sectionId === '3.5.2' ? 0 : null,
    kind: 'user',
    intent: 'ask',
    content: question,
    parts: [{ t: 'text', text: question }],
    quote_seq: quote ?? null,
    created_at: at,
  });
  const ai = await repos.messages.append({
    book_id: 'aima',
    section_id: sectionId,
    part_no: sectionId === '3.5.2' ? 0 : null,
    step_no: sectionId === '3.5.2' ? 0 : null,
    kind: 'assistant',
    intent: 'ask',
    content: remapDemoCitations(answer),
    parts: [{ t: 'text', text: remapDemoCitations(answer) }],
    allowed_refs: quote === undefined ? null : [quote],
    created_at: at,
  });
  return [user.id, ai.id];
}

/** 只在独立 Demo 容器调用；任何失败都回滚整批数据。 */
export async function seedDemo(db: Db, clock: Clock): Promise<void> {
  await db.transaction(async tx => {
    const repos = createRepos(tx, () => clock.now().toISOString());
    const version = await repos.settings.get<number | null>(DEMO_KEY, null);
    if (version === DEMO_VERSION) return;
    if ((await repos.books.list()).length > 0)
      throw new Error('已有正式书籍，不能混入演示数据');
    if (version !== null) throw new Error('不支持这个演示数据版本');
    const now = clock.now().toISOString();
    for (const [index, book] of prototypeSource.BOOKS.entries()) {
      await repos.books.insert({
        id: book.id,
        sha256: `demo:${book.id}`,
        title: book.title,
        author: book.author,
        format: book.fmt === 'PDF' ? 'pdf' : 'epub',
        pages: book.fmt === 'PDF' ? book.pages : null,
        size_bytes: Math.round(Number.parseFloat(book.size) * 1024 * 1024),
        cover_color: book.color,
        parse_model: book.fmt === 'PDF' ? 'vlm' : null,
        status: book.status,
        ready_to_page: book.id === 'aima' ? 126 : 0,
        created_at: new Date(
          clock.now().getTime() - index * 1000,
        ).toISOString(),
        last_opened_at: book.id === 'aima' ? now : null,
      });
    }
    await repos.sections.replaceAll('aima', aima.sections);
    await repos.blocks.insertMany(
      'aima',
      aima.blocks.map(({ source_id: _source, step: _step, ...value }) => value),
    );
    for (const leaf of aima.sections.filter(value => value.is_leaf)) {
      await repos.sections.setParts('aima', leaf.id, [
        {
          part_no: 0,
          block_from: leaf.block_from!,
          block_to: leaf.block_to!,
          name: leaf.title,
        },
      ]);
    }
    const steps: LessonStep[] = exploreSource.STEPS.map((value, index) => {
      const own = aima.blocks.filter(item => item.step === index);
      return {
        no: index,
        title: value.t,
        kind:
          index === 0 ? 'intuition' : index === 1 ? 'definition' : 'derivation',
        block_from: own[0].seq,
        block_to: own[own.length - 1].seq,
        status: index === 0 ? 'done' : index === 1 ? 'current' : 'todo',
      };
    });
    await repos.plans.put({
      book_id: 'aima',
      section_id: '3.5.2',
      part_no: 0,
      steps,
      source: 'fallback',
      created_at: now,
    });
    await repos.study.put({
      book_id: 'aima',
      main_section: '3.5.2',
      main_part: 0,
      main_step: 1,
      phase: 'teaching',
      detours: [],
      mode: 'listen',
      reader_view: 'flow',
      read_anchor: steps[1].block_from,
      last_active_at: new Date(
        clock.now().getTime() - 3 * 86400000,
      ).toISOString(),
    });
    for (let part = 0; part < 3; part++) {
      const from = part * 200 + 1;
      const to = Math.min((part + 1) * 200, 470);
      await repos.parts.upsert({
        book_id: 'slm',
        part_no: part + 1,
        page_from: from,
        page_to: to,
        stage: part === 0 ? 'running' : 'queued',
        total_pages: to - from + 1,
        extracted_pages: part === 0 ? 122 : 0,
        updated_at: now,
      });
    }
    const ddiaSections: Section[] = [];
    const ddiaBlocks: Omit<BlockInsert, 'book_id'>[] = [];
    for (let index = 0; index < 12; index++) {
      const id = `ch${index + 1}`;
      const title = `第 ${index + 1} 章（示意）`;
      const from = index * 2 + 1;
      const texts = [
        EXAMPLE + title,
        EXAMPLE +
          '这是用于体验 EPUB 目录和学习流程的占位正文，不代表本书的章节标题或内容。',
      ];
      texts.forEach((text, offset) =>
        ddiaBlocks.push({
          seq: from + offset,
          page: null,
          loc: `第 ${index + 1} 章 · ${offset + 1}`,
          type: offset === 0 ? 'title' : 'text',
          level: offset === 0 ? 1 : null,
          text,
          chars: Array.from(text).length,
          section_id: id,
        }),
      );
      ddiaSections.push(
        section({
          book_id: 'ddia',
          id,
          no: String(index + 1),
          title,
          level: 1,
          ord: index,
          is_leaf: true,
          block_from: from,
          block_to: from + 1,
          chars: texts.reduce((sum, text) => sum + Array.from(text).length, 0),
        }),
      );
    }
    await repos.sections.replaceAll('ddia', ddiaSections);
    await repos.blocks.insertMany('ddia', ddiaBlocks);
    for (const value of ddiaSections)
      await repos.sections.setParts('ddia', value.id, [
        {
          part_no: 0,
          block_from: value.block_from!,
          block_to: value.block_to!,
          name: value.title,
        },
      ]);
    await repos.cards.addMany(
      prototypeSource.CARDS.map(card => ({
        book_id: 'aima',
        section_id: card.sec,
        front: card.f,
        back: card.b,
        box: card.box,
        due_on: offsetDay(clock.today(), card.due),
        origin: 'section_end',
        created_at: now,
      })),
    );
    for (const value of prototypeSource.STUCK)
      await repos.notes.stuck.add({
        book_id: 'aima',
        section_id: value.sec,
        text: value.x,
        source: 'user',
        resolved_at: value.ok ? now : null,
        created_at: now,
      });
    for (const [id, entries] of Object.entries(prototypeSource.QA)) {
      for (const value of entries) {
        const message_ids = await addQuestion(repos, id, value.q, value.a, now);
        await repos.notes.qa.add({
          book_id: 'aima',
          section_id: id,
          q: value.q,
          a: value.a,
          message_ids,
          created_at: now,
        });
      }
    }
    for (const id of Object.keys(prototypeSource.HIGHLIGHTS))
      await repos.notes.highlights.toggle({
        book_id: 'aima',
        block_seq: demoRefBySourceId[id],
        created_at: now,
      });
    for (const [id, value] of Object.entries(exploreSource.PINS)) {
      const block_seq = demoRefBySourceId[id];
      const message_ids = await addQuestion(
        repos,
        '3.5.2',
        value.q,
        value.a,
        now,
        block_seq,
      );
      await repos.notes.pins.add({
        book_id: 'aima',
        section_id: '3.5.2',
        block_seq,
        question: value.q,
        answer_summary: remapDemoCitations(value.a),
        message_ids,
        created_at: now,
      });
    }
    await repos.settings.set('ai.providers', [
      {
        id: 'demo-claude',
        kind: 'anthropic',
        name: 'Claude 官方（示意）',
        protocol: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        auth: 'x-api-key',
        cache: 'auto',
        keyTail: '示意',
        models: [
          { id: 'claude-sonnet-5-5', enabled: true, price: null },
          { id: 'claude-haiku-5-5', enabled: true, price: null },
          { id: 'claude-opus-5-5', enabled: true, price: null },
        ],
      },
      {
        id: 'demo-openai',
        kind: 'custom',
        name: 'OpenAI 兼容（示意）',
        protocol: 'openai',
        baseUrl: 'https://api.example-relay.com/v1',
        auth: 'bearer',
        cache: 'auto',
        keyTail: '示意',
        models: [{ id: 'gpt-5-mini', enabled: true, price: null }],
      },
    ]);
    await repos.settings.set('ai.assign', {
      teach: { providerId: 'demo-claude', model: 'claude-sonnet-5-5' },
      tidy: { providerId: 'demo-claude', model: 'claude-haiku-5-5' },
    });
    await repos.settings.set(DEMO_KEY, DEMO_VERSION);
  });
}
