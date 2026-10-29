import type { ToolDef } from './protocol';

const object = (
  properties: Record<string, unknown>,
  required: string[],
): Record<string, unknown> => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const string = { type: 'string' };

/** 讲解模型可用工具；写操作只产生提议，确认和执行由 StudySession 处理。 */
export const TOOL_DEFS: ToolDef[] = [
  {
    name: 'load_section',
    description: '读取某小节的原文；必要时临时进入岔路，回答后回主线',
    schema: object({ id: string, part: { type: 'integer', minimum: 0 } }, [
      'id',
    ]),
  },
  {
    name: 'search_book',
    description: '搜索当前书，返回最多八个命中的内容块及位置',
    schema: object({ query: string, chapter: string }, ['query']),
  },
  {
    name: 'get_figure',
    description: '读取原书图片及说明',
    schema: object({ id: string }, ['id']),
  },
  {
    name: 'get_notes',
    description: '读取某小节的摘要、问答和卡点',
    schema: object({ section_id: string }, ['section_id']),
  },
  {
    name: 'show_quiz',
    description: '展示小测，等待用户选择后回传结果',
    schema: object(
      {
        question: string,
        options: { type: 'array', items: string, minItems: 3, maxItems: 4 },
        answer: { type: 'integer', minimum: 0, maximum: 3 },
        explain: string,
        final: { type: 'boolean' },
      },
      ['question', 'options', 'answer', 'explain'],
    ),
  },
  {
    name: 'mark_stuck',
    description: '建议将一个问题记为卡点；只有用户确认后才保存',
    schema: object({ text: string }, ['text']),
  },
  {
    name: 'advance_progress',
    description: '建议推进进度；只有用户确认后才推进',
    schema: object(
      {
        to: {
          type: 'string',
          enum: ['next_step', 'next_part', 'section_done'],
        },
        reason: string,
      },
      ['to', 'reason'],
    ),
  },
];
