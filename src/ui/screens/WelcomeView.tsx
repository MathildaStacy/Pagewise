import { Text, View } from 'react-native';
import {
  Button,
  Field,
  Gradient,
  Icon,
  IconButton,
  Note,
  Screen,
  Segmented,
  Switch,
  makeStyles,
  useTokens,
} from '@ui/kit';
import type { WelcomeState, WelcomeIntents } from '@features/home/types';
import { SettingsGroup, SettingsRow } from './MeView';

export function WelcomeView({
  state,
  intents,
}: {
  state: WelcomeState;
  intents: WelcomeIntents;
}) {
  const s = useStyles(),
    t = useTokens();
  return (
    <View style={s.root}>
      <Screen scroll>
        {state.step ? (
          <View style={s.top}>
            <IconButton
              icon="back"
              label="上一步"
              disabled={state.busy}
              onPress={intents.back}
            />
            <View style={s.segments}>
              {[1, 2, 3].map(i => (
                <View key={i} style={[s.step, i <= state.step && s.stepOn]} />
              ))}
            </View>
            <Text style={s.small}>{state.step}/3</Text>
          </View>
        ) : null}
        {state.step === 0 ? (
          <View style={s.welcome}>
            <Gradient
              colors={t.brand?.ai ?? [t.color.accent, t.color.detour]}
              style={s.logo}
            >
              <Icon name="logo" color={t.color.onAccent} size={52} />
            </Gradient>
            <Text style={s.name}>Pagewise</Text>
            <Text style={s.tagline}>带着整本书的 AI 伴读</Text>
            <View style={s.features}>
              <SettingsRow
                title="一节一节讲给你听"
                subtitle="AI 先读完这一节原文，再按「步」讲；每个说法都带页码。"
                icon={<Icon name="teach" variant="color" size={40} />}
              />
              <SettingsRow
                title="随时岔出去问"
                subtitle="讲 A* 时问「这跟前面的一致代价搜索什么关系」，它会回去读那一节。"
                icon={<Icon name="branch" variant="color" size={40} />}
              />
              <SettingsRow
                title="学完自动整理"
                subtitle="摘要、卡点、闪卡草稿，你勾选后进复习。"
                icon={<Icon name="cards" variant="color" size={40} />}
              />
            </View>
            <Note tone="neutral" variant="ai" icon="lock">
              本地优先：书和学习记录只存在这台手机上。你需要自己准备一个 AI
              服务的 Key；PDF 还需要 MinerU Token。
            </Note>
          </View>
        ) : null}
        {state.step === 1 ? (
          <View style={s.body}>
            <Text style={s.title}>配置 AI 服务</Text>
            <Text style={s.description}>
              讲解、岔路、解释、摘要都靠它。之后可以在「我的 → AI
              服务」里加更多。
            </Text>
            <View style={s.group}>
              {[
                {
                  key: 'claude',
                  title: 'Claude 官方',
                  sub: 'Anthropic Messages · api.anthropic.com',
                  icon: 'spark' as const,
                },
                {
                  key: 'openai',
                  title: 'OpenAI 官方',
                  sub: 'OpenAI Responses · api.openai.com',
                  icon: 'cpu' as const,
                },
                {
                  key: 'relay',
                  title: 'OpenAI 兼容（中转 / 本地）',
                  sub: 'Chat Completions · 自己填 Base URL',
                  icon: 'settings' as const,
                },
              ].map(provider => (
                <SettingsRow
                  key={provider.key}
                  title={provider.title}
                  subtitle={provider.sub}
                  icon={<Icon name={provider.icon} variant="color" size={32} />}
                  onPress={
                    state.busy
                      ? undefined
                      : () => intents.provider(provider.key)
                  }
                  right={
                    <View
                      accessibilityRole="radio"
                      accessibilityState={{
                        checked: state.provider === provider.key,
                      }}
                      style={[
                        s.radio,
                        state.provider === provider.key && s.radioOn,
                      ]}
                    />
                  }
                />
              ))}
            </View>
            <View style={s.fields}>
              {state.provider === 'relay' ? (
                <Field
                  label="Base URL"
                  value={state.baseUrl}
                  placeholder="https://api.example-relay.com/v1"
                  onChange={v => intents.field('baseUrl', v)}
                />
              ) : null}
              <Field
                label="API Key"
                value={state.key}
                secure
                placeholder={state.provider === 'claude' ? 'sk-ant-…' : 'sk-…'}
                onChange={v => intents.field('key', v)}
              />
              <Field
                label="模型 ID（可选，测试连接时自动读取）"
                value={state.model}
                placeholder="填写服务支持的模型 ID"
                onChange={v => intents.field('model', v)}
              />
              <Button
                size="block"
                variant="secondary"
                disabled={state.busy}
                onPress={intents.test}
              >
                {state.busy ? '正在连接…' : '测试连接'}
              </Button>
            </View>
          </View>
        ) : null}
        {state.step === 2 ? (
          <View style={s.body}>
            <Text style={s.title}>MinerU Token</Text>
            <Text style={s.description}>
              PDF 要先交给 MinerU 解析成文字、公式和图片。EPUB
              不需要，可以跳过。
            </Text>
            <View style={s.fields}>
              <Field
                label="Token"
                value={state.token}
                secure
                placeholder="在 mineru.net 申请后粘贴"
                onChange={v => intents.field('token', v)}
              />
              <Field
                label="有效期"
                value={state.expiry}
                placeholder="2027-01-26"
                onChange={v => intents.field('expiry', v)}
              />
            </View>
            <Note tone="neutral">
              每天 1000 页最高优先级，超出后排队变慢，不会被拦截。单个文件最多
              600 页，Pagewise 会自动分片。
            </Note>
          </View>
        ) : null}
        {state.step === 3 ? (
          <>
            <View style={s.body}>
              <Text style={s.title}>你喜欢怎么听</Text>
              <Text style={s.description}>
                随时可以在「我的 → 讲解偏好」里改。
              </Text>
            </View>
            <SettingsGroup>
              <SettingsRow
                title="先讲直觉，再讲公式"
                right={
                  <Switch
                    value={state.prefs.intuitionFirst}
                    onChange={v => intents.pref('intuitionFirst', v)}
                    accessibilityLabel="先讲直觉"
                  />
                }
              />
              <SettingsRow
                title="每段讲解长度"
                right={
                  <View style={s.length}>
                    <Segmented
                      options={['短', '中', '长'].map(key => ({
                        key,
                        label: key,
                      }))}
                      value={state.prefs.length}
                      onChange={v => intents.pref('length', v)}
                    />
                  </View>
                }
              />
              <SettingsRow
                title="一节讲完做小测"
                right={
                  <Switch
                    value={state.prefs.quizAtEnd}
                    onChange={v => intents.pref('quizAtEnd', v)}
                    accessibilityLabel="一节讲完做小测"
                  />
                }
              />
              <SettingsRow
                title="术语中英对照"
                subtitle="例如：可容许的（admissible）"
                right={
                  <Switch
                    value={state.prefs.bilingual}
                    onChange={v => intents.pref('bilingual', v)}
                    accessibilityLabel="术语中英对照"
                  />
                }
              />
            </SettingsGroup>
            <View style={s.body}>
              <Field
                label="补充要求（可选）"
                multiline
                value={state.prefs.extra}
                onChange={v => intents.pref('extra', v)}
                placeholder="例如：多用编程里的类比；伪代码用 Python"
              />
            </View>
          </>
        ) : null}
        {state.error ? (
          <View style={s.feedback}>
            <Note tone="bad">{state.error}</Note>
          </View>
        ) : null}
        {state.notice ? (
          <View style={s.feedback}>
            <Note tone="accent">{state.notice}</Note>
          </View>
        ) : null}
      </Screen>
      <View style={s.footer}>
        <Button size="block" disabled={state.busy} onPress={intents.next}>
          {['开始配置', '下一步', '下一步', '开始学习'][state.step]}
        </Button>
        {state.step < 3 ? (
          <Button
            size="block"
            variant="text"
            disabled={state.busy}
            onPress={intents.skip}
          >
            {['先逛逛，稍后配置', '稍后再配', '我只读 EPUB，跳过'][state.step]}
          </Button>
        ) : null}
      </View>
    </View>
  );
}
const useStyles = makeStyles(t => ({
  root: { flex: 1, backgroundColor: t.color.bg },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  small: { ...t.type.caption, color: t.color.ink2 },
  segments: { flex: 1, flexDirection: 'row', gap: 5 },
  step: {
    height: 4,
    flex: 1,
    borderRadius: t.shape.pill,
    backgroundColor: t.color.line,
  },
  stepOn: { backgroundColor: t.color.accent },
  welcome: { paddingHorizontal: 20, paddingTop: 28, alignItems: 'center' },
  logo: {
    width: 96,
    height: 96,
    borderRadius: t.shape.xl + 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  name: {
    ...t.type.largeTitle,
    fontSize: t.type.largeTitle.fontSize + 2,
    color: t.color.ink,
  },
  tagline: {
    ...t.type.body,
    color: t.color.ink2,
    marginTop: 4,
    marginBottom: 22,
  },
  features: {
    width: '100%',
    backgroundColor: t.color.glass,
    borderRadius: t.shape.lg,
    marginBottom: 14,
    overflow: 'hidden',
  },
  body: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 20, gap: 12 },
  title: {
    ...t.type.largeTitle,
    fontSize: t.type.largeTitle.fontSize - 4,
    lineHeight: 33,
    color: t.color.ink,
  },
  description: { ...t.type.body, color: t.color.ink2 },
  group: {
    backgroundColor: t.color.glass,
    borderRadius: t.shape.lg,
    overflow: 'hidden',
  },
  fields: {
    padding: 14,
    gap: 14,
    borderRadius: t.shape.lg,
    backgroundColor: t.color.glass,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: t.shape.pill,
    borderWidth: 1.5,
    borderColor: t.color.ink2,
  },
  radioOn: { borderWidth: 6, borderColor: t.color.accent },
  length: { width: 126 },
  feedback: { paddingHorizontal: 16, marginBottom: 12 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 4,
    backgroundColor: t.color.glass,
  },
}));
