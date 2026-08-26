"use client";

import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { LoaderCircle, MapPin, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Coordinates = { latitude: string; longitude: string };
type Place = { id: string; label: string; latitude: number; longitude: number };

const BANGKOK = { latitude: 13.7563, longitude: 100.5018 };
const TILE_URL = process.env.NEXT_PUBLIC_OPENSTREETMAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

function numeric(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatted(value: number) {
  return value.toFixed(7);
}

export function OpenStreetMapLocationPicker({ coordinates, onCoordinatesChange }: { coordinates: Coordinates; onCoordinatesChange: (coordinates: Coordinates) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const originalRef = useRef<Coordinates>(coordinates);
  const onChangeRef = useRef(onCoordinatesChange);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedPlace, setSelectedPlace] = useState("");
  const [draft, setDraft] = useState<Coordinates>(coordinates);

  useEffect(() => { onChangeRef.current = onCoordinatesChange; }, [onCoordinatesChange]);

  const updateCoordinates = useCallback((latitude: number, longitude: number) => {
    const next = { latitude: formatted(latitude), longitude: formatted(longitude) };
    setDraft(next);
    onChangeRef.current(next);
  }, []);

  useEffect(() => {
    if (!open || !containerRef.current) return;
    let disposed = false;
    void import("leaflet").then((leaflet) => {
      if (disposed || !containerRef.current) return;
      const latitude = numeric(originalRef.current.latitude, BANGKOK.latitude);
      const longitude = numeric(originalRef.current.longitude, BANGKOK.longitude);
      const map = leaflet.map(containerRef.current, { zoomControl: true }).setView([latitude, longitude], originalRef.current.latitude && originalRef.current.longitude ? 16 : 11);
      leaflet.tileLayer(TILE_URL, { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' }).addTo(map);
      const icon = leaflet.divIcon({ className: "installation-map-marker", html: '<span aria-hidden="true"></span>', iconSize: [34, 44], iconAnchor: [17, 42] });
      const marker = leaflet.marker([latitude, longitude], { draggable: true, autoPan: true, keyboard: true, title: "ตำแหน่ง Installation Site", alt: "หมุดตำแหน่ง Installation Site", icon }).addTo(map);
      marker.on("dragend", () => { const point = marker.getLatLng(); updateCoordinates(point.lat, point.lng); });
      map.on("click", (event) => { marker.setLatLng(event.latlng); updateCoordinates(event.latlng.lat, event.latlng.lng); });
      mapRef.current = map;
      markerRef.current = marker;
      window.setTimeout(() => map.invalidateSize(), 0);
    });
    return () => {
      disposed = true;
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [open, updateCoordinates]);

  const show = () => {
    originalRef.current = coordinates;
    setDraft({
      latitude: formatted(numeric(coordinates.latitude, BANGKOK.latitude)),
      longitude: formatted(numeric(coordinates.longitude, BANGKOK.longitude)),
    });
    setMessage("");
    setSelectedPlace("");
    setOpen(true);
    dialogRef.current?.showModal();
  };

  const close = (restore: boolean) => {
    onChangeRef.current(restore ? originalRef.current : draft);
    dialogRef.current?.close();
    setOpen(false);
  };

  const searchPlace = async () => {
    const term = query.trim();
    if (term.length < 2) { setMessage("กรุณาระบุชื่อสถานที่อย่างน้อย 2 ตัวอักษร"); return; }
    setPending(true); setMessage(""); setSelectedPlace("");
    try {
      const response = await fetch(`/api/v1/reference/places?q=${encodeURIComponent(term)}`);
      const payload = await response.json() as { data?: Place[]; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "ไม่สามารถค้นหาสถานที่ได้");
      const place = payload.data?.[0];
      if (!place) { setMessage("ไม่พบสถานที่ กรุณาลองระบุจังหวัดหรือประเทศเพิ่มเติม"); return; }
      setSelectedPlace(place.label);
      updateCoordinates(place.latitude, place.longitude);
      markerRef.current?.setLatLng([place.latitude, place.longitude]);
      mapRef.current?.setView([place.latitude, place.longitude], 17);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ไม่สามารถค้นหาสถานที่ได้");
    } finally { setPending(false); }
  };

  return <>
    <button type="button" className="secondary installation-map-button" onClick={show}><MapPin aria-hidden="true"/>เปิด Map</button>
    <dialog ref={dialogRef} className="installation-map-dialog" aria-labelledby="installation-map-title" onCancel={(event) => { event.preventDefault(); close(true); }} onClose={() => setOpen(false)}>
      <div className="installation-map-head"><div><strong id="installation-map-title">เลือกตำแหน่ง Installation Site</strong><small>ค้นหาสถานที่ คลิกบนแผนที่ หรือลากหมุดเพื่อปรับพิกัด</small></div><button type="button" className="dialog-close" aria-label="ปิดหน้าต่างและยกเลิกการเปลี่ยนพิกัด" onClick={() => close(true)}><X aria-hidden="true"/></button></div>
      <div className="installation-map-body">
        <div className="installation-map-search"><label htmlFor="installation-place-search">ชื่อสถานที่สำคัญ</label><div><input id="installation-place-search" className="control" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchPlace(); } }} placeholder="เช่น ศูนย์ราชการแจ้งวัฒนะ" autoComplete="off"/><button type="button" className="primary" disabled={pending} onClick={() => void searchPlace()}>{pending?<LoaderCircle className="spin" aria-hidden="true"/>:<Search aria-hidden="true"/>}{pending?"กำลังค้นหา":"Search Map"}</button></div></div>
        <div ref={containerRef} className="installation-map-canvas" role="application" aria-label="OpenStreetMap สำหรับเลือกพิกัด"/>
        <div className="installation-map-result" aria-live="polite"><div><span>Latitude</span><strong>{draft.latitude || formatted(BANGKOK.latitude)}</strong></div><div><span>Longitude</span><strong>{draft.longitude || formatted(BANGKOK.longitude)}</strong></div></div>
        {selectedPlace&&<p className="installation-map-place"><MapPin aria-hidden="true"/>{selectedPlace}</p>}
        {message&&<p className="notice installation-map-message">{message}</p>}
        <p className="help">ใช้เฉพาะชื่อสถานที่สาธารณะ ห้ามส่งข้อมูลส่วนบุคคลหรือข้อมูลลับไปยังบริการค้นหาภายนอก</p>
      </div>
      <div className="installation-map-actions"><button type="button" className="secondary" onClick={() => close(true)}>ยกเลิก</button><button type="button" className="primary" onClick={() => close(false)}>ใช้พิกัดนี้</button></div>
    </dialog>
  </>;
}
