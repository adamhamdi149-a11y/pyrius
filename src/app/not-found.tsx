import Link from "next/link";
import { Orb } from "@/components/ai/Orb";

export default function NotFound() {
  return (
    <div className="main__scroll">
      <div className="page" style={{ display: "grid", justifyItems: "center", textAlign: "center", gap: 14, paddingTop: "12vh" }}>
        <Orb />
        <h1 className="t-title" style={{ marginTop: 28 }}>
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
