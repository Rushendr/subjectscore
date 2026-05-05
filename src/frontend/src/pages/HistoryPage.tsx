import type { HistoryEntry } from "@/types";
import {
  clearHistory,
  getHistory,
  removeFromHistory,
} from "@/utils/history-storage";
import { ArrowLeft, BookOpen, Check, Clock, Copy, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";

interface Props {
  onNavigate: (page: string) => void;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 10) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin} min${diffMin > 1 ? "s" : ""} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? "s" : ""} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ScoreChip({ score }: { score: number }) {
  const cls =
    score >= 67
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : score >= 34
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-rose-100 text-rose-600 border-rose-200";
  const label =
    score >= 80
      ? "Excellent"
      : score >= 67
        ? "Good"
        : score >= 34
          ? "Average"
          : "Poor";
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${cls}`}
    >
      {score} <span className="font-normal opacity-70">— {label}</span>
    </span>
  );
}

function ToneBadge({ tone }: { tone: string }) {
  const colors: Record<string, string> = {
    Urgent: "bg-rose-50 text-rose-600 border-rose-200",
    Request: "bg-blue-50 text-blue-600 border-blue-200",
    Informational: "bg-violet-50 text-violet-600 border-violet-200",
    Casual: "bg-teal-50 text-teal-600 border-teal-200",
  };
  const cls = colors[tone] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${cls}`}
    >
      {tone}
    </span>
  );
}

interface HistoryCardProps {
  entry: HistoryEntry;
  index: number;
  onDelete: (id: string) => void;
}

function HistoryCard({ entry, index, onDelete }: HistoryCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = entry.subject;

    const doCopy = () => {
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
        // execCommand not supported
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
  }, [entry.subject]);

  const truncated =
    entry.subject.length > 80
      ? `${entry.subject.slice(0, 77)}…`
      : entry.subject;

  return (
    <motion.div
      data-ocid={`history.item.${index}`}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      className="bg-card rounded-2xl border border-border p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow duration-200"
    >
      {/* Subject text */}
      <p
        className="text-sm font-semibold text-foreground leading-snug"
        title={entry.subject}
      >
        {truncated}
      </p>

      {/* Score + Tone */}
      <div className="flex flex-wrap items-center gap-2">
        <ScoreChip score={entry.score} />
        <ToneBadge tone={entry.tone} />
      </div>

      {/* Footer: timestamp + actions */}
      <div className="flex items-center justify-between pt-1 border-t border-border">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {formatRelativeTime(entry.timestamp)}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-ocid={`history.copy_button.${index}`}
            onClick={handleCopy}
            title={copied ? "Copied!" : "Copy subject line"}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label={copied ? "Copied!" : "Copy subject line"}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            data-ocid={`history.delete_button.${index}`}
            onClick={() => onDelete(entry.id)}
            title="Delete"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="Delete from history"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function HistoryPage({ onNavigate }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => getHistory());

  const handleDelete = useCallback((id: string) => {
    removeFromHistory(id);
    setEntries(getHistory());
  }, []);

  const handleClearAll = useCallback(() => {
    clearHistory();
    setEntries([]);
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          data-ocid="history.back_button"
          onClick={() => onNavigate("/")}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Analyzer
        </button>
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">
            Subject Line History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your last {entries.length > 0 ? entries.length : ""} tested subject
            lines
          </p>
        </div>
        {entries.length > 0 && (
          <button
            type="button"
            data-ocid="history.clear_all_button"
            onClick={handleClearAll}
            className="flex items-center gap-1.5 text-xs font-semibold text-destructive hover:text-destructive/80 border border-destructive/30 hover:bg-destructive/5 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All
          </button>
        )}
      </div>

      {/* Grid or Empty state */}
      {entries.length === 0 ? (
        <motion.div
          data-ocid="history.empty_state"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-dashed border-border bg-muted/40 py-16 flex flex-col items-center justify-center gap-4 text-center"
        >
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <BookOpen className="w-7 h-7 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">
              No history yet
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Start analyzing subject lines — your last 5 results will appear
              here.
            </p>
          </div>
          <button
            type="button"
            data-ocid="history.go_to_analyzer_button"
            onClick={() => onNavigate("/")}
            className="mt-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            Go to Analyzer
          </button>
        </motion.div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {entries.map((entry, idx) => (
              <HistoryCard
                key={entry.id}
                entry={entry}
                index={idx + 1}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
