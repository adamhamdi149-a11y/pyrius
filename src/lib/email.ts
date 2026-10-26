import type { PriceTracker } from "@/lib/types";
import { money } from "@/lib/utils";

/**
 * Transactional email through Resend (https://resend.com/docs/api-reference/emails/send-email).
 * Needs RESEND_API_KEY; without it nothing is sent and callers carry on.
 */

const FROM = () => process.env.EMAIL_FROM || "Pyrius <team@pyrius.app>";
const APP = () => (process.env.NEXT_PUBLIC_APP_URL || "https://pyrius.app").replace(/\/$/, "");

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendEmail(to: string, subject: string, html: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM(), to: [to], subject, html, text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) console.error("Resend failed:", res.status, (await res.text()).slice(0, 200));
  return res.ok;
}

/** "Montréal → Rome is at $612, at or below your $620 target." */
export async function sendPriceAlert(to: string, t: PriceTracker) {
  const now = money(t.lastKnownPrice, t.currency);
  const target = money(t.targetPrice, t.currency);
  const saved = money(t.savedPrice, t.currency);
  const url = `${APP()}/tracking`;
  const subject = `${t.label}: now ${now}, at or below your target`;
  const text = `${t.label}\n${t.subLabel}\n\nNow ${now} (your target: ${target}, saved at ${saved}).\nPrices can change at any time; it's confirmed by the seller when you book.\n\nOpen Pyrius: ${url}\n\nYou get this because you track this price with email alerts on. Turn them off in Settings › Notifications.`;
  const html = `<!doctype html><html><body style="margin:0;background:#f6f5f2;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#16171d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e7e5e0">
<tr><td style="padding:28px 28px 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#8a8b95">Price alert</td></tr>
<tr><td style="padding:0 28px;font-size:22px;font-weight:650;line-height:1.3">${esc(t.label)}</td></tr>
<tr><td style="padding:4px 28px 0;font-size:14px;color:#6b6c76">${esc(t.subLabel)}</td></tr>
<tr><td style="padding:22px 28px 0"><span style="font-size:34px;font-weight:700;color:#d9531e">${esc(now)}</span>
<span style="font-size:14px;color:#6b6c76">&nbsp; your target ${esc(target)} · saved at ${esc(saved)}</span></td></tr>
<tr><td style="padding:24px 28px"><a href="${url}" style="display:inline-block;background:#ff7628;color:#1a0e05;text-decoration:none;font-weight:650;padding:12px 20px;border-radius:999px">Open in Pyrius</a></td></tr>
<tr><td style="padding:0 28px 26px;font-size:12px;line-height:1.6;color:#8a8b95">Prices can change at any time and are confirmed by the seller when you book. You get this email because you track this price with email alerts on; turn them off in Settings › Notifications.</td></tr>
</table></td></tr></table></body></html>`;
  return sendEmail(to, subject, html, text);
}
