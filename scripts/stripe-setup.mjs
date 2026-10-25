#!/usr/bin/env node
/**
 * Sets up Stripe for Pyrius, idempotently:
 *   - Plus and Pro prices in USD, monthly and yearly, found again by lookup key
 *   - the billing-portal configuration (cancel at period end, switch plan, card, invoices)
 *   - the webhook endpoint for subscription events
 *
 *   node scripts/stripe-setup.mjs --mode test             # updates .env.local (test keys)
 *   node scripts/stripe-setup.mjs --mode live --vercel     # writes Vercel Production env vars
 *
 * Keys are read from .env.local (STRIPE_SECRET_KEY for test, STRIPE_LIVE_SECRET_KEY for live) and are
 * never printed. Secrets go to Vercel through stdin.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const args = process.argv.slice(2);
const mode = args.includes("--mode") ? args[args.indexOf("--mode") + 1] : "test";
const toVercel = args.includes("--vercel");
const APP = "https://pyrius.app";
const ENV_FILE = ".env.local";

const env = Object.fromEntries(
  fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "").trim()]),
);
const KEY = mode === "live" ? env.STRIPE_LIVE_SECRET_KEY : env.STRIPE_SECRET_KEY;
if (!KEY) throw new Error(`Missing ${mode === "live" ? "STRIPE_LIVE_SECRET_KEY" : "STRIPE_SECRET_KEY"} in ${ENV_FILE}`);
if (mode === "live" && !KEY.startsWith("sk_live_") && !KEY.startsWith("rk_live_")) throw new Error("STRIPE_LIVE_SECRET_KEY is not a live key (sk_live_… or rk_live_…).");
if (mode === "test" && !KEY.startsWith("sk_test_") && !KEY.startsWith("rk_test_")) throw new Error("STRIPE_SECRET_KEY is not a test key.");

async function api(path, params, method = params ? "POST" : "GET") {
  const flat = [];
  const walk = (prefix, v) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((x, i) => walk(`${prefix}[${i}]`, x));
    else if (typeof v === "object") Object.entries(v).forEach(([k, x]) => walk(prefix ? `${prefix}[${k}]` : k, x));
    else flat.push([prefix, String(v)]);
  };
  if (params) walk("", params);
  const qs = new URLSearchParams(flat).toString();
  const res = await fetch(`https://api.stripe.com/v1/${path}${method === "GET" && qs ? `?${qs}` : ""}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, ...(method !== "GET" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: method !== "GET" ? qs : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Stripe ${path}: ${json.error?.message}`);
  return json;
}

// US dollars. Yearly prices are charged once a year: Plus $4.99 × 12, Pro $11.99 × 12.
const PRODUCTS = [
  { plan: "plus", name: "Pyrius Plus", description: "30 AI-assisted flight searches a month, unlimited saved offers, 10 tracked prices and alerts." },
  { plan: "pro", name: "Pyrius Pro", description: "Unlimited searches, tracked prices and saved offers, alerts and priority support." },
];
const PRICES = [
  { plan: "plus", interval: "month", amount: 999, key: "pyrius_plus_monthly_usd", env: "STRIPE_PRICE_PLUS" },
  { plan: "plus", interval: "year", amount: 5988, key: "pyrius_plus_yearly_usd", env: "STRIPE_PRICE_PLUS_YEARLY" },
  { plan: "pro", interval: "month", amount: 1999, key: "pyrius_pro_monthly_usd", env: "STRIPE_PRICE_PRO" },
  { plan: "pro", interval: "year", amount: 14388, key: "pyrius_pro_yearly_usd", env: "STRIPE_PRICE_PRO_YEARLY" },
];

/** One product per plan, found again by metadata (or by its earlier name), created if missing. */
async function ensureProduct(p) {
  const list = await api("products", { active: true, limit: 100 }, "GET");
  const found = list.data.find((x) => x.metadata?.pyrius_plan === p.plan) ?? list.data.find((x) => x.name.toLowerCase() === p.name.toLowerCase());
  const fields = { name: p.name, description: p.description, url: APP, statement_descriptor: "PYRIUS", metadata: { app: "pyrius", pyrius_plan: p.plan } };
  return found ? api(`products/${found.id}`, fields) : api("products", fields);
}

async function ensurePrice(p, product) {
  const found = await api("prices", { lookup_keys: [p.key], active: true, limit: 1 }, "GET");
  if (found.data[0]) return found.data[0];
  return api("prices", {
    product: product.id,
    unit_amount: p.amount,
    currency: "usd",
    recurring: { interval: p.interval },
    lookup_key: p.key,
    nickname: `${product.name} ${p.interval === "year" ? "yearly" : "monthly"} (USD)`,
    tax_behavior: "exclusive",
    metadata: { app: "pyrius", pyrius_plan: p.plan, interval: p.interval },
  });
}

const EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
];

async function main() {
  const products = {};
  for (const p of PRODUCTS) products[p.plan] = await ensureProduct(p);
  const prices = {};
  for (const p of PRICES) {
    prices[p.env] = await ensurePrice(p, products[p.plan]);
    console.log(`price ${p.env}: ${prices[p.env].id} (${prices[p.env].unit_amount / 100} ${prices[p.env].currency.toUpperCase()} / ${p.interval})`);
  }

  const portalConfig = {
    business_profile: { headline: "Manage your Pyrius plan", privacy_policy_url: `${APP}/legal/privacy`, terms_of_service_url: `${APP}/legal/terms` },
    default_return_url: `${APP}/settings?section=subscription`,
    features: {
      customer_update: { enabled: true, allowed_updates: ["email", "address", "name"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end", cancellation_reason: { enabled: true, options: ["too_expensive", "unused", "missing_features", "switched_service", "other"] } },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "create_prorations",
        // Subscribers can switch plan and billing period (monthly ↔ yearly) themselves.
        products: PRODUCTS.map((p) => ({ product: products[p.plan].id, prices: PRICES.filter((x) => x.plan === p.plan).map((x) => prices[x.env].id) })),
      },
    },
    metadata: { app: "pyrius" },
  };
  const configs = await api("billing_portal/configurations", { active: true, limit: 20 }, "GET");
  const mine = configs.data.find((c) => c.metadata?.app === "pyrius");
  const portal = mine ? await api(`billing_portal/configurations/${mine.id}`, portalConfig) : await api("billing_portal/configurations", portalConfig);
  console.log(`portal configuration: ${portal.id} (${mine ? "updated" : "created"})`);

  const url = `${APP}/api/stripe/webhook`;
  const hooks = await api("webhook_endpoints", { limit: 50 }, "GET");
  let hook = hooks.data.find((h) => h.url === url);
  let secret;
  if (hook) {
    hook = await api(`webhook_endpoints/${hook.id}`, { enabled_events: EVENTS, disabled: false });
    console.log(`webhook: ${hook.id} updated (${EVENTS.length} events); its signing secret is unchanged`);
  } else {
    hook = await api("webhook_endpoints", { url, enabled_events: EVENTS, description: "Pyrius subscriptions" });
    secret = hook.secret;
    console.log(`webhook: ${hook.id} created (${EVENTS.length} events)`);
  }

  const values = {
    ...Object.fromEntries(PRICES.map((p) => [p.env, prices[p.env].id])),
    STRIPE_PORTAL_CONFIG: portal.id,
    ...(secret ? { STRIPE_WEBHOOK_SECRET: secret } : {}),
    ...(mode === "live" ? { STRIPE_SECRET_KEY: KEY } : {}),
  };

  if (toVercel) {
    if (mode === "live" && !secret && !hooks.data.length) throw new Error("No webhook secret available");
    for (const [name, value] of Object.entries(values)) {
      try {
        execFileSync("vercel", ["env", "rm", name, "production", "--yes", "--scope", "adam-2dc0"], { stdio: "ignore", shell: true });
      } catch {}
      const sensitive = name === "STRIPE_SECRET_KEY" || name === "STRIPE_WEBHOOK_SECRET";
      execFileSync("vercel", ["env", "add", name, "production", ...(sensitive ? ["--sensitive"] : []), "--scope", "adam-2dc0"], { input: value, stdio: ["pipe", "ignore", "ignore"], shell: true });
      console.log(`vercel production: ${name} set`);
    }
    if (mode === "live" && !secret) console.log("note: the live webhook already existed, so STRIPE_WEBHOOK_SECRET was left as it is in Vercel.");
  } else {
    let file = fs.readFileSync(ENV_FILE, "utf8");
    for (const [name, value] of Object.entries(values)) {
      if (name === "STRIPE_SECRET_KEY") continue;
      const line = `${name}=${value}`;
      file = new RegExp(`^${name}=.*$`, "m").test(file) ? file.replace(new RegExp(`^${name}=.*$`, "m"), line) : `${file.replace(/\n?$/, "\n")}${line}\n`;
      console.log(`${ENV_FILE}: ${name} set`);
    }
    fs.writeFileSync(ENV_FILE, file);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
