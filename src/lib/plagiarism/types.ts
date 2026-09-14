export type SourceType = "REPOSITORY" | "WEB" | "ACADEMIC";
export interface Span {
  start: number;
  end: number;
  excluded?: boolean;
  sourceType?: SourceType;
}
export interface Match extends Span {
  submitted_text: string;
  source_text: string;
  similarity_score: number;
  match_type: "EXACT" | "NEAR_EXACT" | "FINGERPRINT" | "LEXICAL" | "SEMANTIC";
  is_quoted: boolean;
  is_cited: boolean;
  in_references: boolean;
  start_position: number;
  end_position: number;
  ai_classification?: string;
  ai_explanation?: string;
  recommendation?: string;
  citation_concern?: string;
}
export interface Source {
  id?: string;
  source_type: SourceType;
  source_title: string;
  source_url?: string;
  author?: string;
  publication_year?: number;
  doi?: string;
  repository_thesis_id?: string;
  metadata: Record<string, unknown>;
  text?: string;
  matches?: Match[];
  similarity_score?: number;
}
