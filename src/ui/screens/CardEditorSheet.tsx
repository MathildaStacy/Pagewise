import { View } from 'react-native';
import { Field, Note, Sheet, makeStyles } from '@ui/kit';
import type {
  CardEditorIntents,
  CardEditorState,
} from '@features/review/types';

export function CardEditorSheet({
  state,
  intents,
}: {
  state?: CardEditorState;
  intents: CardEditorIntents;
}) {
  const s = useStyles();
  if (!state) return null;
  return (
    <Sheet
      visible
      title="编辑闪卡"
      subtitle="修改内容会保留复习进度和历史。"
      detent="full"
      onClose={intents.close}
      actions={[
        {
          label: '取消',
          kind: 'secondary',
          disabled: state.saving,
          onPress: intents.close,
        },
        {
          label: state.saving ? '正在保存…' : '保存修改',
          kind: 'primary',
          disabled: state.saving || !state.front.trim() || !state.back.trim(),
          onPress: intents.save,
        },
      ]}
    >
      <View style={s.fields} pointerEvents={state.saving ? 'none' : 'auto'}>
        {state.error ? <Note tone="bad">{state.error}</Note> : null}
        <Field
          label="问题"
          multiline
          value={state.front}
          onChange={intents.setFront}
        />
        <Field
          label="答案"
          multiline
          value={state.back}
          onChange={intents.setBack}
        />
      </View>
    </Sheet>
  );
}
const useStyles = makeStyles(t => ({
  fields: { gap: t.space.gap },
}));
