import "server-only";
export async function providerJson(
  url: string,
  init: RequestInit = {},
  attempts = 3,
): Promise<unknown> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
    } catch {
      if (attempt === attempts - 1)
        throw new Error("Provider request timed out or could not connect.");
      await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
      continue;
    }
    if (response.ok) return response.json();
    if (response.status !== 429 && response.status < 500)
      throw new Error(
        "Provider rejected the request. Check API configuration.",
      );
    if (attempt === attempts - 1)
      throw new Error("Provider quota reached or temporarily unavailable.");
    const retry = Math.min(
      2000,
      Number(response.headers.get("retry-after") || 0) * 1000 ||
        250 * 2 ** attempt,
    );
    await new Promise((r) => setTimeout(r, retry));
  }
  throw new Error("Provider unavailable");
}
