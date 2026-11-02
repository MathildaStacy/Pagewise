import { View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import type { RichDoc } from './contracts';
import { RichView } from './proxy';
import { makeStyles } from './makeStyles';

/** Shared reader/refinement table: preserve math and text scripts in each cell. */
export function TableView({
  rows,
  preview = false,
  selectable = false,
}: {
  rows: RichDoc[][];
  preview?: boolean;
  selectable?: boolean;
}) {
  const s = useStyles();
  const content = (
    <View style={preview ? s.preview : undefined}>
      {(preview ? rows.slice(0, 3) : rows).map((row, i) => (
        <View key={i} style={s.row}>
          {(preview ? row.slice(0, 2) : row).map((cell, j) => (
            <View
              key={j}
              style={[s.cell, preview && s.previewCell, i === 0 && s.header]}
            >
              <RichView
                doc={cell}
                typography="tableCell"
                selectable={selectable}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
  return preview ? (
    <View pointerEvents="none">{content}</View>
  ) : (
    <ScrollView
      horizontal
      nestedScrollEnabled
      disallowInterruption
      accessibilityLabel="表格，左右滑动查看全部列"
    >
      {content}
    </ScrollView>
  );
}
const useStyles = makeStyles(t => ({
  row: { flexDirection: 'row' },
  cell: {
    width: 170,
    padding: t.space.gap,
    borderWidth: 1,
    borderColor: t.color.line,
  },
  header: { backgroundColor: t.color.surfaceAlt },
  preview: { maxHeight: 180, overflow: 'hidden' },
  previewCell: { width: undefined, flex: 1, minWidth: 0 },
}));
