import type { Currency } from "@/lib/types";
import { cx } from "@/lib/utils";

/**
 * Price with deliberate typography: the currency symbol is set smaller and
 * lighter so the amount reads first. Uses Intl parts, so "$1,599" and
 * "1 599 $" (fr-CA) both render correctly.
 */
export function Price({ amount, currency, locale = "en", size = "md", className }: { amount: number; currency: Currency; locale?: string; size?: "lg" | "md" | "sm"; className?: string }) {
  const parts = new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency, maximumFractionDigits: 0 }).formatToParts(amount);
  const label = parts.map((p) => p.value).join("");
  return (
    <span className={cx("pr", `pr--${size}`, className)} aria-label={label}>
      {parts.map((p, i) =>
        p.type === "currency" ? (
          <span key={i} className="pr__cur" aria-hidden="true">
            {p.value}
          </span>
        ) : p.type === "literal" && !p.value.trim() ? null : (
          <span key={i} aria-hidden="true">
            {p.value}
          </span>
        ),
      )}
    </span>
  );
}
