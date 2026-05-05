import type { AnalysisResult } from "@/types";
import { analyzeSubjectLine } from "@/utils/scoring-engine";
import { ArrowLeft, Minus, Trophy } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

interface Props {
  onNavigate: (page: string) => void;
}

// ─── Scoring Gauge (same reliable technique as AnalyzerPage ScoreGauge) ──────

function ScoringGauge({ score, isEmpty }: { score: number; isEmpty: boolean }) {
  // Semicircle: center (100,100), radius 70, left (180°) → right (0°)
  // stroke-dasharray/dashoffset drives fill — matches AnalyzerPage ScoreGauge
  const R = 70;
  const cx = 100;
  const cy = 100;
  const arcLength = Math.PI * R; // ≈ 219.9

  const bgPath = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;

  const fraction = score / 100;
  const dashOffset = arcLength * (1 - fraction);

  // Needle: −180deg (left/score=0) → 0deg (right/score=100)
  const needleDeg = -180 + fraction * 180;
  const needleLength = 52;

  const scoreColor =
    score > 66 ? "#10b981" : score > 33 ? "#f59e0b" : "#f43f5e";

  const scoreLabel = isEmpty
    ? "No Input"
    : score >= 80
      ? "Excellent"
      : score >= 67
        ? "Good"
        : score >= 34
          ? "Average"
          : "Poor";

  const labelColor = isEmpty
    ? "text-muted-foreground"
    : score >= 67
      ? "text-emerald-600"
      : score >= 34
        ? "text-amber-500"
        : "text-rose-500";

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 200 115"
        className="w-full max-w-[200px]"
        role="img"
        aria-label={`Score gauge: ${isEmpty ? "No input" : `${score} out of 100`}`}
      >
        {/* Tick marks at 0, 25, 50, 75, 100 */}
        {[0, 25, 50, 75, 100].map((pct) => {
          const a = Math.PI * (1 - pct / 100);
          const inner = {
            x: cx + (R - 10) * Math.cos(a),
            y: cy - (R - 10) * Math.sin(a),
          };
          const outer = {
            x: cx + (R + 2) * Math.cos(a),
            y: cy - (R + 2) * Math.sin(a),
          };
          const labelPos = {
            x: cx + (R - 20) * Math.cos(a),
            y: cy - (R - 20) * Math.sin(a),
          };
          return (
            <g key={pct}>
              <line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="#cbd5e1"
                strokeWidth="1.5"
              />
              <text
                x={labelPos.x}
                y={labelPos.y + 2}
                textAnchor="middle"
                fontSize="7"
                fill="#94a3b8"
                fontFamily="sans-serif"
              >
                {pct}
              </text>
            </g>
          );
        })}

        {/* Background arc */}
        <path
          d={bgPath}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Foreground arc — dashoffset drives animated progress */}
        <path
          d={bgPath}
          fill="none"
          stroke={isEmpty ? "#e2e8f0" : scoreColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={isEmpty || score === 0 ? arcLength : dashOffset}
          style={{
            transition: "stroke-dashoffset 0.5s ease-out, stroke 0.4s ease",
          }}
        />

        {/* Needle base circle */}
        <circle cx={cx} cy={cy} r="5" fill={isEmpty ? "#94a3b8" : "#475569"} />

        {/* Needle — rotates around center pivot */}
        <g
          style={{ transition: "transform 0.5s ease-out" }}
          transform={`rotate(${isEmpty ? -180 : needleDeg}, ${cx}, ${cy})`}
        >
          <line
            x1={cx}
            y1={cy}
            x2={cx + needleLength}
            y2={cy}
            stroke={isEmpty ? "#94a3b8" : "#334155"}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>
      </svg>

      {/* Score number */}
      <motion.div
        key={isEmpty ? "empty" : score}
        initial={{ scale: 0.85, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="text-4xl font-black leading-none mt-1"
        style={{ color: isEmpty ? undefined : scoreColor }}
      >
        {isEmpty ? (
          <span className="text-2xl font-bold text-muted-foreground">--</span>
        ) : (
          score
        )}
      </motion.div>
      <div className="text-xs text-muted-foreground mt-0.5 mb-1 font-medium">
        /&nbsp;100
      </div>
      <div
        className={`text-xs font-bold uppercase tracking-widest ${labelColor}`}
      >
        {scoreLabel}
      </div>
    </div>
  );
}

// ─── Feedback badge dot ───────────────────────────────────────────────────────

function FeedbackBadge({ type }: { type: "error" | "warning" | "success" }) {
  if (type === "error")
    return (
      <span
        aria-label="Error"
        className="inline-block w-2 h-2 rounded-full bg-destructive mr-1.5 flex-shrink-0 mt-1"
      />
    );
  if (type === "warning")
    return (
      <span className="inline-block w-2 h-2 rounded-full bg-warning mr-1.5 flex-shrink-0 mt-1" />
    );
  return (
    <span className="inline-block w-2 h-2 rounded-full bg-success mr-1.5 flex-shrink-0 mt-1" />
  );
}

// ─── Subject Panel ────────────────────────────────────────────────────────────

interface SubjectPanelProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  result: AnalysisResult;
  isWinner: boolean | null;
}

function SubjectPanel({
  label,
  value,
  onChange,
  result,
  isWinner,
}: SubjectPanelProps) {
  const isEmpty = value.trim() === "";
  const panelKey = label === "Subject Line A" ? "a" : "b";

  return (
    <div
      data-ocid={`abtest.panel.${panelKey}`}
      className={`bg-card rounded-2xl border p-6 flex flex-col gap-4 transition-all duration-300 ${
        isWinner === true
          ? "border-emerald-400 shadow-md shadow-emerald-100"
          : isWinner === false
            ? "border-border opacity-75"
            : "border-border shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">{label}</h2>
        {isWinner === true && (
          <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">
            <Trophy className="w-3.5 h-3.5" /> Winner ✓
          </span>
        )}
      </div>

      <div className="relative">
        <textarea
          data-ocid={`abtest.input.${panelKey}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label}...`}
          className="w-full h-24 px-4 py-3 bg-muted border border-input rounded-xl outline-none focus:ring-2 focus:ring-ring text-sm font-medium resize-none leading-relaxed transition-colors"
          maxLength={200}
        />
        <span className="absolute bottom-2 right-3 text-xs text-muted-foreground font-medium">
          {result.charCount} chars
        </span>
      </div>

      {/* Score gauge — passes isEmpty so meter shows placeholder when blank */}
      <div className="flex flex-col items-center gap-1">
        <ScoringGauge score={result.score} isEmpty={isEmpty} />
        {result.tone && !isEmpty && (
          <span className="text-xs text-muted-foreground mt-0.5">
            Tone:{" "}
            <span className="font-semibold text-foreground">{result.tone}</span>
          </span>
        )}
      </div>

      {result.feedbackItems.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-border">
          {result.feedbackItems.slice(0, 4).map((item) => (
            <div
              key={item.message}
              className="flex items-start text-xs text-foreground"
            >
              <FeedbackBadge type={item.type} />
              <span className="leading-relaxed">{item.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ABTestPage ───────────────────────────────────────────────────────────────

export default function ABTestPage({ onNavigate }: Props) {
  const [subjectA, setSubjectA] = useState("");
  const [subjectB, setSubjectB] = useState("");
  const [debouncedA, setDebouncedA] = useState("");
  const [debouncedB, setDebouncedB] = useState("");

  const handleA = useCallback((v: string) => setSubjectA(v), []);
  const handleB = useCallback((v: string) => setSubjectB(v), []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedA(subjectA), 300);
    return () => clearTimeout(t);
  }, [subjectA]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedB(subjectB), 300);
    return () => clearTimeout(t);
  }, [subjectB]);

  const resultA = analyzeSubjectLine(debouncedA);
  const resultB = analyzeSubjectLine(debouncedB);

  const bothEmpty = !debouncedA.trim() && !debouncedB.trim();
  const scoresEqual =
    !bothEmpty &&
    debouncedA.trim() &&
    debouncedB.trim() &&
    resultA.score === resultB.score;
  const winnerA =
    !bothEmpty &&
    debouncedA.trim() &&
    debouncedB.trim() &&
    resultA.score > resultB.score;
  const winnerB =
    !bothEmpty &&
    debouncedA.trim() &&
    debouncedB.trim() &&
    resultB.score > resultA.score;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          data-ocid="abtest.back_button"
          onClick={() => onNavigate("/")}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Analyzer
        </button>
      </div>

      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">
          A/B Testing Simulator
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compare two subject lines side by side to find the winner
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SubjectPanel
          label="Subject Line A"
          value={subjectA}
          onChange={handleA}
          result={resultA}
          isWinner={winnerA ? true : winnerB ? false : null}
        />
        <SubjectPanel
          label="Subject Line B"
          value={subjectB}
          onChange={handleB}
          result={resultB}
          isWinner={winnerB ? true : winnerA ? false : null}
        />
      </div>

      {/* Winner Banner */}
      {(scoresEqual || winnerA || winnerB) && (
        <motion.div
          data-ocid="abtest.winner_banner"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={`rounded-2xl border p-5 flex items-center justify-center gap-3 ${
            scoresEqual
              ? "bg-muted border-border"
              : "bg-emerald-50 border-emerald-300"
          }`}
        >
          {scoresEqual ? (
            <>
              <Minus className="w-5 h-5 text-muted-foreground" />
              <p className="text-base font-bold text-foreground">
                It's a tie! Both subject lines scored {resultA.score}/100.
              </p>
            </>
          ) : (
            <>
              <Trophy className="w-5 h-5 text-emerald-600" />
              <p className="text-base font-bold text-emerald-700">
                <span className="text-emerald-900">
                  {winnerA ? "Subject Line A" : "Subject Line B"}
                </span>{" "}
                wins with{" "}
                <span className="text-emerald-900">
                  {winnerA ? resultA.score : resultB.score}
                </span>{" "}
                vs <span>{winnerA ? resultB.score : resultA.score}</span>{" "}
                points!
              </p>
            </>
          )}
        </motion.div>
      )}

      {bothEmpty && (
        <div
          data-ocid="abtest.empty_state"
          className="rounded-2xl border border-dashed border-border bg-muted/40 p-8 text-center"
        >
          <p className="text-sm text-muted-foreground font-medium">
            Enter two subject lines above to compare them and find the better
            performer.
          </p>
        </div>
      )}
    </div>
  );
}
