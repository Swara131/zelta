import { extractSourcesFromSummary } from "../builder-capabilities";

export function splitAgentResultForDelivery(summary: string): {
  summaryBody: string;
  sources: string[];
} {
  const trimmed = summary.trim();
  if (!trimmed) {
    return { summaryBody: "", sources: [] };
  }

  const sources = extractSourcesFromSummary(trimmed);
  if (sources.length === 0) {
    return { summaryBody: trimmed, sources: [] };
  }

  const lines = trimmed.split("\n");
  const summaryLines: string[] = [];
  let inSources = false;

  for (const line of lines) {
    const lineTrimmed = line.trim();
    if (/^sources:?$/i.test(lineTrimmed)) {
      inSources = true;
      continue;
    }
    if (inSources) continue;
    summaryLines.push(line);
  }

  return {
    summaryBody: summaryLines.join("\n").trim(),
    sources,
  };
}
