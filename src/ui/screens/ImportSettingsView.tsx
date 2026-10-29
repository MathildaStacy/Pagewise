import { Text, TextInput, View } from 'react-native';
import {
  AppBar,
  Button,
  Cover,
  Dialog,
  Empty,
  ListSection,
  Note,
  Row,
  Screen,
  Segmented,
  Switch,
  ToastHost,
  makeStyles,
  usePresentation,
  useTokens,
} from '@ui/kit';
import type {
  ImportSettingsIntents,
  ImportSettingsState,
} from '@features/library/types';
export function ImportSettingsView({
  state,
  intents,
}: {
  state: ImportSettingsState;
  intents: ImportSettingsIntents;
}) {
  const s = useStyles();
  const t = useTokens();
  const { groupedLists } = usePresentation();
  const partCount = state.parts.split('、').filter(Boolean).length;
  const partsHint =
    partCount > 1
      ? `单个文件最多 200 页，拆成 ${partCount} 片，合并后保持原书页码`
      : '200 页以内，一次上传';
  const uploadNote =
    '整本书会上传到 MinerU 服务器解析；解析结果（Markdown、内容块、图片）下载后保存在本机，之后阅读和讲解都不用再联网解析。';
  const parseOptions = (
    <>
      <View style={s.modelOptions}>
        <Segmented
          options={[
            { key: 'vlm', label: 'vlm（推荐）' },
            { key: 'pipeline', label: 'pipeline' },
          ]}
          value={state.model}
          onChange={intents.setModel}
        />
        <Text style={s.modelHint}>{state.modelHint}</Text>
      </View>
      <Row
        title="OCR 文字识别"
        subtitle={
          state.facts.some(f => f.label === '文字层' && f.value === '有')
            ? '书有文字层，一般不需要'
            : '扫描版，已自动打开'
        }
        right={
          <Switch
            accessibilityLabel="OCR 文字识别"
            value={state.ocr}
            onChange={intents.setOcr}
          />
        }
      />
      <Row
        title="从第几页开始解析"
        subtitle="先解析你要读的部分，就绪的章节马上能学"
        right={
          <TextInput
            style={s.priority}
            keyboardType="numeric"
            value={state.priorityFrom}
            onChangeText={intents.setPriorityFrom}
            accessibilityLabel="从第几页开始解析"
          />
        }
      />
      <Row
        title="分片"
        subtitle={
          groupedLists && partCount > 1
            ? `${partsHint}：${state.parts}`
            : partsHint
        }
        right={
          groupedLists ? undefined : <Text style={s.parts}>{state.parts}</Text>
        }
      />
      <Row
        title="今日额度"
        subtitle={
          state.overQuota
            ? `超出${
                groupedLists ? '最高' : '高'
              }优先级额度的部分会排队变慢，不会被拦截`
            : `每天 1000 页${groupedLists ? '最高' : '高'}优先级`
        }
        right={
          <Text style={[s.quota, state.overQuota && s.quotaOver]}>
            {state.quota}
          </Text>
        }
      />
    </>
  );
  return (
    <View style={s.root}>
      <Screen scroll>
        <AppBar
          title="解析设置"
          variant="push"
          backLabel="书架"
          onBack={intents.back}
        />
        {state.loading ? (
          <Empty body="正在读取文件信息…" />
        ) : (
          <>
            <View style={s.section}>
              <View style={s.fileInfo}>
                {groupedLists ? (
                  <Cover
                    title={state.cover?.title ?? state.title}
                    color={state.cover?.color ?? t.color.accent}
                    size="lg"
                  />
                ) : (
                  <View
                    style={[
                      s.fileBadge,
                      state.format === 'EPUB' ? s.epubBadge : undefined,
                    ]}
                  >
                    <Text style={s.fileFormat}>{state.format}</Text>
                  </View>
                )}
                <View style={s.fileText}>
                  <Text style={s.fileTitle}>{state.title}</Text>
                  <Text style={s.fileSubtitle}>
                    {[state.subtitle, state.fileName]
                      .filter(Boolean)
                      .join(groupedLists ? '\n' : ' · ')}
                  </Text>
                </View>
              </View>
              <View style={s.facts}>
                {state.facts.map(fact => (
                  <View key={fact.label} style={s.fact}>
                    <Text style={s.factLabel}>{fact.label}</Text>
                    <Text
                      style={[
                        s.factValue,
                        fact.label === '文字层' ||
                        fact.label === '书签目录' ||
                        fact.label === '目录'
                          ? fact.value.startsWith('有')
                            ? s.good
                            : s.warn
                          : undefined,
                      ]}
                    >
                      {fact.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            {state.format === 'PDF' ? (
              <>
                {groupedLists ? (
                  <ListSection
                    title="解析方式 · MinerU 精准解析 API"
                    note={uploadNote}
                  >
                    {parseOptions}
                  </ListSection>
                ) : (
                  <>
                    <View style={s.section}>
                      <View style={s.sectionHeader}>
                        <Text style={s.sectionTitle}>解析方式</Text>
                        <Text style={s.caption}>MinerU 精准解析 API</Text>
                      </View>
                      {parseOptions}
                    </View>
                    <View style={s.uploadNote}>
                      <Note tone="neutral">{uploadNote}</Note>
                    </View>
                  </>
                )}
              </>
            ) : (
              <View style={s.localNote}>
                <Note tone="accent">
                  EPUB 本身是结构化的，直接在本机解析目录和章节，不上传、不占
                  MinerU 额度。
                </Note>
              </View>
            )}
          </>
        )}
        {state.demo ? (
          <View style={s.uploadNote}>
            <Note tone="neutral">演示文件已在书架中，继续会打开现有书籍。</Note>
          </View>
        ) : null}
        {state.error ? (
          <View style={s.uploadNote}>
            <Note tone="bad">{state.error}</Note>
          </View>
        ) : null}
        <View style={[s.startAction, state.format === 'EPUB' && s.localAction]}>
          <Button
            size="block"
            disabled={!state.canStart || state.loading}
            onPress={intents.start}
          >
            {state.format === 'EPUB' ? '导入' : '开始解析'}
          </Button>
        </View>
        <Dialog
          visible={state.overlay}
          title={state.demo ? '打开演示书籍？' : '上传到 MinerU？'}
          body={
            state.demo
              ? '演示文件已在书架中，不会重复导入。'
              : `《${state.title}》（${
                  state.facts.find(f => f.label === '大小')?.value ?? ''
                }，${
                  state.facts.find(f => f.label === '页数')?.value ?? ''
                } 页）会上传到 MinerU 官方服务器解析，使用你在「我的 → 解析服务」里配置的 Token。`
          }
          confirm={state.demo ? '查看书的地图' : '上传并解析'}
          cancel="取消"
          onConfirm={intents.confirm}
          onCancel={intents.closeOverlay}
        />
      </Screen>
      <ToastHost toast={state.toast ? { message: state.toast } : null} />
    </View>
  );
}
const useStyles = makeStyles(t => ({
  root: { flex: 1 },
  section: {
    backgroundColor: t.layout.groupedLists ? undefined : t.color.surface,
    marginBottom: t.layout.groupedLists ? 0 : 8,
  },
  fileInfo: {
    flexDirection: 'row',
    gap: t.layout.groupedLists ? 14 : 12,
    paddingHorizontal: t.layout.groupedLists ? 20 : t.space.pageX,
    paddingTop: t.layout.groupedLists ? 4 : 14,
    paddingBottom: t.layout.groupedLists ? 18 : 14,
    alignItems: 'center',
  },
  fileBadge: {
    width: 42,
    height: 52,
    borderRadius: t.shape.xs + 2,
    backgroundColor: t.color.bad,
    alignItems: 'center',
    justifyContent: 'center',
  },
  epubBadge: { backgroundColor: t.color.ok },
  fileFormat: {
    ...t.type.micro,
    fontSize: t.type.micro.fontSize * (t.layout.groupedLists ? 11 / 12 : 1),
    fontWeight: '700',
    color: t.color.continueInk,
  },
  fileText: { flex: 1 },
  fileTitle: {
    ...t.type.fileTitle,
    color: t.color.ink,
  },
  fileSubtitle: {
    ...t.type.caption,
    color: t.layout.groupedLists ? t.color.ink2 : t.color.ink3,
  },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: t.space.pageX,
    paddingTop: t.layout.groupedLists ? 0 : 4,
    paddingBottom: t.layout.groupedLists ? 0 : 12,
    marginBottom: t.layout.groupedLists ? 24 : 0,
  },
  fact: {
    flexBasis: '40%',
    flexGrow: 1,
    backgroundColor: t.layout.groupedLists ? t.color.surface : t.color.bg,
    borderRadius: t.layout.groupedLists ? t.shape.md - 2 : t.shape.sm,
    paddingVertical: t.layout.groupedLists ? 11 : 8,
    paddingHorizontal: t.layout.groupedLists ? 14 : 10,
  },
  factLabel: {
    ...(t.layout.groupedLists ? t.type.micro : t.type.caption),
    fontWeight: '400',
    color: t.layout.groupedLists ? t.color.ink2 : t.color.ink3,
  },
  factValue: {
    ...t.type.factValue,
    ...t.type.num,
    color: t.color.ink,
    marginTop: t.layout.groupedLists ? 1 : 0,
  },
  good: { color: t.color.okInk },
  warn: { color: t.color.stuck },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: t.space.pageX,
    paddingTop: 12,
    paddingBottom: 6,
  },
  sectionTitle: { ...t.type.headline, color: t.color.ink },
  caption: { ...t.type.caption, color: t.color.ink3 },
  modelOptions: {
    paddingHorizontal: t.space.pageX,
    paddingTop: t.layout.groupedLists ? 10 : 4,
    paddingBottom: t.layout.groupedLists ? 11 : 6,
    gap: t.layout.groupedLists ? 8 : 6,
  },
  modelHint: {
    ...t.type.caption,
    color: t.layout.groupedLists ? t.color.ink2 : t.color.ink3,
    lineHeight: t.type.caption.fontSize * (t.layout.groupedLists ? 1.45 : 1.6),
  },
  priority: {
    ...(t.layout.groupedLists ? t.type.bookTitle : t.type.body),
    ...t.type.num,
    fontWeight: t.type.body.fontWeight,
    color: t.color.ink,
    width: t.layout.groupedLists ? 68 : 64,
    height: t.layout.groupedLists ? 34 : 32,
    borderWidth: t.layout.groupedLists ? 0 : 1,
    borderColor: t.color.line,
    borderRadius: t.layout.groupedLists ? t.shape.sm : t.shape.xs * 2,
    backgroundColor: t.layout.groupedLists ? t.color.surfaceFill : undefined,
    textAlign: 'center',
    paddingVertical: 0,
  },
  parts: {
    ...t.type.label,
    ...t.type.num,
    fontWeight: t.type.body.fontWeight,
    color: t.color.ink2,
    maxWidth: '48%',
    textAlign: 'right',
  },
  quotaOver: {
    color: t.layout.groupedLists ? t.color.stuckInk : t.color.stuck,
  },
  quota: {
    ...t.type.label,
    ...t.type.num,
    fontWeight: t.type.body.fontWeight,
    color: t.color.ink2,
  },
  uploadNote: {
    paddingTop: 4,
    paddingHorizontal: t.space.pageX,
    paddingBottom: 6,
  },
  localNote: {
    paddingHorizontal: t.space.pageX,
    paddingVertical: t.layout.groupedLists ? 0 : 14,
    marginBottom: t.layout.groupedLists ? 20 : 8,
    backgroundColor: t.layout.groupedLists ? undefined : t.color.surface,
  },
  startAction: {
    paddingTop: t.layout.groupedLists ? 0 : 10,
    paddingHorizontal: t.space.pageX,
    paddingBottom: 20,
  },
  localAction: { paddingTop: t.layout.groupedLists ? 0 : 4 },
}));
