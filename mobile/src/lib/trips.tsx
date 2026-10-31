import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Reservation, Trip } from "@/lib/trips/types";
import { uid } from "@/lib/utils";
import { useStore } from "./store";
import { supabase } from "./supabase";

/**
 * My Trips for the signed-in user. Trips the user plans are theirs to edit; reservations are only
 * read here (the Pyrius server writes them when a booking provider confirms one). Trips are stored in
 * Supabase (migration 0002_trips.sql); until that migration has run, planned trips stay on this phone.
 */

export type NewTrip = Pick<Trip, "destination" | "destinationCode" | "country" | "startDate" | "endDate">;

interface TripsCtx {
  ready: boolean;
  trips: Trip[];
  /** Where trips are kept: in the account, or on this phone until the database is set up. */
  storage: "cloud" | "device";
  tripById: (id: string) => Trip | undefined;
  createTrip: (t: NewTrip) => Trip;
  updateTrip: (id: string, patch: Partial<NewTrip>) => void;
  /** Only planned trips without reservations can be deleted. */
  deleteTrip: (id: string) => boolean;
}

const Ctx = createContext<TripsCtx | null>(null);

const deviceKey = (who: string) => `pyrius:trips:v1:${who}`;
async function readDevice(key: string): Promise<Trip[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(key)) ?? "[]") as Trip[];
  } catch {
    return [];
  }
}

/** PostgREST's answer when a table doesn't exist yet. */
const missingTable = (e: { code?: string; message?: string } | null) => Boolean(e && (e.code === "PGRST205" || e.code === "42P01" || /does not exist|schema cache/i.test(e.message ?? "")));

export function TripsProvider({ children }: { children: ReactNode }) {
  const { auth } = useStore();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [ready, setReady] = useState(false);
  const [storage, setStorage] = useState<"cloud" | "device">("device");
  const tripsRef = useRef<Trip[]>([]);
  const userId = auth.mode === "cloud" ? auth.userId : null;
  const who = userId ?? "local";

  const apply = (next: Trip[]) => {
    tripsRef.current = next;
    setTrips(next);
  };

  useEffect(() => {
    let live = true;
    (async () => {
      let loaded: Trip[] | null = null;
      let where: "cloud" | "device" = "device";
      if (supabase && userId) {
        const [t, r] = await Promise.all([supabase.from("trips").select("data"), supabase.from("reservations").select("trip_id, data")]);
        if (!t.error) {
          where = "cloud";
          const byTrip = new Map<string, Reservation[]>();
          for (const row of r.error ? [] : (r.data ?? [])) byTrip.set(row.trip_id, [...(byTrip.get(row.trip_id) ?? []), row.data as Reservation]);
          loaded = (t.data ?? []).map((row) => {
            const trip = row.data as Trip;
            return { ...trip, reservations: byTrip.get(trip.id) ?? [] };
          });
          // Trips planned on this phone before the account could hold them move into the account, once.
          const local = await readDevice(deviceKey(userId));
          const moving = local.filter((x) => !loaded!.some((y) => y.id === x.id));
          if (moving.length) {
            const { error } = await supabase.from("trips").upsert(
              moving.map(({ reservations: _r, ...data }) => ({ id: data.id, user_id: userId, data, start_date: data.startDate ?? null, updated_at: data.updatedAt })),
            );
            if (!error) {
              loaded = [...loaded, ...moving.map((x) => ({ ...x, reservations: [] }))];
              await AsyncStorage.removeItem(deviceKey(userId)).catch(() => {});
            } else {
              console.warn("[trips] moving trips to the account failed:", error.message);
            }
          } else if (local.length) {
            await AsyncStorage.removeItem(deviceKey(userId)).catch(() => {});
          }
        } else if (!missingTable(t.error)) {
          console.warn("[trips] load failed:", t.error.message);
        }
      }
      if (!loaded) loaded = await readDevice(deviceKey(who));
      if (!live) return;
      setStorage(where);
      apply(loaded);
      setReady(true);
    })();
    return () => {
      live = false;
    };
  }, [userId, who]);

  const persist = useCallback(
    (next: Trip[], changed?: Trip, removed?: string) => {
      apply(next);
      if (storage === "cloud" && supabase && userId) {
        if (changed) {
          // Reservations live in their own table, written by the server only.
          const { reservations: _r, ...data } = changed;
          void supabase
            .from("trips")
            .upsert({ id: changed.id, user_id: userId, data, start_date: changed.startDate ?? null, updated_at: changed.updatedAt })
            .then(({ error }) => error && console.warn("[trips] save failed:", error.message));
        }
        if (removed) void supabase.from("trips").delete().eq("id", removed).then(({ error }) => error && console.warn("[trips] delete failed:", error.message));
      } else {
        AsyncStorage.setItem(deviceKey(who), JSON.stringify(next)).catch(() => {});
      }
    },
    [storage, userId, who],
  );

  const createTrip = useCallback(
    (t: NewTrip) => {
      const now = new Date().toISOString();
      const trip: Trip = { ...t, id: uid("trip_"), createdAt: now, updatedAt: now, origin: "user", reservations: [] };
      persist([...tripsRef.current, trip], trip);
      return trip;
    },
    [persist],
  );

  const updateTrip = useCallback(
    (id: string, patch: Partial<NewTrip>) => {
      let changed: Trip | undefined;
      const next = tripsRef.current.map((t) => (t.id === id ? (changed = { ...t, ...patch, updatedAt: new Date().toISOString() }) : t));
      if (changed) persist(next, changed);
    },
    [persist],
  );

  const deleteTrip = useCallback(
    (id: string) => {
      const t = tripsRef.current.find((x) => x.id === id);
      if (!t || t.reservations.length) return false;
      persist(
        tripsRef.current.filter((x) => x.id !== id),
        undefined,
        id,
      );
      return true;
    },
    [persist],
  );

  const tripById = useCallback((id: string) => tripsRef.current.find((t) => t.id === id), []);

  const value = useMemo(() => ({ ready, trips, storage, tripById, createTrip, updateTrip, deleteTrip }), [ready, trips, storage, tripById, createTrip, updateTrip, deleteTrip]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTrips() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTrips must be used inside TripsProvider");
  return c;
}
