"use client";
import React, { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { withRunningChartMetrics } from "@/lib/chart-metrics";
import { useT } from "@/lib/useT";

export interface EquityPoint {
  date: string;
  label?: string;
  equity: number;
  drawdown: number;
}

interface Props {
  data: EquityPoint[];
  dark: boolean;
  startBalance?: number;
}

function fmtPnl(n: number) {
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n >= 0 ? `+$${abs}` : `-$${abs}`;
}
function fmtAxis(v: number) {
  const abs = Math.abs(v);
  const s = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : String(abs);
  return v < 0 ? `-$${s}` : `$${s}`;
}

type EquityDisplayPoint = EquityPoint & {
  _label: string;
  _show: boolean;
  chartHigh: number;
  chartLow: number;
  chartDrawdown: number;
};

type DrawdownDisplayPoint = EquityPoint & {
  _label: string;
  _show: boolean;
  chartHigh: number;
  chartLow: number;
  chartDrawdown: number;
};

export function EquityChart({ data, dark, startBalance = 0 }: Props) {
  const t = useT();
  const baseData = useMemo(
    () => data.map((d, i) => ({
      ...d,
      _label: d.label ?? d.date,
      _show: data.length <= 20 || i % Math.ceil(data.length / 20) === 0,
    })),
    [data]
  );

  const equityData: EquityDisplayPoint[] = useMemo(
    () => withRunningChartMetrics(baseData, "equity", { baseline: 0 }),
    [baseData]
  );

  const drawdownData: DrawdownDisplayPoint[] = useMemo(
    () => withRunningChartMetrics(baseData, "drawdown", { baseline: 0 }),
    [baseData]
  );

  const lastEq = data[data.length - 1]?.equity ?? 0;
  const maxDd = Math.abs(Math.min(0, ...data.map((d) => d.drawdown)));
  const peak = data.length ? Math.max(...data.map((d) => d.equity)) : 0;
  const isPos = lastEq >= 0;
  const totalRet = startBalance > 0 ? (lastEq / startBalance) * 100 : null;

  const axisColor = dark ? "#6A6355" : "#B0A99E";
  const gridColor = dark ? "#1E1C12" : "#EDE8E0";
  const tooltipBg = dark ? "#1A1810" : "#FEFCF9";
  const tooltipBdr = dark ? "#302C1E" : "#D9D2C7";
  const tooltipTxt = dark ? "#F0EBE0" : "#1A1714";

  const yVals = equityData.map((d) => d.equity);
  const yMin = yVals.length ? Math.min(...yVals) : 0;
  const yMax = yVals.length ? Math.max(...yVals) : 0;
  const range = yMax - yMin || 1;
  const gradientOffset = useMemo(
    () => Math.min(0.99, Math.max(0.01, yMax / range)),
    [range, yMax]
  );

  if (data.length < 2) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-stroke bg-tinted px-4 py-3 min-w-0 overflow-hidden">
          <p className="text-[10px] text-ink-5 uppercase tracking-wider mb-1.5">{t("progress_current_balance")}</p>
          <p className="text-xl font-bold leading-none truncate" style={{ color: isPos ? "#22C55E" : "#EF4444" }}>
            {startBalance > 0
              ? `$${(startBalance + lastEq).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
              : fmtPnl(lastEq)}
          </p>
          <p className="text-xs mt-1.5" style={{ color: isPos ? "#22C55E" : "#EF4444", opacity: 0.6 }}>
            {fmtPnl(lastEq)} total P&L
          </p>
        </div>

        <div className="rounded-xl border border-stroke bg-tinted px-4 py-3 min-w-0 overflow-hidden">
          <p className="text-[10px] text-ink-5 uppercase tracking-wider mb-1.5">{t("progress_total_return")}</p>
          <p className="text-xl font-bold leading-none truncate" style={{ color: isPos ? "#22C55E" : "#EF4444" }}>
            {totalRet !== null
              ? `${totalRet >= 0 ? "+" : ""}${totalRet.toFixed(2)}%`
              : fmtPnl(lastEq)}
          </p>
          <p className="text-xs text-ink-5 mt-1.5">Peak: {fmtAxis(peak)}</p>
        </div>

        <div className="rounded-xl border border-stroke bg-tinted px-4 py-3 min-w-0 overflow-hidden">
          <p className="text-[10px] text-ink-5 uppercase tracking-wider mb-1.5">{t("progress_max_drawdown")}</p>
          <p className="text-xl font-bold leading-none truncate" style={{ color: maxDd === 0 ? "#22C55E" : "#EF4444" }}>
            {maxDd === 0 ? "$0.00" : `-$${maxDd.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          </p>
          <p className="text-xs text-ink-5 mt-1.5">
            {startBalance > 0 && maxDd > 0
              ? `${((maxDd / (startBalance + Math.max(peak, 0))) * 100).toFixed(2)}% of balance`
              : maxDd === 0 ? "No drawdown" : "From peak equity"}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={equityData} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7BAF8A" stopOpacity={0.55} />
              <stop offset={`${(gradientOffset * 100 - 0.5).toFixed(2)}%`} stopColor="#7BAF8A" stopOpacity={0.08} />
              <stop offset={`${(gradientOffset * 100 + 0.5).toFixed(2)}%`} stopColor="#AC5A56" stopOpacity={0.08} />
              <stop offset="100%" stopColor="#AC5A56" stopOpacity={0.5} />
            </linearGradient>
            <linearGradient id="eqStroke" x1="0" y1="0" x2="0" y2="1">
              <stop offset={`${(gradientOffset * 100 - 0.5).toFixed(2)}%`} stopColor="#7BAF8A" stopOpacity={1} />
              <stop offset={`${(gradientOffset * 100 + 0.5).toFixed(2)}%`} stopColor="#AC5A56" stopOpacity={1} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="2 5" stroke={gridColor} vertical={false} />

          <XAxis
            dataKey="_label"
            stroke="transparent"
            tick={{ fontSize: 10, fill: axisColor }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="transparent"
            tick={{ fontSize: 10, fill: axisColor }}
            tickLine={false}
            axisLine={false}
            width={60}
            tickFormatter={fmtAxis}
          />

          <ReferenceLine y={0} stroke={axisColor} strokeDasharray="3 5" strokeOpacity={0.5} />

          <Tooltip
            cursor={{ stroke: axisColor, strokeWidth: 1, strokeDasharray: "3 3" }}
            wrapperStyle={{ pointerEvents: "none" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload as EquityDisplayPoint;
              const eq = typeof point?.equity === "number" ? point.equity : 0;
              const dd = typeof point?.drawdown === "number" ? point.drawdown : point?.chartDrawdown ?? 0;
              const high = typeof point?.chartHigh === "number" ? point.chartHigh : eq;
              const low = typeof point?.chartLow === "number" ? point.chartLow : eq;

              return (
                <div
                  style={{
                    background: tooltipBg,
                    border: `1px solid ${tooltipBdr}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    boxShadow: "0 8px 28px rgba(0,0,0,0.2)",
                  }}
                >
                  <p style={{ color: axisColor, fontSize: 11, marginBottom: 6 }}>{point?._label}</p>
                  <p style={{ color: eq >= 0 ? "#22C55E" : "#EF4444", fontSize: 15, fontWeight: 700, margin: 0 }}>
                    {fmtPnl(eq)}
                  </p>
                  <p style={{ color: axisColor, fontSize: 11, marginTop: 4, marginBottom: 0 }}>
                    High: {fmtPnl(high)}
                  </p>
                  <p style={{ color: axisColor, fontSize: 11, marginTop: 2, marginBottom: 0 }}>
                    Low: {fmtPnl(low)}
                  </p>
                  {dd < 0 && (
                    <p style={{ color: "#EF4444", fontSize: 12, opacity: 0.75, marginTop: 4, marginBottom: 0 }}>
                      Drawdown: {fmtPnl(dd)}
                    </p>
                  )}
                  <p style={{ color: tooltipTxt, fontSize: 11, opacity: 0.5, marginTop: 2 }}>
                    Cumulative P&L
                  </p>
                </div>
              );
            }}
          />

          <Area
            type="monotone"
            dataKey="equity"
            stroke="url(#eqStroke)"
            strokeWidth={2.5}
            fill="url(#eqFill)"
            dot={false}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            activeDot={(dotProps: any) => {
              const pointValue = typeof dotProps?.payload?.equity === "number" ? dotProps.payload.equity : 0;
              const dotColor = pointValue >= 0 ? "#22C55E" : "#EF4444";
              return (
                <circle
                  cx={dotProps.cx}
                  cy={dotProps.cy}
                  r={5}
                  fill={dotColor}
                  stroke={tooltipBg}
                  strokeWidth={2}
                />
              );
            }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {maxDd > 0 && (
        <>
          <p className="text-[10px] text-ink-5 uppercase tracking-wider -mb-1">{t("progress_drawdown_peak")}</p>
          <ResponsiveContainer width="100%" height={90}>
            <AreaChart data={drawdownData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#AC5A56" stopOpacity={0.05} />
                  <stop offset="100%" stopColor="#AC5A56" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 5" stroke={gridColor} vertical={false} />
              <XAxis dataKey="_label" hide />
              <YAxis
                stroke="transparent"
                tick={{ fontSize: 9, fill: axisColor }}
                tickLine={false}
                axisLine={false}
                width={60}
                tickFormatter={fmtAxis}
              />
              <ReferenceLine y={0} stroke={gridColor} />
              <Tooltip
                allowEscapeViewBox={{ x: true, y: true }}
                wrapperStyle={{ pointerEvents: "none" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const v = payload[0]?.value as number;
                  if (v === 0) return null;
                  const point = payload[0]?.payload as DrawdownDisplayPoint;
                  const worstSoFar = typeof point?.chartLow === "number" ? point.chartLow : v;

                  return (
                    <div
                      style={{
                        background: tooltipBg,
                        border: `1px solid ${tooltipBdr}`,
                        borderRadius: 8,
                        padding: "8px 12px",
                        boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
                      }}
                    >
                      <p style={{ color: axisColor, fontSize: 10, marginBottom: 3 }}>{label}</p>
                      <p style={{ color: "#EF4444", fontSize: 13, fontWeight: 700, margin: 0 }}>{fmtPnl(v)}</p>
                      <p style={{ color: axisColor, fontSize: 10, marginTop: 2, marginBottom: 0 }}>
                        Worst so far: {fmtPnl(worstSoFar)}
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="drawdown"
                stroke="#EF4444"
                strokeWidth={1.5}
                fill="url(#ddFill)"
                dot={false}
                activeDot={{ r: 3, fill: "#EF4444", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
