import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PlanEvent } from "../types";
import { mapUrl } from "../lib/util";

// 날짜별 동선 지도 — Leaflet + OpenStreetMap (무료, API 키 불필요)
export function DayMap({ events }: { events: PlanEvent[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const spots = events.filter((e): e is PlanEvent & { geo: [number, number] } => !!e.geo);

  useEffect(() => {
    if (!ref.current || spots.length === 0) return;
    const map = L.map(ref.current, { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);

    const pts = spots.map((s) => L.latLng(s.geo[0], s.geo[1]));
    spots.forEach((s, i) => {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:26px;height:26px;border-radius:50%;background:var(--color-accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">${i + 1}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      L.marker(pts[i], { icon })
        .addTo(map)
        .bindPopup(
          `<b>${i + 1}. ${s.title.replace(/</g, "&lt;")}</b><br/><span style="color:#888;font-size:12px">${s.time}</span>` +
          (s.map ? `<br/><a href="${mapUrl(s.map)}" target="_blank" rel="noopener">네이버 지도에서 보기 ↗</a>` : "")
        );
    });
    L.polyline(pts, { color: "var(--color-accent)", weight: 3, opacity: 0.55, dashArray: "6 8" }).addTo(map);
    map.fitBounds(L.latLngBounds(pts).pad(0.18));

    return () => { map.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(spots.map((s) => s.geo))]);

  if (spots.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="mb-2 text-sm font-bold text-ink2">🗺️ 오늘의 동선</h3>
      <div ref={ref} className="h-64 w-full overflow-hidden rounded-xl border border-hairline" />
      <p className="mt-1.5 text-[0.7rem] text-muted">핀 위치는 대략적이에요. 정확한 위치는 핀을 눌러 네이버 지도로 확인하세요.</p>
    </div>
  );
}
