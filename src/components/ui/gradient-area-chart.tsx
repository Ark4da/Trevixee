"use client";
import React, { useId, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { withRunningChartMetrics } from "@/lib/chart-metrics";

interface DataPoint {
  label: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  dark: boolean;
  height?: number;
  baseline?: number;
  singleColor?: boolean;
  color?: string;
  positiveColor?: string;
  negativeColor?: string;
  yFormatter?: (v: number) => string;
  tooltipFormatter?: (v: number) => string;
}

function defaultYFmt(v: number) {
  const abs = Math.abs(v);
  const s = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : String(Math.round(abs));
  return v < 0 ? `-$${s}` : `$${s}`;
}

export function GradientAreaChart({
  data,
  dark,
  height = 240,
  baseline = 0,
  singleColor = false,
  color,
  positiveColor = "#7BAF8A",
  negativeColor = "#AC5A56",
  yFormatter = defaultYFmt,
  tooltipFormatter,
}: Props) {
  const gradientId = useId().replace(/[:]/g, "");

  const axisColor  = dark ? "#7A7068" : "#B0A99E";
  const gridColor  = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
  const tooltipBg  = dark ? "#1C1612" : "#FEFCF9";
  const tooltipBdr = dark ? "rgba(255,255,255,0.10)" : "#D9D2C7";

  const chartData = useMemo(
    () => withRunningChartMetrics(data, "value", { baseline }),
    [baseline, data]
  );

  const values   = chartData.map((d) => d.value);
  const yMin     = values.length > 0 ? Math.min(...values) : 0;
  const yMax     = values.length > 0 ? Math.max(...values) : 0;
  const range    = yMax - yMin || 1;
  const isPos    = values.length === 0 ? true : values[values.length - 1] >= 0;
  const zeroFrac = useMemo(
    () => Math.min(0.99, Math.max(0.01, yMax / range)),
    [yMax, range]
  );

  const fillId   = singleColor ? `gradSingle-${gradientId}` : `gradSplit-${gradientId}`;
  const strokeId = singleColor ? `gradSingle-${gradientId}` : `gradStroke-${gradientId}`;
  const strokeColor = color ?? (isPos ? positiveColor : negativeColor);

  const fmt = tooltipFormatter ?? yFormatter;

  return (
    <ResponsiveContainer width="100%" height={height} minWidth={1} minHeight={height}>
      <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <defs>
          {singleColor ? (
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={strokeColor} stopOpacity={0.18} />
              <stop offset="80%"  stopColor={strokeColor} stopOpacity={0.03} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
            </linearGradient>
          ) : (
            <>
              {/* Fill: green above zero, red below */}
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"
                  stopColor={positiveColor} stopOpacity={0.30} />
                <stop offset={`${(zeroFrac * 100 - 0.5).toFixed(1)}%`}
                  stopColor={positiveColor} stopOpacity={0.06} />
                <stop offset={`${(zeroFrac * 100 + 0.5).toFixed(1)}%`}
                  stopColor={negativeColor} stopOpacity={0.06} />
                <stop offset="100%"
                  stopColor={negativeColor} stopOpacity={0.28} />
              </linearGradient>
              {/* Stroke: green → red at zero crossing */}
              <linearGradient id={strokeId} x1="0" y1="0" x2="0" y2="1">
                <stop offset={`${(zeroFrac * 100 - 0.5).toFixed(1)}%`}
                  stopColor={positiveColor} stopOpacity={1} />
                <stop offset={`${(zeroFrac * 100 + 0.5).toFixed(1)}%`}
                  stopColor={negativeColor} stopOpacity={1} />
              </linearGradient>
            </>
          )}
        </defs>

        <CartesianGrid strokeDasharray="1 6" stroke={gridColor} vertical={false} />

        <XAxis
          dataKey="label"
          stroke="transparent"
          tick={{ fontSize: 10, fill: axisColor, fontFamily: "monospace" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          stroke="transparent"
          tick={{ fontSize: 10, fill: axisColor, fontFamily: "monospace" }}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={yFormatter}
        />

        {!singleColor && (
          <ReferenceLine
            y={0}
            stroke={axisColor}
            strokeDasharray="2 5"
            strokeOpacity={0.35}
          />
        )}

        <Tooltip
          cursor={{ stroke: axisColor, strokeWidth: 1, strokeDasharray: "2 4", strokeOpacity: 0.5 }}
          wrapperStyle={{ pointerEvents: "none" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;

            const point = payload[0]?.payload as DataPoint & {
              chartHigh?: number;
              chartLow?: number;
              chartDrawdown?: number;
              chartDelta?: number;
              chartDeltaPct?: number;
              trades?: number;
              wins?: number;
              losses?: number;
            };

            const v        = typeof point?.value       === "number" ? point.value       : 0;
            const high     = typeof point?.chartHigh   === "number" ? point.chartHigh   : null;
            const low      = typeof point?.chartLow    === "number" ? point.chartLow    : null;
            const drawdown = typeof point?.chartDrawdown === "number" ? point.chartDrawdown : null;
            const delta    = typeof point?.chartDelta  === "number" ? point.chartDelta  : null;
            const ddPct    = typeof point?.chartDeltaPct === "number" ? point.chartDeltaPct : null;
            const dayTrades = typeof point?.trades === "number" ? point.trades : null;
            const dayWins   = typeof point?.wins   === "number" ? point.wins   : null;
            const dayLosses = typeof point?.losses === "number" ? point.losses : null;

            const valColor = singleColor
              ? strokeColor
              : v >= 0 ? positiveColor : negativeColor;

            const deltaColor = delta !== null
              ? (delta >= 0 ? positiveColor : negativeColor)
              : axisColor;

            const sep = (
              <div style={{
                borderTop: `1px solid ${dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"}`,
                margin: "7px 0 6px",
              }} />
            );

            return (
              <div style={{
                background: tooltipBg,
                border: `1px solid ${tooltipBdr}`,
                borderRadius: 9,
                padding: "11px 15px",
                boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
                minWidth: 160,
              }}>
                {/* Date */}
                <p style={{
                  color: axisColor, fontSize: 10,
                  letterSpacing: "0.07em", textTransform: "uppercase",
                  marginBottom: 7, fontWeight: 500,
                }}>
                  {point?.label}
                </p>

                {/* Main value */}
                <p style={{
                  color: valColor, fontSize: 17,
                  fontWeight: 700, margin: 0,
                  fontFamily: "monospace", letterSpacing: "-0.02em",
                }}>
                  {fmt(v)}
                </p>

                {/* Day delta — показываем P&L за этот день */}
                {delta !== null && delta !== 0 && (
                  <p style={{
                    color: deltaColor, fontSize: 13,
                    fontWeight: 700, marginTop: 4,
                    fontFamily: "monospace",
                  }}>
                    {delta >= 0 ? "▲" : "▼"} {fmt(Math.abs(delta))} за день
                  </p>
                )}

                {/* Сделки дня */}
                {dayTrades !== null && dayTrades > 0 && (
                  <div style={{
                    marginTop: 6, display: "flex", alignItems: "center", gap: 6, fontSize: 11,
                  }}>
                    <span style={{ color: axisColor }}>{dayTrades} сд.</span>
                    {dayWins !== null && dayWins > 0 && (
                      <span style={{ color: positiveColor, fontWeight: 600 }}>+{dayWins}W</span>
                    )}
                    {dayLosses !== null && dayLosses > 0 && (
                      <span style={{ color: negativeColor, fontWeight: 600 }}>−{dayLosses}L</span>
                    )}
                  </div>
                )}

                {sep}

                {/* Stats grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px" }}>
                  {high !== null && (
                    <>
                      <p style={{ color: axisColor, fontSize: 10, margin: 0, letterSpacing: "0.05em" }}>PEAK</p>
                      <p style={{ color: positiveColor, fontSize: 11, fontWeight: 600, margin: 0, fontFamily: "monospace", textAlign: "right" }}>
                        {fmt(high)}
                      </p>
                    </>
                  )}
                  {drawdown !== null && drawdown < -0.01 && (
                    <>
                      <p style={{ color: axisColor, fontSize: 10, margin: 0, letterSpacing: "0.05em" }}>ПРОСАДКА</p>
                      <p style={{ color: negativeColor, fontSize: 11, fontWeight: 600, margin: 0, fontFamily: "monospace", textAlign: "right" }}>
                        {fmt(drawdown)}
                        {ddPct !== null && ddPct < -0.1 && (
                          <span style={{ fontSize: 9, opacity: 0.7 }}> ({ddPct.toFixed(1)}%)</span>
                        )}
                      </p>
                    </>
                  )}
                </div>
              </div>
            );
          }}
        />

        <Area
          type="monotone"
          dataKey="value"
          stroke={singleColor ? strokeColor : `url(#${strokeId})`}
          strokeWidth={1.5}
          fill={`url(#${fillId})`}
          dot={false}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          activeDot={(dotProps: any) => {
            const dotValue = typeof dotProps?.payload?.value === "number" ? dotProps.payload.value : 0;
            const dotColor = singleColor
              ? strokeColor
              : dotValue >= 0 ? positiveColor : negativeColor;
            return (
              <circle
                cx={dotProps.cx}
                cy={dotProps.cy}
                r={4}
                fill={dotColor}
                stroke={tooltipBg}
                strokeWidth={2}
              />
            );
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
