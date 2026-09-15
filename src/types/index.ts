export type Role = "STUDENT" | "SUPERVISOR" | "ADMIN";
export type ThesisStatus =
  "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "ARCHIVED";
export type ScanStatus =
  | "QUEUED"
  | "EXTRACTING"
  | "SEARCHING_REPOSITORY"
  | "SEARCHING_WEB"
  | "SEARCHING_ACADEMIC"
  | "COMPARING"
  | "AI_ANALYSIS"
  | "COMPLETED"
  | "FAILED";
export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  matric_number: string | null;
  staff_number: string | null;
  department_id: string | null;
  faculty_id: string | null;
}
export interface Thesis {
  id: string;
  student_id: string;
  supervisor_id: string | null;
  title: string;
  abstract: string;
  keywords: string[];
  academic_year: number;
  status: ThesisStatus;
  department_id: string;
  faculty_id: string;
  document_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  word_count: number;
  extracted_text?: string | null;
  normalized_text?: string | null;
  created_at: string;
  approved_at: string | null;
  version_of: string | null;
  student?: { full_name: string; matric_number: string | null };
  department?: { name: string };
  faculty?: { name: string };
  supervisor?: { full_name: string };
}
export interface Scan {
  id: string;
  thesis_id: string;
  requested_by?: string;
  status: ScanStatus;
  overall_similarity: number;
  repository_similarity: number;
  web_similarity: number;
  academic_similarity: number;
  total_sources: number;
  total_matches: number;
  eligible_word_count: number;
  matched_word_count: number;
  warnings: string[];
  ai_status: string;
  created_at: string;
  started_at?: string | null;
  heartbeat_at?: string | null;
  attempts?: number;
  completed_at: string | null;
  error_message: string | null;
  thesis?: Thesis;
}
export interface Settings {
  id: boolean;
  similarity_warning_threshold: number;
  similarity_high_threshold: number;
  maximum_file_size: number;
  maximum_daily_scans: number;
  allow_student_resubmission: boolean;
  external_search_enabled: boolean;
  academic_search_enabled: boolean;
}
export const DISCLAIMER =
  "A similarity score indicates textual overlap and should not by itself be treated as proof of plagiarism. Human academic review is recommended.";
export const LIMITATIONS =
  "ThesisGuard checks accessible sources. It cannot access every private database or paywalled publication, reproduce Turnitin’s proprietary student-paper database, or detect every sophisticated paraphrase.";
