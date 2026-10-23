"use client";
import { FlaskConical, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useToast } from "@/components/ui/Toast";
import { planById } from "@/lib/plans";
import { useStore } from "@/lib/store/AppStore";
import { moneyExact } from "@/lib/utils";

function DemoCheckout() {
  const params = useSearchParams();
  const router = useRouter();
  const store = useStore();
  const toast = useToast();
  const plan = planById(params.get("plan") === "pro" ? "pro" : "plus");
  const local = store.storage === "local";

  return (
    <div className="page">
      <div className="center-card card checkout">
        <span className="badge badge--warning" style={{ justifySelf: "start" }}>
          <FlaskConical />
          Demo checkout — no payment will be processed
        </span>
        <div>
          <h1 className="t-h2">Pyrius {plan.name}</h1>
          <p className="t-body" style={{ marginTop: 4, fontSize: "var(--fs-sm)" }}>
            Stripe isn&apos;t configured for this deployment yet, so this page stands in for the real checkout. Nothing is charged and no card is requested.
          </p>
        </div>
        <div>
          <div className="checkout__line">
            <span>{plan.name} plan · monthly</span>
            <span className="num">{moneyExact(plan.monthlyCAD, "CAD")}</span>
          </div>
          <div className="checkout__line" style={{ color: "var(--text-3)" }}>
            <span>Provisional price (CAD)</span>
            <span>Not final</span>
          </div>
        </div>
        {local ? (
          <>
            <button
              className="btn btn--primary btn--lg btn--block"
              onClick={() => {
                store.setDemoPlan(plan.id);
                toast({ title: `${plan.name} preview enabled`, description: "Demo entitlement in this browser only. No payment was taken." });
                router.push("/settings?section=subscription");
              }}
            >
              Preview {plan.name} features (demo)
            </button>
            <p className="t-meta" style={{ textAlign: "center" }}>
              The preview unlocks {plan.name} limits locally and is labeled as a demo everywhere.
            </p>
          </>
        ) : (
          <div className="notice">
            <ShieldCheck />
            <span>You&apos;re signed in, so plans can only change through a real Stripe payment confirmed by the server. Add Stripe keys to enable checkout.</span>
          </div>
        )}
        <Link href="/settings?section=subscription" className="btn btn--ghost btn--block">
          Back to plans
        </Link>
      </div>
    </div>
  );
}

export default function DemoCheckoutPage() {
  return (
    <div className="main__scroll">
      <Suspense>
        <DemoCheckout />
      </Suspense>
    </div>
  );
}
