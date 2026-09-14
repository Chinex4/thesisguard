import "server-only";
import { tavily } from "./tavily";
import { brave } from "./brave";
export function webProvider() {
  const name = process.env.WEB_SEARCH_PROVIDER || "tavily";
  if (name === "tavily") return tavily;
  if (name === "brave") return brave;
  throw new Error("WEB_SEARCH_PROVIDER must be tavily or brave.");
}
