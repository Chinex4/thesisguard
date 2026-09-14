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
        <nav>
          <Link href="/repository">Repository</Link>
          <a href="#about">About ThesisGuard</a>
          <Link href="/login">Log in</Link>
          <Link href="/register" className="btn small">
            Get started <ArrowRight size={14} />
          </Link>
        </nav>
      </header>
      <main id="main">
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <div className="pill">
                <ShieldCheck size={14} /> Built for academic integrity
              </div>
              <h1>
                Protect Academic
                <br />
                Integrity.
                <br />
                <em>Preserve Research.</em>
              </h1>
              <p>
                A trusted home for your institution’s research. Store your
                thesis, discover meaningful similarities, and submit your work
                with confidence.
              </p>
              <div className="hero-actions">
                <Link className="btn" href="/theses/new">
                  Check your thesis <ArrowRight size={16} />
                </Link>
                <Link className="btn secondary" href="/repository">
                  <Library size={16} /> Explore repository
                </Link>
              </div>
              <div className="trust-line">
                <span>
                  <Check size={13} /> Private by design
                </span>
                <span>
                  <Check size={13} /> Clear, transparent reports
                </span>
              </div>
            </div>
            <div>
              <div
                className="preview"
                aria-label="Illustrative similarity report preview"
              >
                <div className="preview-top">
                  <span className="flex items-center gap-2">
                    <ShieldCheck size={15} /> ThesisGuard / Similarity report
                  </span>
                  <span className="badge">ILLUSTRATION</span>
                </div>
                <div className="preview-body">
                  <div className="eyebrow">A clearer view of your work</div>
                  <h3 className="mt-3 mb-1">
                    Your research. Thoughtfully reviewed.
                  </h3>
                  <span className="muted text-xs">
                    Understand the overlap. Keep your own voice.
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
                        <small>EXAMPLE SIMILARITY</small>
                      </div>
                    </div>
                    <div className="grow space-y-3">
                      {[
                        ["Repository", "9%"],
                        ["Public web", "6%"],
                        ["Academic sources", "3%"],
                      ].map(([a, b]) => (
                        <div
                          key={a}
                          className="flex justify-between text-xs gap-6"
                        >
                          <span className="muted">{a}</span>
                          <b>{b}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between text-xs mb-3">
                      <b>Matching passages</b>
                      <span className="badge green">Requires human review</span>
                    </div>
                    <div className="preview-lines w-full" />
                    <div
                      className="preview-lines w-4/5"
                      style={{ background: "#f2e4b9" }}
                    />
                    <div className="preview-lines w-11/12" />
                    <div className="mt-5 p-3 rounded-md bg-slate-50 text-xs text-slate-500 flex gap-2">
                      <Quote size={17} className="shrink-0" />
                      Every match is a starting point for better attribution.
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-center text-[10px]! mt-4 mb-0!">
                Illustrative preview · Actual results depend on available
                sources
              </p>
            </div>
          </div>
        </section>
        <div className="feature-strip">
          <span>
            <GraduationCap size={18} /> Built for students & supervisors
          </span>
          <span>
            <LockKeyhole size={16} /> Secure thesis storage
          </span>
          <span>
            <Globe size={17} /> Repository, web & academic sources
          </span>
        </div>
        <section className="landing-section wrap" id="about">
          <div className="section-intro">
            <div className="eyebrow mb-3">
              From first draft to final submission
            </div>
            <h2>Better research starts with clarity.</h2>
            <p>A straightforward workflow that keeps the focus on your work.</p>
          </div>
          <div className="steps">
            {[
              {
                icon: Upload,
                n: "01",
                title: "Upload your thesis",
                text: "Add your research details and upload a PDF or DOCX. Your document stays private until it is approved.",
              },
              {
                icon: ScanText,
                n: "02",
                title: "Understand your similarities",
                text: "Compare your writing with repository documents and accessible web and academic sources.",
              },
              {
                icon: BookOpen,
                n: "03",
                title: "Review, refine, submit",
                text: "Explore matching passages, check your citations, and share a clear report with your supervisor.",
              },
            ].map((s) => (
              <div key={s.n}>
                <div className="flex justify-between items-start">
                  <div className="step-icon">
                    <s.icon size={22} />
                  </div>
                  <span className="text-slate-300 text-2xl font-light">
                    {s.n}
                  </span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="wrap pb-20">
          <div className="features-grid">
            <div className="feature-card">
              <Library size={26} className="text-blue-800 mb-5" />
              <div className="eyebrow mb-3">An institutional memory</div>
              <h2>
                Good research deserves
                <br />
                to be discovered.
              </h2>
              <p>
                Explore approved theses by department, topic, and year. Give the
                next generation of researchers a stronger place to start.
              </p>
              <Link
                href="/repository"
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-900"
              >
                Browse the repository <ArrowRight size={15} />
              </Link>
            </div>
            <div className="feature-card">
              <ShieldCheck size={26} className="text-emerald-700 mb-5" />
              <div className="eyebrow mb-3">Guidance, not a verdict</div>
              <h2>
                Support original thinking.
                <br />
                Build better habits.
              </h2>
              <p>
                Students get practical citation guidance. Supervisors get source
                evidence and a structured review workflow. People make the
                academic decisions.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-900"
              >
                Start with ThesisGuard <ArrowRight size={15} />
              </Link>
            </div>
          </div>
          <div className="mt-10 text-center max-w-3xl mx-auto">
            <p className="text-xs">{DISCLAIMER}</p>
            <p className="text-xs">{LIMITATIONS}</p>
          </div>
        </section>
      </main>
      <footer className="footer">
        <div className="wrap flex justify-between gap-5 flex-wrap">
          <Brand />
          <span>Preserving knowledge. Encouraging originality.</span>
          <span>ThesisGuard · Academic research platform</span>
        </div>
      </footer>
    </div>
  );
}
