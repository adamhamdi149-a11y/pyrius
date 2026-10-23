import type { ReactNode } from "react";

export const LEGAL_EFFECTIVE = "October 23, 2026";
export const PRIVACY_EMAIL = "privacy@pyrius.app";

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/** Shared layout for legal documents: title, date, table of contents, numbered sections. */
export function LegalDoc({ title, intro, sections }: { title: string; intro: ReactNode; sections: LegalSection[] }) {
  return (
    <article className="legal">
      <header className="legal__head">
        <p className="mk-eyebrow">Legal</p>
        <h1 className="legal__title">{title}</h1>
        <p className="legal__date">Effective {LEGAL_EFFECTIVE}</p>
        <div className="legal__intro">{intro}</div>
      </header>
      <div className="legal__grid">
        <nav className="legal__toc" aria-label="Contents">
          <ol>
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="legal__body">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="legal__section">
              <h2>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {s.title}
              </h2>
              {s.body}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
