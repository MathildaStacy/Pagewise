import { Text, View, StyleSheet } from 'react-native';
import type { KitProps } from '../../kit/contracts';
import { useTokens } from '../../kit/context';
import { Gradient } from '../../kit/Gradient';

// The Win11 prototype's cv1–cv5 covers; user books retain their assigned color.
const winCovers = [
  { colors: ['#3156E8', '#6A3FD8'], spot: '#FF8AB8', x: 0.8, y: 0.85 },
  { colors: ['#C2412D', '#7D1F4E'], spot: '#FFC56B', x: 0.8, y: 0.8 },
  { colors: ['#0F6B5C', '#1D3F6E'], spot: '#5FE3C0', x: 0.2, y: 0.9 },
];
export function Cover({
  title,
  color,
  size = 'md',
  width: customWidth,
  subtitle,
}: KitProps['Cover']) {
  const t = useTokens(),
    win = t.brand!.kind === 'win11',
    google = t.brand!.kind === 'google';
  const width =
    customWidth ??
    (win
      ? size === 'lg'
        ? 84
        : size === 'sm'
        ? 48
        : 68
      : size === 'lg'
      ? 62
      : size === 'sm'
      ? 42
      : google
      ? 56
      : 54);
  const height = customWidth
    ? width / 0.72
    : win
    ? size === 'lg'
      ? 116
      : size === 'sm'
      ? 66
      : 94
    : google && size === 'md'
    ? 76
    : (width * 74) / 54;
  const known = /^人工智能：现代方法/.test(title)
    ? 0
    : /^统计学习方法/.test(title)
    ? 1
    : /^Designing Data/.test(title)
    ? 2
    : -1;
  const palette = win && known >= 0 ? winCovers[known] : null;
  const bookTitle = title.replace(/[（(].*$/, ''),
    edition = title.match(/[（(](.*)[）)]/)?.[1];
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${title}，书封面`}
      accessibilityState={{}}
    >
      <Gradient
        colors={palette?.colors ?? [color, color]}
        vertical={win}
        spots={
          palette
            ? [
                {
                  x: palette.x,
                  y: palette.y,
                  rx: 0.8,
                  ry: 0.6,
                  color: palette.spot,
                },
              ]
            : []
        }
        style={
          StyleSheet.create({
            root: {
              width,
              height,
              borderRadius: win ? 8 : google ? 8 : 4,
              padding: win ? (size === 'lg' ? 10 : size === 'sm' ? 6 : 9) : 6,
              justifyContent: win ? 'flex-start' : 'flex-end',
              boxShadow: win
                ? '0 6px 14px rgba(0,0,0,.22)'
                : google
                ? undefined
                : '0 1px 3px rgba(0,0,0,.25)',
            },
          }).root
        }
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Gradient
            colors={
              win
                ? ['rgba(255,255,255,.28)', 'rgba(255,255,255,0)']
                : [
                    'rgba(0,0,0,.2)',
                    'rgba(255,255,255,.14)',
                    'rgba(255,255,255,0)',
                  ]
            }
            style={
              StyleSheet.create({
                root: { flex: 1, borderRadius: win ? 8 : google ? 8 : 4 },
              }).root
            }
          />
        </View>
        <Text
          numberOfLines={3}
          style={
            StyleSheet.create({
              root: {
                color: '#FFFFFF',
                fontSize: win
                  ? size === 'lg'
                    ? 12
                    : size === 'sm'
                    ? 8.5
                    : 10.5
                  : 10,
                lineHeight: win && size === 'lg' ? 15 : 12.5,
                fontWeight: google ? '500' : '700',
              },
            }).root
          }
        >
          {Array.from(bookTitle).slice(0, 12).join('')}
          {win && bookTitle.length > 12 ? '…' : ''}
        </Text>
        {win && (edition || subtitle) ? (
          <Text
            numberOfLines={1}
            style={
              StyleSheet.create({
                root: {
                  color: '#FFFFFF',
                  opacity: 0.85,
                  marginTop: 3,
                  fontSize: size === 'lg' ? 9.5 : 8.5,
                },
              }).root
            }
          >
            {edition ?? subtitle?.split(/[,，]/)[0]}
          </Text>
        ) : null}
      </Gradient>
    </View>
  );
}
