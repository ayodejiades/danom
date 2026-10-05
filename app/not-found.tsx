import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export default function NotFound() {
  return (
    <PageShell active="" title="That page does not exist" intro={<p>The link may be old or mistyped. The credit flow and the recorded run are one click away.</p>}>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className="rounded-[var(--radius-pill)] bg-[var(--accent)] px-6 py-3 text-base font-semibold text-[var(--accent-contrast)] hover:bg-[var(--navy)] hover:text-white">Back to overview</Link>
        <Link href="/demo" className="rounded-[var(--radius-pill)] border border-[var(--navy)] px-6 py-3 text-base font-semibold hover:bg-[var(--navy)] hover:text-white">Try the credit flow</Link>
      </div>
    </PageShell>
  );
}
