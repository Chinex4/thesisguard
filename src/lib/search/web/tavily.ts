import "server-only";
import { z } from "zod";
import { providerJson } from "../http";
import type { WebSearchProvider } from "./types";
const response = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string().url(),
      content: z.string().default(""),
    }),
  ),
});
export const tavily: WebSearchProvider = {
  name: "Tavily",
  async search(query) {
    if (!process.env.TAVILY_API_KEY)
      throw new Error("Tavily is not configured. Add TAVILY_API_KEY.");
    const data = response.parse(
      await providerJson("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + process.env.TAVILY_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          search_depth: "basic",
          max_results: 3,
          include_answer: false,
          include_raw_content: false,
        }),
      }),
    );
    return data.results.map((r) => ({
      title: r.title,
      url: r.url,
      text: r.content,
      coverage: "snippet",
    }));
  },
};
