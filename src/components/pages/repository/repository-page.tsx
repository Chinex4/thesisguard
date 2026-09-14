import Link from "next/link";
import { Heading, Empty } from "@/components/ui";
import { directories } from "@/lib/services/data";
import { searchRepository } from "@/lib/services/repository";
export async function RepositoryPage({
  params,
}: {
  params: Record<string, string | undefined>;
}) {
  const [{ items, count, page }, directory] = await Promise.all([
    searchRepository(params),
    directories(),
  ]);
  const pageUrl = (n: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
    p.set("page", String(n));
    return "/repository?" + p;
  };
  return (
    <>
      <Heading
        title="Thesis repository"
        description="Discover ideas. Build on knowledge. Give research a lasting home."
      />
      <div className="panel">
        <form className="filters" action="/repository">
          <input
            aria-label="Search repository"
            className="filter-input"
            name="q"
            defaultValue={params.q}
            placeholder="Search title, author, or keyword…"
          />
          <select
            className="filter-input"
            aria-label="Faculty"
            name="faculty"
            defaultValue={params.faculty || ""}
          >
            <option value="">All faculties</option>
            {directory.faculties.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <select
            className="filter-input"
            aria-label="Department"
            name="department"
            defaultValue={params.department || ""}
          >
            <option value="">All departments</option>
            {directory.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <input
            className="filter-input"
            aria-label="Academic year"
            name="year"
            type="number"
            placeholder="All years"
            defaultValue={params.year}
          />
          <select
            className="filter-input"
            aria-label="Sort order"
            name="sort"
            defaultValue={params.sort || "newest"}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title A–Z</option>
          </select>
          <button className="btn" type="submit">
            Search
          </button>
        </form>
        <div className="flex justify-between text-xs muted border-b border-slate-100 pb-4">
          <span>
            {count} approved {count === 1 ? "thesis" : "theses"}
          </span>
          <Link href="/repository">Clear filters</Link>
        </div>
        {!items.length && (
          <Empty
            title="No theses found"
            description="Try a broader search or different filters. Only approved theses appear in the repository."
          />
        )}
        {items.map((t) => (
          <article key={t.id} className="repository-card">
            <div className="flex gap-2 items-center">
              <span className="badge">{t.department?.name}</span>
              <span className="text-xs muted">{t.academic_year}</span>
            </div>
            <h3>
              <Link href={"/repository/" + t.id}>{t.title}</Link>
            </h3>
            <p className="mb-2">By {t.student?.full_name}</p>
            <p className="line-clamp-2">{t.abstract}</p>
            <div className="flex justify-between gap-3 items-center">
              <div className="keywords">
                {t.keywords.slice(0, 5).map((k) => (
                  <span className="badge" key={k}>
                    {k}
                  </span>
                ))}
              </div>
              <Link
                className="text-xs text-blue-800 whitespace-nowrap"
                href={"/repository/" + t.id}
              >
                View thesis →
              </Link>
            </div>
          </article>
        ))}
        <nav
          className="flex justify-between items-center pt-6 text-sm"
          aria-label="Repository pagination"
        >
          {page > 1 ? (
            <Link className="btn secondary small" href={pageUrl(page - 1)}>
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="muted">
            Page {page} of {Math.max(1, Math.ceil(count / 12))}
          </span>
          {page * 12 < count ? (
            <Link className="btn secondary small" href={pageUrl(page + 1)}>
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </div>
    </>
  );
}
