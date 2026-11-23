import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { estimateStepsFromKm, evaluateRule, summarizeWalks } from "./calculator";
import { DEFAULT_RULES, SAMPLE_WALKS } from "./presets";
import { PresetPatternId, RewardRule, WalkInput } from "./types";
import { WalkChart } from "./WalkChart";

const STORAGE_KEY_WALKS = "ww_reward_sim_walks_v1";
const STORAGE_KEY_RULES = "ww_reward_sim_rules_v1";

const PATTERN_LABELS: Record<PresetPatternId, string> = {
  instant: "即席ご褒美",
  accumulate: "ためる・積立",
  distance_linked: "距離連動",
};

const PATTERN_ICONS: Record<PresetPatternId, string> = {
  instant: "🍰",
  accumulate: "🪙",
  distance_linked: "👟",
};

function normalizeWalk(raw: Partial<WalkInput>, index: number): WalkInput {
  const distanceKm = Number(raw.distanceKm) || 0;
  const steps =
    typeof raw.steps === "number" && Number.isFinite(raw.steps) && raw.steps >= 0
      ? Math.round(raw.steps)
      : estimateStepsFromKm(distanceKm);
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : `walk-loaded-${index}`,
    date: typeof raw.date === "string" && raw.date ? raw.date : new Date().toISOString().slice(0, 10),
    title: typeof raw.title === "string" && raw.title ? raw.title : "名称未設定ウォーク",
    plannedFareYen: Number(raw.plannedFareYen) || 0,
    actualFareYen: Number(raw.actualFareYen) || 0,
    sustenanceCostYen: Number(raw.sustenanceCostYen) || 0,
    rewardSpentYen: Number(raw.rewardSpentYen) || 0,
    distanceKm,
    steps,
    durationMinutes: Number(raw.durationMinutes) || 0,
    detourCount: Number(raw.detourCount) || 0,
  };
}

function loadInitialWalks(): WalkInput[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WALKS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => !(typeof item?.id === "string" && item.id.startsWith("sample-")))
      .map((item, idx) => normalizeWalk(item, idx));
  } catch {
    return [];
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
  const [isSampleMode, setIsSampleMode] = useState(false);
  const [sampleWalks, setSampleWalks] = useState<WalkInput[]>(SAMPLE_WALKS);
  const [rules] = useState<RewardRule[]>(loadInitialRules);
  const [mode, setMode] = useState<"single" | "cumulative">("single");
  const [selectedWalkId, setSelectedWalkId] = useState<string>(
    () => walks[0]?.id ?? ""
  );
  const [patternFilter, setPatternFilter] = useState<"all" | PresetPatternId>("all");
  const [pendingDeleteWalk, setPendingDeleteWalk] = useState<WalkInput | null>(null);
  const confirmDialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmDialogTitleId = useId();
  const stepsInputId = useId();
  const stepsHintId = useId();

  const [title, setTitle] = useState("週末ウォーク");
  const [plannedFareYen, setPlannedFareYen] = useState(500);
  const [actualFareYen, setActualFareYen] = useState(0);
  const [sustenanceCostYen, setSustenanceCostYen] = useState(180);
  const [rewardSpentYen, setRewardSpentYen] = useState(0);
  const [distanceKm, setDistanceKm] = useState(8.5);
  const [steps, setSteps] = useState(() => estimateStepsFromKm(8.5));
  const [isStepsManual, setIsStepsManual] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(110);
  const [detourCount, setDetourCount] = useState(2);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WALKS, JSON.stringify(walks));
  }, [walks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules));
  }, [rules]);

  useEffect(() => {
    // React の autoFocus は HTML autofocus 属性を出力しないため、ネイティブ showModal() の初期フォーカス用に付与する
    cancelButtonRef.current?.setAttribute("autofocus", "");
  }, []);

  useEffect(() => {
    const dialog = confirmDialogRef.current;
    if (pendingDeleteWalk && dialog && !dialog.open) {
      dialog.showModal();
    }
  }, [pendingDeleteWalk]);

  const activeWalks = isSampleMode ? sampleWalks : walks;

  const targetWalks = useMemo(() => {
    if (mode === "cumulative") return activeWalks;
    const found = activeWalks.find((w) => w.id === selectedWalkId);
    return found ? [found] : activeWalks.slice(0, 1);
  }, [mode, activeWalks, selectedWalkId]);

  const summary = useMemo(() => summarizeWalks(targetWalks), [targetWalks]);

  const visibleRules = useMemo(() => {
    if (patternFilter === "all") return rules;
    return rules.filter((r) => r.pattern === patternFilter);
  }, [rules, patternFilter]);

  const evaluatedRules = useMemo(
    () => visibleRules.map((rule) => evaluateRule(rule, summary)),
    [visibleRules, summary]
  );

  const moodMessage = useMemo(() => {
    if (activeWalks.length === 0) {
      return { icon: "👟", text: "最初のおさんぽを記録してみよう！" };
    }
    if (summary.rewardRemainingYen >= 1000) {
      return { icon: "🎉", text: "たっぷりご褒美タイムいけそう！" };
    }
    if (summary.rewardRemainingYen >= 500) {
      return { icon: "🍰", text: "プチご褒美OK！カフェやパン屋さんへ" };
    }
    if (summary.distanceKm >= 5) {
      return { icon: "🌿", text: "いい距離歩いた！気分リフレッシュ" };
    }
    return { icon: "🚶", text: "少しずつご褒美をためていこう" };
  }, [activeWalks.length, summary.rewardRemainingYen, summary.distanceKm]);

  const handleDistanceChange = (nextDistance: number) => {
    setDistanceKm(nextDistance);
    if (!isStepsManual) {
      setSteps(estimateStepsFromKm(nextDistance));
    }
  };

  const handleStepsChange = (nextSteps: number) => {
    setSteps(nextSteps);
    setIsStepsManual(true);
  };

  const handleResetStepsEstimate = () => {
    setSteps(estimateStepsFromKm(distanceKm));
    setIsStepsManual(false);
  };

  const handleSelectWalkFromChart = (walkId: string) => {
    setSelectedWalkId(walkId);
    setMode("single");
  };

  const handleAddWalk = (e: React.FormEvent) => {
    e.preventDefault();
    const dist = Number(distanceKm) || 0;
    const newWalk: WalkInput = {
      id: `walk-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      title: title.trim() || "名称未設定ウォーク",
      plannedFareYen: Number(plannedFareYen) || 0,
      actualFareYen: Number(actualFareYen) || 0,
      sustenanceCostYen: Number(sustenanceCostYen) || 0,
      rewardSpentYen: Number(rewardSpentYen) || 0,
      distanceKm: dist,
      steps: Math.max(0, Math.round(Number(steps) || 0)),
      durationMinutes: Number(durationMinutes) || 0,
      detourCount: Number(detourCount) || 0,
    };
    setWalks((prev) => [newWalk, ...prev]);
    setIsSampleMode(false);
    setSelectedWalkId(newWalk.id);
    setMode("single");
    setIsStepsManual(false);
  };

  const handleIncrementDetour = (walkId: string) => {
    const updater = (prev: WalkInput[]) =>
      prev.map((w) => (w.id === walkId ? { ...w, detourCount: w.detourCount + 1 } : w));
    if (isSampleMode) {
      setSampleWalks(updater);
    } else {
      setWalks(updater);
    }
  };

  const handleRequestDeleteWalk = (walk: WalkInput) => {
    setPendingDeleteWalk(walk);
  };

  const handleEnterSampleMode = () => {
    setSampleWalks(SAMPLE_WALKS);
    setIsSampleMode(true);
    setSelectedWalkId(SAMPLE_WALKS[0]?.id ?? "");
  };

  const handleExitSampleMode = () => {
    setIsSampleMode(false);
    setSelectedWalkId(walks[0]?.id ?? "");
  };

  const handleConfirmDialogClose = () => {
    const dialog = confirmDialogRef.current;
    if (!dialog) return;
    const choice = dialog.returnValue;
    dialog.returnValue = "";

    if (choice === "delete" && pendingDeleteWalk) {
      const targetId = pendingDeleteWalk.id;
      const nextList = activeWalks.filter((w) => w.id !== targetId);
      if (isSampleMode) {
        setSampleWalks(nextList);
      } else {
        setWalks(nextList);
      }
      if (selectedWalkId === targetId) {
        setSelectedWalkId(nextList[0]?.id ?? "");
      }
    }
    setPendingDeleteWalk(null);
  };

  return (
    <main className="app-shell">
      <header className="hero-header">
        <div>
          <div className="hero-eyebrow">
            <span aria-hidden="true">🌿</span>
            <span>週末おさんぽ＆ご褒美手帳</span>
          </div>
          <h1 className="hero-title">
            <span aria-hidden="true">🚶 </span>さんぽご褒美シミュレータ
          </h1>
          <p className="hero-subtitle">
            歩いたぶんだけ、ご褒美がたまる！水分・飴・グミなどの補給コストは別枠なので、ご褒美枠は減りません。
          </p>
          <p className="hero-privacy-note">
            <span aria-hidden="true">🔒</span>
            <span>
              記録はこのスマホやパソコンの中だけで完結し、外部サーバーへデータが送信されることはありません。
            </span>
          </p>
        </div>
        <div className="hero-mood-pill" role="status" aria-live="polite">
          <span aria-hidden="true">{moodMessage.icon}</span>
          <span>{moodMessage.text}</span>
        </div>
      </header>

      {isSampleMode && (
        <div className="sample-mode-banner" role="status" aria-live="polite">
          <div className="sample-mode-text">
            <span aria-hidden="true">👀</span>
            <span>
              <strong>サンプルデータを表示中（{sampleWalks.length}件）</strong>
              　自分の記録には影響しません。
            </span>
          </div>
          <button
            type="button"
            onClick={handleExitSampleMode}
            className="primary-button sample-exit-button"
          >
            自分の記録に戻る（{walks.length}件）
          </button>
        </div>
      )}

      <section className="control-bar" aria-label="表示切替">
        <div className="segmented-control" role="group" aria-label="集計モード">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`pill-button${mode === "single" ? " is-active" : ""}`}
            aria-pressed={mode === "single"}
          >
            単発表示
          </button>
          <button
            type="button"
            onClick={() => setMode("cumulative")}
            className={`pill-button${mode === "cumulative" ? " is-active" : ""}`}
            aria-pressed={mode === "cumulative"}
          >
            累積表示（全 {activeWalks.length} 件）
          </button>
        </div>

        {mode === "single" &&
          (activeWalks.length > 0 ? (
            <select
              className="walk-select"
              value={selectedWalkId}
              onChange={(e) => setSelectedWalkId(e.target.value)}
              aria-label="対象ウォーク選択"
            >
              {activeWalks.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.date} — {w.title}（{w.distanceKm}km）
                </option>
              ))}
            </select>
          ) : (
            <span className="summary-meta">記録がありません</span>
          ))}

        {isSampleMode ? (
          <button type="button" onClick={handleExitSampleMode} className="ghost-button">
            自分の記録に戻る
          </button>
        ) : (
          <button type="button" onClick={handleEnterSampleMode} className="ghost-button">
            サンプルを見る
          </button>
        )}
      </section>

      <section className="summary-grid" aria-label="集計サマリー">
        <div className="summary-card summary-card--fare">
          <div className="summary-label">
            <span aria-hidden="true">🚃</span>
            <span>浮いた交通費（グロス）</span>
          </div>
          <strong className="summary-value">
            {summary.grossSavedFareYen.toLocaleString()} 円
          </strong>
          <div className="summary-meta">歩いたおかげで節約できた運賃</div>
        </div>

        <div className="summary-card summary-card--reward">
          <div className="summary-label">
            <span aria-hidden="true">🍰</span>
            <span>ご褒美に使える残余枠</span>
          </div>
          <strong className="summary-value">
            {summary.rewardRemainingYen.toLocaleString()} 円
          </strong>
          <div className="summary-meta">
            使用済みご褒美: {summary.rewardSpentYen.toLocaleString()} 円
          </div>
        </div>

        <div className="summary-card summary-card--sustenance">
          <div className="summary-label">
            <span aria-hidden="true">💧</span>
            <span>補給コスト（別枠）</span>
          </div>
          <strong className="summary-value">
            {summary.sustenanceCostYen.toLocaleString()} 円
          </strong>
          <div className="summary-meta">水分・飴・グミ等（減額対象外）</div>
        </div>

        <div className="summary-card summary-card--walk">
          <div className="summary-label">
            <span aria-hidden="true">👟</span>
            <span>歩数・距離・寄り道</span>
          </div>
          <strong className="summary-value summary-value--compact">
            {summary.totalSteps.toLocaleString()} 歩
          </strong>
          <div className="summary-meta">
            {summary.distanceKm} km / {summary.durationMinutes} 分 ・{" "}
            <span aria-hidden="true">📍 </span>寄り道 {summary.detourCount} 件
          </div>
        </div>
      </section>

      <section className="section-block" aria-label="ご褒美換算パターン">
        <div className="section-header">
          <h2 className="section-title">
            <span aria-hidden="true">🎁</span>
            <span>ご褒美換算パターン</span>
          </h2>
          <div className="filter-pills" role="group" aria-label="パターン絞り込み">
            {(["all", "instant", "accumulate", "distance_linked"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPatternFilter(p)}
                className={`filter-pill${patternFilter === p ? " is-active" : ""}`}
                aria-pressed={patternFilter === p}
              >
                <span aria-hidden="true">
                  {p === "all" ? "✨ " : `${PATTERN_ICONS[p]} `}
                </span>
                {p === "all" ? "すべて" : PATTERN_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="rules-grid">
          {evaluatedRules.map(({ rule, displayValue, integerUnits, remainderToNext }) => {
            const maxStep = rule.unitAmount > 0 ? rule.unitAmount : 1;
            const currentStep = Math.max(0, Math.min(maxStep, maxStep - remainderToNext));
            const progressPct = Math.round((currentStep / maxStep) * 100);
            const nextUnitLabel = rule.basis === "fare" ? "円" : "km";

            return (
              <article key={rule.id} className={`rule-card rule-card--${rule.pattern}`}>
                <div className="rule-card-top">
                  <span className="rule-badge">
                    <span aria-hidden="true">{PATTERN_ICONS[rule.pattern]}</span>
                    <span>{PATTERN_LABELS[rule.pattern]}</span>
                  </span>
                  {integerUnits > 0 && (
                    <span className="rule-achieved-tag">{integerUnits} 達成!</span>
                  )}
                </div>

                <div className="rule-name">{rule.name}</div>

                <div className="rule-value-row">
                  <span className="rule-value">{displayValue}</span>
                  <span className="rule-unit">{rule.unitLabel}</span>
                </div>

                <div className="rule-progress-wrap">
                  <progress
                    className="rule-progress"
                    max={maxStep}
                    value={currentStep}
                    aria-label={`${rule.name}の次の1単位までの進捗（${progressPct}%）`}
                  />
                  <div className="rule-next">
                    次の1単位まであと{" "}
                    <strong>
                      {remainderToNext} {nextUnitLabel}
                    </strong>{" "}
                    （{progressPct}%）
                  </div>
                </div>

                <p className="rule-description">{rule.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <WalkChart
        walks={activeWalks}
        selectedWalkId={selectedWalkId}
        onSelectWalk={handleSelectWalkFromChart}
        onLoadSample={isSampleMode ? undefined : handleEnterSampleMode}
      />

      <section className="panel-card" aria-label="ウォーク記録を追加">
        <h2 className="section-title">
          <span aria-hidden="true">✍️</span>
          <span>さんぽ記録を追加</span>
        </h2>
        <form onSubmit={handleAddWalk} className="walk-form">
          <label className="walk-field">
            <span className="walk-field-label">タイトル</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="walk-field">
            <span className="walk-field-label">想定運賃（円）</span>
            <input
              type="number"
              min={0}
              value={plannedFareYen}
              onChange={(e) => setPlannedFareYen(Number(e.target.value))}
            />
          </label>
          <label className="walk-field">
            <span className="walk-field-label">実支払運賃（円）</span>
            <input
              type="number"
              min={0}
              value={actualFareYen}
              onChange={(e) => setActualFareYen(Number(e.target.value))}
            />
          </label>
          <label className="walk-field">
            <span className="walk-field-label">補給：水分・飴・グミ（円）</span>
            <input
              type="number"
              min={0}
              value={sustenanceCostYen}
              onChange={(e) => setSustenanceCostYen(Number(e.target.value))}
            />
          </label>
          <label className="walk-field">
            <span className="walk-field-label">ご褒美支出（円）</span>
            <input
              type="number"
              min={0}
              value={rewardSpentYen}
              onChange={(e) => setRewardSpentYen(Number(e.target.value))}
            />
          </label>
          <label className="walk-field">
            <span className="walk-field-label">距離（km）</span>
            <input
              type="number"
              step="0.1"
              min={0}
              value={distanceKm}
              onChange={(e) => handleDistanceChange(Number(e.target.value))}
            />
          </label>
          <div className="walk-field">
            <div className="walk-field-label walk-field-label--with-action">
              <label htmlFor={stepsInputId}>歩数（歩）</label>
              {isStepsManual && (
                <button
                  type="button"
                  className="inline-reset-link"
                  onClick={handleResetStepsEstimate}
                >
                  目安に戻す
                </button>
              )}
            </div>
            <input
              id={stepsInputId}
              type="number"
              min={0}
              step={100}
              value={steps}
              aria-describedby={stepsHintId}
              onChange={(e) => handleStepsChange(Number(e.target.value))}
            />
          </div>
          <label className="walk-field">
            <span className="walk-field-label">時間（分）</span>
            <input
              type="number"
              min={0}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
            />
          </label>
          <label className="walk-field">
            <span className="walk-field-label">寄り道・発見数</span>
            <input
              type="number"
              min={0}
              value={detourCount}
              onChange={(e) => setDetourCount(Number(e.target.value))}
            />
          </label>
          <div className="walk-form-submit">
            <button type="submit" className="primary-button">
              <span aria-hidden="true">＋ </span>記録を追加する
            </button>
            <span id={stepsHintId} className="form-hint">
              ※ 歩数は距離から自動計算（1km ≈ 1,400歩）されます。手入力での修正もできます。
            </span>
          </div>
        </form>
      </section>

      <section className="section-block" aria-label="記録一覧">
        <div className="section-header">
          <h2 className="section-title">
            <span aria-hidden="true">🗺️</span>
            <span>
              {isSampleMode ? "サンプルのおさんぽログ" : "おさんぽログ"}（{activeWalks.length} 件）
            </span>
          </h2>
        </div>

        {activeWalks.length === 0 ? (
          <div className="empty-state">
            <p style={{ margin: "0 0 12px" }}>
              {isSampleMode
                ? "サンプルをすべて削除しました。自分の記録に戻るか、もう一度サンプルを読み込めます。"
                : "まだ記録がありません。上のフォームからさんぽを記録するか、サンプルデータで動きを試せます。"}
            </p>
            <button
              type="button"
              onClick={isSampleMode ? handleExitSampleMode : handleEnterSampleMode}
              className="secondary-button"
            >
              {isSampleMode ? "自分の記録に戻る" : "サンプルを見る"}
            </button>
          </div>
        ) : (
          <ul className="walk-log-list">
            {activeWalks.map((w) => {
              const saved = Math.max(0, w.plannedFareYen - w.actualFareYen);
              const isSelected = mode === "single" && w.id === selectedWalkId;
              return (
                <li
                  key={w.id}
                  className={`walk-log-item${isSelected ? " is-selected" : ""}`}
                >
                  <div className="walk-log-main">
                    <div className="walk-log-head">
                      <span className="walk-date-chip">{w.date}</span>
                      <span className="walk-log-title">{w.title}</span>
                    </div>
                    <div className="walk-log-metrics">
                      <span className="metric-chip">
                        <span aria-hidden="true">🚃</span>
                        <span>浮いた運賃 {saved.toLocaleString()}円</span>
                      </span>
                      <span className="metric-chip">
                        <span aria-hidden="true">💧</span>
                        <span>補給 {w.sustenanceCostYen.toLocaleString()}円</span>
                      </span>
                      {w.rewardSpentYen > 0 && (
                        <span className="metric-chip">
                          <span aria-hidden="true">🍰</span>
                          <span>ご褒美 {w.rewardSpentYen.toLocaleString()}円</span>
                        </span>
                      )}
                      <span className="metric-chip">
                        <span aria-hidden="true">👣</span>
                        <span>{w.steps.toLocaleString()} 歩</span>
                      </span>
                      <span className="metric-chip">
                        <span aria-hidden="true">👟</span>
                        <span>{w.distanceKm} km</span>
                      </span>
                      <span className="metric-chip">
                        <span aria-hidden="true">📍</span>
                        <span>寄り道 {w.detourCount}件</span>
                      </span>
                    </div>
                  </div>
                  <div className="walk-log-actions">
                    <button
                      type="button"
                      onClick={() => handleIncrementDetour(w.id)}
                      className="detour-button"
                    >
                      <span aria-hidden="true">✨ </span>寄り道 +1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRequestDeleteWalk(w)}
                      aria-label={`${w.date} ${w.title} を削除`}
                      className="delete-outline-button"
                    >
                      削除
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <footer className="app-footer">
        保存先：ブラウザ内ストレージ（<code>localStorage</code>）
      </footer>

      <dialog
        ref={confirmDialogRef}
        aria-labelledby={confirmDialogTitleId}
        onClose={handleConfirmDialogClose}
      >
        <h2 id={confirmDialogTitleId} className="confirm-dialog-title">
          記録を削除しますか？
        </h2>
        <p className="confirm-dialog-message">
          {pendingDeleteWalk
            ? `「${pendingDeleteWalk.date} ${pendingDeleteWalk.title}」を削除します。この操作は取り消せません。`
            : ""}
        </p>
        <form method="dialog" className="confirm-dialog-actions">
          <button
            ref={cancelButtonRef}
            type="submit"
            value="cancel"
            className="secondary-button"
          >
            キャンセル
          </button>
          <button type="submit" value="delete" className="danger-button">
            削除する
          </button>
        </form>
      </dialog>
    </main>
  );
}
