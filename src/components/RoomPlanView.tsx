"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Maximize2 } from "lucide-react";
import { layoutSeats, type LayoutSeat, type RoomLayout } from "@/lib/roomLayout";

// Plan de salle dessiné, en lecture : murs, éléments (Aron, téva, portes…)
// et places cliquables. L'appelant donne l'apparence de chaque place.
// Zoom : sur ordinateur, le plan tient dans la largeur. Sur écran tactile, il
// s'ouvre agrandi (places d'au moins 28 px, au lieu de 15 à 20 px ajustées à un
// téléphone) et défile dans son cadre ; les boutons − / + / Vue d'ensemble
// changent l'échelle.
export interface SeatLook {
  fill: string;
  stroke: string;
  text: string;
  textColor: string;
  title: string;
  ring?: boolean;
}

const EL: Record<string, { fill: string; stroke: string; color: string }> = {
  aron: { fill: "#efe3c8", stroke: "#b08d57", color: "#1f2937" },
  estrade: { fill: "#f1ede4", stroke: "#6b7280", color: "#1f2937" },
  teva: { fill: "#efe3c8", stroke: "#8a6d3b", color: "#1f2937" },
  porte: { fill: "#d4af37", stroke: "#8a6d3b", color: "#7a5c24" },
  secours: { fill: "#16a34a", stroke: "#14532d", color: "#15803d" },
  pilier: { fill: "#9ca3af", stroke: "#4b5563", color: "#1f2937" },
  zone: { fill: "#eef2e6", stroke: "#8a9a74", color: "#5f6f48" },
  autre: { fill: "#e5e7eb", stroke: "#6b7280", color: "#1f2937" },
};

export default function RoomPlanView({
  layout,
  look,
  onSeat,
}: {
  layout: RoomLayout;
  look: (s: LayoutSeat) => SeatLook;
  onSeat?: (s: LayoutSeat) => void;
}) {
  const seats = useMemo(() => layoutSeats(layout), [layout]);
  const box = useMemo(() => {
    const xs = layout.walls.map((p) => p[0]);
    const ys = layout.walls.map((p) => p[1]);
    for (const e of layout.elements) xs.push(e.x, e.x + e.w), ys.push(e.y, e.y + e.h);
    for (const s of seats) xs.push(s.x, s.x + s.w), ys.push(s.y, s.y + s.h);
    const m = 30;
    const x = Math.min(...xs) - m, y = Math.min(...ys) - m;
    return { x, y, w: Math.max(...xs) + m - x, h: Math.max(...ys) + m - y };
  }, [layout, seats]);
  const labels = useMemo(
    () =>
      layout.rows.map((r) => {
        const rs = seats.filter((s) => s.rowNum === r.num);
        if (!rs.length) return null;
        const first = rs[0], lastS = rs[rs.length - 1];
        const end = r.lab === "end";
        if (r.dir === "h") {
          const s = end ? lastS : first;
          return { key: r.id, text: r.letter, x: end ? s.x + s.w + 7 : s.x - 7, y: s.y + s.h / 2 + 4.5, anchor: end ? "start" : "end" };
        }
        const s = end ? lastS : first;
        return { key: r.id, text: r.letter, x: s.x + s.w / 2, y: end ? s.y + s.h + 15 : s.y - 7, anchor: "middle" };
      }),
    [layout, seats]
  );
  const wallPath = "M" + layout.walls.map((p) => p.join(" ")).join(" L") + " Z";

  // Échelle en pixels par unité du plan ; null = ajusté à la largeur du cadre.
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [touch, setTouch] = useState(false);
  const minSeat = useMemo(() => (seats.length ? Math.min(...seats.map((s) => Math.min(s.w, s.h))) : 20), [seats]);
  const fitScale = () => (wrap.current ? wrap.current.clientWidth / box.w : 1);
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    setTouch(coarse);
    if (coarse) {
      const comfy = 28 / minSeat;
      setScale(comfy > fitScale() ? comfy : null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minSeat, box.w]);
  const zoom = (f: number) => {
    const cur = scale ?? fitScale();
    const next = Math.min(Math.max(cur * f, fitScale()), 48 / minSeat);
    setScale(next <= fitScale() + 0.001 ? null : next);
  };
  const width = scale ? Math.round(box.w * scale) : undefined;
  // Plan agrandi : on centre la vue (Aron et téva au milieu), pas le bord gauche.
  useEffect(() => {
    const el = wrap.current;
    if (el && width) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [width]);

  return (
    <div className="space-y-2">
      {(touch || scale) && (
        <div className="flex items-center justify-end gap-2 print:hidden">
          <span className="text-xs text-gray-500 mr-auto">{scale ? "Glissez pour parcourir le plan." : ""}</span>
          <button type="button" className="btn-secondary px-3 min-w-[44px] justify-center" onClick={() => zoom(1 / 1.3)} disabled={!scale} aria-label="Réduire le plan">
            <Minus className="w-5 h-5 text-ink" aria-hidden />
          </button>
          <button type="button" className="btn-secondary px-3 min-w-[44px] justify-center" onClick={() => zoom(1.3)} disabled={!!scale && scale >= 48 / minSeat - 0.001} aria-label="Agrandir le plan">
            <Plus className="w-5 h-5 text-ink" aria-hidden />
          </button>
          <button type="button" className="btn-secondary px-3 min-w-[44px] justify-center" onClick={() => setScale(null)} disabled={!scale} aria-label="Vue d'ensemble du plan">
            <Maximize2 className="w-5 h-5 text-ink" aria-hidden />
          </button>
        </div>
      )}
      <div ref={wrap} className="overflow-x-auto overscroll-x-contain">
    <svg
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      className={`${width ? "max-w-none" : "w-full h-auto max-h-[85vh]"} select-none block`}
      width={width}
      height={width ? Math.round(box.h * (scale as number)) : undefined}
      role="group"
      aria-label="Plan de la salle"
      style={{ fontFamily: "Montserrat, Arial, sans-serif" }}
    >
      {layout.elements.filter((e) => e.type === "zone").map((e) => (
        <g key={e.id}>
          <rect x={e.x} y={e.y} width={e.w} height={e.h} fill={EL.zone.fill} stroke={EL.zone.stroke} strokeDasharray="6 4" />
          <text x={e.x + e.w / 2} y={e.y + e.h / 2} fontSize={12} textAnchor="middle" fontWeight={700} fill={EL.zone.color}>{e.name}</text>
        </g>
      ))}
      <path d={wallPath} fill="#faf7f0" stroke="#374151" strokeWidth={5} strokeLinejoin="miter" />
      {layout.elements.filter((e) => e.type !== "zone").map((e) => {
        const c = EL[e.type] || EL.autre;
        const thin = Math.min(e.w, e.h) < 24;
        const fs = thin ? 11 : Math.max(9, Math.min(14, e.h / 4, e.w / 8));
        let tx = e.x + e.w / 2, ty = e.y + e.h / 2 + fs / 3, anchor: "middle" | "end" = "middle";
        if (thin) {
          if (e.w >= e.h) ty = e.y > 30 ? e.y - 6 : e.y + e.h + 14;
          else (tx = e.x - 6), (anchor = "end");
        }
        return (
          <g key={e.id}>
            <rect x={e.x} y={e.y} width={e.w} height={e.h} fill={c.fill} stroke={c.stroke} strokeWidth={thin ? 1 : 2} />
            <text x={tx} y={ty} fontSize={fs} textAnchor={anchor} fontWeight={700} fill={c.color} paintOrder="stroke" stroke="#faf7f0" strokeWidth={thin ? 3 : 0}>{e.name}</text>
          </g>
        );
      })}
      {labels.map((l) => l && (
        <text key={l.key} x={l.x} y={l.y} fontSize={13} fontWeight={700} textAnchor={l.anchor as any} fill="#8a6d3b">{l.text}</text>
      ))}
      {seats.map((s) => {
        const lk = look(s);
        const fs = Math.min(10, s.w * 0.4, s.h * 0.45) * (lk.text.length > 3 ? 0.75 : 1);
        return (
          <g
            key={`${s.rowNum}:${s.k}`}
            role={onSeat ? "button" : undefined}
            tabIndex={onSeat ? 0 : undefined}
            aria-label={lk.title}
            onClick={() => onSeat?.(s)}
            onKeyDown={(e) => {
              if (onSeat && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onSeat(s);
              }
            }}
            className={onSeat ? "cursor-pointer focus:outline-none [&:focus>rect]:stroke-[3]" : undefined}
          >
            <title>{lk.title}</title>
            <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={4} fill={lk.fill} stroke={lk.ring ? "#14233d" : lk.stroke} strokeWidth={lk.ring ? 3 : 1.5} />
            <text x={s.x + s.w / 2} y={s.y + s.h / 2 + 3.5} fontSize={fs} textAnchor="middle" fontWeight={700} fill={lk.textColor} pointerEvents="none">{lk.text}</text>
          </g>
        );
      })}
    </svg>
      </div>
    </div>
  );
}
