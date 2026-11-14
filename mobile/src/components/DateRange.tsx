import { toISODate } from "@/lib/utils";
import { Calendar } from "./Calendar";

/** A month calendar for a date range: tap the first day, then the last. Past days can't be chosen. */
export function DateRange({ start, end, onChange }: { start?: string; end?: string; onChange: (start?: string, end?: string) => void }) {
  return <Calendar mode="range" start={start} end={end} picking={start && !end ? "end" : "start"} min={toISODate(new Date())} onChange={onChange} />;
}
