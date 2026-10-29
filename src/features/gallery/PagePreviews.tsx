import { useState, type ComponentType } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppBar, Button, Note, Segmented, useTokens } from '@ui/kit';
import { ShelfView } from '@ui/screens/ShelfView';
import { BookMapView } from '@ui/screens/BookMapView';
import { ParseProgressView } from '@ui/screens/ParseProgressView';
import { ImportSettingsView } from '@ui/screens/ImportSettingsView';
import { ReviewView } from '@ui/screens/ReviewView';
import { ReviewSessionView } from '@ui/screens/ReviewSessionView';
import { NotesView } from '@ui/screens/NotesView';
import { NotesBookView } from '@ui/screens/NotesBookView';
import { NoteDetailView } from '@ui/screens/NoteDetailView';
import { MeView } from '@ui/screens/MeView';
import { MeMineruView } from '@ui/screens/MeMineruView';
import { MeAIView } from '@ui/screens/MeAIView';
import { MeAIEditView } from '@ui/screens/MeAIEditView';
import { MePrefsView } from '@ui/screens/MePrefsView';
import { MeStorageView } from '@ui/screens/MeStorageView';
import { AboutView } from '@ui/screens/AboutView';
import {
  shelfSamples,
  mapSamples,
  parseSamples,
  importSamples,
} from '@features/library/samples';
import { reviewSamples, reviewSessionSamples } from '@features/review/samples';
import {
  notesSamples,
  notesBookSamples,
  noteDetailSamples,
} from '@features/notes/samples';
import {
  meSamples,
  mineruSamples,
  aiSamples,
  aiEditSamples,
  prefsSamples,
  storageSamples,
  aboutSamples,
} from '@features/settings/samples';
import { useAppearanceVM } from '@features/appearance/useAppearanceVM';

const noop = () => {};
/** Preview callbacks intentionally do nothing: samples never read or mutate a library. */
function preview<S, I extends object>(
  label: string,
  Page: ComponentType<{ state: S; intents: I }>,
  samples: Record<string, S>,
) {
  const intents = new Proxy({} as I, { get: () => noop });
  return {
    label,
    states: Object.keys(samples),
    render: (key: string) => (
      <Page
        state={samples[key] ?? Object.values(samples)[0]}
        intents={intents}
      />
    ),
  };
}
export const pagePreviews = {
  shelf: preview('书架', ShelfView, shelfSamples),
  map: preview('书的地图', BookMapView, mapSamples),
  parse: preview('解析进度', ParseProgressView, parseSamples),
  import: preview('解析设置', ImportSettingsView, importSamples),
  review: preview('复习', ReviewView, reviewSamples),
  cards: preview('复习闪卡', ReviewSessionView, reviewSessionSamples),
  notes: preview('笔记', NotesView, notesSamples),
  notesBook: preview('按节笔记', NotesBookView, notesBookSamples),
  detail: preview('一节的笔记', NoteDetailView, noteDetailSamples),
  me: preview('我的', MeView, meSamples),
  mineru: preview('解析服务', MeMineruView, mineruSamples),
  ai: preview('AI 服务', MeAIView, aiSamples),
  aiEdit: preview('编辑 AI 服务', MeAIEditView, aiEditSamples),
  prefs: preview('讲解偏好', MePrefsView, prefsSamples),
  storage: preview('存储与备份', MeStorageView, storageSamples),
  about: preview('关于 Pagewise', AboutView, aboutSamples),
};
export const pagePreviewItems = Object.entries(pagePreviews).map(
  ([key, p]) => ({ key, label: p.label }),
);
export function PagePreviews({
  pageKey,
  back,
}: {
  pageKey: string;
  back(): void;
}) {
  const page = pagePreviews[pageKey as keyof typeof pagePreviews];
  const [sample, setSample] = useState(page.states[0]);
  const vm = useAppearanceVM(back);
  const t = useTokens();
  return (
    <View style={[styles.fill, { backgroundColor: t.color.bg }]}>
      <AppBar title={`页面样例 · ${page.label}`} variant="push" onBack={back} />
      <View style={{ padding: t.space.pageX, gap: t.space.gap }}>
        <Segmented
          options={vm.state.skinOptions}
          value={vm.state.skin}
          onChange={vm.intents.setSkin}
        />
        <Segmented
          options={vm.state.schemeOptions}
          value={vm.state.scheme}
          onChange={vm.intents.setScheme}
        />
        <Segmented
          options={page.states.map(key => ({
            key,
            label:
              (
                {
                  normal: '正常',
                  empty: '空',
                  loading: '加载',
                  error: '错误',
                  long: '长文本',
                  front: '正面',
                  finished: '完成',
                } as Record<string, string>
              )[key] ?? key,
          }))}
          value={sample}
          onChange={setSample}
        />
        <Note tone="neutral">以下为固定样例，操作仅供展示。</Note>
      </View>
      <View style={styles.fill}>{page.render(sample)}</View>
      <Button label="返回组件对照" variant="text" onPress={back} />
    </View>
  );
}
const styles = StyleSheet.create({ fill: { flex: 1 } });
