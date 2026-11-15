import { NextResponse } from "next/server";
import { finishBooking } from "@/lib/booking/flightCheckout";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Called by the confirmation page after Stripe Checkout: books the paid fare (once) and returns the booking. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { sessionId?: unknown } | null;
  const id = typeof body?.sessionId === "string" && /^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(body.sessionId) ? body.sessionId : null;
  if (!id) return NextResponse.json({ status: "not_found" }, { status: 404 });
  try {
    const out = await finishBooking(id);
    return NextResponse.json(out, { status: out.status === "not_found" ? 404 : 200 });
  } catch (err) {
    console.error("Finishing booking failed:", (err as Error).message);
    return NextResponse.json({ error: "Pyrius couldn't check this booking right now. Reload the page in a moment; you won't be charged twice." }, { status: 502 });
  }
}
