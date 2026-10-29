import { View } from 'react-native';
import { ListSection, Row, Button, Note, Empty, useTokens } from '@ui/kit';
import type { StorageState, StorageIntents } from '@features/settings/types';
import { SettingsFrame } from './MeView';
export function MeStorageView({
  state,
  intents,
}: {
  state: StorageState;
  intents: StorageIntents;
}) {
  const t = useTokens();
  return (
    <SettingsFrame title="存储与备份" state={state} back={intents.back}>
      <ListSection title="每本书">
        {state.books.map(b => (
          <Row
            key={b.id}
            title={b.title}
            subtitle={b.meta}
            right={
              <Button
                size="sm"
                variant="ghost"
                label="清理"
                onPress={() => intents.clean(b.id)}
              />
            }
          />
        ))}
        {!state.books.length ? (
          <Empty body="书架为空，导入后可在这里管理存储。" />
        ) : null}
      </ListSection>
      <ListSection>
        <Row
          title="导出备份"
          subtitle="书的地图、学习记录、笔记、闪卡、设置；不含 Key 和 Token"
          chevron
          onPress={intents.exportBackup}
        />
        <Row title="从备份恢复" chevron onPress={intents.restoreBackup} />
      </ListSection>
      <View style={{ padding: t.space.pageX }}>
        <Note tone="neutral">存储清理和备份将在完整文件管理接入后启用。</Note>
      </View>
    </SettingsFrame>
  );
}
