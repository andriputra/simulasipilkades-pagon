"use client";

import { createContext, useContext } from "react";
import { labelsFor, type EventLabels } from "@/lib/event-meta";

const EventLabelsContext = createContext<EventLabels>(labelsFor("pilkades"));

/**
 * Menyebarkan sebutan per jenis pemilihan (calon/pemilih/TPS) ke seluruh
 * halaman panel tanpa setiap halaman harus memanggil API sendiri.
 */
export default function EventLabelsProvider({ kind, children }: { kind: string; children: React.ReactNode }) {
  return <EventLabelsContext.Provider value={labelsFor(kind)}>{children}</EventLabelsContext.Provider>;
}

export function useEventLabels(): EventLabels {
  return useContext(EventLabelsContext);
}
