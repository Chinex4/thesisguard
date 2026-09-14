import "server-only";
import { z } from "zod";
import { providerJson } from "../http";
import type { WebSearchProvider } from "./types";
const response = z.object({
  web: z
    .object({
      results: z.array(
        z.object({
          title: z.string(),
          url: z.string().url(),
          description: z.string().default(""),
        }),
      ),
    })
    .optional(),
});
export const brave: WebSearchProvider = {
  name: "Brave",
  async search(query) {
    if (!process.env.BRAVE_SEARCH_API_KEY)
      throw new Error("Brave is selected but BRAVE_SEARCH_API_KEY is missing.");
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", "3");
    const data = response.parse(
      await providerJson(url.href, {
        headers: {
          "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY,
          Accept: "application/json",
        },
      }),
    );
    return (data.web?.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      text: r.description,
      coverage: "snippet",
    }));
  },
};
