import { useLayoutEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import {
  AppBar,
  Button,
  Empty,
  Icon,
  Note,
  Screen,
  makeStyles,
  usePresentation,
  useTokens,
} from '@ui/kit';
import type {
  ReviewSessionIntents,
  ReviewSessionState,
} from '@features/review/types';

export function ReviewSessionView({
  state,
  intents,
}: {
  state: ReviewSessionState;
  intents: ReviewSessionIntents;
}) {
  const s = useStyles(),
    t = useTokens();
  const { flashcards, reduceMotion } = usePresentation();
  const flip = flashcards === 'flip',
    flipped = !!state.card?.flipped;
  const rotation = useRef(new Animated.Value(flipped ? 1 : 0)).current;
  const rating = useRef(new Animated.Value(flipped ? 1 : 0)).current;
  useLayoutEffect(() => {
    if (!flip || reduceMotion || !flipped) {
      rotation.setValue(flipped ? 1 : 0);
      rating.setValue(flipped ? 1 : 0);
      return;
    }
    const turn = Animated.timing(rotation, {
      toValue: 1,
      duration: 600,
      easing: Easing.bezier(...t.motion.easing),
      useNativeDriver: true,
    });
    const reveal = Animated.timing(rating, {
      toValue: 1,
      duration: 450,
      delay: 150,
      easing: Easing.bezier(...t.motion.easing),
      useNativeDriver: true,
    });
    turn.start();
    reveal.start();
    return () => {
      turn.stop();
      reveal.stop();
    };
  }, [
    flip,
    flipped,
    state.title,
    reduceMotion,
    rating,
    rotation,
    t.motion.easing,
  ]);
  const card = state.card;
  const source = card ? (
    <View style={s.sourceRow}>
      <Text style={s.source}>{card.source}</Text>
      <Text style={s.source}>{card.box}</Text>
    </View>
  ) : null;
  const actions = (
    <View style={s.cardActions}>
      {card?.canOpenSource ? (
        <Button
          variant={flip ? 'secondary' : 'ghost'}
          size="sm"
          onPress={intents.openSource}
        >
          回到原文
        </Button>
      ) : null}
      <Button
        variant={flip ? 'secondary' : 'ghost'}
        size="sm"
        onPress={intents.askAi}
      >
        问 AI
      </Button>
    </View>
  );
  return (
    <Screen scroll>
      <AppBar
        title={state.title}
        variant="push"
        backLabel="复习"
        onBack={intents.back}
      />
      {state.error ? (
        <View style={s.message}>
          <Note tone="bad">{state.error}</Note>
          <Button variant="text" onPress={intents.retry}>
            重试
          </Button>
        </View>
      ) : null}
      {state.loading ? <Empty body="正在读取卡片…" /> : null}
      {card ? (
        <>
          {flip ? (
            <View style={s.flipWrap}>
              <Pressable
                style={s.flipCard}
                onPress={flipped ? undefined : intents.flip}
                accessibilityRole={flipped ? 'none' : 'button'}
                accessibilityLabel={
                  flipped ? '闪卡答案' : `${card.front}，点卡片看答案`
                }
                accessibilityState={{ expanded: flipped }}
                accessible={!flipped}
              >
                <Animated.View
                  testID="flashcard-front"
                  pointerEvents={flipped ? 'none' : 'auto'}
                  accessibilityElementsHidden={flipped}
                  importantForAccessibility={
                    flipped ? 'no-hide-descendants' : 'auto'
                  }
                  style={[
                    s.face,
                    {
                      transform: [
                        { perspective: 1400 },
                        {
                          rotateY: rotation.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '180deg'],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  {source}
                  <Text style={s.front}>{card.front}</Text>
                  <Text style={s.tip}>{card.tip}</Text>
                </Animated.View>
                <Animated.View
                  testID="flashcard-back"
                  pointerEvents={flipped ? 'auto' : 'none'}
                  accessibilityElementsHidden={!flipped}
                  importantForAccessibility={
                    flipped ? 'auto' : 'no-hide-descendants'
                  }
                  style={[
                    s.face,
                    {
                      transform: [
                        { perspective: 1400 },
                        {
                          rotateY: rotation.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['180deg', '360deg'],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  {source}
                  <Text style={s.backQuestion}>{card.front}</Text>
                  <Text style={s.back}>{card.back}</Text>
                  {actions}
                </Animated.View>
              </Pressable>
            </View>
          ) : (
            <Pressable
              testID="flashcard-expanded"
              style={s.card}
              onPress={flipped ? undefined : intents.flip}
              accessibilityRole={flipped ? 'none' : 'button'}
              accessibilityLabel={
                flipped ? '闪卡答案' : `${card.front}，点卡片看答案`
              }
              accessibilityState={{ expanded: flipped }}
              accessible={!flipped}
            >
              {source}
              <Text style={s.front}>{card.front}</Text>
              {flipped ? (
                <>
                  <Text style={s.back}>{card.back}</Text>
                  {actions}
                </>
              ) : (
                <Text style={s.tip}>{card.tip}</Text>
              )}
            </Pressable>
          )}
          {state.rate ? (
            <Animated.View
              testID="flashcard-ratings"
              style={[
                s.ratings,
                flip
                  ? {
                      opacity: rating,
                      transform: [
                        {
                          translateY: rating.interpolate({
                            inputRange: [0, 1],
                            outputRange: [12, 0],
                          }),
                        },
                      ],
                    }
                  : undefined,
              ]}
            >
              {state.rate.map(rate => (
                <Pressable
                  key={rate.key}
                  onPress={() => intents.rate(rate.key)}
                  disabled={state.busy}
                  accessibilityRole="button"
                  accessibilityLabel={`${rate.label}，${rate.sub}`}
                  accessibilityState={{ disabled: state.busy }}
                  hitSlop={4}
                  style={({ pressed }) => [
                    s.rating,
                    flip
                      ? rate.key === 'again'
                        ? s.againFill
                        : rate.key === 'hard'
                        ? s.hardFill
                        : s.goodFill
                      : undefined,
                    pressed ? s.pressed : undefined,
                    state.busy ? s.disabled : undefined,
                  ]}
                >
                  <Text
                    style={[
                      s.ratingLabel,
                      rate.key === 'again'
                        ? s.again
                        : rate.key === 'hard'
                        ? s.hard
                        : s.good,
                    ]}
                  >
                    {rate.label}
                  </Text>
                  <Text
                    style={[
                      s.ratingSub,
                      flip
                        ? rate.key === 'again'
                          ? s.again
                          : rate.key === 'hard'
                          ? s.hard
                          : s.good
                        : undefined,
                    ]}
                  >
                    {rate.sub}
                  </Text>
                </Pressable>
              ))}
            </Animated.View>
          ) : flip ? (
            <View style={s.ratingSpace} />
          ) : null}
        </>
      ) : null}
      {state.finished ? (
        <View style={s.finished}>
          {flip ? (
            <View style={s.finishedBadge}>
              <Icon name="check" size={36} color={t.color.onAccent} />
            </View>
          ) : (
            <Text style={s.finishedMark}>✓</Text>
          )}
          <Text style={s.finishedTitle}>{state.finished.title}</Text>
          <Text style={s.finishedText}>{state.finished.text}</Text>
          <View style={s.done}>
            <Button size="block" onPress={intents.done}>
              完成
            </Button>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
const useStyles = makeStyles(t => {
  const flip = t.layout.flashcards === 'flip',
    scale = t.type.body.fontSize / (flip ? 17 : 14);
  return {
    message: { padding: t.space.pageX, gap: t.space.gap },
    card: {
      marginHorizontal: 14,
      marginVertical: 16,
      minHeight: 300,
      paddingHorizontal: 18,
      paddingVertical: 20,
      backgroundColor: t.color.surface,
      borderRadius: t.shape.sheet,
      ...t.elevation.flashcard,
    },
    flipWrap: { paddingHorizontal: 16, paddingTop: 4 },
    flipCard: { height: 380 },
    face: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backfaceVisibility: 'hidden',
      backgroundColor: t.color.surface,
      borderWidth: t.scheme === 'dark' ? 0.5 : 0,
      borderColor: t.color.line,
      borderRadius: t.shape.md + 2,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 18,
      ...t.elevation.flashcard,
    },
    sourceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    source: {
      ...t.type.caption,
      lineHeight: (flip ? 18.85 : 18) * scale,
      color: flip ? t.color.ink2 : t.color.ink3,
      flexShrink: 1,
    },
    front: {
      ...t.type.body,
      fontSize: (flip ? 22 : 19) * scale,
      lineHeight: (flip ? 31.9 : 29.45) * scale,
      fontWeight: flip ? '700' : '600',
      color: t.color.ink,
      marginTop: flip ? 'auto' : 26,
      marginBottom: flip ? 'auto' : 10,
      textAlign: flip ? 'center' : 'left',
      letterSpacing: flip ? -0.22 * scale : 0,
    },
    backQuestion: {
      ...t.type.body,
      fontSize: 15 * scale,
      lineHeight: 22.5 * scale,
      fontWeight: '600',
      color: t.color.ink2,
      marginTop: 16,
      marginBottom: 10,
    },
    back: {
      ...t.type.body,
      fontSize: (flip ? 18 : 15) * scale,
      lineHeight: (flip ? 30.6 : 27) * scale,
      color: flip ? t.color.ink : t.color.ink2,
      flex: flip ? 1 : undefined,
      borderTopWidth: flip ? 0 : 1,
      borderStyle: 'dashed',
      borderTopColor: t.color.line,
      paddingTop: flip ? 0 : 12,
      marginTop: flip ? 0 : 6,
    },
    tip: {
      ...t.type.caption,
      lineHeight: (flip ? 18.85 : 18) * scale,
      color: t.color.ink3,
      textAlign: 'center',
      marginTop: flip ? 0 : 'auto',
    },
    cardActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: flip ? 0 : 14,
      flexWrap: 'wrap',
    },
    ratings: {
      flexDirection: 'row',
      gap: flip ? 10 : 8,
      paddingHorizontal: flip ? 16 : 14,
      paddingTop: flip ? 18 : 0,
    },
    ratingSpace: { height: 84 },
    rating: {
      flex: 1,
      height: flip ? 66 : 54,
      borderWidth: flip ? 0 : 1,
      borderColor: t.color.line,
      borderRadius: t.shape.md,
      backgroundColor: t.color.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    againFill: { backgroundColor: t.color.badBg },
    hardFill: { backgroundColor: t.color.stuckBg },
    goodFill: { backgroundColor: t.color.okBg },
    pressed: { opacity: 0.7 },
    disabled: { opacity: 0.45 },
    ratingLabel: {
      ...t.type.body,
      fontWeight: flip ? '700' : '600',
      lineHeight: (flip ? 22.1 : 18.2) * scale,
    },
    again: { color: flip ? t.color.badInk : t.color.bad },
    hard: { color: flip ? t.color.stuckInk : t.color.stuck },
    good: { color: flip ? t.color.okInk : t.color.ok },
    ratingSub: {
      ...t.type.micro,
      fontWeight: flip ? '500' : '400',
      color: t.color.ink3,
      opacity: flip ? 0.85 : 1,
      lineHeight: (flip ? 15.6 : 14.3) * scale,
    },
    finished: {
      paddingTop: flip ? 70 : 80,
      paddingHorizontal: flip ? 30 : 20,
      paddingBottom: flip ? 20 : 40,
      alignItems: 'center',
    },
    finishedBadge: {
      width: 72,
      height: 72,
      borderRadius: t.shape.pill,
      backgroundColor: t.color.ok,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    finishedMark: {
      ...t.type.largeTitle,
      fontSize: 40 * scale,
      lineHeight: 60 * scale,
      color: t.color.ink3,
    },
    finishedTitle: {
      ...t.type.title,
      fontSize: (flip ? 22 : 17) * scale,
      lineHeight: (flip ? 31.9 : 25.5) * scale,
      fontWeight: flip ? '700' : '600',
      color: t.color.ink,
      marginTop: flip ? 0 : 8,
      marginBottom: flip ? 6 : 8,
    },
    finishedText: {
      ...t.type.body,
      fontSize: (flip ? 15 : 13) * scale,
      lineHeight: (flip ? 24 : 19.5) * scale,
      color: flip ? t.color.ink2 : t.color.ink3,
      textAlign: 'center',
    },
    done: {
      alignSelf: 'stretch',
      paddingHorizontal: flip ? 0 : 10,
      marginTop: flip ? 24 : 40,
    },
  };
});
