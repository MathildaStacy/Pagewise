import { Text, View } from 'react-native';
import {
  Button,
  BookVisualView,
  FigureView,
  CheckRow,
  MathView,
  Note,
  ProgressBar,
  Segmented,
  Sheet,
  TableView,
  makeStyles,
} from '@ui/kit';
import type {
  RefinementContent,
  RefinementState,
  StudyIntents,
} from '@features/study/types';
import { SettingsSelect } from './MeAIView';

export function RefinementSheet({
  state,
  intents,
}: {
  state?: RefinementState;
  intents: StudyIntents;
}) {
  const s = useStyles();
  if (!state) return null;
  const action = (key: string) => intents.refinementAction?.(key);
  const complete = ['ready', 'undone'].includes(state.status);
  const selected = state.edits.filter(e => e.selected).length;
  const options = state.aiOptions;
  const captions: Record<RefinementState['status'], string> = {
    idle: '生成建议后，逐项对照原文并采纳。',
    running: '正在精修，已完成的批次会保存在本机。',
    paused: '已停止，继续时从上次完成的批次开始。',
    failed: '本次精修未完成，已完成的批次仍然保留。',
    ready: state.edits.length
      ? `找到 ${state.edits.length} 处可改进内容，选择要采纳的修改。`
      : '本节未发现可自动修复的问题。',
    applied: '已用于重排阅读、AI 伴读和翻译。',
    undone: '已恢复解析原文，可重新选择建议。',
    stale: '原文已重新解析，请重新生成精修建议。',
  };
  return (
    <Sheet
      visible
      title="精修本节"
      subtitle={`${state.scope} · 保留原文与页码，修改先看后采纳。`}
      detent="full"
      onClose={() => action('close')}
      actions={
        state.activity === 'generate'
          ? [
              {
                label: '停止精修',
                kind: 'secondary',
                onPress: () => action('stop'),
              },
            ]
          : state.busy
          ? [
              {
                label: state.activity === 'loading' ? '正在加载…' : '正在保存…',
                kind: 'secondary',
                disabled: true,
                onPress: () => {},
              },
            ]
          : state.status === 'applied'
          ? [
              {
                label: '撤销精修',
                kind: 'secondary',
                onPress: () => action('undo'),
              },
            ]
          : complete && state.edits.length
          ? [
              {
                label: `采纳 ${selected} 处修改`,
                kind: 'primary',
                disabled: !selected,
                onPress: () => action('apply'),
              },
            ]
          : [
              {
                label: state.canResume ? '继续精修' : '生成精修建议',
                kind: 'primary',
                disabled:
                  !options.config ||
                  (state.mode === 'vision' && !state.canVision),
                onPress: () => action(state.canResume ? 'resume' : 'start'),
              },
            ]
      }
    >
      <View style={s.body}>
        <Segmented
          value={state.mode}
          options={[
            { key: 'structure', label: '结构精修' },
            { key: 'vision', label: '原页复核' },
          ]}
          onChange={value =>
            intents.refinementMode?.(value as 'structure' | 'vision')
          }
        />
        <Text style={s.detail}>
          {state.mode === 'vision'
            ? '将本节 PDF 原页发给所选 AI，校正文字、公式，重建表格与图表。重绘曲线标注为估读，可逐项预览和采纳。'
            : '处理换行、断词与标题层级。涉及改字的疑点会保留原文，供原页复核。'}
        </Text>
        {!state.canVision ? (
          <Text style={s.detail}>
            原页复核需要 PDF 原件和支持图片输入的模型。
          </Text>
        ) : null}
        <SettingsSelect
          label="精修模型"
          value={options.selected}
          options={options.models}
          disabled={state.busy}
          onChange={value => {
            const model = options.models.find(m => m.key === value);
            if (model)
              intents.refinementOptions?.({
                providerId: model.providerId,
                model: model.model,
              });
          }}
        />
        {options.efforts.length ? (
          <SettingsSelect
            label="推理强度"
            value={options.config?.effort ?? ''}
            options={options.efforts}
            disabled={state.busy}
            onChange={value =>
              intents.refinementOptions?.({
                effort: value as NonNullable<typeof options.config>['effort'],
              })
            }
          />
        ) : null}
        {!options.config ? (
          <Note tone="neutral">请先在「我的 → AI 服务」分配整理模型。</Note>
        ) : null}
        <Note tone={state.status === 'applied' ? 'accent' : 'neutral'}>
          {state.activity === 'loading'
            ? '正在读取本节精修记录…'
            : captions[state.status]}
        </Note>
        {['paused', 'failed'].includes(state.status) && !state.canResume ? (
          <Text style={s.detail}>
            模型或模式已更换，将重新生成建议。恢复上次配置可继续未完成的批次。
          </Text>
        ) : null}
        {state.hasPreviousApplied ? (
          <View style={s.issues}>
            <Text style={s.detail}>
              阅读仍使用上次采纳的精修，新建议采纳后才会替换。
            </Text>
            <Button
              variant="text"
              disabled={state.busy}
              onPress={() => action('undo')}
            >
              撤销当前阅读精修
            </Button>
          </View>
        ) : null}
        {state.total > 0 ? (
          <View style={s.progress}>
            <ProgressBar value={state.completed / state.total} />
            <Text style={s.detail}>
              {state.completed} / {state.total} 批
            </Text>
          </View>
        ) : null}
        {state.error ? (
          <>
            <Note tone="bad">{state.error}</Note>
            <Button
              variant="secondary"
              onPress={() => {
                action('close');
                intents.openAiSettings?.();
              }}
            >
              AI 服务设置
            </Button>
          </>
        ) : null}
        {state.edits.map(edit => (
          <View key={edit.seq} style={s.edit}>
            {complete && !state.busy ? (
              <CheckRow
                checked={edit.selected}
                title={edit.location}
                subtitle={edit.reason}
                onToggle={() => intents.refinementToggle?.(edit.seq)}
              />
            ) : (
              <Text style={s.label}>
                {edit.location} · {edit.reason}
              </Text>
            )}
            <Text style={s.label}>解析原文</Text>
            <RefinementPreview content={edit.before} original />
            <Text style={s.label}>精修建议</Text>
            <RefinementPreview content={edit.after} />
          </View>
        ))}
        {state.issues.length ? (
          <View style={s.issues}>
            <Text style={s.label}>待核对疑点</Text>
            {state.issues.map((issue, i) => (
              <View key={`${issue.seq}-${i}`}>
                <Text style={s.detail}>
                  {issue.location} · {issue.reason}
                </Text>
                <Button
                  variant="text"
                  onPress={() => intents.refinementLocate?.(issue.seq)}
                >
                  查看原文
                </Button>
              </View>
            ))}
          </View>
        ) : null}
        {state.tokens ? <Text style={s.detail}>{state.tokens}</Text> : null}
        {!state.busy && state.status !== 'idle' ? (
          <Button
            variant="text"
            disabled={
              !options.config || (state.mode === 'vision' && !state.canVision)
            }
            onPress={() => action('start')}
          >
            重新生成建议
          </Button>
        ) : null}
      </View>
    </Sheet>
  );
}
function RefinementPreview({
  content,
  original = false,
}: {
  content: RefinementContent;
  original?: boolean;
}) {
  const s = useStyles();
  if (content.kind === 'visual') return <BookVisualView data={content.data} />;
  if (content.kind === 'image')
    return content.uri ? (
      <FigureView uri={content.uri} caption={content.text} />
    ) : (
      <Text style={s.before}>请点「查看原页」核对扫描图。</Text>
    );
  if (content.kind === 'equation')
    return <MathView tex={content.tex} display />;
  if (content.kind === 'table')
    return <TableView rows={content.rows} grid={content.grid} selectable />;
  return (
    <Text selectable style={original ? s.before : s.after}>
      {content.text}
    </Text>
  );
}
const useStyles = makeStyles(t => ({
  body: { gap: t.space.gap },
  progress: { gap: t.space.gap },
  detail: { ...t.type.body, color: t.color.ink2 },
  label: { ...t.type.label, color: t.color.ink },
  before: { ...t.type.bookBody, color: t.color.ink2 },
  after: { ...t.type.bookBody, color: t.color.ink },
  edit: {
    gap: t.space.gap,
    paddingVertical: t.space.pageX,
    borderTopWidth: 1,
    borderTopColor: t.color.line,
  },
  issues: { gap: t.space.gap, paddingVertical: t.space.pageX },
}));
