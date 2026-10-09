export type AgentResultKind =
  | "text"
  | "report"
  | "table"
  | "schedule"
  | "list"
  | "decision"
  | "research"
  | "code"
  | "error"
  | "action_result"
  | "structured";

export interface AgentResultSource {
  title: string;
  url?: string;
  domain?: string;
}

export interface AgentResultTable {
  title?: string;
  columns: string[];
  rows: string[][];
}

export interface AgentDecisionCard {
  action?: string;
  status?: string;
  risk?: string;
  policy?: string;
  reason?: string;
  amount?: string;
}

export interface ParsedAgentResult {
  kind: AgentResultKind;
  title?: string;
  markdown: string;
  sources: AgentResultSource[];
  tables: AgentResultTable[];
  decision?: AgentDecisionCard;
  warnings: string[];
  rawJson?: unknown;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function safeHttpUrl(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!isHttpUrl(trimmed)) return undefined;
  return trimmed;
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function sourceFromText(raw: string): AgentResultSource {
  const trimmed = raw.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").trim();
  const markdownLink = trimmed.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/i);
  if (markdownLink) {
    const url = safeHttpUrl(markdownLink[2]);
    return { title: markdownLink[1], url, domain: url ? domainFromUrl(url) : undefined };
  }
  const labeled = trimmed.match(/^(.*?)\s+[—-]\s+(https?:\/\/\S+)/i);
  if (labeled) {
    const url = safeHttpUrl(labeled[2]);
    return {
      title: labeled[1].trim() || (url ? domainFromUrl(url) : trimmed),
      url,
      domain: url ? domainFromUrl(url) : undefined,
    };
  }
  const url = safeHttpUrl(trimmed.split(/\s+/).find((part) => part.startsWith("http")) ?? trimmed);
  if (url && trimmed === url) {
    return { title: domainFromUrl(url), url, domain: domainFromUrl(url) };
  }
  if (url) {
    return { title: trimmed.replace(url, "").trim() || domainFromUrl(url), url, domain: domainFromUrl(url) };
  }
  return { title: trimmed };
}

export function extractAgentSources(markdown: string): AgentResultSource[] {
  const lines = markdown.split("\n");
  const sources: AgentResultSource[] = [];
  let inSources = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#{1,6}\s*sources\b/i.test(trimmed) || /^sources:?$/i.test(trimmed)) {
      inSources = true;
      continue;
    }
    if (inSources) {
      if (!trimmed) continue;
      if (/^#{1,6}\s/.test(trimmed) && !/^#{1,6}\s*sources\b/i.test(trimmed)) break;
      sources.push(sourceFromText(trimmed));
    }
  }
  return sources.filter((item) => item.title);
}

export function stripSourcesSection(markdown: string): string {
  const lines = markdown.split("\n");
  const kept: string[] = [];
  let inSources = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#{1,6}\s*sources\b/i.test(trimmed) || /^sources:?$/i.test(trimmed)) {
      inSources = true;
      continue;
    }
    if (inSources) {
      if (/^#{1,6}\s/.test(trimmed) && !/^#{1,6}\s*sources\b/i.test(trimmed)) {
        inSources = false;
        kept.push(line);
      }
      continue;
    }
    kept.push(line);
  }
  return kept.join("\n").trim();
}

function isPipeRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.includes("|", 1);
}

function isSeparatorRow(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitPipeRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

export function promoteStandaloneBoldLines(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => {
      const match = line.trim().match(/^\*\*(.+?)\*\*$/);
      return match ? `## ${match[1]}` : line;
    })
    .join("\n");
}

export function repairMarkdownTables(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const next = lines[i + 1] ?? "";
    if (isPipeRow(line) && isPipeRow(next) && !isSeparatorRow(next) && !isSeparatorRow(line)) {
      const cols = Math.max(splitPipeRow(line).length, splitPipeRow(next).length, 1);
      out.push(line);
      out.push(`| ${Array.from({ length: cols }, () => "---").join(" | ")} |`);
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

export function extractMarkdownTables(markdown: string): AgentResultTable[] {
  const lines = repairMarkdownTables(markdown).split("\n");
  const tables: AgentResultTable[] = [];
  for (let i = 0; i < lines.length - 1; i += 1) {
    const header = lines[i] ?? "";
    const sep = lines[i + 1] ?? "";
    if (!isPipeRow(header) || !isSeparatorRow(sep)) continue;
    const columns = splitPipeRow(header);
    const rows: string[][] = [];
    let j = i + 2;
    while (j < lines.length && isPipeRow(lines[j] ?? "") && !isSeparatorRow(lines[j] ?? "")) {
      rows.push(splitPipeRow(lines[j] ?? ""));
      j += 1;
    }
    if (columns.length > 0) tables.push({ columns, rows });
    i = j - 1;
  }
  return tables;
}

function looksLikeJsonDump(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.some((key) =>
    ["results", "toolOutput", "raw", "choices", "tool_calls", "toolCalls"].includes(key)
  );
}

function structuredSectionToMarkdown(section: Record<string, unknown>): string {
  const title = typeof section.title === "string" ? section.title : "";
  const type = typeof section.type === "string" ? section.type : "";
  const lines: string[] = [];
  if (title) lines.push(`### ${title}`, "");
  if (type === "table" && Array.isArray(section.columns) && Array.isArray(section.rows)) {
    const columns = section.columns.map((item) => String(item));
    lines.push(`| ${columns.join(" | ")} |`);
    lines.push(`| ${columns.map(() => "---").join(" | ")} |`);
    for (const row of section.rows) {
      const cells = Array.isArray(row) ? row.map((cell) => String(cell)) : Object.values(row as object).map(String);
      lines.push(`| ${cells.join(" | ")} |`);
    }
    lines.push("");
    return lines.join("\n");
  }
  if (typeof section.content === "string") {
    lines.push(section.content, "");
    return lines.join("\n");
  }
  if (Array.isArray(section.items)) {
    for (const item of section.items) lines.push(`- ${String(item)}`);
    lines.push("");
  }
  return lines.join("\n");
}

function classify(markdown: string, extras: Partial<ParsedAgentResult>): AgentResultKind {
  if (extras.kind) return extras.kind;
  if (extras.decision) return "decision";
  const tables = extras.tables ?? [];
  const headers = tables[0]?.columns.map((column) => column.toLowerCase()) ?? [];
  if (tables.length > 0 && headers.some((column) => /date|time|schedule/.test(column))) return "schedule";
  if (tables.length > 0) return "table";
  if (/```/.test(markdown)) return "code";
  if (/^#{1,3}\s/m.test(markdown) && /finding|research|brief|overview/i.test(markdown)) return "report";
  if (extras.sources && extras.sources.length > 0 && /\b(news|source|latest)\b/i.test(markdown)) {
    return "research";
  }
  if (/^(\s*[-*]\s|\s*\d+\.\s)/m.test(markdown) && markdown.split("\n").filter((line) => /^(\s*[-*]\s|\s*\d+\.\s)/.test(line)).length >= 3) {
    return "list";
  }
  if (/\b(risk|decision|allowed|blocked|approval)\b/i.test(markdown) && /\b(high|medium|low)\b/i.test(markdown)) {
    return "decision";
  }
  return "text";
}

function parseObject(record: Record<string, unknown>): ParsedAgentResult {
  const title = typeof record.title === "string" ? record.title : undefined;
  const summary = typeof record.summary === "string" ? record.summary : "";
  const warnings = Array.isArray(record.warnings) ? record.warnings.map(String) : [];
  const decision: AgentDecisionCard | undefined =
    record.decision || record.risk || record.riskLevel || record.policy
      ? {
          action: typeof record.action === "string" ? record.action : typeof record.title === "string" ? record.title : undefined,
          status: typeof record.status === "string" ? record.status : typeof record.decision === "string" ? record.decision : undefined,
          risk: typeof record.risk === "string" ? record.risk : typeof record.riskLevel === "string" ? record.riskLevel : undefined,
          policy: typeof record.policy === "string" ? record.policy : undefined,
          reason:
            typeof record.reason === "string"
              ? record.reason
              : typeof record.reasoning === "string"
                ? record.reasoning
                : undefined,
          amount: typeof record.amount === "string" ? record.amount : undefined,
        }
      : undefined;

  const sourceItems: AgentResultSource[] = [];
  if (Array.isArray(record.sources)) {
    for (const item of record.sources) {
      if (typeof item === "string") sourceItems.push(sourceFromText(item));
      else if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        const url = safeHttpUrl(typeof row.url === "string" ? row.url : undefined);
        sourceItems.push({
          title: typeof row.title === "string" ? row.title : url ? domainFromUrl(url) : "Source",
          url,
          domain: url ? domainFromUrl(url) : undefined,
        });
      }
    }
  }

  const parts: string[] = [];
  if (title) parts.push(`# ${title}`, "");
  if (summary) parts.push(summary, "");
  if (Array.isArray(record.sections)) {
    for (const section of record.sections) {
      if (section && typeof section === "object") {
        parts.push(structuredSectionToMarkdown(section as Record<string, unknown>));
      }
    }
  }
  if (typeof record.markdown === "string") parts.push(record.markdown);
  if (typeof record.message === "string" && parts.length === 0) parts.push(record.message);
  if (typeof record.content === "string" && parts.length === 0) parts.push(record.content);

  let markdown = parts.join("\n").trim();
  if (!markdown && looksLikeJsonDump(record)) {
    return {
      kind: "text",
      markdown: "The agent returned data that is not a readable report.",
      sources: sourceItems,
      tables: [],
      warnings: ["Raw tool output was hidden."],
      rawJson: record,
    };
  }
  if (!markdown && decision) {
    return {
      kind: "decision",
      title,
      markdown: "",
      sources: sourceItems,
      tables: [],
      decision,
      warnings,
      rawJson: record,
    };
  }
  if (!markdown) {
    return {
      kind: "text",
      markdown: "The agent returned data that is not a readable report.",
      sources: sourceItems,
      tables: [],
      warnings: ["Raw tool output was hidden."],
      rawJson: record,
    };
  }

  markdown = repairMarkdownTables(promoteStandaloneBoldLines(markdown));
  const sources = sourceItems.length > 0 ? sourceItems : extractAgentSources(markdown);
  const body = sourceItems.length > 0 ? markdown : stripSourcesSection(markdown);
  const tables = extractMarkdownTables(body);
  const kind = classify(body, {
    kind: Array.isArray(record.sections) ? "structured" : decision ? "decision" : undefined,
    tables,
    sources,
    decision,
  });

  return {
    kind,
    title,
    markdown: body,
    sources,
    tables,
    decision,
    warnings,
    rawJson: record,
  };
}

export function parseAgentResult(input: unknown): ParsedAgentResult {
  if (input == null) {
    return { kind: "text", markdown: "", sources: [], tables: [], warnings: [] };
  }

  if (typeof input === "object") {
    return parseObject(input as Record<string, unknown>);
  }

  const text = String(input).trim();
  if (!text) {
    return { kind: "text", markdown: "", sources: [], tables: [], warnings: [] };
  }

  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === "object") {
        return parseAgentResult(parsed);
      }
    } catch {
      /* not JSON — treat as markdown */
    }
  }

  const cleaned = repairMarkdownTables(
    promoteStandaloneBoldLines(text.replace(/^\s*(execution completed successfully\.?\s*)/i, ""))
  );
  const sources = extractAgentSources(cleaned);
  const markdown = stripSourcesSection(cleaned);
  const tables = extractMarkdownTables(markdown);
  const kind = classify(markdown, { tables, sources });

  return {
    kind,
    markdown,
    sources,
    tables,
    warnings: [],
  };
}

export function tableToCsv(table: AgentResultTable): string {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return [table.columns.map(escape).join(","), ...table.rows.map((row) => row.map(escape).join(","))].join(
    "\n"
  );
}

export function previewPlainText(markdown: string, max = 280): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? `${plain.slice(0, max)}…` : plain;
}
