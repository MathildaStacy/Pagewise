import { View } from 'react-native';
import { Sheet, Dialog, usePresentation } from '@ui/kit';
import type { StorageState, StorageIntents } from '@features/settings/types';
import {
  SettingsFrame,
  SettingsGroup,
  SettingsRow,
  SettingsButton,
  SettingsSwitch,
  SettingsNote,
  useSettingsStyles,
} from './MeView';
export function MeStorageView({
  state,
  intents,
}: {
  state: StorageState;
  intents: StorageIntents;
}) {
  const { groupedLists } = usePresentation(),
    s = useSettingsStyles();
  return (
    <SettingsFrame title="存储与备份" state={state} back={intents.back}>
      <SettingsGroup title="每本书">
        {state.books.length ? (
          state.books.map(b => (
            <SettingsRow
              key={b.id}
              title={b.title}
              subtitle={b.meta}
              right={
                <SettingsButton
                  small
                  variant={groupedLists ? 'danger' : 'ghost'}
                  label={b.needsReparse ? '重新解析' : '清理'}
                  onPress={() =>
                    b.needsReparse ? intents.reparse(b.id) : intents.clean(b.id)
                  }
                />
              }
            />
          ))
        ) : (
          <SettingsRow title="书架为空，导入后可在这里管理存储。" />
        )}
      </SettingsGroup>
      <SettingsGroup title={groupedLists ? '备份' : undefined}>
        {state.lastBackup ? (
          <SettingsNote>{state.lastBackup}</SettingsNote>
        ) : null}
        <SettingsRow
          title="导出备份"
          subtitle="整库：书的地图、学习记录、笔记、闪卡、设置；不含 API Key 和 Token"
          chevron
          onPress={intents.exportBackup}
        />
        <SettingsRow
          title="从备份恢复"
          chevron
          onPress={intents.restoreBackup}
        />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsRow
          title="备份包含原文件"
          subtitle="默认只备份学习数据"
          right={
            <SettingsSwitch
              label="备份包含原文件"
              value={state.includeOriginals}
              onChange={intents.setIncludeOriginals}
            />
          }
        />
      </SettingsGroup>
      <Dialog
        danger={groupedLists}
        visible={!!state.confirmClean}
        title="清理解析缓存？"
        body="会删除这本书的解析结果（Markdown、内容块、图片），保留学习记录、笔记和闪卡。以后再打开需要重新解析。"
        confirm="清理"
        cancel="取消"
        onConfirm={intents.confirmClean}
        onCancel={intents.closeOverlay}
      />
      <Sheet
        visible={!!state.confirmReparse}
        title="重新解析原文件？"
        onClose={intents.closeOverlay}
      >
        <SettingsNote>
          PDF 将重新上传到 MinerU，可能消耗解析额度；EPUB
          在本机解析。原有学习记录和手动目录会保留。
        </SettingsNote>
        <View style={s.overlayActions}>
          <SettingsButton
            block
            label="开始重新解析"
            onPress={intents.confirmReparse}
          />
          <SettingsButton
            block
            variant="ghost"
            label="取消"
            onPress={intents.closeOverlay}
          />
        </View>
      </Sheet>
      <Sheet
        visible={state.confirmRestore}
        title="从备份恢复？"
        onClose={intents.closeOverlay}
      >
        {state.restorePreview ? (
          <SettingsNote>{state.restorePreview}</SettingsNote>
        ) : null}
        <SettingsNote>
          恢复将替换本机学习数据，完成后重新打开应用。备份不含 Key 和
          Token，新设备上需要重新填写。请先导出当前数据。
        </SettingsNote>
        <View style={s.overlayActions}>
          <SettingsButton
            block
            label="恢复这份备份"
            onPress={intents.confirmRestore}
          />
          <SettingsButton
            block
            variant="ghost"
            label="取消"
            onPress={intents.closeOverlay}
          />
        </View>
      </Sheet>
    </SettingsFrame>
  );
}
