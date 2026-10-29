import { Text, View } from 'react-native';
import {
  AppBar,
  Button,
  Cover,
  Empty,
  ListSection,
  Note,
  ProgressBar,
  Screen,
  StageStrip,
  ToastHost,
  useTokens,
  makeStyles,
} from '@ui/kit';
import type {
  ParseProgressIntents,
  ParseProgressState,
} from '@features/library/types';
export function ParseProgressView({
  state,
  intents,
}: {
  state: ParseProgressState;
  intents: ParseProgressIntents;
}) {
  const t = useTokens();
  const s = useStyles();
  return (
    <View style={s.root}>
      <Screen scroll>
        <AppBar
          title="解析进度"
          variant="push"
          backLabel="书架"
          onBack={intents.back}
        />
        {state.cover ? (
          <View style={s.bookHeader}>
            <Cover {...state.cover} />
            <View style={s.bookContent}>
              <Text style={s.bookTitle}>{state.title}</Text>
              <Text style={s.bookMeta}>{state.meta}</Text>
            </View>
          </View>
        ) : null}
        {state.loading ? <Empty body="正在读取解析进度…" /> : null}
        {state.error ? <Note tone="bad">{state.error}</Note> : null}
        {state.demo ? (
          <View style={s.demoNote}>
            <Note tone="neutral">这是演示进度，不会上传文件或消耗额度。</Note>
          </View>
        ) : null}
        <ListSection>
          {state.parts.map(part => (
            <View key={part.number} style={s.part}>
              <View style={s.partHeader}>
                <Text style={s.partTitle}>{part.label}</Text>
                <Text
                  style={{
                    ...t.type.caption,
                    color: part.tone === 'bad' ? t.color.badInk : t.color.ink2,
                  }}
                >
                  {part.statusText}
                </Text>
              </View>
              <ProgressBar value={part.progress} tone={part.tone} />
              <StageStrip stages={part.stages} />
              {part.error ? (
                <>
                  <Note tone="bad">{part.error}</Note>
                  <View style={s.partActions}>
                    <Button size="sm" onPress={intents.goUpdateToken}>
                      去更新 Token
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => intents.retryPart(part.number)}
                    >
                      重试这一片
                    </Button>
                  </View>
                </>
              ) : null}
            </View>
          ))}
        </ListSection>
        <View style={s.footer}>
          <Note tone={state.ready ? 'accent' : 'neutral'}>{state.footer}</Note>
          {state.ready ? (
            <Button size="block" onPress={intents.openMap}>
              查看书的地图
            </Button>
          ) : null}
          {state.error ? (
            <Button variant="secondary" onPress={intents.refresh}>
              重试
            </Button>
          ) : null}
        </View>
      </Screen>
      <ToastHost
        toast={
          state.toast
            ? {
                message: state.toast,
              }
            : null
        }
      />
    </View>
  );
}
const useStyles = makeStyles(t => ({
  root: {
    flex: 1,
  },
  bookHeader: {
    padding: t.space.pageX,
    flexDirection: 'row',
    gap: t.space.gap,
    alignItems: 'center',
  },
  bookContent: {
    flex: 1,
    gap: 6,
  },
  bookTitle: {
    ...t.type.headline,
    color: t.color.ink,
  },
  bookMeta: {
    ...t.type.caption,
    color: t.color.ink2,
  },
  demoNote: {
    paddingHorizontal: t.space.pageX,
  },
  part: {
    padding: t.space.pageX,
    gap: t.space.gap,
    borderBottomWidth: 1,
    borderBottomColor: t.color.line,
  },
  partHeader: {
    flexDirection: 'row',
    gap: t.space.gap,
  },
  partTitle: {
    ...t.type.label,
    color: t.color.ink,
    flex: 1,
  },
  partActions: {
    flexDirection: 'row',
    gap: t.space.gap,
    flexWrap: 'wrap',
  },
  footer: {
    padding: t.space.pageX,
    gap: t.space.gap,
  },
}));
