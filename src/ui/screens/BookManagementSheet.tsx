import { Text, View } from 'react-native';
import { Button, Note, Sheet, Switch, makeStyles } from '@ui/kit';
import type { ShelfIntents, ShelfState } from '@features/library/types';

export function BookManagementSheet({
  state,
  intents,
}: {
  state: ShelfState;
  intents: ShelfIntents;
}) {
  const s = useStyles();
  const overlay = state.overlay;
  const action = overlay && 'bookId' in overlay ? overlay : null;
  return (
    <Sheet
      visible={!!action}
      title={
        action?.kind === 'delete'
          ? '删除书籍？'
          : action?.kind === 'reparse'
          ? '重新解析'
          : action?.duplicate
          ? '这本书已在书架上'
          : '管理书籍'
      }
      onClose={intents.closeOverlay}
    >
      {action ? (
        <View style={s.content}>
          <Text style={s.title} numberOfLines={3}>
            {action.title}
          </Text>
          {action.kind === 'bookActions' ? (
            <>
              <Text style={s.body}>
                {action.restored ? '原文件已补回。' : ''}
                解析效果不好时，可以重新解析并保留学习记录。
              </Text>
              <Button
                size="block"
                onPress={() => {
                  intents.closeOverlay();
                  intents.openBook(action.bookId);
                }}
              >
                打开书籍
              </Button>
              <Button
                size="block"
                variant="secondary"
                icon="sync"
                onPress={intents.requestReparse}
              >
                重新解析
              </Button>
              <Button
                size="block"
                variant="danger"
                icon="trash"
                onPress={intents.requestDelete}
              >
                删除书籍
              </Button>
            </>
          ) : action.kind === 'reparse' ? (
            <>
              <Text style={s.body}>
                {action.format === 'pdf'
                  ? '将原文件重新上传到 MinerU，重新生成正文和目录，会消耗解析额度。'
                  : '将使用原 EPUB 文件在本机重新生成正文和目录。'}
                学习记录、笔记、闪卡和手动修改的目录会保留。
              </Text>
              {action.format === 'pdf' ? (
                <View style={s.option}>
                  <View style={s.optionText}>
                    <Text style={s.label}>使用 OCR</Text>
                    <Text style={s.hint}>
                      重新识别文字，适合扫描件或文字层有误的 PDF。
                    </Text>
                  </View>
                  <Switch
                    accessibilityLabel="重新解析使用 OCR"
                    value={action.ocr}
                    disabled={action.busy}
                    onChange={intents.setReparseOcr}
                  />
                </View>
              ) : null}
              {action.error ? <Note tone="bad">{action.error}</Note> : null}
              {action.needsToken ? (
                <Button size="block" onPress={intents.configureParser}>
                  设置解析服务
                </Button>
              ) : (
                <Button
                  size="block"
                  disabled={action.busy}
                  onPress={intents.confirmReparse}
                >
                  {action.busy ? '正在准备解析…' : '开始重新解析'}
                </Button>
              )}
            </>
          ) : (
            <>
              <Text style={s.body}>
                将从本机删除原文件、解析结果，以及这本书的学习记录、笔记和闪卡。此操作无法撤销，下载文件夹里的原书不受影响。
              </Text>
              {action.error ? <Note tone="bad">{action.error}</Note> : null}
              <Button
                size="block"
                variant="danger"
                disabled={action.busy}
                onPress={intents.confirmDelete}
              >
                {action.busy ? '正在删除…' : '确认删除书籍'}
              </Button>
            </>
          )}
          <Button
            size="block"
            variant="ghost"
            disabled={action.busy}
            onPress={intents.closeOverlay}
          >
            取消
          </Button>
        </View>
      ) : null}
    </Sheet>
  );
}
const useStyles = makeStyles(t => ({
  content: { gap: t.space.gap },
  title: { ...t.type.label, color: t.color.ink },
  body: { ...t.type.body, color: t.color.ink2 },
  label: { ...t.type.label, color: t.color.ink },
  hint: { ...t.type.caption, color: t.color.ink2, marginTop: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.gap,
    paddingVertical: t.space.gap,
  },
  optionText: { flex: 1 },
}));
