import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, IconButton, Row, Segmented, Sheet, makeStyles } from '@ui/kit';
import type {
  ReaderState,
  ReadingAppearance,
  StudyIntents,
} from '@features/study/types';

export function ReadingSettings({
  reading,
  intents,
}: {
  reading?: ReadingAppearance;
  intents: StudyIntents;
}) {
  const [open, setOpen] = useState(false);
  const s = useStyles();
  return (
    <>
      <Button variant="text" label="阅读设置" onPress={() => setOpen(true)} />
      <Sheet visible={open} title="阅读设置" onClose={() => setOpen(false)}>
        <View style={s.settings}>
          <Text style={s.label}>字号</Text>
          <Segmented
            accessibilityLabel="阅读字号"
            options={[
              { key: 's', label: '小' },
              { key: 'm', label: '中' },
              { key: 'l', label: '大' },
            ]}
            value={reading?.readingSize ?? 'm'}
            onChange={value =>
              intents.setReadingAppearance?.({
                readingSize: value as ReadingAppearance['readingSize'],
              })
            }
          />
          <Text style={s.hint}>同时应用于原文、译文和 AI 讲解。</Text>
          <Text style={s.label}>显示</Text>
          <Segmented
            accessibilityLabel="阅读显示模式"
            options={[
              { key: 'system', label: '跟随系统' },
              { key: 'light', label: '浅色' },
              { key: 'dark', label: '深色' },
            ]}
            value={reading?.scheme ?? 'system'}
            onChange={value =>
              intents.setReadingAppearance?.({
                scheme: value as ReadingAppearance['scheme'],
              })
            }
          />
        </View>
      </Sheet>
    </>
  );
}

/** Daily reading actions stay visible; occasional tools are one tap away. */
export function ReadingTools({
  read,
  reading,
  intents,
}: {
  read: ReaderState;
  reading?: ReadingAppearance;
  intents: StudyIntents;
}) {
  const [open, setOpen] = useState(false);
  const s = useStyles();
  return (
    <View style={s.tools}>
      <Button
        variant="text"
        label="翻译本节"
        disabled={!read.canTranslate}
        onPress={() => intents.translateSection?.()}
      />
      <ReadingSettings reading={reading} intents={intents} />
      <IconButton icon="more" label="阅读工具" onPress={() => setOpen(true)} />
      <Sheet visible={open} title="阅读工具" onClose={() => setOpen(false)}>
        <Row
          title="本节对话"
          subtitle="查看和切换本节的独立对话"
          onPress={() => {
            setOpen(false);
            intents.openConversations?.();
          }}
        />
        <Row
          title="精修本节"
          subtitle="核对原页，修复文字、表格和图表"
          onPress={
            read.loading || !read.items.length
              ? undefined
              : () => {
                  setOpen(false);
                  intents.openRefinement?.();
                }
          }
        />
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles(t => ({
  tools: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.space.pageX,
    gap: 8,
  },
  settings: { gap: 12, paddingVertical: 8 },
  label: { ...t.type.label, color: t.color.ink },
  hint: { ...t.type.caption, color: t.color.ink2 },
}));
