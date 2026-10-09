/**
 * Safely parse a fetch Response as JSON.
 * Returns a clear error when the server responded with HTML (common during dev 404/500 pages).
 */
export async function readJsonResponse<T = Record<string, unknown>>(
  response: Response
): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const preview = (await response.text()).trim().slice(0, 120);
    if (preview.startsWith("<!DOCTYPE") || preview.startsWith("<html")) {
      throw new Error(
        "The server returned an error page instead of data. Restart the dev server and try again."
      );
    }
    throw new Error(
      preview
        ? `Unexpected server response: ${preview}`
        : "Unexpected server response. Try again."
    );
  }

  return (await response.json()) as T;
}
