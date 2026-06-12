import { createClient } from '@supabase/supabase-js';
import { Fountain, FountainStatus, WaterType, Report } from './types';

let supabaseClient: any = null;

// Clean parsing helper to format reverse geocoding addresses with city name
export function formatReverseGeocodeAddress(data: any): { address: string; city: string } {
  if (!data) return { address: 'Indirizzo non presente', city: 'Altro' };
  
  const addr = data.address || {};
  const city = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || addr.county || 'Altra';
  
  // Format clean address incorporating the city name
  let street = addr.road || addr.pedestrian || addr.path || addr.suburb || '';
  if (street && addr.house_number) {
    street = `${street}, ${addr.house_number}`;
  }
  
  let formattedAddress = '';
  if (street) {
    formattedAddress = `${street}, ${city}`;
  } else if (data.display_name) {
    // Fallback to first few parts of display_name, but make sure city is appended if not present
    const parts = data.display_name.split(',');
    const mainParts = parts.slice(0, Math.min(3, parts.length)).join(',').trim();
    if (!mainParts.toLowerCase().includes(city.toLowerCase())) {
      formattedAddress = `${mainParts}, ${city}`;
    } else {
      formattedAddress = mainParts;
    }
  } else {
    formattedAddress = `Città: ${city}`;
  }
  
  // Capitalize first letters of city for display elegance
  const cleanCity = city.charAt(0).toUpperCase() + city.slice(1);
  const cleanAddress = formattedAddress.trim();

  return { address: cleanAddress, city: cleanCity };
}

export function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  // Vite bakes these into the client build on GitHub Actions during `npm run build`
  const url = (import.meta as any).env?.VITE_SUPABASE_URL?.trim();
  const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    return null;
  }

  // Double-check is actual valid http link
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return null;
  }

  // Filter known presets or raw string tags
  if (url.includes("your-") || url.includes("placeholder") || url.includes("insert_your_")) {
    return null;
  }

  try {
    supabaseClient = createClient(url, key);
    return supabaseClient;
  } catch (err) {
    console.warn("Client-side Supabase client initialization failed:", err);
    return null;
  }
}

// Convert DB snake_case columns back to CamelCase client structures
export function mapToFountainClient(db: any): Fountain {
  return {
    id: db.id,
    name: db.name || "Fontanella",
    lat: Number(db.lat),
    lng: Number(db.lng),
    address: db.address || "",
    status: (db.status || "working") as FountainStatus,
    waterType: (db.water_type || "potabile") as WaterType,
    description: db.description || "",
    addedBy: db.added_by || "Esploratore",
    rating: Number(db.rating || 3.0),
    photos: Array.isArray(db.photos) ? db.photos : [],
    reports: Array.isArray(db.reports) ? db.reports : [],
    createdAt: db.created_at || new Date().toISOString(),
    city: db.city || "Altro",
    waterFlowRate: db.water_flow_rate || undefined,
    hasFilter: !!db.has_filter,
    isOsm: !!db.is_osm,
  };
}

// Convert client CamelCase structure to DB snake_case record schema
export function mapToDBRecord(f: Fountain): any {
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

// Global fetch unified handler
export async function fetchFountains(): Promise<Fountain[]> {
  const supabase = getSupabaseClient();
  
  if (supabase) {
    try {
      console.log("[AquaMap] Direct Client-Side Supabase fetch triggered...");
      const [osmResult, utenteResult] = await Promise.all([
        supabase.from("fontanelle_osm").select("*"),
        supabase.from("fontanelle_utente").select("*")
      ]);

      if (!osmResult.error || !utenteResult.error) {
        const osmList = (osmResult.data || []).map(mapToFountainClient);
        const utenteList = (utenteResult.data || []).map(mapToFountainClient);
        console.log(`[AquaMap] Successfully restored ${osmList.length} OSM + ${utenteList.length} user fountains directly from Supabase.`);
        return [...osmList, ...utenteList];
      }
      
      if (osmResult.error) console.error("OSM direct db fetch error:", osmResult.error.message);
      if (utenteResult.error) console.error("Utente direct db fetch error:", utenteResult.error.message);
    } catch (err: any) {
      console.error("Direct Supabase fetch exception, falling back to Express API:", err.message || err);
    }
  }

  // Fallback to server routes when running on AI Studio and direct keys aren't compiled/supplied
  try {
    console.log("[AquaMap] Falling back to backend API proxy list fetch...");
    const res = await fetch("/api/fountains");
    if (res.ok) {
      return await res.json();
    }
  } catch (err: any) {
    console.error("Express API fallback retrieve failed:", err.message || err);
  }

  return [];
}

// Add user fountain unified handler
export async function insertFountain(f: Fountain): Promise<Fountain | null> {
  const supabase = getSupabaseClient();
  const dbRecord = mapToDBRecord(f);

  if (supabase) {
    try {
      console.log("[AquaMap] Direct Client-Side Supabase inserting fountain...");
      const { data, error } = await supabase
        .from("fontanelle_utente")
        .upsert([dbRecord])
        .select();

      if (!error && data && data.length > 0) {
        console.log("[AquaMap] Success saving user fountain directly!");
        return mapToFountainClient(data[0]);
      }
      if (error) {
        console.error("Direct user insert failed:", error.message);
      }
    } catch (err: any) {
      console.error("Direct Supabase insert exception, falling back to Express API:", err.message || err);
    }
  }

  // Backend API fallback
  try {
    const res = await fetch("/api/fountains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err: any) {
    console.error("Express API insert fallback failed:", err.message || err);
  }

  return null;
}

// Submit community report unified handler
export async function submitReport(
  fountainId: string,
  payload: {
    type: 'status_change' | 'comment' | 'photo' | 'report_broken';
    comment: string;
    statusAfter: FountainStatus;
    rating: number;
    photo: string | null;
  }
): Promise<Fountain | null> {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      console.log("[AquaMap] Direct Client-Side report submitted. Acquiring current fountain state...");
      const targetTable = fountainId.startsWith("node-") ? "fontanelle_osm" : "fontanelle_utente";

      const { data: records, error: getErr } = await supabase
        .from(targetTable)
        .select("*")
        .eq("id", fountainId);

      if (!getErr && records && records.length > 0) {
        const dbRecord = records[0];
        const fountain = mapToFountainClient(dbRecord);

        // Build report object
        const newReport: Report = {
          id: `r-${Date.now()}`,
          type: payload.type,
          comment: payload.comment,
          statusBefore: fountain.status,
          statusAfter: payload.statusAfter,
          photoUrl: payload.photo || undefined,
          user: 'Tu (Esploratore)',
          userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
          createdAt: new Date().toISOString(),
          rating: payload.rating || undefined
        };

        const updatedReports = [newReport, ...fountain.reports];
        const ratedLogs = updatedReports.filter((r) => r.rating !== undefined);
        const aggregatedRating =
          ratedLogs.length > 0
            ? ratedLogs.reduce((acc, curr) => acc + (curr.rating || 0), 0) / ratedLogs.length
            : fountain.rating;

        const updatedPhotos = payload.photo ? [payload.photo, ...fountain.photos] : fountain.photos;

        const updatedFountain: Fountain = {
          ...fountain,
          status: payload.statusAfter,
          rating: Number(aggregatedRating.toFixed(1)),
          photos: updatedPhotos,
          reports: updatedReports,
        };

        const updatedRecord = mapToDBRecord(updatedFountain);
        
        const { data: finalRecord, error: putErr } = await supabase
          .from(targetTable)
          .upsert(updatedRecord)
          .select("*");

        if (!putErr && finalRecord && finalRecord.length > 0) {
          console.log("[AquaMap] Successfully synchronized and added report directly!");
          return mapToFountainClient(finalRecord[0]);
        } else {
          console.error("Direct report save error:", putErr?.message);
        }
      }
    } catch (err: any) {
      console.error("Direct Supabase report save exception, falling back to Express API:", err.message || err);
    }
  }

  // Backend API fallback
  try {
    const res = await fetch(`/api/fountains/${fountainId}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err: any) {
    console.error("Express API report submission fallback failed:", err.message || err);
  }

  return null;
}

// Client-Side OpenStreetMap Synchronization
export async function syncOsmClientSide(progressCallback?: (msg: string) => void): Promise<{ success: boolean; count: number; message: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, count: 0, message: "Supabase non è configurato o le chiavi nel client non sono caricate/valide." };
  }

  const areas = [
    { name: 'Milano', query: 'relation["name"="Milano"]["admin_level"="8"]' },
    { name: 'Roma', query: 'relation["name"="Roma"]["admin_level"="8"]' },
    { name: 'Paris', query: 'relation["name"="Paris"]["admin_level"="6"]' },
    { name: 'London', query: 'relation["name"="London"]["admin_level"="8"]' },
    { name: 'New York', query: 'relation["name"="New York City"]["admin_level"="5"]' }
  ];

  const features: any[] = [];
  
  if (progressCallback) progressCallback("Inizio recupero dati da OpenStreetMap Overpass (5 città)...");

  for (const area of areas) {
    try {
      if (progressCallback) progressCallback(`Caricamento fontanelle da OSM per: ${area.name}...`);
      const queryStr = `
        [out:json][timeout:90];
        ${area.query}->.searchArea;
        node["amenity"="drinking_water"](area.searchArea);
        out body;
      `;
      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(queryStr)}`;
      const res = await fetch(url);
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
        if (progressCallback) progressCallback(`Trovate ${elementFeatures.length} fontanelle per ${area.name}.`);
      } else {
        console.error(`Overpass failed for ${area.name} with status ${res.status}`);
      }
      
      // Delay to respect OSM Overpass rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err: any) {
      console.error(`Error querying OSM for ${area.name}:`, err);
    }
  }

  if (features.length === 0) {
    return { success: false, count: 0, message: "Nessuna fontanella scaricata da OSM. Riprovare tra qualche minuto." };
  }

  if (progressCallback) progressCallback(`Sincronizzazione di ${features.length} fontanelle direttamente in Supabase...`);

  const dbFountains = features.map(feature => {
    const lat = feature.geometry.coordinates[1];
    const lng = feature.geometry.coordinates[0];
    const safeId = feature.id.replace(/\//g, "-");
    
    return mapToDBRecord({
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

  // Chunk upserts in batches of 50
  const chunkSize = 50;
  let succeededCount = 0;
  for (let i = 0; i < dbFountains.length; i += chunkSize) {
    const chunk = dbFountains.slice(i, i + chunkSize);
    if (progressCallback) {
      progressCallback(`Salvataggio dati Supabase: Batch ${Math.floor(i / chunkSize) + 1}/${Math.ceil(dbFountains.length / chunkSize)}`);
    }
    const { error } = await supabase
      .from("fontanelle_osm")
      .upsert(chunk, { onConflict: "id" });
    
    if (error) {
      console.error(`Error syncing chunk to Supabase fontanelle_osm:`, error.message || error);
    } else {
      succeededCount += chunk.length;
    }
  }

  return { 
    success: true, 
    count: succeededCount, 
    message: `Sincronizzazione completata! ${succeededCount} fontanelle sincronizzate direttamente su Supabase.` 
  };
}
