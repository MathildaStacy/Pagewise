import type { Card, Section } from '@core/types';
import { BOX_DAYS, nextReview } from '@core/review';
import type { ReviewData } from '@app/usecases/review';
import type { ReviewState, ReviewSessionState } from './types';

export function sectionLabel(
  sections: Section[],
  bookId: string,
  id: string,
): string {
  const s = sections.find(item => item.book_id === bookId && item.id === id);
  return s ? `${s.no ?? ''} ${s.title}`.trim() : id;
}
export function presentReview(data: ReviewData): ReviewState {
  const due = Math.min(data.stats.due, data.limit);
  const max = Math.max(1, ...data.stats.boxes);
  return {
    hero: {
      due,
      stuck: data.stuck.filter(s => !s.resolved_at).length,
      total: data.stats.total,
    },
    boxes: data.stats.boxes.map((count, index) => ({
      label: `盒 ${index + 1} · ${BOX_DAYS[index]} 天`,
      count,
      ratio: count / max,
    })),
    start: {
      enabled: due > 0,
      label: due ? `开始复习 ${due} 张` : '今天没有要复习的卡片',
    },
    quickStart: {
      enabled: due > 0,
      label: `先复习 ${Math.min(5, due || 5)} 张`,
    },
    stuckList: data.stuck.map(s => ({
      id: String(s.id),
      text: s.text,
      where:
        sectionLabel(data.sections, s.book_id, s.section_id) +
        (s.source === 'card' ? ' · 复习时答错' : ''),
      resolved: !!s.resolved_at,
    })),
    loading: false,
  };
}
export function presentReviewCard(
  card: Card,
  sections: Section[],
  flipped: boolean,
  index: number,
  total: number,
  today: string,
): ReviewSessionState {
  const section = sections.find(
    s => s.book_id === card.book_id && s.id === card.section_id,
  );
  return {
    title: `复习 ${index + 1}/${total}`,
    card: {
      source: sectionLabel(sections, card.book_id, card.section_id),
      box: `盒 ${card.box}`,
      front: card.front,
      back: flipped ? card.back : undefined,
      flipped,
      tip: '先在心里回答，再点卡片看答案',
      canOpenSource: section?.block_from != null,
    },
    rate: flipped
      ? (
          [
            ['again', '忘了'],
            ['hard', '模糊'],
            ['good', '记得'],
          ] as const
        ).map(([key, label]) => ({
          key,
          label,
          sub: `${nextReview(card.box, key, today).days} 天后`,
        }))
      : null,
    finished: null,
    loading: false,
    busy: false,
  };
}
