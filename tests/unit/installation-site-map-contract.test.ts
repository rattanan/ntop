import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Installation Site OpenStreetMap picker", () => {
  it("connects the map picker to controlled Latitude and Longitude fields", () => {
    const form = read("components/presales-forms.tsx");
    expect(form).toContain("<OpenStreetMapLocationPicker coordinates={coordinates} onCoordinatesChange={setCoordinates}");
    expect(form).toContain('name="latitude"');
    expect(form).toContain('name="longitude"');
    expect(form).toContain("value={coordinates.latitude}");
    expect(form).toContain("value={coordinates.longitude}");
  });

  it("provides an accessible dialog with explicit search and draggable marker", () => {
    const picker = read("components/openstreetmap-location-picker.tsx");
    expect(picker).toContain('aria-labelledby="installation-map-title"');
    expect(picker).toContain('aria-label="OpenStreetMap สำหรับเลือกพิกัด"');
    expect(picker).toContain("draggable: true");
    expect(picker).toContain('marker.on("dragend"');
    expect(picker).toContain('map.on("click"');
    expect(picker).toContain("Search Map");
    expect(picker).toContain("OpenStreetMap contributors");
    expect(picker).toContain("const NT_CHAENG_WATTHANA = { latitude: 13.88442, longitude: 100.57043 }");
    expect(picker).toContain("setView([latitude, longitude], 16)");
    expect(picker).toContain("if (submit) onChangeRef.current(draft)");
    expect(picker).toContain('onClick={() => close(true)}>Submit</button>');
    expect(picker).not.toContain('<form className="installation-map-search"');
    expect(picker).not.toContain("autocomplete");
  });

  it("keeps the coordinate inputs and map button aligned without a duplicate required marker", () => {
    const styles = read("app/globals.css");
    expect(styles).toContain(".installation-site-coordinates>label { min-width:0;margin-bottom:0; }");
    expect(styles).toContain(".installation-site-coordinates.field:has(:required)>label:first-child::after { content:none; }");
    expect(styles).toContain(".installation-site-coordinates .control,.installation-map-button { height:var(--input-height);min-height:var(--input-height); }");
  });

  it("proxies authenticated Nominatim searches with bounds, caching and rate limiting", () => {
    const route = read("app/api/v1/reference/places/route.ts");
    expect(route).toContain("getSession");
    expect(route).toContain("MIN_UPSTREAM_INTERVAL_MS = 1_100");
    expect(route).toContain("CACHE_TTL_MS");
    expect(route).toContain('limit: "5"');
    expect(route).toContain('"user-agent"');
    expect(route).toContain("OPENSTREETMAP_NOMINATIM_BASE_URL");
    expect(route).not.toContain("encodeURIComponent");
    expect(route).toContain("URLSearchParams");
  });
});
