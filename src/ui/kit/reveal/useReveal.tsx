import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, type TextStyle } from 'react-native';
import type { RichDoc } from '../contracts';
import { withAlpha } from '../color';
import { useSkin } from '../context';
import { docLength, fadeClock, revealDoc, type RevealMark } from './doc';

/** 速度变化的缓动时间常数，避免忽快忽慢。 */
const EASE_MS = 140;
/** 两次提交到界面的最短间隔：约 30 帧/秒已足够连贯。 */
const COMMIT_MS = 30;
/** 后台恢复或掉帧后，单帧最多按这么长时间推进。 */
const MAX_FRAME_MS = 100;
/** 生成结束后仍需等待超过这么久，才出现「显示全部」。 */
const SKIP_AFTER_MS = 1200;

export interface Reveal {
  /** 当前应呈现的文档（已截断、带渐显标记）。 */
  doc: RichDoc;
  /** 仍在吐字或渐显中。 */
  revealing: boolean;
  /** 生成已结束但剩余内容还要等一阵，可以提供「显示全部」。 */
  canSkip: boolean;
  skip(): void;
}
interface View {
  shown: number;
  settled: number;
  marks: RevealMark[];
  now: number;
}
const noop = () => {};

/**
 * 把 doc 按帧逐字吐出，新字从模糊渐变到清晰；节奏取自皮肤 tokens.motion.reveal。
 * 挂载时 streaming 为假（历史消息）则直接完整显示；开启「减少动态效果」时不做动画。
 * 流式条目落库后应保持同一 React key，吐字会从原位置继续。
 */
export function useReveal(doc: RichDoc, streaming: boolean): Reveal {
  const { tokens, reduceMotion } = useSkin();
  const pace = tokens.motion.reveal;
  const total = useMemo(() => docLength(doc), [doc]);
  const [view, setView] = useState<View>(() => {
    const shown = streaming ? 0 : total;
    return { shown, settled: shown, marks: [], now: 0 };
  });
  const engine = useRef({
    ...view,
    rate: pace.minRate,
    budget: 0,
    last: 0,
    lastCommit: -Infinity,
  });
  const target = useRef(total);
  useLayoutEffect(() => {
    target.current = total;
  });
  useEffect(() => {
    if (reduceMotion) return;
    const e = engine.current;
    let handle = 0;
    const tick = () => {
      const now = Date.now();
      const goal = target.current;
      const dt = Math.min(Math.max(now - e.last, 0), MAX_FRAME_MS);
      e.last = now;
      if (e.shown > goal) {
        // The tail was restructured (e.g. a marker resolved); never show past the end.
        e.shown = goal;
        e.settled = Math.min(e.settled, goal);
        e.marks = e.marks.filter(mark => mark.upto <= goal);
      }
      const backlog = goal - e.shown;
      if (backlog > 0) {
        const desired = Math.min(
          pace.maxRate,
          Math.max(pace.minRate, (backlog * 1000) / pace.lagMs),
        );
        e.rate += (desired - e.rate) * (1 - Math.exp(-dt / EASE_MS));
        e.budget += (e.rate * dt) / 1000;
        const step = Math.floor(e.budget);
        if (step > 0) {
          e.budget -= step;
          e.shown = Math.min(goal, e.shown + step);
          e.marks.push({ at: now, upto: e.shown });
        }
      } else e.budget = 0;
      while (e.marks.length && now - e.marks[0].at >= pace.fadeMs)
        e.settled = e.marks.shift()!.upto;
      const busy = e.shown < goal || e.marks.length > 0;
      if (!busy || now - e.lastCommit >= COMMIT_MS - 4) {
        e.lastCommit = now;
        setView({
          shown: e.shown,
          settled: e.settled,
          marks: [...e.marks],
          now,
        });
      }
      handle = busy ? requestAnimationFrame(tick) : 0;
    };
    e.last = Date.now();
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [total, reduceMotion, pace]);
  const skip = useCallback(() => {
    const e = engine.current;
    e.shown = e.settled = target.current;
    e.marks = [];
    e.budget = 0;
    setView({ shown: e.shown, settled: e.shown, marks: [], now: e.last });
  }, []);
  if (reduceMotion)
    return { doc, revealing: false, canSkip: false, skip: noop };
  const shown = Math.min(view.shown, total);
  const remaining = total - shown;
  return {
    doc: revealDoc(
      doc,
      shown,
      Math.min(view.settled, shown),
      fadeClock(view.marks, view.settled, view.now, pace.fadeMs),
    ),
    revealing: remaining > 0 || view.marks.length > 0,
    canSkip: !streaming && (remaining * 1000) / pace.maxRate > SKIP_AFTER_MS,
    skip,
  };
}

const fadeStyles = new Map<string, TextStyle>();
/** 渐显中的文字：透明度上升、模糊光晕收拢，读起来像从模糊变清晰。 */
export function revealTextStyle(
  fade: number,
  ink: string,
  blur: number,
): TextStyle {
  const key = `${ink}|${blur}|${fade}`;
  let style = fadeStyles.get(key);
  if (!style) {
    const eased = 1 - (1 - fade) * (1 - fade);
    style = {
      color: withAlpha(ink, 0.12 + 0.88 * eased),
      ...(blur > 0
        ? {
            textShadowColor: withAlpha(ink, 0.6 * (1 - eased)),
            textShadowRadius: blur * (1 - eased),
            textShadowOffset: { width: 0, height: 0 },
          }
        : null),
    };
    fadeStyles.set(key, style);
  }
  return style;
}

/** 由 AiMessage 提供：为真时，新挂载的公式、引用卡、图片等整块淡入。 */
export const RevealContext = createContext(false);
export function RevealFadeIn({ children }: { children?: ReactNode }) {
  const animate = useContext(RevealContext);
  const { tokens } = useSkin();
  const [onMount] = useState(animate);
  const [opacity] = useState(() => new Animated.Value(onMount ? 0 : 1));
  const duration = tokens.motion.reveal.fadeMs;
  useEffect(() => {
    if (!onMount) return;
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    });
    animation.start();
    return () => {
      animation.stop();
      opacity.setValue(1);
    };
  }, [onMount, opacity, duration]);
  return onMount ? (
    <Animated.View style={{ opacity }}>{children}</Animated.View>
  ) : (
    <>{children}</>
  );
}
