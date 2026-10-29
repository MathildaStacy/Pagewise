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
  usePresentation,
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
  const { groupedLists } = usePresentation();
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
            <Cover {...state.cover} size={groupedLists ? 'lg' : 'md'} />
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
          {state.parts.map((part, index) => (
            <View key={part.number} style={s.part}>
              {groupedLists && index > 0 ? (
                <View style={s.partDivider} />
              ) : null}
              <View style={s.partHeader}>
                <Text style={s.partTitle}>{part.label}</Text>
                <Text
                  style={[
                    s.partStatus,
                    part.tone === 'bad'
                      ? s.partBad
                      : part.tone === 'ok'
                      ? s.partOk
                      : undefined,
                  ]}
                >
                  {part.statusText}
                </Text>
              </View>
              <ProgressBar
                value={part.progress}
                tone={part.tone === 'muted' ? 'accent' : part.tone}
              />
              <StageStrip stages={part.stages} />
              {part.error ? (
                <>
                  <View style={s.partNote}>
                    <Note tone="bad">{part.error}</Note>
                  </View>
                  <View style={s.partActions}>
                    <Button size="sm" onPress={intents.goUpdateToken}>
                      去更新 Token
                    </Button>
                    <Button
                      size="sm"
                      variant={groupedLists ? 'secondary' : 'ghost'}
                      onPress={() => intents.retryPart(part.number)}
                    >
                      重试这一片
                    </Button>
                  </View>
                </>
              ) : null}
              {part.warning ? (
                <>
                  <View style={s.partNote}>
                    <Note tone="neutral">{part.warning}</Note>
                  </View>
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => intents.retryPart(part.number, true)}
                  >
                    用 OCR 重新解析这一片
                  </Button>
                </>
              ) : null}
            </View>
          ))}
        </ListSection>
        <View style={s.footer}>
          <Note tone={state.ready ? 'accent' : 'neutral'}>{state.footer}</Note>
          {state.ready ? (
            <View style={s.mapAction}>
              <Button size="block" onPress={intents.openMap}>
                查看书的地图
              </Button>
            </View>
          ) : null}
          {state.error ? (
            <Button
              variant="secondary"
              onPress={
                state.parts.length
                  ? intents.refresh
                  : intents.retryBook ?? intents.refresh
              }
            >
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
    paddingHorizontal: t.layout.groupedLists ? 20 : t.space.pageX,
    paddingTop: t.layout.groupedLists ? 4 : 12,
    paddingBottom: t.layout.groupedLists ? 18 : 12,
    marginBottom: t.layout.groupedLists ? 0 : 8,
    backgroundColor: t.layout.groupedLists ? undefined : t.color.surface,
    flexDirection: 'row',
    gap: t.layout.groupedLists ? 14 : 12,
    alignItems: 'center',
  },
  bookContent: {
    flex: 1,
    gap: 2,
  },
  bookTitle: {
    ...(t.layout.groupedLists ? t.type.fileTitle : t.type.bookTitle),
    color: t.color.ink,
  },
  bookMeta: {
    ...t.type.caption,
    color: t.layout.groupedLists ? t.color.ink2 : t.color.ink3,
  },
  demoNote: {
    paddingHorizontal: t.space.pageX,
  },
  part: {
    paddingHorizontal: t.space.pageX,
    paddingVertical: t.layout.groupedLists ? 14 : 12,
    backgroundColor: t.color.surface,
    borderBottomWidth: t.layout.groupedLists ? 0 : 1,
    borderBottomColor: t.color.line,
  },
  partDivider: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 0,
    height: 0.5,
    backgroundColor: t.color.line,
  },
  partHeader: {
    flexDirection: 'row',
    gap: t.space.gap,
    alignItems: 'center',
    marginBottom: t.layout.groupedLists ? 9 : 8,
  },
  partTitle: {
    ...t.type.parsePartTitle,
    color: t.color.ink,
    flex: 1,
  },
  partStatus: {
    ...t.type.caption,
    ...t.type.num,
    fontWeight: t.layout.groupedLists ? '600' : '400',
    color: t.color.ink2,
  },
  partBad: { color: t.layout.groupedLists ? t.color.badInk : t.color.bad },
  partOk: { color: t.color.okInk },
  partActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: t.layout.groupedLists ? 10 : 8,
  },
  partNote: { marginTop: t.layout.groupedLists ? 10 : 8 },
  footer: {
    paddingHorizontal: t.space.pageX,
    paddingTop: t.layout.groupedLists ? 0 : 4,
    paddingBottom: 20,
  },
  mapAction: { marginTop: t.layout.groupedLists ? 14 : 10 },
}));
