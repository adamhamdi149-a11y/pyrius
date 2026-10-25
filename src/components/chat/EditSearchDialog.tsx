"use client";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { AirportInput } from "@/components/ui/AirportInput";
import type { FlightSearchParams } from "@/lib/types";
import { addDays, toISODate } from "@/lib/utils";

/** Direct edit of a flight search without going back through the conversation. */
export function EditSearchDialog({ open, onClose, params, onApply }: { open: boolean; onClose: () => void; params: FlightSearchParams; onApply: (p: FlightSearchParams) => void }) {
  const [p, setP] = useState(params);
  useEffect(() => {
    if (open) setP(params);
  }, [open, params]);
  const today = toISODate(new Date());
  const valid = p.originCode !== p.destinationCode && p.departDate > today && (!p.returnDate || p.returnDate > p.departDate) && p.adults >= 1;
  const set = (patch: Partial<FlightSearchParams>) => setP((x) => ({ ...x, ...patch }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit flight search"
      description="Results update instantly. The assistant will remember the change."
      wide
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" disabled={!valid} onClick={() => onApply(p)}>
            Update results
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field">
          <label className="field__label" htmlFor="es-from">
            From
          </label>
          <AirportInput id="es-from" value={p.originCode} onChange={(code) => set({ originCode: code })} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="es-to">
            To
          </label>
          <AirportInput id="es-to" value={p.destinationCode} onChange={(code) => set({ destinationCode: code })} />
        </div>
        <label className="field">
          <span className="field__label">Depart</span>
          <input
            className="input"
            type="date"
            min={addDays(today, 1)}
            value={p.departDate}
            onChange={(e) => e.target.value && set({ departDate: e.target.value, returnDate: p.returnDate && p.returnDate <= e.target.value ? addDays(e.target.value, 7) : p.returnDate })}
          />
        </label>
        <label className="field">
          <span className="field__label">Return</span>
          <input className="input" type="date" min={addDays(p.departDate, 1)} value={p.returnDate ?? ""} onChange={(e) => set({ returnDate: e.target.value || undefined })} />
        </label>
        <label className="field">
          <span className="field__label">Adults</span>
          <select className="select" value={p.adults} onChange={(e) => set({ adults: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Children</span>
          <select className="select" value={p.children} onChange={(e) => set({ children: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      {p.originCode === p.destinationCode && <p className="field__hint" style={{ color: "var(--error)", marginTop: 10 }}>Origin and destination must be different.</p>}
    </Dialog>
  );
}
