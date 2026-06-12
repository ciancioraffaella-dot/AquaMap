var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  getSupabase: () => getSupabase,
  mapToDB: () => mapToDB,
  mapToFountain: () => mapToFountain
});
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_supabase_js = require("@supabase/supabase-js");
var import_meta = {};
var ONE_WEEK = 7 * 24 * 60 * 60 * 1e3;
var supabaseClient = null;
function getSupabase() {
  if (supabaseClient) return supabaseClient;
  let url = void 0;
  let key = void 0;
  if (typeof process !== "undefined" && process.env && process.env.SUPABASE_URL) {
    url = process.env.SUPABASE_URL?.trim();
    key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();
  } else {
    try {
      url = import_meta.env?.VITE_SUPABASE_URL?.trim();
      key = import_meta.env?.VITE_SUPABASE_ANON_KEY?.trim();
    } catch (e) {
    }
  }
  if (!url || !key) {
    console.warn("Supabase credentials (SUPABASE_URL and SUPABASE_ANON_KEY) are missing in environment variables. Running in localized fallback mode.");
    return null;
  }
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    console.warn(`Supabase URL is invalid: "${url}". It must start with http:// or https://. Running in localized fallback mode.`);
    return null;
  }
  if (url.includes("your-") || url.includes("placeholder") || url.includes("insert_your_")) {
    console.warn(`Supabase URL is utilizing a placeholder: "${url}". Please configure it with your actual Supabase URL. Running in localized fallback mode.`);
    return null;
  }
  try {
    supabaseClient = (0, import_supabase_js.createClient)(url, key);
    return supabaseClient;
  } catch (err) {
    console.warn("Failed to initialize Supabase client:", err.message || err);
    return null;
  }
}
function mapToDB(f) {
  return {
    id: String(f.id),
    name: f.name || "Fontanella",
    lat: Number(f.lat),
    lng: Number(f.lng),
    address: f.address || "",
    status: f.status || "working",
    water_type: f.waterType || "potabile",
    description: f.description || "",
    added_by: f.addedBy || "Esploratore",
    rating: Number(f.rating || 3),
    photos: Array.isArray(f.photos) ? f.photos : [],
    reports: Array.isArray(f.reports) ? f.reports : [],
    created_at: f.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
    city: f.city || "Altro",
    water_flow_rate: f.waterFlowRate || null,
    has_filter: f.hasFilter !== void 0 ? !!f.hasFilter : false,
    is_osm: f.isOsm !== void 0 ? !!f.isOsm : false
  };
}
function mapToFountain(db) {
  return {
    id: db.id,
    name: db.name,
    lat: Number(db.lat),
    lng: Number(db.lng),
    address: db.address,
    status: db.status,
    waterType: db.water_type,
    description: db.description,
    addedBy: db.added_by,
    rating: Number(db.rating || 3),
    photos: Array.isArray(db.photos) ? db.photos : [],
    reports: Array.isArray(db.reports) ? db.reports : [],
    createdAt: db.created_at,
    city: db.city,
    waterFlowRate: db.water_flow_rate || void 0,
    hasFilter: !!db.has_filter,
    isOsm: !!db.is_osm
  };
}
function printSupabaseSchemaGuideline() {
  console.log(`
============================================================
SUGGESTED SUPABASE TABELLA SCHEMA (DUE TABELLE SEPARATE):
Copia ed esegui questa query SQL nell'editor SQL di Supabase:

-- 1. Tabella per le fontanelle proveniente da OpenStreetMap (OSM)
CREATE TABLE IF NOT EXISTS public.fontanelle_osm (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    address text NOT NULL,
    status text NOT NULL DEFAULT 'working',
    water_type text NOT NULL DEFAULT 'potabile',
    description text NOT NULL DEFAULT '',
    added_by text NOT NULL DEFAULT 'OpenStreetMap',
    rating double precision NOT NULL DEFAULT 3.0,
    photos jsonb NOT NULL DEFAULT '[]'::jsonb,
    reports jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at text NOT NULL,
    city text NOT NULL,
    water_flow_rate text,
    has_filter boolean DEFAULT false,
    is_osm boolean DEFAULT true
);

-- 2. Tabella per le fontanelle inserite dagli utenti
CREATE TABLE IF NOT EXISTS public.fontanelle_utente (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    address text NOT NULL,
    status text NOT NULL DEFAULT 'working',
    water_type text NOT NULL DEFAULT 'potabile',
    description text NOT NULL DEFAULT '',
    added_by text NOT NULL DEFAULT 'Esploratore',
    rating double precision NOT NULL DEFAULT 3.0,
    photos jsonb NOT NULL DEFAULT '[]'::jsonb,
    reports jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at text NOT NULL,
    city text NOT NULL,
    water_flow_rate text,
    has_filter boolean DEFAULT false,
    is_osm boolean DEFAULT false
);

-- Abilita il Row Level Security (RLS) su entrambe le tabelle
ALTER TABLE public.fontanelle_osm ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fontanelle_utente ENABLE ROW LEVEL SECURITY;

-- Crea le policy di accesso pubblico (Lettura e Scrittura aperte) per entrambe le tabelle
CREATE POLICY "Allow public read access to OSM" ON public.fontanelle_osm FOR SELECT USING (true);
CREATE POLICY "Allow public all to OSM" ON public.fontanelle_osm FOR ALL USING (true);

CREATE POLICY "Allow public read access to Utente" ON public.fontanelle_utente FOR SELECT USING (true);
CREATE POLICY "Allow public all to Utente" ON public.fontanelle_utente FOR ALL USING (true);
============================================================
`);
}
async function syncOsmToSupabase() {
  console.log("Starting active OSM query synchronization for global drinking fountains...");
  const areas = [
    { name: "Milano", query: 'relation["name"="Milano"]["admin_level"="8"]' },
    { name: "Roma", query: 'relation["name"="Roma"]["admin_level"="8"]' },
    { name: "Paris", query: 'relation["name"="Paris"]["admin_level"="6"]' },
    { name: "London", query: 'relation["name"="London"]["admin_level"="8"]' },
    { name: "New York", query: 'relation["name"="New York City"]["admin_level"="5"]' }
  ];
  const features = [];
  for (const area of areas) {
    try {
      console.log(`Fetching fountains for area: ${area.name}`);
      const queryStr = `
        [out:json][timeout:90];
        ${area.query}->.searchArea;
        node["amenity"="drinking_water"](area.searchArea);
        out body;
      `;
      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(queryStr)}`;
      const res = await fetch(url, {
        headers: { "User-Agent": `AquaMapWorldApplication/4.0` }
      });
      if (res.ok) {
        const osmData = await res.json();
        const elementFeatures = (osmData.elements || []).filter((el) => el.type === "node").map((el) => ({
          type: "Feature",
          properties: {
            "@id": `node/${el.id}`,
            "amenity": "drinking_water",
            "name": el.tags?.name || el.tags?.description || `Fontanella a ${area.name}`,
            "city": area.name,
            ...el.tags
          },
          geometry: {
            type: "Point",
            coordinates: [el.lon, el.lat]
          },
          id: `node-${el.id}`
        }));
        features.push(...elementFeatures);
        console.log(`Loaded ${elementFeatures.length} fountains for ${area.name}`);
      } else {
        console.error(`Overpass failed for ${area.name} with status ${res.status}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 3e3));
    } catch (err) {
      console.error(`Error querying OSM for ${area.name}:`, err);
    }
  }
  if (features.length > 0) {
    const supabase = getSupabase();
    if (supabase) {
      console.log(`Synchronizing ${features.length} fountains directly to Supabase table 'fontanelle_osm'...`);
      const dbFountains = features.map((feature) => {
        const lat = feature.geometry.coordinates[1];
        const lng = feature.geometry.coordinates[0];
        const safeId = feature.id.replace(/\//g, "-");
        return mapToDB({
          id: safeId,
          name: feature.properties.name || feature.properties.description || "Fontanella",
          lat,
          lng,
          address: feature.properties.address || feature.properties["addr:street"] || "Dati da OpenStreetMap",
          status: "working",
          waterType: "potabile",
          description: feature.properties.description || "Dati provenienti da OpenStreetMap",
          addedBy: "OpenStreetMap",
          rating: 3,
          photos: [],
          reports: [],
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          city: feature.properties.city || areaNameFromFeature(feature) || "Milano",
          isOsm: true
        });
      });
      const chunkSize = 100;
      let succeededCount = 0;
      for (let i = 0; i < dbFountains.length; i += chunkSize) {
        const chunk = dbFountains.slice(i, i + chunkSize);
        const { error } = await supabase.from("fontanelle_osm").upsert(chunk, { onConflict: "id" });
        if (error) {
          console.error(`Error syncing chunk ${i / chunkSize} to Supabase fontanelle_osm:`, error.message || error);
        } else {
          succeededCount += chunk.length;
        }
      }
      console.log(`Supabase OSM synchronization success: ${succeededCount}/${dbFountains.length} fountains saved to fontanelle_osm.`);
    }
  } else {
    console.log("No features resolved during Overpass API sync trigger.");
  }
}
function areaNameFromFeature(feature) {
  if (feature.properties.city) return feature.properties.city;
  const name = feature.properties.name || "";
  if (name.includes("Milano")) return "Milano";
  if (name.includes("Roma")) return "Roma";
  if (name.includes("Paris")) return "Paris";
  if (name.includes("London")) return "London";
  if (name.includes("New York")) return "New York";
  return "Milano";
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "10mb" }));
  printSupabaseSchemaGuideline();
  app.get("/api/reverse-geocode", async (req, res) => {
    try {
      const { lat, lng } = req.query;
      if (!lat || !lng) {
        return res.status(400).json({ error: "Missing lat or lng" });
      }
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=it`;
      const response = await fetch(url, {
        headers: { "User-Agent": "AquaMapWorldApplication/4.0 (ciancio.raffaella@gmail.com)" }
      });
      if (response.ok) {
        const data = await response.json();
        res.json(data);
      } else {
        res.status(response.status).json({ error: `Nominatim status: ${response.status}` });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/fountains", async (req, res) => {
    const supabase = getSupabase();
    if (supabase) {
      try {
        console.log("Fetching latest fountains from Supabase tables (fontanelle_osm, fontanelle_utente)...");
        const [osmResult, utenteResult] = await Promise.all([
          supabase.from("fontanelle_osm").select("*"),
          supabase.from("fontanelle_utente").select("*")
        ]);
        if (!osmResult.error || !utenteResult.error) {
          const osmFountains = (osmResult.data || []).map((record) => mapToFountain(record));
          const utenteFountains = (utenteResult.data || []).map((record) => mapToFountain(record));
          return res.json([...osmFountains, ...utenteFountains]);
        }
        if (osmResult.error) console.warn("Supabase fontanelle_osm fetch error:", osmResult.error.message);
        if (utenteResult.error) console.warn("Supabase fontanelle_utente fetch error:", utenteResult.error.message);
      } catch (err) {
        console.error("Exception while fetching from Supabase:", err.message || err);
      }
    }
    return res.json([]);
  });
  app.get("/api/fountains/osm", async (req, res) => {
    const supabase = getSupabase();
    if (supabase) {
      try {
        console.log("Fetching OSM fountains from Supabase table (fontanelle_osm)...");
        const { data, error } = await supabase.from("fontanelle_osm").select("*");
        if (!error && data) {
          const fountains = data.map((record) => mapToFountain(record));
          return res.json(fountains);
        }
      } catch (err) {
        console.error("Exception while fetching OSM fountains from Supabase:", err.message || err);
      }
    }
    return res.json([]);
  });
  app.post("/api/fountains", async (req, res) => {
    const newFountain = req.body;
    if (!newFountain || !newFountain.id) {
      return res.status(400).json({ error: "Missing fountain object or id" });
    }
    const supabase = getSupabase();
    if (supabase) {
      try {
        const dbRecord = mapToDB(newFountain);
        const { data, error } = await supabase.from("fontanelle_utente").upsert(dbRecord).select("*").single();
        if (error) {
          console.error("Error inserting custom fountain into Supabase fontanelle_utente:", error.message);
          return res.status(500).json({ error: error.message });
        }
        if (data) {
          return res.json(mapToFountain(data));
        }
      } catch (err) {
        console.error("Supabase write exception:", err);
        return res.status(500).json({ error: err.message });
      }
    }
    res.json(newFountain);
  });
  app.post("/api/fountains/:id/reports", async (req, res) => {
    const { id } = req.params;
    const { type, comment, statusAfter, rating, photo } = req.body;
    const supabase = getSupabase();
    if (supabase) {
      try {
        const targetTable = id.startsWith("node-") ? "fontanelle_osm" : "fontanelle_utente";
        const { data: records, error: getErr } = await supabase.from(targetTable).select("*").eq("id", id);
        if (getErr || !records || records.length === 0) {
          return res.status(404).json({ error: `Fountain not found in Supabase table ${targetTable}` });
        }
        const dbRecord = records[0];
        const fountain = mapToFountain(dbRecord);
        const newReport = {
          id: `r-${Date.now()}`,
          type,
          comment,
          statusBefore: fountain.status,
          statusAfter,
          photoUrl: photo || void 0,
          user: "Tu (Esploratore)",
          userAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          rating: rating || void 0
        };
        const updatedReports = [newReport, ...fountain.reports];
        const ratedLogs = updatedReports.filter((r) => r.rating !== void 0);
        const aggregatedRating = ratedLogs.length > 0 ? ratedLogs.reduce((acc, curr) => acc + (curr.rating || 0), 0) / ratedLogs.length : fountain.rating;
        const updatedPhotos = photo ? [photo, ...fountain.photos] : fountain.photos;
        const updatedFountain = {
          ...fountain,
          status: statusAfter,
          rating: Number(aggregatedRating.toFixed(1)),
          photos: updatedPhotos,
          reports: updatedReports
        };
        const updatedRecord = mapToDB(updatedFountain);
        const { data: finalRecord, error: putErr } = await supabase.from(targetTable).upsert(updatedRecord).select("*").single();
        if (putErr) {
          return res.status(500).json({ error: putErr.message });
        }
        return res.json(mapToFountain(finalRecord));
      } catch (err) {
        console.error("Supabase exception in report endpoint:", err);
        return res.status(500).json({ error: err.message });
      }
    }
    res.status(400).json({ error: "Supabase not connected, updates can only be saved in client's local states." });
  });
  app.post("/api/fountains/refresh-osm", async (req, res) => {
    try {
      console.log("Manual OSM refresh requested...");
      await syncOsmToSupabase();
      res.json({ success: true, message: "OSM features synced and updated successfully!" });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getSupabase,
  mapToDB,
  mapToFountain
});
//# sourceMappingURL=server.cjs.map
