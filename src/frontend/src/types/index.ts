export type FeedbackItem = {
  message: string;
  type: "error" | "warning" | "success";
};

export type AnalysisResult = {
  score: number;
  tone: "Request" | "Urgent" | "Informational" | "Casual";
  feedbackItems: FeedbackItem[];
  spamWords: string[];
  powerWords: string[];
  longWords: string[];
  charCount: number;
  wordCount: number;
  emojiCount: number;
};

export type HistoryEntry = {
  id: string;
  subject: string;
  score: number;
  tone: string;
  timestamp: number;
};

export type NavLink = {
  label: string;
  href: string;
};
