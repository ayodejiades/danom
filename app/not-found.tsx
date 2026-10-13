import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export default function NotFound() {
  return (
    <PageShell active="" eyebrow="Error 404" title={<>No entry on <em>this</em> page</>} intro={<p>The link may be old or mistyped. The credit flow and the recorded run are one click away.</p>}>
      <div className="flex flex-wrap items-center gap-5">
        <Link href="/" className="btn btn-primary">Back to overview</Link>
        <Link href="/demo" className="btn">Try the credit flow</Link>
        <span className="stamp stamp-refused text-sm">Not found</span>
      </div>
    </PageShell>
  );
}
