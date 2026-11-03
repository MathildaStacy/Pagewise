import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import type { RichDoc, RichTable } from './contracts';
import { useTokens } from './context';
import { RichView } from './proxy';
import { makeStyles } from './makeStyles';
import { docLength } from './reveal/doc';

/** Shared reader/refinement table: preserve math and text scripts in each cell. */
export function TableView({
  rows,
  grid,
  preview = false,
  selectable = false,
}: {
  rows: RichDoc[][];
  grid?: RichTable;
  preview?: boolean;
  selectable?: boolean;
}) {
  const s = useStyles();
  if (grid)
    return <GridTable grid={grid} preview={preview} selectable={selectable} />;
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

/** Measure cell contents before distributing extra height across spanning rows. */
function GridTable({
  grid,
  preview,
  selectable,
}: {
  grid: RichTable;
  preview: boolean;
  selectable: boolean;
}) {
  const s = useStyles();
  const t = useTokens();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(320);
  const key = JSON.stringify([grid, width, fontScale, t.type.bookBody]);
  const [measurement, setMeasurement] = useState<{
    key: string;
    cells: Record<number, number>;
  }>({ key: '', cells: {} });
  const measured = measurement.key === key ? measurement.cells : {};
  const cellFont = t.type.bookBody.fontSize * 0.9 * fontScale;
  const columnWidths = Array<number>(grid.columns).fill(cellFont * 5);
  for (const cell of grid.cells) {
    if (cell.colSpan === 1)
      columnWidths[cell.col] = Math.max(
        columnWidths[cell.col],
        Math.min(docLength(cell.doc) * 0.55, 12) * cellFont + t.space.gap * 2,
      );
  }
  const extra = Math.max(
    0,
    (width - columnWidths.reduce((sum, value) => sum + value, 0)) /
      grid.columns,
  );
  const left = (col: number) =>
    columnWidths.slice(0, col).reduce((sum, value) => sum + value + extra, 0);
  const heights = Array<number>(grid.rows).fill(
    t.type.bookBody.lineHeight * fontScale + 20,
  );
  grid.cells.forEach((cell, index) => {
    if (cell.rowSpan === 1)
      heights[cell.row] = Math.max(heights[cell.row], measured[index] ?? 0);
  });
  grid.cells.forEach((cell, index) => {
    const current = heights
      .slice(cell.row, cell.row + cell.rowSpan)
      .reduce((sum, h) => sum + h, 0);
    heights[cell.row + cell.rowSpan - 1] += Math.max(
      0,
      (measured[index] ?? 0) - current,
    );
  });
  const top = (row: number) =>
    heights.slice(0, row).reduce((sum, h) => sum + h, 0);
  const content = (
    <View style={{ width: left(grid.columns), height: top(grid.rows) }}>
      {grid.cells.map((cell, index) => (
        <View
          key={index}
          testID={`table-cell-${cell.row}-${cell.col}`}
          style={[
            s.gridCell,
            cell.header && s.header,
            {
              left: left(cell.col),
              top: top(cell.row),
              width: left(cell.col + cell.colSpan) - left(cell.col),
              height: top(cell.row + cell.rowSpan) - top(cell.row),
            },
          ]}
        >
          <View
            // Width/font invalidation can leave a cell's native size unchanged. Remount
            // its measuring view so onLayout repopulates the new measurement set.
            key={key}
            style={s.cellWords}
            onLayout={event => {
              const height = Math.ceil(event.nativeEvent.layout.height);
              setMeasurement(old => {
                const cells = old.key === key ? old.cells : {};
                return cells[index] === height
                  ? old
                  : { key, cells: { ...cells, [index]: height } };
              });
            }}
          >
            <RichView
              doc={cell.doc}
              typography="tableCell"
              selectable={selectable}
            />
          </View>
        </View>
      ))}
    </View>
  );
  return (
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      {preview ? (
        <View style={s.preview} pointerEvents="none">
          {content}
        </View>
      ) : (
        <ScrollView
          horizontal
          nestedScrollEnabled
          disallowInterruption
          accessibilityLabel="表格，左右滑动查看全部列"
        >
          {content}
        </ScrollView>
      )}
    </View>
  );
}
const useStyles = makeStyles(t => ({
  gridCell: {
    position: 'absolute',
    borderWidth: 0.5,
    borderColor: t.color.line,
  },
  // Let text measure at its natural height instead of the row's previous height.
  cellWords: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: t.space.gap,
  },
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
