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

  // Detect spam words (whole-word matching where possible)
  const foundSpam: string[] = [];
  for (const word of SPAM_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(input)) {
      foundSpam.push(word);
    }
  }
  if (foundSpam.length > 0) {
    const penalty = Math.min(foundSpam.length * 15, 30);
    score -= penalty;
    feedbackItems.push({
      message: `Spam triggers detected: ${foundSpam.slice(0, 5).join(", ")}${foundSpam.length > 5 ? "..." : ""}`,
      type: "error",
    });
  }

  // ALL CAPS check
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

  // Excessive punctuation
  const exclamationCount = (input.match(/!/g) ?? []).length;
  if (exclamationCount > 1) {
    score -= 15;
    feedbackItems.push({
      message: `${exclamationCount} exclamation marks detected. One or none is best.`,
      type: "error",
    });
  }

  // Spaced-out letters
  if (/(\b\w\s){3,}\w\b/.test(input)) {
    score -= 20;
    feedbackItems.push({
      message:
        "Spaced-out letters detected (e.g. 'F R E E') — common spam bypass trick.",
      type: "error",
    });
  }

  // Symbol bypass tricks
  if (/[$@!#%][a-z]/i.test(input)) {
    score -= 10;
    feedbackItems.push({
      message:
        "Symbol substitution detected (e.g. '$ave', 'fr@@'). Avoid using symbols to replace letters.",
      type: "error",
    });
  }

  // Character count (using Array.from for emoji support)
  const charCount = getCharCount(input);

  // Length checks
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

  // Emoji boost
  const emojiCount = countEmojis(input);
  if (emojiCount > 0) {
    score += 5;
    feedbackItems.push({
      message: `${emojiCount} emoji${emojiCount > 1 ? "s" : ""} detected — adds personality and can boost open rates.`,
      type: "success",
    });
  }

  // Power words boost
  const foundPower: string[] = [];
  for (const word of POWER_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(lower)) {
      foundPower.push(word);
    }
  }
  if (foundPower.length > 0) {
    score += foundPower.length * 10;
    feedbackItems.push({
      message: `Power words found: ${foundPower.join(", ")} — these boost open rates.`,
      type: "success",
    });
  }

  // Long words (>10 chars)
  const words = input.split(/\s+/).filter(Boolean);
  const longWords = words.filter(
    (w) => w.replace(/[^a-zA-Z]/g, "").length > 10,
  );
  const wordCount = words.length;

  // Clamp score
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
