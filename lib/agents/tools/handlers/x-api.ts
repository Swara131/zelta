import type { ToolExecutionOutcome } from "../../runtime/types";

export async function handleXApi(
  input: Record<string, unknown>
): Promise<ToolExecutionOutcome> {
  const query =
    (typeof input.query === "string" && input.query.trim()) ||
    (typeof input.search === "string" && input.search.trim()) ||
    "";

  if (!query) {
    return {
      executed: false,
      error: "x_search requires a query.",
      output: {},
    };
  }

  const token = process.env.X_API_BEARER_TOKEN?.trim();
  if (!token) {
    return {
      executed: false,
      error:
        "X is not configured. Set X_API_BEARER_TOKEN or connect X in Settings.",
      output: { query },
    };
  }

  const maxResults =
    typeof input.maxResults === "number" && input.maxResults > 0 && input.maxResults <= 10
      ? Math.floor(input.maxResults)
      : 5;

  try {
    const url = new URL("https://api.twitter.com/2/tweets/search/recent");
    url.searchParams.set("query", query);
    url.searchParams.set("max_results", String(maxResults));
    url.searchParams.set("tweet.fields", "created_at,author_id,public_metrics");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        executed: false,
        error: `X API returned ${response.status}.`,
        output: { query, detail: text.slice(0, 500) },
      };
    }

    const payload = (await response.json()) as {
      data?: Array<{
        id: string;
        text: string;
        created_at?: string;
        author_id?: string;
      }>;
      meta?: { result_count?: number };
    };

    return {
      executed: true,
      output: {
        query,
        tweets: payload.data ?? [],
        resultCount: payload.meta?.result_count ?? payload.data?.length ?? 0,
      },
    };
  } catch (err) {
    return {
      executed: false,
      error: err instanceof Error ? err.message : "X search failed.",
      output: { query },
    };
  }
}
