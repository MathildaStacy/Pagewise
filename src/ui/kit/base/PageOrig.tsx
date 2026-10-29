import { useRef, type ComponentRef } from 'react';
import { Image, Pressable, View } from 'react-native';
import type { PageOrigProps } from '../contracts';
import { Icon } from '../Icon';
import { makeStyles } from '../makeStyles';
import { useTokens } from '../context';

export function PageOrig({
  uri,
  width,
  height,
  blocks,
  onBlock,
  onPin,
}: PageOrigProps) {
  const t = useTokens(),
    s = useStyles();
  const page = useRef<ComponentRef<typeof View>>(null);
  return (
    <View
      ref={page}
      collapsable={false}
      style={[s.page, { aspectRatio: width / height }]}
      accessibilityLabel="原版书页"
      accessibilityRole="none"
    >
      <Image
        source={{ uri }}
        resizeMode="contain"
        style={s.image}
        accessibilityLabel="原版书页图片"
      />
      {blocks
        .filter(
          b =>
            [b.x0, b.y0, b.x1, b.y1].every(Number.isFinite) &&
            b.x1 > b.x0 &&
            b.y1 > b.y0,
        )
        .map(block => {
          const marks = new Set(
            block.marks ??
              (block.state
                ? [
                    block.state === 'current'
                      ? 'now'
                      : block.state === 'done'
                      ? 'heard'
                      : block.state,
                  ]
                : []),
          );
          const disabled = !onBlock || block.selectable === false;
          const select = () =>
            page.current?.measureInWindow((x, y, w, h) =>
              onBlock?.(block.ref, {
                x: x + block.x0 * w,
                y: y + block.y0 * h,
                w: (block.x1 - block.x0) * w,
                h: (block.y1 - block.y0) * h,
              }),
            );
          return (
            <View
              key={block.ref}
              pointerEvents="box-none"
              style={[
                s.block,
                {
                  left: `${block.x0 * 100}%`,
                  top: `${block.y0 * 100}%`,
                  width: `${(block.x1 - block.x0) * 100}%`,
                  height: `${(block.y1 - block.y0) * 100}%`,
                },
              ]}
            >
              <Pressable
                testID={`pdf-block-${block.ref}`}
                onPress={select}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={
                  block.label ??
                  `内容块 b${block.ref}${block.pin ? '，有问答便签' : ''}`
                }
                accessibilityState={{
                  disabled,
                  selected: marks.has('selected') || marks.has('now'),
                }}
                style={[
                  s.hit,
                  marks.has('heard') && s.heard,
                  marks.has('now') && s.now,
                  marks.has('selected') && s.selected,
                ]}
              >
                {marks.has('highlight') || marks.has('flash') ? (
                  <View
                    pointerEvents="none"
                    testID={`pdf-fill-${block.ref}`}
                    style={[s.fill, marks.has('flash') ? s.flash : s.highlight]}
                  />
                ) : null}
              </Pressable>
              {block.pin ? (
                <Pressable
                  testID={`pdf-pin-${block.ref}`}
                  accessibilityRole="button"
                  accessibilityLabel={
                    block.pinLabel ?? `内容块 b${block.ref} 的问答便签`
                  }
                  onPress={() => onPin?.(block.ref)}
                  disabled={!onPin}
                  style={s.pin}
                >
                  <Icon name="pin" size={14} color={t.color.pin} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
    </View>
  );
}
const useStyles = makeStyles(t => ({
  page: {
    width: '100%',
    backgroundColor: t.color.paper,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: t.shape.xs,
  },
  image: { position: 'absolute', width: '100%', height: '100%' },
  block: { position: 'absolute' },
  hit: { width: '100%', height: '100%', borderLeftWidth: 0 },
  heard: { borderLeftWidth: 2, borderLeftColor: t.color.stepCur },
  now: { borderLeftWidth: 3, borderLeftColor: t.color.accent },
  selected: {
    borderWidth: 1,
    borderColor: t.color.accent,
    backgroundColor: t.color.accentBg,
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.35,
  },
  highlight: { backgroundColor: t.color.highlight },
  flash: { backgroundColor: t.color.accentBg },
  pin: {
    position: 'absolute',
    right: 0,
    top: 0,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.color.pinBg,
    borderRadius: t.shape.pill,
  },
}));
