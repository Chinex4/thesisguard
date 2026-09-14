"use client";
import { useState } from "react";
import { Tabs, Tab } from "@mui/material";
import {
  ExternalLink,
  Download,
  Quote,
  BookOpen,
  Globe,
  Library,
} from "lucide-react";
import { Heading, Notice } from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import { DISCLAIMER, LIMITATIONS, type Scan } from "@/types";
import { tokenize } from "@/lib/plagiarism/tokenize";
interface SourceRow {
  id: string;
  source_type: string;
  source_title: string;
  source_url: string | null;
  author: string | null;
  publication_year: number | null;
  doi: string | null;
  similarity_score: number;
  metadata: Record<string, unknown>;
}
interface MatchRow {
  id: string;
  source_id: string;
  submitted_text: string;
  source_text: string;
  similarity_score: number;
  match_type: string;
  is_quoted: boolean;
  is_cited: boolean;
  excluded_from_score: boolean;
  in_references: boolean;
  ai_classification: string | null;
  ai_explanation: string | null;
  recommendation: string | null;
  citation_concern: string | null;
}
export function safeHref(url: string | null) {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return ["https:", "http:"].includes(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
}
function Highlight({ text, other }: { text: string; other: string }) {
  const words = new Set(tokenize(other).map((t) => t.value));
  const tokens = tokenize(text);
  let previous = 0;
  const parts: React.ReactNode[] = [];
  tokens.forEach((t, i) => {
    parts.push(text.slice(previous, t.start));
    parts.push(
      words.has(t.value) ? (
        <mark key={i}>{text.slice(t.start, t.end)}</mark>
      ) : (
        text.slice(t.start, t.end)
      ),
    );
    previous = t.end;
  });
  parts.push(text.slice(previous));
  return <>{parts}</>;
}
export function ReportView({
  scan,
  sources,
  matches,
}: {
  scan: Scan;
  sources: SourceRow[];
  matches: MatchRow[];
}) {
  const [filter, setFilter] = useState("ALL");
  const visible = matches.filter(
    (m) =>
      filter === "ALL" ||
      (filter === "ISSUE" && (!m.is_cited || Boolean(m.citation_concern))) ||
      (filter === "EXCLUDED" && m.excluded_from_score) ||
      sources.some((s) => s.id === m.source_id && s.source_type === filter),
  );
  const visibleSources = sources.filter((s) =>
    ["ALL", "ISSUE", "EXCLUDED"].includes(filter)
      ? filter === "ALL" || visible.some((m) => m.source_id === s.id)
      : s.source_type === filter,
  );
  return (
    <>
      <Heading
        title="Similarity report"
        description="Evidence to support a thoughtful academic review."
      >
        <a className="btn secondary" href={"/api/reports/" + scan.id + "/pdf"}>
          <Download size={16} /> Download PDF
        </a>
      </Heading>
      <div className="panel mb-6">
        <div className="flex flex-col sm:flex-row gap-8 items-start sm:items-center">
          <div
            className="report-score shrink-0"
            style={
              {
                "--score": Number(scan.overall_similarity),
              } as React.CSSProperties
            }
          >
            <div>
              <strong>
                {Number(scan.overall_similarity).toFixed(1)}
                <span className="text-lg">%</span>
              </strong>
              <small>OVERALL SIMILARITY</small>
            </div>
          </div>
          <div>
            <span className="eyebrow">Your research, in context</span>
            <h2 className="text-2xl mt-3 mb-3">{scan.thesis?.title}</h2>
            <div className="text-sm muted">
              {scan.thesis?.student?.full_name} ·{" "}
              {scan.thesis?.department?.name}
            </div>
            <div className="text-xs muted mt-2">
              Checked{" "}
              {new Date(
                scan.completed_at || scan.created_at,
              ).toLocaleDateString("en-GB")}{" "}
              · {scan.matched_word_count.toLocaleString()} of{" "}
              {scan.eligible_word_count.toLocaleString()} eligible words matched
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-5 mt-7 border-t border-slate-100 pt-6">
          {[
            ["Repository", scan.repository_similarity + "%"],
            ["Public web", scan.web_similarity + "%"],
            ["Academic sources", scan.academic_similarity + "%"],
            ["Sources found", scan.total_sources],
            ["Matching passages", scan.total_matches],
          ].map(([label, value]) => (
            <div key={label}>
              <span className="text-xs muted">{label}</span>
              <b className="block text-xl mt-1">{value}</b>
            </div>
          ))}
        </div>
      </div>
      <Notice>{DISCLAIMER}</Notice>
      {scan.warnings?.length > 0 && (
        <div className="mt-5 panel">
          <h3>Coverage & availability</h3>
          <ul className="list-disc pl-5 text-sm muted space-y-2">
            {scan.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {scan.ai_status === "UNAVAILABLE" && (
        <div className="mt-4">
          <ActionButton
            url={"/api/scans/" + scan.id + "/ai"}
            label="Retry AI guidance"
          />
        </div>
      )}
      <div className="mt-7 mb-6 border-b border-slate-200">
        <Tabs
          value={filter}
          onChange={(_, v) => setFilter(v)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Filter similarity matches"
        >
          {[
            ["ALL", "All matches"],
            ["REPOSITORY", "Repository"],
            ["WEB", "Public web"],
            ["ACADEMIC", "Academic"],
            ["ISSUE", "Potential citation issues"],
            ["EXCLUDED", "Excluded matches"],
          ].map(([value, label]) => (
            <Tab key={value} value={value} label={label} />
          ))}
        </Tabs>
      </div>
      <div className="panel mb-6">
        <div className="section-title">
          <h2>Matched & discovered sources</h2>
          <span className="muted text-xs">{visibleSources.length} sources</span>
        </div>
        {!visibleSources.length && (
          <p className="text-sm">
            No sources in this category. A zero score does not establish
            originality.
          </p>
        )}
        {visibleSources.map((s) => {
          const Icon =
            s.source_type === "REPOSITORY"
              ? Library
              : s.source_type === "WEB"
                ? Globe
                : BookOpen;
          const href = safeHref(s.source_url);
          return (
            <article key={s.id} className="source-card">
              <div className="flex gap-4">
                <Icon size={21} className="text-blue-800 shrink-0 mt-1" />
                <div className="grow min-w-0">
                  <div className="flex justify-between gap-4">
                    <h3 className="text-base mb-2">{s.source_title}</h3>
                    <b className="text-sm whitespace-nowrap">
                      {s.similarity_score}%
                    </b>
                  </div>
                  <p className="text-xs mb-2">
                    {s.source_type} · {s.author || "Author not supplied"}
                    {s.publication_year
                      ? " · " + s.publication_year
                      : ""} ·{" "}
                    {matches.filter((m) => m.source_id === s.id).length}{" "}
                    passages
                  </p>
                  {href && (
                    <a
                      className="text-xs text-blue-800 inline-flex items-center gap-1 break-all"
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View original source <ExternalLink size={12} />
                    </a>
                  )}
                  {s.doi && (
                    <p className="text-xs mt-2 mb-1 break-all">DOI: {s.doi}</p>
                  )}
                  <p className="text-xs mt-2 mb-0">
                    {String(s.metadata.coverage || "Available text only")}
                    {s.metadata.verification_warning
                      ? " · " + String(s.metadata.verification_warning)
                      : ""}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="section-title">
        <h2>Passage comparisons</h2>
        <span className="text-xs muted">
          {visible.length} potential matches
        </span>
      </div>
      {visible.length === 0 && (
        <div className="panel">
          <p className="mb-0 text-sm">No matching passages for this filter.</p>
        </div>
      )}
      {visible.map((m, i) => (
        <article className="panel mb-5" key={m.id}>
          <div className="flex gap-3 justify-between flex-wrap mb-5">
            <h3 className="text-base mb-0">
              {i + 1}. {sources.find((s) => s.id === m.source_id)?.source_title}
            </h3>
            <span className="badge">
              {m.match_type.replaceAll("_", " ")} · {m.similarity_score}%
              strength
            </span>
          </div>
          <div className="passage-grid">
            <div>
              <p className="text-xs font-semibold">SUBMITTED PASSAGE</p>
              <div className="passage">
                <Highlight text={m.submitted_text} other={m.source_text} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold">MATCHING SOURCE PASSAGE</p>
              <div className="passage">
                <Highlight text={m.source_text} other={m.submitted_text} />
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap mt-4">
            {m.is_quoted && (
              <span className="badge green">Quotation detected</span>
            )}
            {m.is_cited && (
              <span className="badge green">Citation detected</span>
            )}
            {m.excluded_from_score && (
              <span className="badge">Excluded from score · references</span>
            )}
          </div>
          <div className="mt-5 bg-blue-50/50 p-4 rounded-lg flex gap-3">
            <Quote size={19} className="text-blue-800 shrink-0" />
            <div>
              <h4 className="text-sm font-semibold mb-1">
                {m.ai_classification || "Academic integrity guidance"}
              </h4>
              {m.ai_explanation && (
                <p className="text-xs mb-2">{m.ai_explanation}</p>
              )}
              <p className="text-xs mb-0">
                {m.recommendation ||
                  "Check the original source and its attribution. Quote verbatim wording accurately, and paraphrase from your own understanding. This general guidance is not an AI classification."}
              </p>
            </div>
          </div>
        </article>
      ))}
      <p className="text-xs mt-6">{LIMITATIONS}</p>
    </>
  );
}
