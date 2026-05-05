import type { AnalysisResult } from "@/types";
import { addToHistory } from "@/utils/history-storage";
import { analyzeSubjectLine } from "@/utils/scoring-engine";
import { POWER_WORDS, SPAM_WORDS } from "@/utils/spam-dictionary";
import { Check, ClipboardCopy, TrendingUp, Wand2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Speedometer Gauge ───────────────────────────────────────────────────────

function ScoreGauge({ score, isEmpty }: { score: number; isEmpty: boolean }) {
  // Full semicircle: center (100, 100), radius 70, from 180° (left) to 0° (right)
  // Using stroke-dasharray/dashoffset on a fixed path for reliable animation
  const R = 70;
  const cx = 100;
  const cy = 100;

  // Arc circumference of a half-circle
  const arcLength = Math.PI * R; // ≈ 219.9

  // Fixed background arc path: left (180°) → right (0°)
  const bgPath = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;

  // Foreground: same path, clipped via dashoffset
  const fraction = score / 100;
  const dashOffset = arcLength * (1 - fraction);

  // Needle: rotate around center pivot
  // At score=0 → -180deg (pointing left), at score=100 → 0deg (pointing right)
  const needleDeg = -180 + fraction * 180;
  const needleLength = 55;

  const scoreColor =
    score > 66 ? "#10b981" : score > 33 ? "#f59e0b" : "#f43f5e";
  const scoreLabel = isEmpty
    ? "Start typing..."
    : score > 66
      ? "Excellent"
      : score > 33
        ? "Average"
        : "Poor";
  const labelColor =
    score > 66
      ? "text-emerald-600"
      : score > 33
        ? "text-amber-600"
        : "text-rose-500";

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 200 115"
        className="w-full max-w-[220px]"
        aria-label="Score gauge"
        role="img"
      >
        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((pct) => {
          const a = Math.PI * (1 - pct / 100); // 180° → 0° as pct 0→100
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

        {/* Foreground arc — dasharray drives fill, dashoffset drives progress */}
        <path
          d={bgPath}
          fill="none"
          stroke={scoreColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={score === 0 ? arcLength : dashOffset}
          style={{
            transition: "stroke-dashoffset 0.5s ease-out, stroke 0.4s ease",
          }}
        />

        {/* Needle base circle */}
        <circle cx={cx} cy={cy} r="5" fill="#475569" />

        {/* Needle — rotates around center pivot using SVG transform attribute */}
        <g
          style={{ transition: "transform 0.5s ease-out" }}
          transform={`rotate(${needleDeg}, ${cx}, ${cy})`}
        >
          <line
            x1={cx}
            y1={cy}
            x2={cx + needleLength}
            y2={cy}
            stroke="#334155"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>
      </svg>

      {/* Score number */}
      <motion.div
        key={score}
        initial={{ scale: 0.85, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="text-6xl font-black leading-none"
        style={{ color: scoreColor }}
      >
        {score}
      </motion.div>
      <div className="text-xs text-muted-foreground mt-0.5 mb-1 font-medium">
        /&nbsp;100
      </div>
      <div
        className={`text-sm font-bold uppercase tracking-widest ${labelColor}`}
      >
        {scoreLabel}
      </div>
    </div>
  );
}

// ─── Tone Badge ───────────────────────────────────────────────────────────────

const TONE_STYLES: Record<string, string> = {
  Urgent: "bg-rose-100 text-rose-700 border-rose-200",
  Request: "bg-blue-100 text-blue-700 border-blue-200",
  Informational: "bg-slate-100 text-slate-600 border-slate-200",
  Casual: "bg-violet-100 text-violet-700 border-violet-200",
};

function ToneBadge({ tone }: { tone: string }) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${TONE_STYLES[tone] ?? TONE_STYLES.Informational}`}
    >
      <TrendingUp size={11} />
      Tone: {tone}
    </div>
  );
}

// ─── Word Heatmap ─────────────────────────────────────────────────────────────

function WordHeatmap({
  text,
  spamWords,
  powerWords,
  longWords,
}: {
  text: string;
  spamWords: string[];
  powerWords: string[];
  longWords: string[];
}) {
  if (!text.trim()) return null;

  const spamSet = new Set(spamWords.map((w) => w.toLowerCase()));
  const powerSet = new Set(powerWords.map((w) => w.toLowerCase()));
  const longSet = new Set(
    longWords.map((w) => w.toLowerCase().replace(/[^a-z]/g, "")),
  );

  // Tokenize: split on spaces preserving them, then split each token further on punctuation
  const tokens = text.split(/(\s+)/);
  const tokenKeys = tokens.map((t, i) => `${t}-${i}`);

  return (
    <div>
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
        Word Analysis
      </p>
      <div
        className="p-4 rounded-xl bg-muted/30 border border-border text-base leading-relaxed font-medium break-words"
        aria-label="Word heatmap"
      >
        {tokens.map((token, i) => {
          const key = tokenKeys[i];
          if (/^\s+$/.test(token)) return <span key={key}>{token}</span>;
          const clean = token.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (spamSet.has(clean) || spamSet.has(token.toLowerCase())) {
            return (
              <span
                key={key}
                className="bg-rose-100 text-rose-700 underline decoration-wavy rounded px-0.5 mx-0.5"
                title="Spam word"
              >
                {token}
              </span>
            );
          }
          if (powerSet.has(clean) || powerSet.has(token.toLowerCase())) {
            return (
              <span
                key={key}
                className="bg-emerald-100 text-emerald-700 font-semibold rounded px-0.5 mx-0.5"
                title="Power word"
              >
                {token}
              </span>
            );
          }
          if (longSet.has(clean)) {
            return (
              <span
                key={key}
                className="bg-amber-100 text-amber-800 rounded px-0.5 mx-0.5"
                title="Long word — consider shortening"
              >
                {token}
              </span>
            );
          }
          return <span key={key}>{token}</span>;
        })}
      </div>
      <div className="flex flex-wrap gap-3 mt-2">
        <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-600">
          <span className="w-2.5 h-2.5 rounded-sm bg-rose-100 border border-rose-300 inline-block" />{" "}
          Spam word
        </span>
        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-300 inline-block" />{" "}
          Power word
        </span>
        <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300 inline-block" />{" "}
          Long word
        </span>
      </div>
    </div>
  );
}

// ─── Inbox Previews ───────────────────────────────────────────────────────────

function MobilePreview({ subject }: { subject: string }) {
  const truncated =
    subject.length > 35
      ? `${subject.slice(0, 35)}…`
      : subject || "Subject line preview…";
  const isOver = subject.length > 35;
  return (
    <div>
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
        Mobile Preview
      </p>
      <div className="bg-slate-900 rounded-2xl p-4 shadow-lg">
        {/* phone top bar */}
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-slate-400 text-[9px] font-semibold">9:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-4 h-1.5 bg-slate-500 rounded-sm" />
            <div className="w-1 h-1.5 bg-slate-500 rounded-sm" />
          </div>
        </div>
        {/* notification card */}
        <div className="bg-white rounded-xl p-3 flex gap-2.5 shadow">
          <div className="w-9 h-9 rounded-full bg-rose-200 flex-shrink-0 flex items-center justify-center text-rose-600 text-xs font-bold">
            JD
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline gap-2 mb-0.5">
              <span className="text-slate-800 text-xs font-bold truncate">
                John Doe
              </span>
              <span className="text-slate-400 text-[9px] flex-shrink-0">
                11:20 AM
              </span>
            </div>
            <div
              className={`text-slate-800 text-xs font-semibold truncate ${isOver ? "text-amber-700" : ""}`}
            >
              {truncated}
            </div>
            <div className="text-slate-400 text-[10px] truncate">
              This is the body text of the email…
            </div>
          </div>
        </div>
        <div className="mt-2 text-center">
          <span
            className={`text-[9px] font-semibold ${isOver ? "text-amber-400" : "text-slate-500"}`}
          >
            {isOver
              ? "⚠ Truncated at 35 chars"
              : `${subject.length}/35 chars — fits mobile`}
          </span>
        </div>
      </div>
    </div>
  );
}

function DesktopPreview({ subject }: { subject: string }) {
  const truncated =
    subject.length > 60
      ? `${subject.slice(0, 60)}…`
      : subject || "Subject line preview…";
  const isOver = subject.length > 60;
  return (
    <div>
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
        Desktop Preview
      </p>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Outlook-style header bar */}
        <div className="bg-blue-700 px-3 py-1.5 flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <div className="w-2 h-2 rounded-full bg-blue-400" />
          </div>
          <span className="text-blue-100 text-[9px] font-semibold ml-1">
            Inbox — Outlook
          </span>
        </div>
        {/* Row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-blue-50/40">
          <div className="w-8 h-8 rounded-full bg-slate-300 flex-shrink-0 flex items-center justify-center text-slate-600 text-xs font-bold">
            JD
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-3">
              <span className="text-slate-800 text-xs font-bold w-20 truncate">
                John Doe
              </span>
              <span
                className={`text-xs font-semibold flex-1 truncate ${isOver ? "text-amber-700" : "text-slate-700"}`}
              >
                {truncated}
              </span>
              <span className="text-slate-400 text-[9px] flex-shrink-0">
                11:20 AM
              </span>
            </div>
            <div className="text-slate-400 text-[10px] truncate mt-0.5">
              This is the body text of the email…
            </div>
          </div>
        </div>
        <div className="px-4 py-1.5 text-center">
          <span
            className={`text-[9px] font-semibold ${isOver ? "text-amber-600" : "text-slate-400"}`}
          >
            {isOver
              ? "⚠ Truncated at 60 chars"
              : `${subject.length}/60 chars — fits desktop`}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Feedback Cards ───────────────────────────────────────────────────────────

function FeedbackCards({ items }: { items: AnalysisResult["feedbackItems"] }) {
  if (items.length === 0) return null;
  const styleMap = {
    error: "bg-rose-50 text-rose-700 border-rose-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
        Feedback
      </p>
      {items.map((item, i) => (
        <motion.div
          key={item.message}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06 }}
          className={`rounded-xl p-3 text-sm font-semibold border ${styleMap[item.type]}`}
          data-ocid={`feedback.item.${i + 1}`}
        >
          {item.message}
        </motion.div>
      ))}
    </div>
  );
}

// ─── AI Alternative Generator ────────────────────────────────────────────────

function generateAlternatives(input: string, spamWords: string[]): string[] {
  if (!input.trim()) return [];

  const spamSet = new Set(spamWords.map((w) => w.toLowerCase()));
  const powerSuggestions = [
    "Feedback",
    "Insights",
    "Discussion",
    "Update",
    "Proposal",
  ];

  // Clean spam words
  const cleaned = input
    .split(/\s+/)
    .filter((w) => !spamSet.has(w.toLowerCase().replace(/[^a-z0-9]/g, "")))
    .join(" ")
    .replace(/!{2,}/g, "!")
    .trim();

  // Variant 1: cleaned + question form for curiosity
  const v1 = cleaned.endsWith("?") ? cleaned : `${cleaned.slice(0, 55)}?`;

  // Variant 2: prepend a power word
  const powerWord =
    powerSuggestions.find(
      (pw) => !cleaned.toLowerCase().includes(pw.toLowerCase()),
    ) ?? "Update";
  const v2 = `${powerWord}: ${cleaned.slice(0, 50)}`;

  // Variant 3: length-optimized (<=35 chars), trimmed at last space
  let v3 = cleaned.slice(0, 35);
  const lastSpace = v3.lastIndexOf(" ");
  if (lastSpace > 15) v3 = v3.slice(0, lastSpace);
  v3 = v3.trim();

  return [v1, v2, v3].filter(Boolean);
}

function AlternativeCard({ text, index }: { text: string; index: number }) {
  const [copied, setCopied] = useState(false);
  const result = analyzeSubjectLine(text);
  const scoreColor =
    result.score > 66
      ? "text-emerald-600"
      : result.score > 33
        ? "text-amber-600"
        : "text-rose-500";

  const handleCopy = () => {
    const doCopy = () => {
      // Fallback: create a temporary textarea and use execCommand
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
      document.body.appendChild(el);
      el.focus();
      el.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // execCommand not available
      } finally {
        document.body.removeChild(el);
      }
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => doCopy());
    } else {
      doCopy();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border"
      data-ocid={`alternatives.item.${index + 1}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
          {text}
        </p>
        <p className={`text-xs font-bold mt-0.5 ${scoreColor}`}>
          Score: {result.score}/100
        </p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        data-ocid={`alternatives.copy_button.${index + 1}`}
        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors duration-200 ${
          copied
            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
            : "bg-muted/60 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
        }`}
        aria-label={copied ? "Copied!" : "Copy to clipboard"}
      >
        {copied ? (
          <>
            <Check size={13} className="text-emerald-600" />
            <span>Copied</span>
          </>
        ) : (
          <>
            <ClipboardCopy size={13} />
            <span>Copy</span>
          </>
        )}
      </button>
    </motion.div>
  );
}

// ─── Main AnalyzerPage ────────────────────────────────────────────────────────

export default function AnalyzerPage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<AnalysisResult>(() =>
    analyzeSubjectLine(""),
  );
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runAnalysis = useCallback((text: string) => {
    const analysis = analyzeSubjectLine(text);
    setResult(analysis);
    if (analysis.score > 0 && text.trim()) {
      addToHistory({
        subject: text,
        score: analysis.score,
        tone: analysis.tone,
        timestamp: Date.now(),
      });
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runAnalysis(input);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input, runAnalysis]);

  const handleGenerateAlternatives = () => {
    const alts = generateAlternatives(input, SPAM_WORDS);
    setAlternatives(alts);
    setShowAlternatives(true);
  };

  const isEmpty = !input.trim();
  const wordCount = isEmpty
    ? 0
    : input.trim().split(/\s+/).filter(Boolean).length;
  const charCount = Array.from(input).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── LEFT COLUMN ── */}
        <div className="space-y-6">
          {/* Input Card */}
          <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
            <div className="flex items-center justify-between mb-3">
              <label
                htmlFor="subject-input"
                className="text-xs font-bold text-muted-foreground uppercase tracking-widest"
              >
                Enter Subject Line
              </label>
              <span
                className={`text-xs font-bold ${charCount > 60 ? "text-rose-500" : "text-muted-foreground"}`}
              >
                {charCount} / 60
              </span>
            </div>

            <textarea
              id="subject-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. URGENT: You won a FREE gift! Click here now!!!"
              rows={4}
              className="w-full min-h-32 p-4 bg-muted/30 border border-input rounded-xl outline-none focus:ring-2 focus:ring-ring text-base font-medium leading-relaxed resize-none transition-smooth placeholder:text-muted-foreground"
              data-ocid="analyzer.subject_input"
              aria-label="Email subject line input"
            />

            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">
                {wordCount} word{wordCount !== 1 ? "s" : ""}
              </span>
              {charCount > 35 && charCount <= 60 && (
                <span className="text-xs text-amber-600 font-semibold">
                  May be cut off on mobile
                </span>
              )}
              {charCount > 60 && (
                <span className="text-xs text-rose-500 font-semibold">
                  Too long for desktop
                </span>
              )}
            </div>
          </div>

          {/* Word Heatmap */}
          <AnimatePresence>
            {!isEmpty && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="bg-card rounded-2xl shadow-sm border border-border p-6"
              >
                <WordHeatmap
                  text={input}
                  spamWords={result.spamWords}
                  powerWords={result.powerWords}
                  longWords={result.longWords}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Feedback Cards */}
          <AnimatePresence>
            {result.feedbackItems.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-card rounded-2xl shadow-sm border border-border p-6"
              >
                <FeedbackCards items={result.feedbackItems} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* AI Alternatives */}
          <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-bold text-foreground">
                  AI Alternative Generator
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Get 3 optimized versions of your subject line
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateAlternatives}
                disabled={isEmpty}
                data-ocid="alternatives.generate_button"
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-smooth"
              >
                <Wand2 size={15} />
                Generate
              </button>
            </div>

            <AnimatePresence>
              {showAlternatives && alternatives.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                  data-ocid="alternatives.panel"
                >
                  {alternatives.map((alt, i) => (
                    <AlternativeCard key={alt} text={alt} index={i} />
                  ))}
                </motion.div>
              )}
              {showAlternatives && alternatives.length === 0 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-muted-foreground text-center py-2"
                >
                  Enter a subject line first to generate alternatives.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-6">
          {/* Score Gauge Card */}
          <div className="bg-card rounded-2xl shadow-sm border border-border p-6 text-center">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Deliverability Score
            </p>
            <ScoreGauge score={isEmpty ? 0 : result.score} isEmpty={isEmpty} />

            {/* Tone badge */}
            <div className="mt-4 flex justify-center">
              <ToneBadge tone={isEmpty ? "Informational" : result.tone} />
            </div>

            {/* Sub-metrics */}
            {!isEmpty && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-border"
              >
                <div className="text-center">
                  <div
                    className={`text-lg font-black ${result.spamWords.length > 0 ? "text-rose-500" : "text-emerald-600"}`}
                  >
                    {result.spamWords.length}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-semibold">
                    Spam Words
                  </div>
                </div>
                <div className="text-center">
                  <div
                    className={`text-lg font-black ${charCount > 60 ? "text-rose-500" : charCount > 35 ? "text-amber-500" : "text-emerald-600"}`}
                  >
                    {charCount}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-semibold">
                    Characters
                  </div>
                </div>
                <div className="text-center">
                  <div
                    className={`text-lg font-black ${result.powerWords.length > 0 ? "text-emerald-600" : "text-muted-foreground"}`}
                  >
                    {result.powerWords.length}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-semibold">
                    Power Words
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Mobile Preview */}
          <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
            <MobilePreview subject={input} />
          </div>

          {/* Desktop Preview */}
          <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
            <DesktopPreview subject={input} />
          </div>
        </div>
      </div>
    </div>
  );
}
