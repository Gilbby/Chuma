import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Polyline, Defs, LinearGradient, Stop, Rect, Path } from "react-native-svg";
import { useTheme } from "@/src/theme/ThemeContext";

interface Point {
  label: string;
  value: number;
}

interface LineChartProps {
  data: Point[];
  width: number;
  height: number;
  color?: string;
  showAxis?: boolean;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  width,
  height,
  color,
  showAxis = true,
}) => {
  const { colors } = useTheme();
  if (data.length === 0) return null;
  const pad = 16;
  const labelHeight = showAxis ? 22 : 0;
  const chartW = width - pad * 2;
  const chartH = height - pad * 2 - labelHeight;
  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  const range = max - min || 1;
  const step = chartW / (data.length - 1 || 1);

  const points = data.map((d, i) => {
    const x = pad + i * step;
    const y = pad + chartH - ((d.value - min) / range) * chartH;
    return { x, y };
  });
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Build area path
  const areaPath =
    `M ${points[0].x},${pad + chartH} ` +
    points.map((p) => `L ${p.x},${p.y}`).join(" ") +
    ` L ${points[points.length - 1].x},${pad + chartH} Z`;

  const stroke = color ?? colors.primary;

  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={stroke} stopOpacity="0.25" />
            <Stop offset="1" stopColor={stroke} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill="url(#grad)" />
        <Polyline
          points={polyline}
          fill="none"
          stroke={stroke}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <Rect
            key={i}
            x={p.x - 3}
            y={p.y - 3}
            width={6}
            height={6}
            rx={3}
            fill={colors.surface}
            stroke={stroke}
            strokeWidth={2}
          />
        ))}
      </Svg>
      {showAxis ? (
        <View style={[styles.axis, { width }]}>
          {data.map((d, i) => (
            <Text key={i} style={[styles.axisLabel, { color: colors.textMuted }]}>
              {d.label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
};

interface BarChartProps {
  data: Point[];
  width: number;
  height: number;
  color?: string;
  suffix?: string;
}

export const BarChart: React.FC<BarChartProps> = ({ data, width, height, color, suffix = "" }) => {
  const { colors } = useTheme();
  const pad = 16;
  const labelH = 20;
  const chartW = width - pad * 2;
  const chartH = height - pad * 2 - labelH;
  const max = Math.max(...data.map((d) => d.value));
  const gap = 12;
  const barW = (chartW - gap * (data.length - 1)) / data.length;
  const stroke = color ?? colors.primary;
  return (
    <View>
      <Svg width={width} height={height}>
        {data.map((d, i) => {
          const h = max === 0 ? 0 : (d.value / max) * chartH;
          const x = pad + i * (barW + gap);
          const y = pad + chartH - h;
          return (
            <Rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={8}
              fill={stroke}
              fillOpacity={0.85}
            />
          );
        })}
      </Svg>
      <View style={[styles.axis, { width, marginTop: -labelH - 4 }]}>
        {data.map((d, i) => (
          <View key={i} style={{ alignItems: "center", flex: 1 }}>
            <Text style={[styles.axisLabel, { color: colors.textMuted }]}>
              {d.value}
              {suffix}
            </Text>
            <Text style={[styles.axisLabel, { color: colors.textMuted, marginTop: 2 }]}>
              {d.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    marginTop: 6,
  },
  axisLabel: { fontSize: 10, fontWeight: "600" },
});
