import type { ToolExecutionOutcome } from "../../runtime/types";

const BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";
const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

export interface WebSearchResultItem {
  title: string;
  url: string;
  description: string;
}

export function isWebSearchConfigured(): boolean {
  return Boolean(
    process.env.TAVILY_API_KEY?.trim() || process.env.BRAVE_SEARCH_API_KEY?.trim()
  );
}

function normalizeCount(input: Record<string, unknown>): number {
  if (typeof input.count === "number" && input.count > 0 && input.count <= 10) {
    return Math.floor(input.count);
  }
  return 5;
}

async function searchWithTavily(
  query: string,
  count: number
): Promise<
  | { results: WebSearchResultItem[]; provider: "tavily"; answer?: string }
  | { error: string; detail?: string }
> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    return { error: "Tavily API key not configured." };
  }

  try {
    const response = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: count,
        include_answer: true,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        error: `Tavily Search API returned ${response.status}.`,
        detail: text.slice(0, 500),
      };
    }

    const payload = (await response.json()) as {
      answer?: string;
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };

    const results =
      payload.results?.map((item) => ({
        title: item.title?.trim() || "Untitled result",
        url: item.url?.trim() || "",
        description: item.content?.trim() || "",
      })) ?? [];

    const answer = payload.answer?.trim() || undefined;

    return { results, provider: "tavily", answer };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Tavily search failed.",
    };
  }
}

async function searchWithBrave(
  query: string,
  count: number
): Promise<{ results: WebSearchResultItem[]; provider: "brave" } | { error: string; detail?: string }> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!apiKey) {
    return { error: "Brave Search API key not configured." };
  }

  try {
    const url = new URL(BRAVE_SEARCH_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(count));

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        error: `Brave Search API returned ${response.status}.`,
        detail: text.slice(0, 500),
      };
    }

    const payload = (await response.json()) as {
      web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
    };

    const results =
      payload.web?.results?.map((item) => ({
        title: item.title?.trim() || "Untitled result",
        url: item.url?.trim() || "",
        description: item.description?.trim() || "",
      })) ?? [];

    return { results, provider: "brave" };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Brave search failed.",
    };
  }
}

export async function handleWebSearch(
  input: Record<string, unknown>
): Promise<ToolExecutionOutcome> {
  const query =
    (typeof input.query === "string" && input.query.trim()) ||
    (typeof input.q === "string" && input.q.trim()) ||
    "";

  if (!query) {
    return {
      executed: false,
      error: "web_search requires a query.",
      output: {},
    };
  }

  if (!isWebSearchConfigured()) {
    return {
      executed: false,
      error:
        "Web search is not configured. Set TAVILY_API_KEY or BRAVE_SEARCH_API_KEY in .env.local and restart the dev server.",
      output: { query },
    };
  }

  const count = normalizeCount(input);

  if (process.env.TAVILY_API_KEY?.trim()) {
    const tavily = await searchWithTavily(query, count);
    if ("results" in tavily) {
      return {
        executed: true,
        output: {
          query,
          provider: tavily.provider,
          results: tavily.results,
          resultCount: tavily.results.length,
          ...(tavily.answer ? { answer: tavily.answer } : {}),
        },
      };
    }

    if (process.env.BRAVE_SEARCH_API_KEY?.trim()) {
      const brave = await searchWithBrave(query, count);
      if ("results" in brave) {
        return {
          executed: true,
          output: {
            query,
            provider: brave.provider,
            results: brave.results,
            resultCount: brave.results.length,
          },
        };
      }
      return {
        executed: false,
        error: brave.error,
        output: { query, detail: brave.detail, fallbackFrom: "tavily", tavilyError: tavily.error },
      };
    }

    return {
      executed: false,
      error: tavily.error,
      output: { query, detail: tavily.detail },
    };
  }

  const brave = await searchWithBrave(query, count);
  if ("results" in brave) {
    return {
      executed: true,
      output: {
        query,
        provider: brave.provider,
        results: brave.results,
        resultCount: brave.results.length,
      },
    };
  }

  return {
    executed: false,
    error: brave.error,
    output: { query, detail: brave.detail },
  };
}
