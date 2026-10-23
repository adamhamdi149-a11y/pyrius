import Link from "next/link";
import { LiveOrb } from "@/components/ai/LiveOrb";

export default function NotFound() {
  return (
    <div className="main__scroll">
      <div className="page" style={{ display: "grid", justifyItems: "center", textAlign: "center", gap: 14, paddingTop: "12vh" }}>
        <div className="panel-orb panel-orb--lg">
          <LiveOrb mood="idle" />
        </div>
        <h1 className="t-title" style={{ marginTop: 4 }}>
          This page drifted off course
        </h1>
        <p className="page__sub">The link may be outdated. Let&apos;s get you back to planning.</p>
        <Link href="/" className="btn btn--primary" style={{ marginTop: 8 }}>
          Back to the assistant
        </Link>
      </div>
    </div>
  );
}
