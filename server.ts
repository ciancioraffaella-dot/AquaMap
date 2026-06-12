import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

let cachedOsmData: any = null;
let lastCacheUpdate: number = 0;
const AQUAMAP_FILE = "aquamap.json";
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000; // 1 week

// Setup Lazy-Initialized Supabase client
let supabaseClient: any = null;

export function getSupabase() {
  if (supabaseClient) return supabaseClient;
  
  let url: string | undefined = undefined;
  let key: string | undefined = undefined;

  // Se il codice runna su AI Studio
  if (typeof process !== "undefined" && process.env && process.env.SUPABASE_URL) {
    url = process.env.SUPABASE_URL?.trim();
    key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();
  } else {
    // Se il codice runna su GitHub Pages / Vite
    try {
      url = (import.meta as any).env?.VITE_SUPABASE_URL?.trim();
      key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY?.trim();
    } catch (e) {
      // Fallback
    }
  }
  
  if (!url || !key) {
    console.warn("Supabase credentials (SUPABASE_URL and SUPABASE_ANON_KEY) are missing in environment variables. Running in localized fallback mode.");
    return null;
  }

  // Pre-validate that it is a valid HTTP or HTTPS URL
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    console.warn(`Supabase URL is invalid: "${url}". It must start with http:// or https://. Running in localized fallback mode.`);
    return null;
  }

  // Check if it's a known generic placeholder
  if (url.includes("your-") || url.includes("placeholder") || url.includes("insert_your_")) {
    console.warn(`Supabase URL is utilizing a placeholder: "${url}". Please configure it with your actual Supabase URL. Running in localized fallback mode.`);
    return null;
  }
  
  try {
    supabaseClient = createClient(url, key);
    return supabaseClient;
  } catch (err: any) {
    console.warn("Failed to initialize Supabase client:", err.message || err);
    return null;
  }
}

// Map camelCase to PostgreSQL snake_case columns
export interface DBFountain {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  status: string;
  water_type: string;
  description: string;
  added_by: string;
  rating: number;
  photos: string[];
  reports: any[];
  created_at: string;
  city: string;
  water_flow_rate?: string | null;
  has_filter?: boolean | null;
  is_osm?: boolean | null;
}

export function mapToDB(f: any): DBFountain {
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
    rating: Number(f.rating || 3.0),
    photos: Array.isArray(f.photos) ? f.photos : [],
    reports: Array.isArray(f.reports) ? f.reports : [],
    created_at: f.createdAt || new Date().toISOString(),
    city: f.city || "Altro",
    water_flow_rate: f.waterFlowRate || null,
    has_filter: f.hasFilter !== undefined ? !!f.hasFilter : false,
    is_osm: f.isOsm !== undefined ? !!f.isOsm : false,
  };
}

export function mapToFountain(db: DBFountain) {
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
    rating: Number(db.rating || 3.0),
    photos: Array.isArray(db.photos) ? db.photos : [],
    reports: Array.isArray(db.reports) ? db.reports : [],
    createdAt: db.created_at,
    city: db.city,
    waterFlowRate: db.water_flow_rate || undefined,
    hasFilter: !!db.has_filter,
    isOsm: !!db.is_osm,
  };
}

// Print database schema helper for Supabase users
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
    { name: 'Milano', query: 'relation["name"="Milano"]["admin_level"="8"]' },
    { name: 'Roma', query: 'relation["name"="Roma"]["admin_level"="8"]' },
    { name: 'Paris', query: 'relation["name"="Paris"]["admin_level"="6"]' },
    { name: 'London', query: 'relation["name"="London"]["admin_level"="8"]' },
    { name: 'New York', query: 'relation["name"="New York City"]["admin_level"="5"]' }
  ];

  const features: any[] = [];

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
        headers: { 'User-Agent': `AquaMapWorldApplication/4.0` }
      });
      if (res.ok) {
        const osmData = await res.json();
        const elementFeatures = (osmData.elements || [])
          .filter((el: any) => el.type === 'node')
          .map((el: any) => ({
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
      
      // Delay to respect OSM Overpass rate limits
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (err) {
      console.error(`Error querying OSM for ${area.name}:`, err);
    }
  }

  if (features.length > 0) {
    // Dynamic synchronization with Supabase Table 'fontanelle_osm'
    const supabase = getSupabase();
    if (supabase) {
      console.log(`Synchronizing ${features.length} fountains directly to Supabase table 'fontanelle_osm'...`);
      const dbFountains = features.map(feature => {
        const lat = feature.geometry.coordinates[1];
        const lng = feature.geometry.coordinates[0];
        const safeId = feature.id.replace(/\//g, "-");
        
        return mapToDB({
          id: safeId,
          name: feature.properties.name || feature.properties.description || "Fontanella",
          lat: lat,
          lng: lng,
          address: feature.properties.address || feature.properties['addr:street'] || "Dati da OpenStreetMap",
          status: "working",
          waterType: "potabile",
          description: feature.properties.description || "Dati provenienti da OpenStreetMap",
          addedBy: "OpenStreetMap",
          rating: 3.0,
          photos: [],
          reports: [],
          createdAt: new Date().toISOString(),
          city: feature.properties.city || areaNameFromFeature(feature) || "Milano",
          isOsm: true
        });
      });

      // Chunk upserts in batches of 100
      const chunkSize = 100;
      let succeededCount = 0;
      for (let i = 0; i < dbFountains.length; i += chunkSize) {
        const chunk = dbFountains.slice(i, i + chunkSize);
        const { error } = await supabase
          .from("fontanelle_osm")
          .upsert(chunk, { onConflict: "id" });
        
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

function areaNameFromFeature(feature: any): string {
  if (feature.properties.city) return feature.properties.city;
  const name = feature.properties.name || "";
  if (name.includes("Milano")) return "Milano";
  if (name.includes("Roma")) return "Roma";
  if (name.includes("Paris")) return "Paris";
  if (name.includes("London")) return "London";
  if (name.includes("New York")) return "New York";
  return "Milano";
}

async function seedExistingAquamapAndCleanup() {
  if (!fs.existsSync(AQUAMAP_FILE)) {
    console.log("No aquamap.json found to seed. Relying entirely on Supabase database tables.");
    return;
  }

  const supabase = getSupabase();
  if (!supabase) {
    console.warn("Supabase credentials missing during startup. Please configure SUPABASE_URL and SUPABASE_ANON_KEY first.");
    return;
  }

  try {
    console.log("Reading existing static file 'aquamap.json' to seed Supabase 'fontanelle_osm' table...");
    const rawData = fs.readFileSync(AQUAMAP_FILE, "utf-8");
    const geojson = JSON.parse(rawData);
    const features = geojson.features || [];

    if (features.length === 0) {
      console.log("Empty aquamap.json found, skipping seeding.");
      return;
    }

    console.log(`Mapping ${features.length} features of aquamap.json to database structures...`);
    const dbFountains = features.map((feature: any) => {
      const lat = feature.geometry.coordinates[1];
      const lng = feature.geometry.coordinates[0];
      const safeId = feature.id.replace(/\//g, "-");
      
      return mapToDB({
        id: safeId,
        name: feature.properties.name || feature.properties.description || "Fontanella",
        lat: lat,
        lng: lng,
        address: feature.properties.address || feature.properties['addr:street'] || "Dati da OpenStreetMap",
        status: "working",
        waterType: "potabile",
        description: feature.properties.description || "Dati provenienti da OpenStreetMap",
        addedBy: "OpenStreetMap",
        rating: 3.0,
        photos: [],
        reports: [],
        createdAt: new Date().toISOString(),
        city: feature.properties.city || "Milano",
        isOsm: true
      });
    });

    console.log(`Upserting ${dbFountains.length} fountains into 'fontanelle_osm' in chunks of 50...`);
    const chunkSize = 50;
    let succeededCount = 0;
    for (let i = 0; i < dbFountains.length; i += chunkSize) {
      const chunk = dbFountains.slice(i, i + chunkSize);
      const { error } = await supabase
        .from("fontanelle_osm")
        .upsert(chunk, { onConflict: "id" });
      
      if (error) {
        console.error(`Error seeding chunk ${i / chunkSize} into Supabase 'fontanelle_osm':`, error.message || error);
        throw new Error(`Seeding failed at chunk ${i / chunkSize}: ${error.message}`);
      } else {
        succeededCount += chunk.length;
      }
    }

    console.log(`SUCCESS: Seeded ${succeededCount} fountains into Supabase!`);
    console.log(`Deleting local static fallback file '${AQUAMAP_FILE}' as requested...`);
    fs.unlinkSync(AQUAMAP_FILE);
    console.log(`Local static file '${AQUAMAP_FILE}' removed successfully!`);
  } catch (err: any) {
    console.error("Failed seeding or deleting during startup. Keeping local file for safety. Error:", err.message || err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support JSON bodies up to 10MB (for custom image base64 report transfers)
  app.use(express.json({ limit: '10mb' }));

  // Print helpful schema on boot
  printSupabaseSchemaGuideline();

  // Run startup database seed check and cleanup
  await seedExistingAquamapAndCleanup();

  // API reverse geocode proxy
  app.get("/api/reverse-geocode", async (req, res) => {
    try {
      const { lat, lng } = req.query;
      if (!lat || !lng) {
        return res.status(400).json({ error: "Missing lat or lng" });
      }
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=it`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'AquaMapWorldApplication/4.0 (ciancio.raffaella@gmail.com)' }
      });
      if (response.ok) {
        const data = await response.json();
        res.json(data);
      } else {
        res.status(response.status).json({ error: `Nominatim status: ${response.status}` });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET all fountains (combining OSM and UserDefined structures from Supabase)
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
          const osmFountains = (osmResult.data || []).map(record => mapToFountain(record));
          const utenteFountains = (utenteResult.data || []).map(record => mapToFountain(record));
          return res.json([...osmFountains, ...utenteFountains]);
        }
        
        if (osmResult.error) console.warn("Supabase fontanelle_osm fetch error:", osmResult.error.message);
        if (utenteResult.error) console.warn("Supabase fontanelle_utente fetch error:", utenteResult.error.message);
      } catch (err: any) {
        console.error("Exception while fetching from Supabase:", err.message || err);
      }
    }
    return res.json([]);
  });

  // Legacy OSM Fountains backup endpoint
  app.get("/api/fountains/osm", async (req, res) => {
    const supabase = getSupabase();
    if (supabase) {
      try {
        console.log("Fetching OSM fountains from Supabase table (fontanelle_osm)...");
        const { data, error } = await supabase.from("fontanelle_osm").select("*");
        if (!error && data) {
          const fountains = data.map(record => mapToFountain(record));
          return res.json(fountains);
        }
      } catch (err: any) {
        console.error("Exception while fetching OSM fountains from Supabase:", err.message || err);
      }
    }
    return res.json([]);
  });

  // POST create a fountain (inserts to Supabase fontanelle_utente)
  app.post("/api/fountains", async (req, res) => {
    const newFountain = req.body;
    if (!newFountain || !newFountain.id) {
      return res.status(400).json({ error: "Missing fountain object or id" });
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        const dbRecord = mapToDB(newFountain);
        const { data, error } = await supabase
          .from("fontanelle_utente")
          .upsert(dbRecord)
          .select("*")
          .single();
          
        if (error) {
          console.error("Error inserting custom fountain into Supabase fontanelle_utente:", error.message);
          return res.status(500).json({ error: error.message });
        }
        if (data) {
          return res.json(mapToFountain(data));
        }
      } catch (err: any) {
        console.error("Supabase write exception:", err);
        return res.status(500).json({ error: err.message });
      }
    }

    // fallback return of sent payload
    res.json(newFountain);
  });

  // POST add community report / photo to a fountain
  app.post("/api/fountains/:id/reports", async (req, res) => {
    const { id } = req.params;
    const { type, comment, statusAfter, rating, photo } = req.body;

    const supabase = getSupabase();
    if (supabase) {
      try {
        const targetTable = id.startsWith("node-") ? "fontanelle_osm" : "fontanelle_utente";

        // 1. Get current record from either fontanelle_osm or fontanelle_utente
        const { data: records, error: getErr } = await supabase
          .from(targetTable)
          .select("*")
          .eq("id", id);
          
        if (getErr || !records || records.length === 0) {
          return res.status(404).json({ error: `Fountain not found in Supabase table ${targetTable}` });
        }

        const dbRecord = records[0];
        const fountain = mapToFountain(dbRecord);

        // 2. Build report item
        const newReport = {
          id: `r-${Date.now()}`,
          type,
          comment,
          statusBefore: fountain.status,
          statusAfter,
          photoUrl: photo || undefined,
          user: 'Tu (Esploratore)',
          userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
          createdAt: new Date().toISOString(),
          rating: rating || undefined
        };

        const updatedReports = [newReport, ...fountain.reports];
        const ratedLogs = updatedReports.filter((r) => r.rating !== undefined);
        const aggregatedRating =
          ratedLogs.length > 0
            ? ratedLogs.reduce((acc, curr) => acc + (curr.rating || 0), 0) / ratedLogs.length
            : fountain.rating;

        const updatedPhotos = photo ? [photo, ...fountain.photos] : fountain.photos;

        const updatedFountain = {
          ...fountain,
          status: statusAfter,
          rating: Number(aggregatedRating.toFixed(1)),
          photos: updatedPhotos,
          reports: updatedReports,
        };

        // 3. Save back to the respective table
        const updatedRecord = mapToDB(updatedFountain);
        const { data: finalRecord, error: putErr } = await supabase
          .from(targetTable)
          .upsert(updatedRecord)
          .select("*")
          .single();

        if (putErr) {
          return res.status(500).json({ error: putErr.message });
        }

        return res.json(mapToFountain(finalRecord));
      } catch (err: any) {
        console.error("Supabase exception in report endpoint:", err);
        return res.status(500).json({ error: err.message });
      }
    }

    res.status(400).json({ error: "Supabase not connected, updates can only be saved in client's local states." });
  });

  // Manual Trigger Endpoint to refresh OSM instantly
  app.post("/api/fountains/refresh-osm", async (req, res) => {
    try {
      console.log("Manual OSM refresh requested...");
      await syncOsmToSupabase();
      res.json({ success: true, message: "OSM features synced and updated successfully!" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
