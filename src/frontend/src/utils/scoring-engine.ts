import type { AnalysisResult, FeedbackItem } from "@/types";
import { POWER_WORDS, SPAM_WORDS } from "./spam-dictionary";

function countEmojis(text: string): number {
  try {
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    const segments = Array.from(segmenter.segment(text));
    return segments.filter((s) => {
      const cp = s.segment.codePointAt(0);
      if (cp === undefined) return false;
      return (
        (cp >= 0x1f600 && cp <= 0x1f64f) ||
        (cp >= 0x1f300 && cp <= 0x1f5ff) ||
        (cp >= 0x1f680 && cp <= 0x1f6ff) ||
        (cp >= 0x1f700 && cp <= 0x1f77f) ||
        (cp >= 0x2600 && cp <= 0x27bf) ||
        (cp >= 0x1f900 && cp <= 0x1f9ff) ||
        (cp >= 0x1fa00 && cp <= 0x1faff)
      );
    }).length;
  } catch {
    return 0;
  }
}

function getCharCount(text: string): number {
  return Array.from(text).length;
}

function detectTone(
  input: string,
): "Request" | "Urgent" | "Informational" | "Casual" {
  const lower = input.toLowerCase().trim();
  if (/\?$/.test(input.trim())) return "Urgent";
  if (/urgent|important|now|deadline|asap|immediately/i.test(lower))
    return "Urgent";
  if (/^(hi|hey|hello|just checking|just wanted|checking in)/i.test(lower))
    return "Casual";
  if (/^(hi\b|hey\b)/i.test(lower)) return "Casual";
  const firstWord = lower.split(/\s+/)[0] ?? "";
  const actionVerbs = [
    "please",
    "review",
    "approve",
    "confirm",
    "send",
    "share",
    "check",
    "update",
    "respond",
    "reply",
    "join",
    "schedule",
    "complete",
    "submit",
    "provide",
    "help",
    "sign",
    "accept",
    "decline",
    "attend",
  ];
  if (actionVerbs.includes(firstWord)) return "Request";
  return "Informational";
}

export function analyzeSubjectLine(input: string): AnalysisResult {
  if (!input.trim()) {
    return {
      score: 0,
      tone: "Informational",
      feedbackItems: [],
      spamWords: [],
      powerWords: [],
      longWords: [],
      charCount: 0,
      wordCount: 0,
      emojiCount: 0,
    };
  }

  let score = 100;
  const feedbackItems: FeedbackItem[] = [];
  const lower = input.toLowerCase();

  // ── Spam words ──────────────────────────────────────────────────────────────
  const foundSpam: string[] = [];
  for (const word of SPAM_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(input)) foundSpam.push(word);
  }
  if (foundSpam.length > 0) {
    const penalty = Math.min(foundSpam.length * 15, 30);
    score -= penalty;
    feedbackItems.push({
      message: `Spam triggers detected: ${foundSpam.slice(0, 5).join(", ")}${foundSpam.length > 5 ? "..." : ""}`,
      type: "error",
    });
  }

  // ── ALL CAPS ─────────────────────────────────────────────────────────────────
  const alphabeticChars = input.replace(/[^a-zA-Z]/g, "");
  if (
    alphabeticChars.length > 5 &&
    alphabeticChars === alphabeticChars.toUpperCase()
  ) {
    score -= 25;
    feedbackItems.push({
      message:
        "Avoid ALL CAPS — it appears as shouting and triggers spam filters.",
      type: "error",
    });
  }

  // ── Excessive punctuation ────────────────────────────────────────────────────
  const exclamationCount = (input.match(/!/g) ?? []).length;
  if (exclamationCount > 1) {
    score -= 15;
    feedbackItems.push({
      message: `${exclamationCount} exclamation marks detected. One or none is best.`,
      type: "error",
    });
  }

  // ── Spaced-out letters ───────────────────────────────────────────────────────
  if (/(\b\w\s){3,}\w\b/.test(input)) {
    score -= 20;
    feedbackItems.push({
      message:
        "Spaced-out letters detected (e.g. 'F R E E') — common spam bypass trick.",
      type: "error",
    });
  }

  // ── Symbol bypass tricks ─────────────────────────────────────────────────────
  if (/[$@!#%][a-z]/i.test(input)) {
    score -= 10;
    feedbackItems.push({
      message:
        "Symbol substitution detected (e.g. '$ave', 'fr@@'). Avoid using symbols to replace letters.",
      type: "error",
    });
  }

  // ── Character & word counts ──────────────────────────────────────────────────
  const charCount = getCharCount(input);
  const words = input.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // ── Length checks (original) ─────────────────────────────────────────────────
  if (charCount > 60) {
    score -= 15;
    feedbackItems.push({
      message: `Too long (${charCount} chars). Desktop inboxes show ~60 characters. Trim for better readability.`,
      type: "error",
    });
  } else if (charCount > 35) {
    feedbackItems.push({
      message: `${charCount} characters — may get cut off on mobile screens (ideal: under 35 for mobile).`,
      type: "warning",
    });
  } else if (charCount > 0 && charCount <= 35) {
    feedbackItems.push({
      message: `Great length (${charCount} chars) — fits perfectly on both mobile and desktop.`,
      type: "success",
    });
  }

  // ── NEW: Too short penalty (< 10 non-emoji chars) ────────────────────────────
  const emojiCount = countEmojis(input);
  const _nonEmojiCharCount = charCount - emojiCount * 2; // rough emoji char width offset
  const plainTextLen = input.replace(/[\u0080-\uFFFF]/g, "").length; // ASCII only length
  if (plainTextLen < 10 && charCount > 0) {
    score -= 15;
    feedbackItems.push({
      message: "Subject line is too short to convey meaningful information.",
      type: "error",
    });
  }

  // ── NEW: Optimal length bonus (30–50 chars) ──────────────────────────────────
  if (charCount >= 30 && charCount <= 50) {
    score += 5;
    feedbackItems.push({
      message: "Good length — fits well in most inboxes.",
      type: "success",
    });
  }

  // ── Emoji boost (original) ───────────────────────────────────────────────────
  if (emojiCount > 0) {
    score += 5;
    feedbackItems.push({
      message: `${emojiCount} emoji${emojiCount > 1 ? "s" : ""} detected — adds personality and can boost open rates.`,
      type: "success",
    });
  }

  // ── Power words — CAPPED at +20 total ────────────────────────────────────────
  const foundPower: string[] = [];
  for (const word of POWER_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(lower)) foundPower.push(word);
  }
  if (foundPower.length > 0) {
    const powerBonus = Math.min(foundPower.length * 5, 20);
    score += powerBonus;
    feedbackItems.push({
      message: `Power words found: ${foundPower.join(", ")} — these boost open rates.`,
      type: "success",
    });
  }

  // ── NEW: Gibberish / non-word detection ──────────────────────────────────────
  const alphaWords = words
    .map((w) => w.replace(/[^a-zA-Z]/g, "").toLowerCase())
    .filter((w) => w.length > 0);
  if (alphaWords.length > 0) {
    const isGibberish = (w: string): boolean => {
      if (w.length <= 2) return false;
      const hasVowel = /[aeiou]/i.test(w);
      if (!hasVowel) return true;
      // repeated chars like "aaaa", "zzzz"
      if (/^(.)\1{2,}$/.test(w)) return true;
      // sequential chars like "abcd", "qwer"
      const codes = Array.from(w).map((c) => c.charCodeAt(0));
      const isSequential = codes.every(
        (c, i) => i === 0 || c === codes[i - 1] + 1,
      );
      if (isSequential && w.length >= 4) return true;
      return false;
    };
    const gibberishWords = alphaWords.filter(isGibberish);
    const gibberishRatio = gibberishWords.length / alphaWords.length;
    if (gibberishRatio >= 0.5) {
      score -= 40;
      score = Math.min(score, 35);
      feedbackItems.push({
        message: "Subject line contains non-words or random characters.",
        type: "error",
      });
    }
  }

  // ── NEW: Repeated words (low unique ratio) ───────────────────────────────────
  if (words.length >= 3) {
    const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
    const uniqueRatio = uniqueWords.size / words.length;
    if (uniqueRatio < 0.5) {
      score -= 20;
      feedbackItems.push({
        message:
          "Most words are repeated — vary your vocabulary for a stronger subject line.",
        type: "error",
      });
    }
  }

  // ── NEW: All-lowercase, no structure ─────────────────────────────────────────
  if (
    input.trim().length > 5 &&
    input === input.toLowerCase() &&
    /^[a-z]/.test(input.trim())
  ) {
    score -= 10;
    feedbackItems.push({
      message:
        "No capitalization detected — capitalize the first word for a professional appearance.",
      type: "warning",
    });
  }

  // ── NEW: Vague/generic words ──────────────────────────────────────────────────
  const VAGUE_WORDS = [
    "update",
    "info",
    "fyi",
    "hey",
    "hi",
    "hello",
    "notice",
    "reminder",
    "important",
    "news",
    "alert",
    "message",
    "follow up",
    "just checking",
    "checking in",
  ];
  const foundVague: string[] = [];
  for (const vw of VAGUE_WORDS) {
    const escaped = vw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(lower)) foundVague.push(vw);
  }
  if (foundVague.length > 0) {
    const vaguePenalty = Math.min(foundVague.length * 15, 30);
    score -= vaguePenalty;
    feedbackItems.push({
      message:
        "Vague subject line — be more specific about what the reader will find.",
      type: "warning",
    });
  }

  // ── NEW: Single/short vague subject line cap ─────────────────────────────────
  if (wordCount === 1) {
    const singleWord = words[0]?.replace(/[^a-zA-Z]/g, "").toLowerCase() ?? "";
    const isPowerWord = foundPower.some(
      (pw) => pw.toLowerCase() === singleWord,
    );
    if (!isPowerWord) {
      score -= 20;
      score = Math.min(score, 50);
      feedbackItems.push({
        message:
          "Single-word subject lines are too vague — add context to improve clarity.",
        type: "warning",
      });
    }
  } else if (wordCount <= 3 && wordCount > 1) {
    // Very short: apply clarity penalty unless it has a strong action word
    const STRONG_ACTION_VERBS = [
      "get",
      "learn",
      "discover",
      "join",
      "save",
      "grab",
      "try",
      "start",
      "unlock",
      "see",
      "claim",
      "buy",
      "win",
      "boost",
    ];
    const firstWordLower = (words[0] ?? "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
    const hasActionVerb =
      STRONG_ACTION_VERBS.includes(firstWordLower) || foundPower.length > 0;
    if (!hasActionVerb) {
      score -= 15;
      feedbackItems.push({
        message:
          "Very short subject line — add more detail to improve clarity and engagement.",
        type: "warning",
      });
    }
  }

  // ── NEW: Corporate jargon detection ──────────────────────────────────────────
  const JARGON_PHRASES = [
    "per our conversation",
    "going forward",
    "as per",
    "touch base",
    "circle back",
    "synergy",
    "leverage",
    "paradigm",
    "deliverable",
    "bandwidth",
    "deep dive",
    "boil the ocean",
    "move the needle",
    "action item",
    "thought leadership",
    "value add",
    "low hanging fruit",
  ];
  const foundJargon: string[] = [];
  for (const phrase of JARGON_PHRASES) {
    if (lower.includes(phrase)) foundJargon.push(phrase);
  }
  if (foundJargon.length > 0) {
    const jargonPenalty = Math.min(foundJargon.length * 10, 20);
    score -= jargonPenalty;
    feedbackItems.push({
      message: "Avoid corporate jargon — use plain, direct language instead.",
      type: "warning",
    });
  }

  // ── NEW: Engagement signals ──────────────────────────────────────────────────
  const ENGAGEMENT_VERBS = [
    "get",
    "learn",
    "discover",
    "join",
    "save",
    "grab",
    "try",
    "start",
    "unlock",
    "see",
  ];
  const firstWordLower = (words[0] ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (ENGAGEMENT_VERBS.includes(firstWordLower)) {
    score += 8;
    feedbackItems.push({
      message: "Starts with an action verb — great for engagement.",
      type: "success",
    });
  }

  // Question format
  if (input.trim().endsWith("?")) {
    score += 5;
    feedbackItems.push({
      message: "Question format creates curiosity — good for engagement.",
      type: "success",
    });
  }

  // Personalization token
  if (/\[name\]|\{name\}|\[first\]/i.test(input)) {
    score += 5;
    feedbackItems.push({
      message:
        "Personalization token detected — personalized subject lines improve open rates.",
      type: "success",
    });
  }

  // Number / statistic
  if (
    /\d+%|\d+\s*(tips|ways|reasons|steps|tricks|ideas|facts|secrets|examples)/i.test(
      input,
    ) ||
    /^\d+\s/i.test(input.trim())
  ) {
    score += 8;
    feedbackItems.push({
      message:
        "Includes a number — subject lines with stats tend to perform better.",
      type: "success",
    });
  }

  // ── Long words (>10 chars) ────────────────────────────────────────────────────
  const longWords = words.filter(
    (w) => w.replace(/[^a-zA-Z]/g, "").length > 10,
  );

  // ── Clamp & tone ─────────────────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, score));
  const tone = detectTone(input);

  return {
    score,
    tone,
    feedbackItems,
    spamWords: foundSpam,
    powerWords: foundPower,
    longWords,
    charCount,
    wordCount,
    emojiCount,
  };
}
// Re-export utilities used by other modules
export { countEmojis, getCharCount, detectTone };
