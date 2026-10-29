import { useId, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
  type TextLayoutEvent,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { parseColor } from './color';

// react-native-svg replaces the color's alpha with stopOpacity.
function stopPaint(color: string, opacity = 1) {
  const { r, g, b, a } = parseColor(color);
  return { stopColor: `rgb(${r},${g},${b})`, stopOpacity: a * opacity };
}

export interface GradientSpot {
  x: number;
  y: number;
  rx: number;
  ry: number;
  color: string;
}

/** Native vector gradient; keeps text and controls in the native view tree. */
export function Gradient({
  colors,
  children,
  style,
  vertical = false,
  spots = [],
}: {
  colors: string[];
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  vertical?: boolean;
  spots?: GradientSpot[];
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const requestedRadius = StyleSheet.flatten(style)?.borderRadius;
  const radius = Math.min(
    typeof requestedRadius === 'number' ? requestedRadius : 0,
    bounds.width / 2,
    bounds.height / 2,
  );
  return (
    <View
      style={[styles.root, style]}
      onLayout={({ nativeEvent: { layout } }) =>
        setBounds(previous =>
          previous.width === layout.width && previous.height === layout.height
            ? previous
            : { width: layout.width, height: layout.height },
        )
      }
    >
      <Svg
        pointerEvents="none"
        width={bounds.width}
        height={bounds.height}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <LinearGradient
            id={id}
            x1="0"
            y1="0"
            x2={vertical ? 0.25 : 1}
            y2={vertical ? 1 : 0.35}
          >
            {colors.map((color, i) => (
              <Stop
                key={i}
                offset={i / Math.max(1, colors.length - 1)}
                {...stopPaint(color)}
              />
            ))}
          </LinearGradient>
          {spots.map((spot, i) => (
            <RadialGradient
              key={i}
              id={`${id}s${i}`}
              cx={spot.x}
              cy={spot.y}
              rx={spot.rx}
              ry={spot.ry}
            >
              <Stop offset="0" {...stopPaint(spot.color)} />
              <Stop offset={0.7} {...stopPaint(spot.color, 0)} />
            </RadialGradient>
          ))}
        </Defs>
        <Rect width="100%" height="100%" rx={radius} fill={`url(#${id})`} />
        {spots.map((_, i) => (
          <Rect
            key={i}
            width="100%"
            height="100%"
            rx={radius}
            fill={`url(#${id}s${i})`}
          />
        ))}
      </Svg>
      {children}
    </View>
  );
}
const styles = StyleSheet.create({ root: { overflow: 'hidden' } });

/** Native text keeps measurement, ellipsis and font scaling; SVG paints its ink. */
export function GradientText({
  children,
  colors,
  style,
}: {
  children: string;
  colors: string[];
  style: StyleProp<TextStyle>;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const { fontScale } = useWindowDimensions();
  const [line, setLine] = useState<
    TextLayoutEvent['nativeEvent']['lines'][number] | null
  >(null);
  const textStyle = StyleSheet.flatten(style);
  return (
    <View>
      <Text
        numberOfLines={1}
        style={[style, gradientTextStyles.measure]}
        onTextLayout={e => setLine(e.nativeEvent.lines[0] ?? null)}
      >
        {children}
      </Text>
      {line ? (
        <Svg
          pointerEvents="none"
          accessible={false}
          width="100%"
          height="100%"
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
              {colors.map((color, i) => (
                <Stop
                  key={i}
                  offset={i / Math.max(1, colors.length - 1)}
                  {...stopPaint(color)}
                />
              ))}
            </LinearGradient>
          </Defs>
          <SvgText
            x={line.x}
            y={line.y + line.ascender}
            fontSize={(textStyle?.fontSize ?? 13) * fontScale}
            fontFamily={textStyle?.fontFamily}
            fontWeight={textStyle?.fontWeight}
            fill={`url(#${id})`}
          >
            {line.text}
          </SvgText>
        </Svg>
      ) : null}
    </View>
  );
}
const gradientTextStyles = StyleSheet.create({ measure: { opacity: 0 } });

export function ProgressRing({
  value,
  color,
  track,
  children,
  colors,
}: {
  value: number;
  color: string;
  track: string;
  children?: ReactNode;
  colors?: string[];
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View style={ringStyles.root}>
      <Svg
        width={72}
        height={72}
        viewBox="0 0 64 64"
        style={StyleSheet.absoluteFill}
      >
        {colors ? (
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              {colors.map((stop, i) => (
                <Stop
                  key={i}
                  offset={i / Math.max(1, colors.length - 1)}
                  {...stopPaint(stop)}
                />
              ))}
            </LinearGradient>
          </Defs>
        ) : null}
        <Circle
          cx={32}
          cy={32}
          r={26}
          fill="none"
          stroke={track}
          strokeWidth={7}
        />
        <Circle
          cx={32}
          cy={32}
          r={26}
          fill="none"
          stroke={colors ? `url(#${id})` : color}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0, Math.min(1, value)) * 163.36} 163.36`}
          rotation={-90}
          origin="32,32"
        />
      </Svg>
      {children}
    </View>
  );
}
const ringStyles = StyleSheet.create({
  root: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
