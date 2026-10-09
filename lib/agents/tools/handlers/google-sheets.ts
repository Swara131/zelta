import type { ToolExecutionOutcome } from "../../runtime/types";

export async function handleGoogleSheets(
  input: Record<string, unknown>
): Promise<ToolExecutionOutcome> {
  const spreadsheetId =
    (typeof input.spreadsheetId === "string" && input.spreadsheetId.trim()) ||
    (typeof input.sheetId === "string" && input.sheetId.trim()) ||
    "";
  const range =
    (typeof input.range === "string" && input.range.trim()) || "Sheet1!A1:Z100";

  if (!spreadsheetId) {
    return {
      executed: false,
      error: "google_sheets requires spreadsheetId.",
      output: {},
    };
  }

  const apiKey = process.env.GOOGLE_SHEETS_API_KEY?.trim();
  if (!apiKey) {
    return {
      executed: false,
      error:
        "Google Sheets is not configured. Set GOOGLE_SHEETS_API_KEY for read-only access to public sheets, or connect Google Sheets in Settings (OAuth coming soon).",
      output: { spreadsheetId, range },
    };
  }

  try {
    const url = new URL(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`
    );
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        executed: false,
        error: `Google Sheets API returned ${response.status}.`,
        output: { spreadsheetId, range, detail: text.slice(0, 500) },
      };
    }

    const payload = (await response.json()) as {
      range?: string;
      values?: string[][];
    };

    return {
      executed: true,
      output: {
        spreadsheetId,
        range: payload.range ?? range,
        values: payload.values ?? [],
        rowCount: payload.values?.length ?? 0,
      },
    };
  } catch (err) {
    return {
      executed: false,
      error: err instanceof Error ? err.message : "Google Sheets read failed.",
      output: { spreadsheetId, range },
    };
  }
}
