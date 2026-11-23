import { useMemo, useState } from "react";
import { estimateStepsFromKm } from "./calculator";
import { WalkInput } from "./types";

interface WalkChartProps {
  walks: WalkInput[];
  selectedWalkId: string;
  onSelectWalk: (walkId: string) => void;
  onLoadSample?: () => void;
}

interface ChartPoint {
  id: string;
  date: string;
  shortDate: string;
  title: string;
  savedFareYen: number;
  sustenanceCostYen: number;
  rewardSpentYen: number;
  steps: number;
  distanceKm: number;
}

const TICK_COUNT = 4;

function computeNiceAxisMax(maxValue: number, fallbackMax: number): number {
  if (maxValue <= 0) return fallbackMax;
  const rawStep = (maxValue * 1.12) / TICK_COUNT;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  const candidates = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const niceNorm = candidates.find((c) => normalized <= c) ?? 10;
  return niceNorm * magnitude * TICK_COUNT;
}

function formatShortDate(isoDate: string, includeYear: boolean): string {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const [y, m, d] = parts;
  const month = Number(m);
  const day = Number(d);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return isoDate;
  return includeYear ? `${y.slice(-2)}/${month}/${day}` : `${month}/${day}`;
}

function formatStepAxisTick(value: number): string {
  if (value === 0) return "0";
  if (value >= 10000) {
    const man = value / 10000;
    return `${Number.isInteger(man) ? man : man.toFixed(1)}万`;
  }
  return value.toLocaleString();
}

function truncateLabel(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

export function WalkChart({
  walks,
  selectedWalkId,
  onSelectWalk,
  onLoadSample,
}: WalkChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const points = useMemo<ChartPoint[]>(() => {
    const chronological = [...walks]
      .reverse()
      .sort((a, b) => a.date.localeCompare(b.date));

    const years = new Set(chronological.map((w) => w.date.slice(0, 4)));
    const includeYear = years.size > 1;

    return chronological.map((w) => {
      const savedFareYen = Math.max(
        0,
        (Number.isFinite(w.plannedFareYen) ? w.plannedFareYen : 0) -
          (Number.isFinite(w.actualFareYen) ? w.actualFareYen : 0)
      );
      const sustenanceCostYen =
        Number.isFinite(w.sustenanceCostYen) && w.sustenanceCostYen > 0
          ? w.sustenanceCostYen
          : 0;
      const rewardSpentYen =
        Number.isFinite(w.rewardSpentYen) && w.rewardSpentYen > 0
          ? w.rewardSpentYen
          : 0;
      const steps =
        typeof w.steps === "number" && Number.isFinite(w.steps) && w.steps >= 0
          ? Math.round(w.steps)
          : estimateStepsFromKm(w.distanceKm);

      return {
        id: w.id,
        date: w.date,
        shortDate: formatShortDate(w.date, includeYear),
        title: w.title,
        savedFareYen,
        sustenanceCostYen,
        rewardSpentYen,
        steps,
        distanceKm: w.distanceKm,
      };
    });
  }, [walks]);

  if (points.length === 0) {
    return (
      <section className="panel-card">
        <h2 className="section-title">
          <span aria-hidden="true">📊</span>
          <span>おさんぽグラフ（歩数 × お金）</span>
        </h2>
        <div className="empty-state" style={{ marginBlockStart: 14 }}>
          <p style={{ margin: onLoadSample ? "0 0 12px" : 0 }}>
            記録を追加すると、歩いた日だけを並べた「歩数・ケチった交通費・補給代・ご褒美支出」のグラフが表示されます。
          </p>
          {onLoadSample && (
            <button
              type="button"
              onClick={onLoadSample}
              className="secondary-button"
            >
              サンプルを見る
            </button>
          )}
        </div>
      </section>
    );
  }

  const maxYen = Math.max(
    ...points.map((p) =>
      Math.max(p.savedFareYen, p.sustenanceCostYen, p.rewardSpentYen)
    ),
    0
  );
  const maxSteps = Math.max(...points.map((p) => p.steps), 0);

  const leftAxisMax = computeNiceAxisMax(maxYen, 800);
  const rightAxisMax = computeNiceAxisMax(maxSteps, 10000);

  const padLeft = 58;
  const padRight = 60;
  const padTop = 34;
  const padBottom = 52;
  const chartHeight = 296;
  const plotHeight = chartHeight - padTop - padBottom;

  const minChartWidth = 720;
  const slotMinWidth = 112;
  const chartWidth = Math.max(
    minChartWidth,
    padLeft + padRight + points.length * slotMinWidth
  );
  const plotWidth = chartWidth - padLeft - padRight;
  const slotWidth = plotWidth / points.length;
  const barGap = 4;
  const barWidth = Math.max(10, Math.min(22, (slotWidth - 20) / 3 - barGap));

  const yYen = (val: number) =>
    padTop + plotHeight - (Math.max(0, val) / leftAxisMax) * plotHeight;
  const ySteps = (val: number) =>
    padTop + plotHeight - (Math.max(0, val) / rightAxisMax) * plotHeight;

  const coords = points.map((p, i) => {
    const cx = padLeft + slotWidth * (i + 0.5);
    const savedY = yYen(p.savedFareYen);
    const sustenanceY = yYen(p.sustenanceCostYen);
    const rewardY = yYen(p.rewardSpentYen);
    const stepY = ySteps(p.steps);
    return {
      ...p,
      cx,
      savedY,
      savedH: padTop + plotHeight - savedY,
      sustenanceY,
      sustenanceH: padTop + plotHeight - sustenanceY,
      rewardY,
      rewardH: padTop + plotHeight - rewardY,
      stepY,
    };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.cx.toFixed(1)} ${c.stepY.toFixed(1)}`)
    .join(" ");

  const activePoint =
    coords.find((c) => c.id === hoveredId) ??
    coords.find((c) => c.id === selectedWalkId) ??
    coords[coords.length - 1];

  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => i / TICK_COUNT);

  const chartSummaryText = `全${points.length}回のおさんぽ記録。左軸はケチった交通費・補給代・ご褒美支出（最大${leftAxisMax.toLocaleString()}円）、右軸は歩数（最大${rightAxisMax.toLocaleString()}歩）。`;

  return (
    <section className="panel-card">
      <div className="chart-header">
        <div>
          <h2 className="section-title">
            <span aria-hidden="true">📊</span>
            <span>おさんぽグラフ（歩数 × お金）</span>
          </h2>
          <p className="chart-subtitle">
            歩いた日だけを左から順に並べています。棒グラフがお金（左軸）、折れ線が歩数（右軸）です。
          </p>
        </div>

        <div className="chart-legend" aria-label="グラフ凡例">
          <span className="legend-item">
            <span className="legend-swatch legend-swatch--saved" aria-hidden="true" />
            <span>ケチった交通費（円）</span>
          </span>
          <span className="legend-item">
            <span className="legend-swatch legend-swatch--sustenance" aria-hidden="true" />
            <span>補給代（円）</span>
          </span>
          <span className="legend-item">
            <span className="legend-swatch legend-swatch--reward" aria-hidden="true" />
            <span>ご褒美支出（円）</span>
          </span>
          <span className="legend-item">
            <span className="legend-swatch legend-swatch--steps" aria-hidden="true" />
            <span>歩数（歩）</span>
          </span>
        </div>
      </div>

      {activePoint && (
        <div className="chart-spotlight" role="status" aria-live="polite">
          <div className="chart-spotlight-title">
            <span className="walk-date-chip">{activePoint.date}</span>
            <strong>{activePoint.title}</strong>
          </div>
          <div className="chart-spotlight-metrics">
            <span className="spotlight-chip spotlight-chip--saved">
              <span aria-hidden="true">🚃</span>
              <span>交通費 {activePoint.savedFareYen.toLocaleString()}円</span>
            </span>
            <span className="spotlight-chip spotlight-chip--sustenance">
              <span aria-hidden="true">💧</span>
              <span>補給 {activePoint.sustenanceCostYen.toLocaleString()}円</span>
            </span>
            <span className="spotlight-chip spotlight-chip--reward">
              <span aria-hidden="true">🍰</span>
              <span>ご褒美 {activePoint.rewardSpentYen.toLocaleString()}円</span>
            </span>
            <span className="spotlight-chip spotlight-chip--steps">
              <span aria-hidden="true">👣</span>
              <span>
                {activePoint.steps.toLocaleString()}歩（{activePoint.distanceKm}km）
              </span>
            </span>
          </div>
        </div>
      )}

      <figure className="chart-figure">
        <div className="chart-scroll-wrap">
          <svg
            className="walk-chart-svg"
            role="img"
            aria-label={chartSummaryText}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            style={{ minInlineSize: `${Math.min(chartWidth, 560)}px` }}
            onMouseLeave={() => setHoveredId(null)}
          >
            {/* Axis Titles */}
            <text x={padLeft - 8} y={16} textAnchor="end" className="chart-axis-unit">
              円
            </text>
            <text
              x={chartWidth - padRight + 8}
              y={16}
              textAnchor="start"
              className="chart-axis-unit chart-axis-unit--steps"
            >
              歩数
            </text>

            {/* Horizontal Grid Lines & Dual Y-Axis Labels */}
            {ticks.map((ratio) => {
              const y = padTop + plotHeight * (1 - ratio);
              const yenTick = Math.round(leftAxisMax * ratio);
              const stepTick = Math.round(rightAxisMax * ratio);
              return (
                <g key={ratio}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={chartWidth - padRight}
                    y2={y}
                    className={ratio === 0 ? "chart-axis-base" : "chart-grid-line"}
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="chart-tick-label"
                  >
                    {yenTick.toLocaleString()}
                  </text>
                  <text
                    x={chartWidth - padRight + 8}
                    y={y + 4}
                    textAnchor="start"
                    className="chart-tick-label chart-tick-label--steps"
                  >
                    {formatStepAxisTick(stepTick)}
                  </text>
                </g>
              );
            })}

            {/* Active Slot Highlight & Bars */}
            {coords.map((c) => {
              const isActive = activePoint?.id === c.id;
              const totalBarsWidth = barWidth * 3 + barGap * 2;
              const startX = c.cx - totalBarsWidth / 2;
              const savedBarX = startX;
              const sustenanceBarX = startX + barWidth + barGap;
              const rewardBarX = startX + (barWidth + barGap) * 2;
              const savedBarHeight = Math.max(c.savedFareYen > 0 ? 3 : 0, c.savedH);
              const sustenanceBarHeight = Math.max(
                c.sustenanceCostYen > 0 ? 3 : 0,
                c.sustenanceH
              );
              const rewardBarHeight = Math.max(
                c.rewardSpentYen > 0 ? 3 : 0,
                c.rewardH
              );

              return (
                <g
                  key={c.id}
                  className="chart-slot"
                  onMouseEnter={() => setHoveredId(c.id)}
                  onClick={() => onSelectWalk(c.id)}
                >
                  <rect
                    x={c.cx - slotWidth / 2 + 4}
                    y={padTop - 6}
                    width={Math.max(0, slotWidth - 8)}
                    height={plotHeight + 12}
                    rx={10}
                    className={isActive ? "chart-slot-bg is-active" : "chart-slot-bg"}
                  />

                  {/* Saved Fare Bar */}
                  {savedBarHeight > 0 && (
                    <rect
                      x={savedBarX}
                      y={padTop + plotHeight - savedBarHeight}
                      width={barWidth}
                      height={savedBarHeight}
                      rx={4}
                      className="chart-bar-saved"
                    />
                  )}

                  {/* Sustenance Cost Bar */}
                  {sustenanceBarHeight > 0 && (
                    <rect
                      x={sustenanceBarX}
                      y={padTop + plotHeight - sustenanceBarHeight}
                      width={barWidth}
                      height={sustenanceBarHeight}
                      rx={4}
                      className="chart-bar-sustenance"
                    />
                  )}

                  {/* Reward Spent Bar */}
                  {rewardBarHeight > 0 && (
                    <rect
                      x={rewardBarX}
                      y={padTop + plotHeight - rewardBarHeight}
                      width={barWidth}
                      height={rewardBarHeight}
                      rx={4}
                      className="chart-bar-reward"
                    />
                  )}

                  {/* X-axis Labels */}
                  <text
                    x={c.cx}
                    y={padTop + plotHeight + 20}
                    textAnchor="middle"
                    className={
                      isActive ? "chart-x-date is-active" : "chart-x-date"
                    }
                  >
                    {c.shortDate}
                  </text>
                  <text
                    x={c.cx}
                    y={padTop + plotHeight + 37}
                    textAnchor="middle"
                    className="chart-x-title"
                  >
                    {truncateLabel(c.title, points.length <= 4 ? 10 : 7)}
                  </text>
                </g>
              );
            })}

            {/* Steps Line */}
            {coords.length >= 2 && (
              <path d={linePath} fill="none" className="chart-steps-line" />
            )}

            {/* Steps Markers & Value Labels */}
            {coords.map((c) => {
              const isActive = activePoint?.id === c.id;
              const showValueLabel = points.length <= 12 || isActive;
              return (
                <g
                  key={`step-${c.id}`}
                  className="chart-point-group"
                  onMouseEnter={() => setHoveredId(c.id)}
                  onClick={() => onSelectWalk(c.id)}
                >
                  <circle
                    cx={c.cx}
                    cy={c.stepY}
                    r={isActive ? 7 : 5.5}
                    className={
                      isActive ? "chart-step-dot is-active" : "chart-step-dot"
                    }
                  />
                  {showValueLabel && (
                    <text
                      x={c.cx}
                      y={Math.max(padTop - 8, c.stepY - 12)}
                      textAnchor="middle"
                      className="chart-step-value"
                    >
                      {c.steps.toLocaleString()}歩
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <figcaption className="chart-caption">
          グラフ上の棒や点、または下のボタンを選ぶとその回の詳細を表示し、単発表示の対象も切り替えられます。
        </figcaption>
      </figure>

      <div className="chart-quick-select" role="group" aria-label="グラフ対象おさんぽ選択">
        {coords.map((c) => {
          const isActive = activePoint?.id === c.id;
          return (
            <button
              key={`pick-${c.id}`}
              type="button"
              className={`chart-pick-button${isActive ? " is-active" : ""}`}
              aria-pressed={isActive}
              onMouseEnter={() => setHoveredId(c.id)}
              onFocus={() => setHoveredId(c.id)}
              onMouseLeave={() => setHoveredId(null)}
              onBlur={() => setHoveredId(null)}
              onClick={() => onSelectWalk(c.id)}
            >
              {c.shortDate} {truncateLabel(c.title, 10)}
            </button>
          );
        })}
      </div>

      <details className="chart-table-details">
        <summary>数値データ表を見る（{points.length}件）</summary>
        <div className="chart-table-wrap">
          <table className="chart-data-table">
            <caption>歩いた日ごとの交通費・補給代・ご褒美支出・歩数一覧</caption>
            <thead>
              <tr>
                <th scope="col">日付</th>
                <th scope="col">タイトル</th>
                <th scope="col">ケチった交通費</th>
                <th scope="col">補給代</th>
                <th scope="col">ご褒美支出</th>
                <th scope="col">歩数</th>
                <th scope="col">距離</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={`row-${p.id}`}>
                  <td>{p.date}</td>
                  <td>{p.title}</td>
                  <td>{p.savedFareYen.toLocaleString()} 円</td>
                  <td>{p.sustenanceCostYen.toLocaleString()} 円</td>
                  <td>{p.rewardSpentYen.toLocaleString()} 円</td>
                  <td>{p.steps.toLocaleString()} 歩</td>
                  <td>{p.distanceKm} km</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
