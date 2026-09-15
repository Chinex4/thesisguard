import Link from "next/link";
import {
  ArrowRight,
  Upload,
  Library,
  ScanText,
  ShieldCheck,
  BookOpen,
  Check,
  Globe,
  GraduationCap,
  Quote,
  LockKeyhole,
} from "lucide-react";
import { Brand } from "@/components/ui";
import { DISCLAIMER, LIMITATIONS } from "@/types";

export default function Home() {
  return (
    <div className="landing">
      <header className="wrap landing-header">
        <Brand />
        <nav aria-label="Primary navigation">
          <Link className="landing-nav-link" href="/repository">
            Repository
          </Link>
          <a className="landing-nav-link" href="#how-it-works">
            How it works
          </a>
          <Link className="landing-login btn secondary small" href="/login">
            Log in
          </Link>
          <Link href="/register" className="btn small landing-start">
            Get started <ArrowRight size={14} />
          </Link>
        </nav>
      </header>

      <main id="main">
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <div className="pill">
                <ShieldCheck size={14} /> Academic integrity, made practical
              </div>
              <h1>Check your research before you submit.</h1>
              <p>
                ThesisGuard helps students store research, review text overlap,
                verify sources, and submit with clearer academic context.
              </p>
              <div className="hero-actions">
                <Link className="btn" href="/theses/new">
                  Check a thesis <ArrowRight size={16} />
                </Link>
                <Link className="btn secondary" href="/repository">
                  <Library size={16} /> Browse repository
                </Link>
              </div>
              <div className="trust-line" aria-label="Platform assurances">
                <span>
                  <Check size={13} /> Private storage
                </span>
                <span>
                  <Check size={13} /> Source-based reports
                </span>
                <span>
                  <Check size={13} /> Human review stays central
                </span>
              </div>
            </div>

            <div className="hero-preview-wrap">
              <div
                className="preview"
                aria-label="Illustrative similarity report preview"
              >
                <div className="preview-top">
                  <span className="flex items-center gap-2 min-w-0">
                    <ShieldCheck size={15} className="shrink-0" />
                    <span className="truncate">Similarity report</span>
                  </span>
                  <span className="badge">Preview</span>
                </div>
                <div className="preview-body">
                  <div className="eyebrow">Research overview</div>
                  <h3 className="mt-3 mb-1">Development of a student platform</h3>
                  <span className="muted text-xs">
                    Example report using repository, web and academic sources
                  </span>

                  <div className="preview-score">
                    <div
                      className="report-score"
                      style={{ "--score": 18 } as React.CSSProperties}
                    >
                      <div>
                        <strong>
                          18<span className="text-lg">%</span>
                        </strong>
                        <small>SIMILARITY</small>
                      </div>
                    </div>
                    <div className="grow space-y-3 min-w-0">
                      {[
                        ["Repository", "9%"],
                        ["Public web", "6%"],
                        ["Academic", "3%"],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="flex justify-between text-xs gap-6"
                        >
                          <span className="muted">{label}</span>
                          <b>{value}</b>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <div className="preview-match-head">
                      <b>Matching passage</b>
                      <span className="badge green">Review source</span>
                    </div>
                    <div className="preview-lines w-full" />
                    <div className="preview-lines w-4/5 preview-highlight" />
                    <div className="preview-lines w-11/12" />
                    <div className="preview-note">
                      <Quote size={17} className="shrink-0" />
                      Similarity is evidence to review, not an automatic verdict.
                    </div>
                  </div>
                </div>
              </div>
              <p className="preview-caption">
                Illustrative interface. Results depend on available sources.
              </p>
            </div>
          </div>
        </section>

        <div className="feature-strip" aria-label="Platform features">
          <span>
            <GraduationCap size={18} /> Students & supervisors
          </span>
          <span>
            <LockKeyhole size={16} /> Private thesis storage
          </span>
          <span>
            <Globe size={17} /> Repository, web & academic checks
          </span>
        </div>

        <section className="landing-section wrap" id="how-it-works">
          <div className="section-intro">
            <div className="eyebrow mb-3">Simple by design</div>
            <h2>Three steps from draft to review.</h2>
            <p>Keep the workflow focused on your research, not the software.</p>
          </div>

          <div className="steps">
            {[
              {
                icon: Upload,
                n: "01",
                title: "Upload",
                text: "Add your thesis and research details. Files remain private until approved.",
              },
              {
                icon: ScanText,
                n: "02",
                title: "Check",
                text: "Compare against institutional research and accessible external sources.",
              },
              {
                icon: BookOpen,
                n: "03",
                title: "Review",
                text: "Inspect matching passages, verify citations, and submit with context.",
              },
            ].map((step) => (
              <article className="landing-step" key={step.n}>
                <div className="flex justify-between items-start gap-4">
                  <div className="step-icon">
                    <step.icon size={22} />
                  </div>
                  <span className="step-number">{step.n}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="wrap landing-value-section">
          <div className="features-grid">
            <article className="feature-card">
              <Library size={26} className="text-blue-800 mb-5" />
              <div className="eyebrow mb-3">Institutional repository</div>
              <h2>Research worth finding.</h2>
              <p>
                Browse approved theses by topic, department, and year, then build
                on work already completed within your institution.
              </p>
              <Link className="text-link" href="/repository">
                Browse repository <ArrowRight size={15} />
              </Link>
            </article>

            <article className="feature-card">
              <ShieldCheck size={26} className="text-emerald-700 mb-5" />
              <div className="eyebrow mb-3">Evidence, not accusation</div>
              <h2>Keep academic judgment human.</h2>
              <p>
                Similarity scores point reviewers to evidence. Students and
                supervisors still make the academic decisions.
              </p>
              <Link className="text-link" href="/register">
                Create an account <ArrowRight size={15} />
              </Link>
            </article>
          </div>

          <div className="landing-disclaimer">
            <p>{DISCLAIMER}</p>
            <p>{LIMITATIONS}</p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap landing-footer-inner">
          <Brand />
          <span>Preserving knowledge. Encouraging originality.</span>
          <span>ThesisGuard · Academic research platform</span>
        </div>
      </footer>
    </div>
  );
}
