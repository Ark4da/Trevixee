export interface RunningChartMetrics {
  chartHigh: number;
  chartLow: number;
  chartDrawdown: number;
  chartDelta: number;      // change vs previous point
  chartDeltaPct: number;   // % change vs running high (peak)
}

interface RunningMetricsOptions {
  baseline?: number;
}

function toFiniteNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function withRunningChartMetrics<T extends object, K extends keyof T>(
  data: T[],
  valueKey: K,
  options?: RunningMetricsOptions
): Array<T & RunningChartMetrics> {
  const hasBaseline = typeof options?.baseline === "number" && Number.isFinite(options.baseline);
  let runningHigh = hasBaseline ? (options!.baseline as number) : Number.NEGATIVE_INFINITY;
  let runningLow = hasBaseline ? (options!.baseline as number) : Number.POSITIVE_INFINITY;

  let prevValue: number | null = null;

  return data.map((point) => {
    const rawValue = (point as Record<PropertyKey, unknown>)[valueKey as PropertyKey];
    const value = toFiniteNumber(rawValue) ?? 0;

    runningHigh = Math.max(runningHigh, value);
    runningLow = Math.min(runningLow, value);

    const delta = prevValue !== null ? value - prevValue : 0;
    const drawdown = value - runningHigh;
    const deltaPct = runningHigh !== 0 ? (drawdown / Math.abs(runningHigh)) * 100 : 0;

    prevValue = value;

    return {
      ...point,
      chartHigh: runningHigh,
      chartLow: runningLow,
      chartDrawdown: drawdown,
      chartDelta: delta,
      chartDeltaPct: deltaPct,
    };
  });
}

export function getPayloadPoint(payload: unknown): Record<string, unknown> | null {
  if (!Array.isArray(payload) || payload.length === 0) return null;
  const first = payload[0];
  if (!first || typeof first !== "object") return null;
  const point = (first as { payload?: unknown }).payload;
  return point && typeof point === "object" ? (point as Record<string, unknown>) : null;
}

export function getNumericMetric(point: unknown, keys: string[]): number | null {
  if (!point || typeof point !== "object") return null;
  const obj = point as Record<string, unknown>;

  for (const key of keys) {
    const numeric = toFiniteNumber(obj[key]);
    if (numeric !== null) return numeric;
  }

  return null;
}
