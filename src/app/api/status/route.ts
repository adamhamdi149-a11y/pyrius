import { NextResponse } from "next/server";
import { flightMode } from "@/lib/providers";

// Reports which integrations are configured. Never returns secret values.
export function GET() {
  return NextResponse.json({
    ai: process.env.OPENAI_API_KEY ? "openai" : "demo",
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_PLUS),
    // "live" (Google Flights), "demo" (explicit demo mode) or "none" (not connected).
    flights: flightMode(),
  });
}
