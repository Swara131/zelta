export async function parseApiJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  if (!contentType.includes("application/json")) {
    if (text.trimStart().startsWith("<!DOCTYPE") || text.trimStart().startsWith("<html")) {
      throw new Error(
        `Server returned HTML instead of JSON (${response.status}). Restart the dev server after pulling latest changes.`
      );
    }
    throw new Error(text.slice(0, 200) || `Unexpected response (${response.status}).`);
  }

  return JSON.parse(text) as T;
}
