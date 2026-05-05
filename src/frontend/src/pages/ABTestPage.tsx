import type { AnalysisResult } from "@/types";
import { analyzeSubjectLine } from "@/utils/scoring-engine";
import { ArrowLeft, Minus, Trophy } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

interface Props {
  onNavigate: (page: string) => void;
}

function ScoringGauge({ score }: { score: number }) {
  const radius = 70;
  const cx = 90;
  const cy = 90;
  const startAngle = 210;
  const endAngle = 330;
  const totalArc = 360 - startAngle + endAngle;
  const fraction = score / 100;
  const currentArc = fraction * totalArc;

  function polarToCart(cx: number, cy: number, r: number, deg: number) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(startDeg: number, endDeg: number, r: number) {
    const s = polarToCart(cx, cy, r, startDeg);
    const e = polarToCart(cx, cy, r, endDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const needleDeg = startAngle + fraction * totalArc;
  const needleTip = polarToCart(cx, cy, radius - 8, needleDeg);
  const needleBase1 = polarToCart(cx, cy, 12, needleDeg + 90);
  const needleBase2 = polarToCart(cx, cy, 12, needleDeg - 90);

  const gaugeColor =
    score >= 67 ? "#10b981" : score >= 34 ? "#f59e0b" : "#ef4444";

  return (
    <svg
      viewBox="0 0 180 120"
      className="w-full max-w-[200px] mx-auto"
      role="img"
      aria-label={`Score gauge: ${score} out of 100`}
    >
      <title>Score gauge: {score} out of 100</title>
      {/* Track */}
      <path
        d={arcPath(startAngle, startAngle + totalArc, radius)}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth="12"
        strokeLinecap="round"
      />
      {/* Filled arc */}
      {score > 0 && (
        <path
          d={arcPath(startAngle, startAngle + currentArc, radius)}
          fill="none"
          stroke={gaugeColor}
          strokeWidth="12"
          strokeLinecap="round"
        />
      )}
      {/* Needle */}
      <polygon
        points={`${needleTip.x},${needleTip.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
        fill={gaugeColor}
        opacity="0.9"
      />
      <circle cx={cx} cy={cy} r="6" fill={gaugeColor} />
      {/* Score text */}
      <text
        x={cx}
        y={cy + 20}
        textAnchor="middle"
        fontSize="22"
        fontWeight="800"
        fill={gaugeColor}
      >
        {score}
      </text>
      <text
        x={cx}
        y={cy + 32}
        textAnchor="middle"
        fontSize="7"
        fill="#94a3b8"
        fontWeight="600"
      >
        / 100
      </text>
    </svg>
  );
}

function ScoreLabel({ score }: { score: number }) {
  if (score === 0)
    return (
      <span className="text-muted-foreground text-xs font-semibold">
        No Input
      </span>
    );
  if (score >= 80)
    return (
      <span className="text-emerald-600 text-xs font-semibold uppercase tracking-wider">
        Excellent
      </span>
    );
  if (score >= 67)
    return (
      <span className="text-emerald-500 text-xs font-semibold uppercase tracking-wider">
        Good
      </span>
    );
  if (score >= 34)
    return (
      <span className="text-amber-500 text-xs font-semibold uppercase tracking-wider">
        Average
      </span>
    );
  return (
    <span className="text-rose-500 text-xs font-semibold uppercase tracking-wider">
      Poor
    </span>
  );
}

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
  return (
    <div
      data-ocid={`abtest.panel.${label === "Subject Line A" ? "a" : "b"}`}
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
          data-ocid={`abtest.input.${label === "Subject Line A" ? "a" : "b"}`}
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

      <div className="flex flex-col items-center gap-1">
        <ScoringGauge score={result.score} />
        <ScoreLabel score={result.score} />
        {result.tone && result.charCount > 0 && (
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
