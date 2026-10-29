import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTokens } from './context';

/** The floating Apple composer fades the reading surface into its bottom edge. */
export function BottomFade() {
  const t = useTokens();
  return (
    <Svg style={styles.fill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <LinearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={t.color.bg} stopOpacity={0} />
          <Stop offset="0.46" stopColor={t.color.bg} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#bottomFade)" />
    </Svg>
  );
}
const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
});
