export interface TranslatedAction {
  id: string;
  lineNumber: number;
  action: string;
  explanation: string;
  affectedSystem: string;
  affectedUser: string;
  timestamp: string;
  businessImpact: "critical" | "high" | "medium" | "low" | "none";
  aiConfidence: number;
}

export type TranslatorStatus = "idle" | "translating" | "complete";

export type UploadedLogSummary = {
  id: string;
  filename: string;
  createdAt: string;
  hasTranslations: boolean;
};
