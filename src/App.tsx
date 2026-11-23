import React, { useEffect, useMemo, useState } from "react";
import { evaluateRule, summarizeWalks } from "./calculator";
import { DEFAULT_RULES, SAMPLE_WALKS } from "./presets";
import { PresetPatternId, RewardRule, WalkInput } from "./types";

const STORAGE_KEY_WALKS = "ww_reward_sim_walks_v1";
const STORAGE_KEY_RULES = "ww_reward_sim_rules_v1";

const PATTERN_LABELS: Record<PresetPatternId, string> = {
  instant: "即席ご褒美",
  accumulate: "ためる・積立",
  distance_linked: "距離連動",
};

function loadInitialWalks(): WalkInput[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WALKS);
    if (!raw) return SAMPLE_WALKS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SAMPLE_WALKS;
  } catch {
    return SAMPLE_WALKS;
  }
}

function loadInitialRules(): RewardRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RULES);
    if (!raw) return DEFAULT_RULES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_RULES;
  } catch {
    return DEFAULT_RULES;
  }
}

export function App() {
  const [walks, setWalks] = useState<WalkInput[]>(loadInitialWalks);
  const [rules, setRules] = useState<RewardRule[]>(loadInitialRules);
  const [mode, setMode] = useState<"single" | "cumulative">("single");
  const [selectedWalkId, setSelectedWalkId] = useState<string>(
    () => loadInitialWalks()[0]?.id ?? "walk-1"
  );
  const [patternFilter, setPatternFilter] = useState<"all" | PresetPatternId>("all");

  const [title, setTitle] = useState("週末ウォーク");
  const [plannedFareYen, setPlannedFareYen] = useState(500);
  const [actualFareYen, setActualFareYen] = useState(0);
  const [sustenanceCostYen, setSustenanceCostYen] = useState(180);
  const [rewardSpentYen, setRewardSpentYen] = useState(0);
  const [distanceKm, setDistanceKm] = useState(8.5);
  const [durationMinutes, setDurationMinutes] = useState(110);
  const [detourCount, setDetourCount] = useState(2);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WALKS, JSON.stringify(walks));
  }, [walks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules));
  }, [rules]);

  const targetWalks = useMemo(() => {
    if (mode === "cumulative") return walks;
    const found = walks.find((w) => w.id === selectedWalkId);
    return found ? [found] : walks.slice(0, 1);
  }, [mode, walks, selectedWalkId]);

  const summary = useMemo(() => summarizeWalks(targetWalks), [targetWalks]);

  const visibleRules = useMemo(() => {
    if (patternFilter === "all") return rules;
    return rules.filter((r) => r.pattern === patternFilter);
  }, [rules, patternFilter]);

  const evaluatedRules = useMemo(
    () => visibleRules.map((rule) => evaluateRule(rule, summary)),
    [visibleRules, summary]
  );

  const handleAddWalk = (e: React.FormEvent) => {
    e.preventDefault();
    const newWalk: WalkInput = {
      id: `walk-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      title: title.trim() || "名称未設定ウォーク",
      plannedFareYen: Number(plannedFareYen) || 0,
      actualFareYen: Number(actualFareYen) || 0,
      sustenanceCostYen: Number(sustenanceCostYen) || 0,
      rewardSpentYen: Number(rewardSpentYen) || 0,
      distanceKm: Number(distanceKm) || 0,
      durationMinutes: Number(durationMinutes) || 0,
      detourCount: Number(detourCount) || 0,
    };
    setWalks((prev) => [newWalk, ...prev]);
    setSelectedWalkId(newWalk.id);
    setMode("single");
  };

  const handleIncrementDetour = (walkId: string) => {
    setWalks((prev) =>
      prev.map((w) => (w.id === walkId ? { ...w, detourCount: w.detourCount + 1 } : w))
    );
  };

  const handleResetAll = () => {
    localStorage.removeItem(STORAGE_KEY_WALKS);
    localStorage.removeItem(STORAGE_KEY_RULES);
    setWalks(SAMPLE_WALKS);
    setRules(DEFAULT_RULES);
    setSelectedWalkId(SAMPLE_WALKS[0].id);
  };

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "24px 16px", fontFamily: "sans-serif" }}>
      <h1>コスト換算／ご褒美シミュレータ</h1>
      <p style={{ color: "#555" }}>
        静的・ローカル完結（<code>localStorage</code> 保存）。水分・飴・グミなどの補給コストは別枠とし、ご褒美枠を削らない設計です。
      </p>

      <section style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setMode("single")}
          style={{ fontWeight: mode === "single" ? "bold" : "normal" }}
        >
          単発表示
        </button>
        <button
          type="button"
          onClick={() => setMode("cumulative")}
          style={{ fontWeight: mode === "cumulative" ? "bold" : "normal" }}
        >
          累積表示（全 {walks.length} 件）
        </button>

        {mode === "single" && (
          <select
            value={selectedWalkId}
            onChange={(e) => setSelectedWalkId(e.target.value)}
            aria-label="対象ウォーク選択"
          >
            {walks.map((w) => (
              <option key={w.id} value={w.id}>
                {w.date} — {w.title}（{w.distanceKm}km）
              </option>
            ))}
          </select>
        )}

        <button type="button" onClick={handleResetAll} style={{ marginLeft: "auto" }}>
          サンプル初期化
        </button>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <div>浮いた交通費（グロス）</div>
          <strong style={{ fontSize: 22 }}>{summary.grossSavedFareYen.toLocaleString()} 円</strong>
        </div>
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <div>ご褒美残余枠</div>
          <strong style={{ fontSize: 22 }}>{summary.rewardRemainingYen.toLocaleString()} 円</strong>
          <div style={{ fontSize: 12, color: "#666" }}>ご褒美支出: {summary.rewardSpentYen} 円</div>
        </div>
        <div style={{ border: "1px solid #f0c36d", background: "#fffdf5", borderRadius: 8, padding: 12 }}>
          <div>補給コスト（別枠）</div>
          <strong style={{ fontSize: 22 }}>{summary.sustenanceCostYen.toLocaleString()} 円</strong>
          <div style={{ fontSize: 12, color: "#666" }}>水分・飴・グミ等（減額対象外）</div>
        </div>
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <div>距離・時間・寄り道</div>
          <strong style={{ fontSize: 18 }}>
            {summary.distanceKm} km / {summary.durationMinutes} 分
          </strong>
          <div style={{ fontSize: 13 }}>寄り道・発見: {summary.detourCount} 件</div>
        </div>
      </section>

      <section style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>ご褒美換算パターン</h2>
          {(["all", "instant", "accumulate", "distance_linked"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPatternFilter(p)}
              style={{ fontWeight: patternFilter === p ? "bold" : "normal" }}
            >
              {p === "all" ? "すべて" : PATTERN_LABELS[p]}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          {evaluatedRules.map(({ rule, displayValue, remainderToNext }) => (
            <div key={rule.id} style={{ border: "1px solid #ccc", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 12, color: "#666" }}>{PATTERN_LABELS[rule.pattern]}</div>
              <div style={{ fontWeight: "bold", marginTop: 2 }}>{rule.name}</div>
              <div style={{ fontSize: 24, margin: "8px 0" }}>
                {displayValue} <span style={{ fontSize: 15 }}>{rule.unitLabel}</span>
              </div>
              <div style={{ fontSize: 12, color: "#555" }}>
                次の1単位まであと{" "}
                <strong>
                  {remainderToNext} {rule.basis === "fare" ? "円" : "km"}
                </strong>
              </div>
              <p style={{ fontSize: 12, color: "#777", marginBottom: 0 }}>{rule.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>ウォーク記録を追加</h2>
        <form
          onSubmit={handleAddWalk}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}
        >
          <label>
            タイトル
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%" }} />
          </label>
          <label>
            想定運賃（円）
            <input
              type="number"
              min={0}
              value={plannedFareYen}
              onChange={(e) => setPlannedFareYen(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </label>
          <label>
            実支払運賃（円）
            <input
              type="number"
              min={0}
              value={actualFareYen}
              onChange={(e) => setActualFareYen(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </label>
          <label>
            補給：水分・飴・グミ（円）
            <input
              type="number"
              min={0}
              value={sustenanceCostYen}
              onChange={(e) => setSustenanceCostYen(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </label>
          <label>
            ご褒美支出（円）
            <input
              type="number"
              min={0}
              value={rewardSpentYen}
              onChange={(e) => setRewardSpentYen(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </label>
          <label>
            距離（km）
            <input
              type="number"
              step="0.1"
              min={0}
              value={distanceKm}
              onChange={(e) => setDistanceKm(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </label>
          <label>
            時間（分）
            <input
              type="number"
              min={0}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </label>
          <label>
            寄り道・発見数
            <input
              type="number"
              min={0}
              value={detourCount}
              onChange={(e) => setDetourCount(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </label>
          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit">記録を追加</button>
          </div>
        </form>
      </section>

      <section>
        <h2 style={{ fontSize: 18 }}>記録一覧</h2>
        <ul style={{ paddingLeft: 18 }}>
          {walks.map((w) => {
            const saved = Math.max(0, w.plannedFareYen - w.actualFareYen);
            return (
              <li key={w.id} style={{ marginBottom: 8 }}>
                <strong>{w.date}</strong> {w.title} — 浮いた運賃 <strong>{saved}円</strong> / 補給{" "}
                {w.sustenanceCostYen}円 / {w.distanceKm}km / 寄り道 <strong>{w.detourCount}件</strong>{" "}
                <button type="button" onClick={() => handleIncrementDetour(w.id)}>
                  寄り道 +1
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
