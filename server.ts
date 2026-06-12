import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

let cachedOsmData: any = null;
let lastCacheUpdate: number = 0;
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

// Helper to find nearest European city and guess beautiful address
function findNearestEuropeanCityServer(lat: number, lng: number): { city: string; address: string } {
  const referenceCities = [
    { name: 'Milano', lat: 45.4642, lng: 9.1900 },
    { name: 'Roma', lat: 41.8902, lng: 12.4922 },
    { name: 'Torino', lat: 45.0703, lng: 7.6869 },
    { name: 'Napoli', lat: 40.8518, lng: 14.2681 },
    { name: 'Firenze', lat: 43.7696, lng: 11.2558 },
    { name: 'Venezia', lat: 45.4408, lng: 12.3155 },
    { name: 'Parigi', lat: 48.8566, lng: 2.3522 },
    { name: 'Londra', lat: 51.5074, lng: -0.1278 },
    { name: 'Berlino', lat: 52.5200, lng: 13.4050 },
    { name: 'Madrid', lat: 40.4168, lng: -3.7038 },
    { name: 'Barcellona', lat: 41.3851, lng: 2.1734 },
    { name: 'Vienna', lat: 48.2082, lng: 16.3738 },
    { name: 'Amsterdam', lat: 52.3676, lng: 4.9041 },
    { name: 'Bruxelles', lat: 50.8503, lng: 4.3517 },
    { name: 'Monaco di Baviera', lat: 48.1351, lng: 11.5820 },
    { name: 'Lisbona', lat: 38.7223, lng: -9.1393 },
    { name: 'Atene', lat: 37.9838, lng: 23.7275 },
    { name: 'Dublino', lat: 53.3498, lng: -6.2603 },
    { name: 'Piazza Armerina', lat: 37.3856, lng: 14.3670 },
    { name: 'Enna', lat: 37.5600, lng: 14.2810 },
    { name: 'Palermo', lat: 38.1157, lng: 13.3615 },
    { name: 'Catania', lat: 37.5079, lng: 15.0830 },
    { name: 'Messina', lat: 38.1938, lng: 15.5540 },
    { name: 'Siracusa', lat: 37.0755, lng: 15.2866 },
    { name: 'Ragusa', lat: 36.9282, lng: 14.7172 },
    { name: 'Caltanissetta', lat: 37.4903, lng: 14.0620 },
    { name: 'Agrigento', lat: 37.3111, lng: 13.5765 },
    { name: 'Trapani', lat: 38.0178, lng: 12.5150 },
    { name: 'Cagliari', lat: 39.2238, lng: 9.1217 },
    { name: 'Sassari', lat: 40.7259, lng: 8.5556 },
    { name: 'Alghero', lat: 40.5580, lng: 8.3181 },
    { name: 'Bari', lat: 41.1171, lng: 16.8719 },
    { name: 'Taranto', lat: 40.4644, lng: 17.2470 },
    { name: 'Lecce', lat: 40.3533, lng: 18.1741 },
    { name: 'Foggia', lat: 41.4622, lng: 15.5446 },
    { name: 'Reggio Calabria', lat: 38.1113, lng: 15.6473 },
    { name: 'Catanzaro', lat: 38.9054, lng: 16.5948 },
    { name: 'Cosenza', lat: 39.2983, lng: 16.2537 },
    { name: 'Potenza', lat: 40.6405, lng: 15.8056 },
    { name: 'Matera', lat: 40.6664, lng: 16.6043 },
    { name: 'Salerno', lat: 40.6780, lng: 14.7881 },
    { name: 'Caserta', lat: 41.0735, lng: 14.3331 },
    { name: 'Pescara', lat: 42.4618, lng: 14.2185 },
    { name: 'Ancona', lat: 43.6158, lng: 13.5189 },
    { name: 'Perugia', lat: 43.1107, lng: 12.3908 },
    { name: 'Terni', lat: 42.5638, lng: 12.6414 },
    { name: 'Bologna', lat: 44.4949, lng: 11.3426 },
    { name: 'Modena', lat: 44.6471, lng: 10.9252 },
    { name: 'Parma', lat: 44.8015, lng: 10.3279 },
    { name: 'Ravenna', lat: 44.4183, lng: 12.2035 },
    { name: 'Rimini', lat: 44.0575, lng: 12.5653 },
    { name: 'Genova', lat: 44.4056, lng: 8.9463 },
    { name: 'La Spezia', lat: 44.1107, lng: 9.8434 },
    { name: 'Sanremo', lat: 43.8160, lng: 7.7738 },
    { name: 'Verona', lat: 45.4383, lng: 10.9916 },
    { name: 'Padova', lat: 45.4064, lng: 11.8768 },
    { name: 'Vicenza', lat: 45.5455, lng: 11.5475 },
    { name: 'Treviso', lat: 45.6669, lng: 12.2429 },
    { name: 'Trieste', lat: 45.6495, lng: 13.7768 },
    { name: 'Udine', lat: 46.0625, lng: 13.2373 },
    { name: 'Trento', lat: 46.0679, lng: 11.1211 },
    { name: 'Bolzano', lat: 46.4908, lng: 11.3548 },
    { name: 'Brescia', lat: 45.5398, lng: 10.2198 },
    { name: 'Bergamo', lat: 45.6983, lng: 9.6773 },
    { name: 'Como', lat: 45.8081, lng: 9.0852 },
    { name: 'Varese', lat: 45.8172, lng: 8.8262 },
    { name: 'Novara', lat: 45.4468, lng: 8.6214 },
    { name: 'Alessandria', lat: 44.9129, lng: 8.6150 },
    { name: 'Pisa', lat: 43.7085, lng: 10.4036 },
    { name: 'Livorno', lat: 43.5485, lng: 10.3106 },
    { name: 'Siena', lat: 43.3182, lng: 11.3304 },
    { name: 'Lucca', lat: 43.8429, lng: 10.5027 }
  ];

  let minDistance = Infinity;
  let nearestCityName = 'Altra';

  for (const c of referenceCities) {
    const dist = Math.sqrt(Math.pow(lat - c.lat, 2) + Math.pow(lng - c.lng, 2));
    if (dist < minDistance) {
      minDistance = dist;
      nearestCityName = c.name;
    }
  }

  // If closest city is within generous ~3.0 degrees, align it
  if (minDistance < 3.0) {
    return { 
      city: nearestCityName, 
      address: `Zona centrale di ${nearestCityName}, Italia` 
    };
  }

  return { 
    city: nearestCityName, 
    address: `Zona centrale di ${nearestCityName}, Europa` 
  };
}

async function syncOsmToSupabase() {
  console.log("Starting active OSM query synchronization for Europe-wide drinking fountains...");
  
  const queryStr = `[out:json][timeout:120];
(
  area["name"="Milano"]["admin_level"="8"]->.a;
  area["name"="Roma"]["admin_level"="8"]->.b;
  area["name"="Torino"]["admin_level"="8"]->.c;
  area["name"="Napoli"]["admin_level"="8"]->.d;
  area["name"="Firenze"]["admin_level"="8"]->.e;
  area["name"="Venezia"]["admin_level"="8"]->.f;
  area["name"="Paris"]["admin_level"="6"]->.g;
  area["name"="London"]["admin_level"="8"]->.h;
  area["name"="Berlin"]["admin_level"="4"]->.i;
  area["name"="Madrid"]["admin_level"="8"]->.j;
  area["name"="Barcelona"]["admin_level"="8"]->.k;
  area["name"="Wien"]["admin_level"="8"]->.l;
  area["name"="Amsterdam"]["admin_level"="8"]->.m;
  area["name"="Bruxelles - Brussel"]["admin_level"="8"]->.n;
  area["name"="München"]["admin_level"="8"]->.o;
  area["name"="Lisboa"]["admin_level"="8"]->.p;
  area["name"="Athens"]["admin_level"="8"]->.q;
  area["name"="Dublin"]["admin_level"="8"]->.r;
);
(
  node["amenity"="drinking_water"](area.a);
  node["amenity"="drinking_water"](area.b);
  node["amenity"="drinking_water"](area.c);
  node["amenity"="drinking_water"](area.d);
  node["amenity"="drinking_water"](area.e);
  node["amenity"="drinking_water"](area.f);
  node["amenity"="drinking_water"](area.g);
  node["amenity"="drinking_water"](area.h);
  node["amenity"="drinking_water"](area.i);
  node["amenity"="drinking_water"](area.j);
  node["amenity"="drinking_water"](area.k);
  node["amenity"="drinking_water"](area.l);
  node["amenity"="drinking_water"](area.m);
  node["amenity"="drinking_water"](area.n);
  node["amenity"="drinking_water"](area.o);
  node["amenity"="drinking_water"](area.p);
  node["amenity"="drinking_water"](area.q);
  node["amenity"="drinking_water"](area.r);
);
out body;`;

  const features: any[] = [];

  try {
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(queryStr)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': `AquaMapWorldApplication/4.0` }
    });
    if (res.ok) {
      const osmData = await res.json();
      const elements = osmData.elements || [];
      const elementFeatures = elements
        .filter((el: any) => el.type === 'node')
        .map((el: any) => {
          const lat = Number(el.lat);
          const lng = Number(el.lon);
          const resolved = findNearestEuropeanCityServer(lat, lng);

          let name = el.tags?.name || el.tags?.description;
          if (!name) {
            if (el.tags?.operator) name = `Fontanella (${el.tags.operator})`;
            else name = `Fontanella Potabile ${resolved.city}`;
          }

          let address = el.tags?.['addr:street'];
          if (address) {
            if (el.tags?.['addr:housenumber']) address += `, ${el.tags['addr:housenumber']}`;
            address += `, ${resolved.city}`;
          } else {
            address = resolved.address;
          }

          return {
            type: "Feature",
            properties: {
              "@id": `node/${el.id}`,
              "amenity": "drinking_water",
              "name": name,
              "city": resolved.city,
              "address": address,
              ...el.tags
            },
            geometry: {
              type: "Point",
              coordinates: [lng, lat]
            },
            id: `node-${el.id}`
          };
        });

      features.push(...elementFeatures);
      console.log(`Loaded ${elementFeatures.length} fountains for Europe-wide sync.`);
    } else {
      console.error(`Overpass failed with status ${res.status}`);
    }
  } catch (err) {
    console.error(`Error querying OSM for Europe:`, err);
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
          name: feature.properties.name,
          lat: lat,
          lng: lng,
          address: feature.properties.address,
          status: "working",
          waterType: "potabile",
          description: feature.properties.description || "Infrastruttura idrica registrata da OpenStreetMap",
          addedBy: "OpenStreetMap",
          rating: 3.0,
          photos: [],
          reports: [],
          createdAt: new Date().toISOString(),
          city: feature.properties.city,
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support JSON bodies up to 10MB (for custom image base64 report transfers)
  app.use(express.json({ limit: '10mb' }));

  // Print helpful schema on boot
  printSupabaseSchemaGuideline();

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
        const utenteResult = await supabase.from("fontanelle_utente").select("*");

        const { latMin, latMax, lngMin, lngMax } = req.query;
        let osmQuery = supabase.from("fontanelle_osm").select("*");
        
        if (latMin && latMax && lngMin && lngMax) {
          osmQuery = osmQuery
            .gte("lat", Number(latMin))
            .lte("lat", Number(latMax))
            .gte("lng", Number(lngMin))
            .lte("lng", Number(lngMax));
        } else {
          // If no bounds specified, limit initial fetch to prevent performance issues
          osmQuery = osmQuery.limit(1000);
        }

        const osmResult = await osmQuery;

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
