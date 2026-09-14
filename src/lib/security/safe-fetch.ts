import "server-only";
import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { Agent, fetch as request } from "undici";
export function isPublicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}
export async function validateUrl(input: string) {
  const url = new URL(input);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port))
  )
    throw new Error("Unsafe source URL");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  )
    throw new Error("Private host blocked");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    lookup(hostname, { all: true }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("Source DNS lookup timed out")),
        5000,
      );
    }),
  ]).finally(() => clearTimeout(timer));
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new Error("Private network address blocked");
  return { url, addresses };
}
export async function safeFetch(
  input: string,
  maxBytes = 2_000_000,
): Promise<{ buffer: Buffer; contentType: string; url: string }> {
  let target = input;
  for (let redirect = 0; redirect <= 3; redirect++) {
    const { url, addresses } = await validateUrl(target);
    const pinned = addresses[0];
    const agent = new Agent({
      connect: {
        lookup: (_hostname, _options, callback) =>
          callback(null, [{ address: pinned.address, family: pinned.family }]),
      },
    });
    try {
      const response = await request(url, {
        dispatcher: agent,
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
        headers: {
          "user-agent": "ThesisGuard/1.0 (academic source verification)",
          accept: "text/html,application/pdf,text/plain",
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (!location) throw new Error("Invalid redirect");
        target = new URL(location, url).href;
        continue;
      }
      if (!response.ok) throw new Error("Source unavailable");
      const contentType = response.headers.get("content-type") || "";
      if (!/text\/(html|plain)|application\/pdf/.test(contentType))
        throw new Error("Unsupported source content");
      if (Number(response.headers.get("content-length")) > maxBytes)
        throw new Error("Source exceeds size limit");
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (!response.body) throw new Error("Empty source");
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > maxBytes) throw new Error("Source exceeds size limit");
        chunks.push(chunk);
      }
      return { buffer: Buffer.concat(chunks), contentType, url: url.href };
    } finally {
      await agent.close();
    }
  }
  throw new Error("Too many redirects");
}
