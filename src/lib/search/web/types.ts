export interface WebResult {
  title: string;
  url: string;
  text: string;
  coverage: "snippet" | "full text";
}
export interface WebSearchProvider {
  name: string;
  search(query: string): Promise<WebResult[]>;
}
