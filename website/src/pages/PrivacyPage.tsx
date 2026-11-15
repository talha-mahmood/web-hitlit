import { Fragment, type ReactNode } from "react";
import policy from "../../../PRIVACY_POLICY.md?raw";

// Renders the app's own PRIVACY_POLICY.md (single source of truth) — public,
// no sign-in needed. The file only uses headings, paragraphs, bullet lists,
// bold and horizontal rules, so a tiny renderer covers it.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

function render(md: string): ReactNode[] {
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (!list.length) return;
    out.push(
      <ul key={`ul-${out.length}`} className="my-3 list-disc space-y-1.5 pl-6">
        {list.map((li, i) => (
          <li key={i}>{inline(li)}</li>
        ))}
      </ul>
    );
    list = [];
  };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("- ")) {
      list.push(line.slice(2));
      continue;
    }
    flush();
    if (!line) continue;
    if (line === "---") out.push(<hr key={out.length} className="my-6 border-border" />);
    else if (line.startsWith("# ")) out.push(<h1 key={out.length} className="text-3xl font-extrabold text-ink">{line.slice(2)}</h1>);
    else if (line.startsWith("## ")) out.push(<h2 key={out.length} className="mb-2 mt-2 text-xl font-bold text-ink">{line.slice(3)}</h2>);
    else if (line.startsWith("### ")) out.push(<h3 key={out.length} className="mb-1 mt-2 text-lg font-semibold text-ink">{line.slice(4)}</h3>);
    else out.push(<p key={out.length} className="my-3">{inline(line)}</p>);
  }
  flush();
  return out;
}

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="bg-brand">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-5 sm:px-6">
          <a href="/" className="flex items-center gap-3">
            <img src="/icon-192.png" alt="" className="h-9 w-9 rounded-full" />
            <span className="text-lg font-bold text-white">HitLit</span>
          </a>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-4 py-10 text-[15px] leading-7 text-ink-secondary sm:px-6">
        {render(policy)}
      </article>
    </div>
  );
}
