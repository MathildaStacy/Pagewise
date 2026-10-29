import { Text, View } from 'react-native';
import {
  AppBar,
  Button,
  Dialog,
  Empty,
  Field,
  ListSection,
  Note,
  Row,
  Screen,
  Segmented,
  Switch,
  ToastHost,
  makeStyles,
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
            <ListSection>
              <Row
                title={state.title}
                subtitle={`${state.format} · ${state.subtitle}`}
              />
              {state.facts.map(fact => (
                <Row
                  key={fact.label}
                  title={fact.label}
                  right={<Text style={s.fact}>{fact.value}</Text>}
                />
              ))}
            </ListSection>
            {state.format === 'PDF' ? (
              <>
                <ListSection title="解析方式" note="MinerU 精准解析 API">
                  <View style={s.modelOptions}>
                    <Segmented
                      options={[
                        {
                          key: 'vlm',
                          label: 'vlm（推荐）',
                        },
                        {
                          key: 'pipeline',
                          label: 'pipeline',
                        },
                      ]}
                      value={state.model}
                      onChange={intents.setModel}
                    />
                    <Text style={s.modelHint}>{state.modelHint}</Text>
                  </View>
                  <Row
                    title="OCR 文字识别"
                    subtitle="扫描版已自动打开"
                    right={
                      <Switch
                        accessibilityLabel="OCR 文字识别"
                        value={state.ocr}
                        onChange={intents.setOcr}
                      />
                    }
                  />
                  <View style={s.priorityField}>
                    <Field
                      label="从第几页开始解析"
                      value={state.priorityFrom}
                      onChange={intents.setPriorityFrom}
                      keyboardType="numeric"
                    />
                  </View>
                  <Row
                    title="分片"
                    subtitle="单个文件最多 200 页，合并后保持原书页码"
                  />
                  <View style={s.parts}>
                    <Text style={s.partsText}>{state.parts}</Text>
                  </View>
                  <Row
                    title="今日额度"
                    subtitle="每天 1000 页高优先级"
                    right={<Text style={s.quota}>{state.quota}</Text>}
                  />
                </ListSection>
                <View style={s.uploadNote}>
                  <Note tone="neutral">
                    整本书会上传到 MinerU
                    服务器解析；结果下载后保存在本机，之后阅读不用再次联网解析。
                  </Note>
                </View>
              </>
            ) : (
              <View style={s.localNote}>
                <Note tone="accent">
                  EPUB 在本机解析目录和章节，不上传、不占 MinerU 额度。
                </Note>
              </View>
            )}
          </>
        )}
        {state.demo ? (
          <View style={s.demoNote}>
            <Note tone="neutral">演示文件已在书架中，继续会打开现有书籍。</Note>
          </View>
        ) : null}
        {state.error ? (
          <View style={s.errorNote}>
            <Note tone="bad">{state.error}</Note>
          </View>
        ) : null}
        <View style={s.startAction}>
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
              : `《${state.title}》会上传到 MinerU 官方服务器解析，使用「我的 → 解析服务」里的 Token。`
          }
          confirm={state.demo ? '查看书的地图' : '上传并解析'}
          cancel="取消"
          onConfirm={intents.confirm}
          onCancel={intents.closeOverlay}
        />
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
  fact: {
    ...t.type.body,
    color: t.color.ink2,
  },
  modelOptions: {
    padding: t.space.pageX,
    gap: t.space.gap,
  },
  modelHint: {
    ...t.type.caption,
    color: t.color.ink2,
  },
  priorityField: {
    padding: t.space.pageX,
  },
  parts: {
    paddingHorizontal: t.space.pageX,
    paddingBottom: t.space.gap,
  },
  partsText: {
    ...t.type.caption,
    color: t.color.ink2,
  },
  quota: {
    ...t.type.caption,
    color: t.color.ink2,
  },
  uploadNote: {
    padding: t.space.pageX,
  },
  localNote: {
    padding: t.space.pageX,
  },
  demoNote: {
    padding: t.space.pageX,
  },
  errorNote: {
    padding: t.space.pageX,
  },
  startAction: {
    padding: t.space.pageX,
  },
}));
