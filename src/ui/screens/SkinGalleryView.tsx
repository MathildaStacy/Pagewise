import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as K from '@ui/kit';
import type { GalleryState, GalleryIntents } from '@features/gallery/types';

export function SkinGalleryView({
  state: s,
  intents: i,
}: {
  state: GalleryState;
  intents: GalleryIntents;
}) {
  const t = K.useTokens();
  const section = (title: string, children: React.ReactNode) => (
    <K.ListSection title={title}>{children}</K.ListSection>
  );
  const wrap = (children: React.ReactNode) => (
    <View style={{ padding: t.space.pageX, gap: t.space.gap }}>{children}</View>
  );
  const controls = (
    <View style={{ gap: t.space.gap }}>
      <K.Segmented
        accessibilityLabel="皮肤"
        options={s.skinOptions}
        value={s.skin}
        onChange={i.setSkin}
      />
      <K.Segmented
        accessibilityLabel="深浅色"
        options={s.schemeOptions}
        value={s.scheme}
        onChange={i.setScheme}
      />
      <K.Segmented
        accessibilityLabel="系统字号倍率"
        options={[
          { key: '1', label: '1.0 倍' },
          { key: '1.3', label: '1.3 倍' },
          { key: '2', label: '2.0 倍' },
        ]}
        value={String(s.fontScale)}
        onChange={i.setScale}
      />
    </View>
  );
  const steps = ['直觉', '定义', '一致性', '检查'].map((title, index) => ({
    title,
    state:
      index < s.step
        ? ('done' as const)
        : index === s.step
        ? ('current' as const)
        : index === 2
        ? ('skipped' as const)
        : ('todo' as const),
  }));
  const rich: K.RichDoc = [
    {
      t: 'p',
      c: [
        { t: 'text', v: '先看直觉：' },
        { t: 'b', c: [{ t: 'text', v: '把大问题拆成几步' }] },
        { t: 'text', v: '。每个解释都能回到原书。' },
        {
          t: 'cite',
          ref: 103005,
          label: 'p.103',
          verified: true,
          detour: false,
        },
      ],
    },
    {
      t: 'aux',
      kind: 'example',
      open: false,
      body: [
        {
          t: 'p',
          c: [{ t: 'text', v: '这是供组件预览的示意例子，不是原书内容。' }],
        },
      ],
    },
  ];
  return (
    <K.Screen>
      <K.AppBar
        title="组件对照"
        subtitle="Pagewise · 开发预览"
        variant="root"
        right={
          <K.IconButton
            icon="settings"
            label="外观设置"
            onPress={i.appearance}
          />
        }
      />
      {wrap(controls)}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: t.space.sectionGap }}
      >
        {section(
          '页面',
          s.pages.map(page => (
            <K.Row
              key={page.key}
              title={page.label}
              chevron
              onPress={() => i.previewPage(page.key)}
            />
          )),
        )}
        {section(
          '按钮与快捷操作',
          wrap(
            <>
              <View style={[layout.wrapRow, { gap: t.space.gap }]}>
                {(
                  [
                    'primary',
                    'secondary',
                    'ghost',
                    'detour',
                    'danger',
                    'text',
                  ] as const
                ).map((variant, index) => (
                  <K.Button
                    key={variant}
                    variant={variant}
                    onPress={() => i.notify('已点击按钮')}
                    label={
                      ['主操作', '次操作', '边框', '岔路', '删除', '文字'][
                        index
                      ]
                    }
                  />
                ))}
                <K.Button disabled onPress={() => {}} label="暂不可用" />
              </View>
              <K.QuickActions
                items={[
                  {
                    key: 'next',
                    label: '懂了，下一步',
                    kind: 'primary',
                    icon: 'next',
                  },
                  { key: 'alt', label: '换个说法' },
                  { key: 'example', label: '举个例子' },
                  { key: 'derive', label: '展开推导', icon: 'derive' },
                ]}
                onPress={key =>
                  i.notify(key === 'next' ? '继续下一步' : '已选择快捷操作')
                }
              />
            </>,
          ),
        )}
        {section(
          '听讲进度',
          <>
            <K.AppBar
              title="3.5.2 A*搜索"
              subtitle="人工智能：现代方法"
              variant="push"
              onBack={() => i.notify('返回地图')}
              backLabel="地图"
              right={<K.ModeSwitch value={s.mode} onChange={i.setMode} />}
            />
            <K.StepProgress
              steps={steps}
              label={`第 ${s.step + 1}/4 步`}
              onPressStep={i.jumpStep}
              onPressBar={() => i.openOverlay('sheet')}
              right={
                <K.Button
                  variant="text"
                  label="AI 看到的内容 ›"
                  onPress={() => i.openOverlay('sheet')}
                />
              }
            />
            <K.DetourBanner
              title="岔路 · 一致代价搜索"
              onBack={() => i.notify('已回到主线')}
              backLabel="回到主线"
            />
            {wrap(
              <>
                <K.ProgressBar value={0.64} />
                <K.StageStrip
                  stages={[
                    { label: '导入', state: 'done' },
                    { label: '解析', state: 'current' },
                    { label: '入库', state: 'todo' },
                  ]}
                />
              </>,
            )}
          </>,
        )}
        {section(
          '列表与输入',
          <>
            <K.Row
              title="示例分组"
              subtitle="界面保持相同的操作位置"
              chevron
              onPress={() => i.notify('打开行')}
            />
            <K.Row
              title="开关"
              right={
                <K.Switch
                  value={s.switchOn}
                  onChange={i.setSwitch}
                  accessibilityLabel="演示开关"
                />
              }
            />
            <K.CheckRow
              checked={s.checked}
              title="保存这个要点"
              subtitle="系统字号放大时允许换行"
              tag="建议"
              onToggle={i.toggleChecked}
            />
            <K.Field label="文本输入" value={s.field} onChange={i.setField} />
            {wrap(
              <>
                <View style={[layout.centeredRow, { gap: t.space.gap }]}>
                  <K.Cover title="示意书籍" color={t.color.accent} size="sm" />
                  <K.Tag label="已就绪" tone="ok" />
                  <K.StatusDot tone="accent" />
                  <K.SectionStatusIcon status="learning" />
                </View>
                <K.Note tone="warn">
                  演示数据只用于预览，不会写入正式书库。
                </K.Note>
              </>,
            )}
          </>,
        )}
        {section(
          '讲解与引用',
          wrap(
            <>
              <K.UserBubble
                text="这里为什么可以这样推导？"
                quote="示意原文 · p.103"
              />
              <K.StepHeader
                step={2}
                label="第 2 步"
                title="理解启发式函数"
                pages="p.103"
              />
              <K.AiMessage
                doc={rich}
                onCite={() => i.openOverlay('sheet')}
                onFigure={() => i.notify('查看插图')}
              />
              <K.ToolSteps
                lines={[
                  { text: '读取 3.4.2 的原文', running: false },
                  { text: '整理这一小节', running: true },
                ]}
              />
              <K.SourceCard
                label="原文 · p.103"
                text="这是示意段落，真实原文在导入书籍后显示。"
                onPress={() => i.openOverlay('sheet')}
              />
              <K.AuxBlock kind="derive">
                <Text style={{ ...t.type.aiBody, color: t.color.derive }}>
                  从已知条件出发，逐步补齐推导。
                </Text>
              </K.AuxBlock>
              <K.CheckCard text="现在能说出这一步的作用吗？" />
              <K.MathView tex="f(n) = g(n) + h(n)" display />
              <View style={[layout.wrapRow, { gap: t.space.gap }]}>
                <K.CiteChip
                  label="p.103"
                  tone="main"
                  onPress={() => i.openOverlay('sheet')}
                />
                <K.CiteChip
                  label="未核实"
                  tone="detour"
                  verified={false}
                  onPress={() => i.notify('这条引用尚未核实')}
                />
                <K.PinChip
                  label="为什么这样计算？"
                  onPress={() => i.openOverlay('sheet')}
                />
              </View>
              <K.Typing />
            </>,
          ),
        )}
        {section(
          '学习卡片',
          wrap(
            <>
              <K.ResumeCard
                title="续学 · 距上次 3 天"
                lines={['讲到了第 2 步', '上次的卡点：一致性与可采纳性']}
                actions={[
                  { key: 'go', label: '直接继续', primary: true },
                  { key: 'review', label: '先复习卡点' },
                ]}
                onAction={() => i.notify('已选择续学方式')}
              />
              <K.FoldCard
                title="已解决：两种搜索的关系"
                count="3 条"
                expanded={s.foldOpen}
                onToggle={i.toggleFold}
              >
                <Text style={{ ...t.type.body, color: t.color.ink }}>
                  折叠的问答仍可随时回看。
                </Text>
              </K.FoldCard>
              <K.QuizCard
                title="检查一下"
                question="这步讲解主要解决什么问题？"
                options={['理解概念', '跳过原文', '增加记忆负担'].map(
                  (label, index) => ({
                    label,
                    state:
                      s.picked === null
                        ? 'idle'
                        : index === 0
                        ? 'right'
                        : index === s.picked
                        ? 'wrong'
                        : 'muted',
                  }),
                )}
                locked={s.picked !== null}
                onPick={i.pick}
              />
              <K.ProposalCard
                title="AI 建议 · 记为卡点"
                body="把暂时没想清楚的问题留下来，下次再看。"
                state={s.proposal}
                resultText={s.proposal === 'accepted' ? '已记下' : '已略过'}
                actions={[
                  { key: 'accept', label: '记下' },
                  { key: 'dismiss', label: '不用' },
                ]}
                onAction={i.propose}
              />
              <K.DoneCard
                title="本节讲完了"
                text="整理摘要、卡点和闪卡，再进入下一节。"
                onPress={() => i.notify('打开本节小结')}
              />
              <K.SysDivider text="第 3.5.2 节 · 示意内容" />
            </>,
          ),
        )}
        {section(
          '读书与复习',
          wrap(
            <>
              <K.GuideBar
                title="本节导读"
                body="先理解直觉，再看公式和例子。"
                expanded={s.guideOpen}
                onToggle={i.toggleGuide}
              />
              <K.BlockView
                text="原书正文使用衬线字体。点段落可解释、记笔记或从这里开始讲。"
                current
                onPress={() => i.openOverlay('selection')}
              />
              <K.ReadEnd
                label="读完这一节"
                onPress={() => i.notify('打开本节小结')}
              />
              <K.FlashCard
                front="启发式函数有什么作用？"
                back="估计到达目标还需付出的代价。（示意内容）"
                flipped={s.flipped}
                onFlip={i.flip}
              />
              <K.RateBar
                disabled={!s.flipped}
                onRate={() => i.notify('已记录评分')}
              />
              <K.BoxChart boxes={[5, 3, 2, 1, 4]} />
              <K.StackBar
                layers={[
                  { value: 15, tone: 'accent' },
                  { value: 25, tone: 'detour' },
                  { value: 40, tone: 'ok' },
                  { value: 20, tone: 'stuck' },
                ]}
              />
              <K.LayerRow
                name="当前原文"
                detail="完整小节 · 预计输入"
                tokens="3.2k"
                cached
                color={t.color.accent}
              />
            </>,
          ),
        )}
        {section(
          '书页与插图',
          wrap(
            <>
              <K.FigureView
                uri={s.previewPageUri}
                caption="合成插图 · 仅用于组件预览"
                onPress={() => i.notify('查看示意插图')}
              />
              <K.PageOrig
                uri={s.previewPageUri}
                width={320}
                height={440}
                blocks={[
                  {
                    ref: 1001,
                    x0: 0.07,
                    y0: 0.13,
                    x1: 0.93,
                    y1: 0.23,
                    state: 'current',
                  },
                  {
                    ref: 1002,
                    x0: 0.12,
                    y0: 0.43,
                    x1: 0.88,
                    y1: 0.64,
                    state: 'highlight',
                    pin: true,
                  },
                ]}
                onBlock={() => i.openOverlay('selection')}
              />
              <View style={{ minHeight: t.space.rowY * 7 }}>
                <K.Fab
                  label="导入"
                  icon="add"
                  onPress={() => i.notify('导入功能将在 T8 接入')}
                />
              </View>
            </>,
          ),
        )}
        {section(
          '浮层与材质',
          wrap(
            <>
              <K.Glass
                strength="regular"
                style={{ padding: t.space.pageX, borderRadius: t.shape.lg }}
              >
                <Text style={{ ...t.type.body, color: t.color.ink }}>
                  材质跟随皮肤，设备不支持时使用填充降级。
                </Text>
              </K.Glass>
              <K.Button
                label="打开浮层"
                onPress={() => i.openOverlay('sheet')}
              />
              <K.Button
                label="打开对话框"
                variant="secondary"
                onPress={() => i.openOverlay('dialog')}
              />
              <K.Button
                label="打开段落菜单"
                variant="ghost"
                onPress={() => i.openOverlay('selection')}
              />
              <K.Empty title="空状态" body="导入第一本书，从一小节开始。" />
              <K.Composer
                value={s.composer}
                onChange={i.setComposer}
                placeholder="不懂就问…"
                onSend={() => i.notify('已发送示意问题')}
                sendDisabled={!s.composer.trim()}
                micAvailable={false}
                quote={{
                  label: '示意原文 · p.103',
                  onClear: () => i.notify('已清除引用'),
                }}
              />
            </>,
          ),
        )}
      </ScrollView>
      <K.TabBar
        items={[
          { key: 'shelf', label: '书架', icon: 'shelf' },
          { key: 'review', label: '复习', icon: 'cards', badge: 8 },
          { key: 'notes', label: '笔记', icon: 'note' },
          { key: 'me', label: '我的', icon: 'person' },
        ]}
        active="me"
        onSelect={() => i.notify('导航将在 T4 接入')}
      />
      <K.Sheet
        visible={s.overlay === 'sheet'}
        title="皮肤切换测试"
        subtitle="修改文字后切换皮肤，浮层和内容都保留"
        onClose={i.closeOverlay}
        actions={[
          { label: '完成', kind: 'primary', onPress: i.closeOverlay },
          { label: '取消', kind: 'secondary', onPress: i.closeOverlay },
        ]}
      >
        {wrap(
          <>
            {controls}
            <K.Field
              label="浮层中的输入"
              value={s.field}
              onChange={i.setField}
            />
            <K.Note tone="accent">此处可以直接切换皮肤和深浅色。</K.Note>
          </>,
        )}
      </K.Sheet>
      <K.Dialog
        visible={s.overlay === 'dialog'}
        title="保留学习记录？"
        body="这里只展示对话框，不会删除任何内容。"
        confirm="保留"
        cancel="取消"
        onConfirm={i.closeOverlay}
        onCancel={i.closeOverlay}
      />
      {s.overlay === 'selection' ? (
        <K.SelectionMenu
          anchor={{ x: 20, y: 180, w: 300, h: 72 }}
          items={[
            { key: 'explain', label: '解释' },
            { key: 'note', label: '记笔记' },
            { key: 'teach', label: '从这里开始讲' },
          ]}
          onSelect={() => {
            i.closeOverlay();
            i.notify('已选择段落操作');
          }}
          onDismiss={i.closeOverlay}
        />
      ) : null}
      <K.ToastHost toast={s.toast ? { message: s.toast, tone: 'ok' } : null} />
    </K.Screen>
  );
}

const layout = StyleSheet.create({
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap' },
  centeredRow: { flexDirection: 'row', alignItems: 'center' },
});
