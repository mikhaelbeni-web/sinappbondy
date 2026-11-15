"use client";

import { useEffect, useRef } from "react";
import type { RoomLayout } from "@/lib/roomLayout";
import type { SeatSection } from "@/lib/seating";

// Ouvre l'éditeur de plan (public/plan-editor.html) en plein écran et
// dialogue avec lui par postMessage (même origine uniquement).
export default function PlanEditorModal({
  name,
  layout,
  sections,
  locked,
  onSave,
  onClose,
}: {
  name: string;
  layout: RoomLayout | null;
  sections: SeatSection[];
  locked: Record<string, string>; // "numRangée:position" -> famille
  onSave: (layout: RoomLayout, sections: SeatSection[]) => Promise<string | null>; // message d'erreur ou null
  onClose: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const props = useRef({ name, layout, sections, locked, onSave, onClose });
  props.current = { name, layout, sections, locked, onSave, onClose };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    async function onMessage(ev: MessageEvent) {
      if (ev.origin !== window.location.origin || ev.source !== frame.current?.contentWindow || !ev.data) return;
      const post = (m: any) => frame.current?.contentWindow?.postMessage(m, window.location.origin);
      const p = props.current;
      if (ev.data.type === "plan-editor:ready") {
        post({ type: "plan-editor:load", name: p.name, layout: p.layout, sections: p.sections, locked: p.locked });
      } else if (ev.data.type === "plan-editor:save") {
        const sections = (ev.data.sections || []).map((s: any) => ({ id: s.id, name: s.name, price: s.price, rows: 0, seatsPerRow: 0 }));
        const err = await p.onSave(ev.data.layout, sections);
        post(err ? { type: "plan-editor:error", message: err } : { type: "plan-editor:saved" });
      } else if (ev.data.type === "plan-editor:close") {
        p.onClose();
      }
    }
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-white" role="dialog" aria-modal="true" aria-label="Éditeur du plan de salle">
      <iframe ref={frame} src="/plan-editor.html?app=1" title="Éditeur du plan de salle" className="w-full h-full border-0" />
    </div>
  );
}
