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
    amenity: (db.amenity || 'drinking_water') as 'drinking_water' | 'toilets',
  };
}

// Convert client CamelCase structure to DB snake_case record schema
export function mapToDBRecord(f: Fountain): any {
  return {
    id: String(f.id),
    name: f.name || "Servizio Pubblico",
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
    amenity: f.amenity || 'drinking_water',
  };
}

// Global fetch unified handler
export async function fetchFountains(bounds?: { latMin: number; latMax: number; lngMin: number; lngMax: number }): Promise<Fountain[]> {
  const supabase = getSupabaseClient();
  
  if (supabase) {
    try {
      console.log("[AquaMap] Direct Client-Side Supabase fetch triggered with bounds:", bounds);
      const utenteResult = await supabase.from("fontanelle_utente").select("*");
      
      let osmQuery = supabase.from("fontanelle_osm").select("*");
      if (bounds) {
        osmQuery = osmQuery
          .gte("lat", bounds.latMin)
          .lte("lat", bounds.latMax)
          .gte("lng", bounds.lngMin)
          .lte("lng", bounds.lngMax);
      } else {
        // Initial limit to prevent downloading 66k items and crashing
        osmQuery = osmQuery.limit(1000);
      }
      
      const osmResult = await osmQuery;

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
    let url = "/api/fountains";
    if (bounds) {
      url += `?latMin=${bounds.latMin}&latMax=${bounds.latMax}&lngMin=${bounds.lngMin}&lngMax=${bounds.lngMax}`;
    }
    const res = await fetch(url);
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

// Helper to find nearest European city and guess beautiful address
export function findNearestEuropeanCity(lat: number, lng: number): { city: string; address: string } {
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

// Client-Side OpenStreetMap Synchronization
export async function syncOsmClientSide(progressCallback?: (msg: string) => void): Promise<{ success: boolean; count: number; message: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, count: 0, message: "Supabase non è configurato o le chiavi nel client non sono caricate/valide." };
  }

  if (progressCallback) progressCallback("Connessione a OpenStreetMap Overpass in corso (Intera Europa)...");

  // Single super query that downloads key European capitals/tourist cities at once
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
  node["amenity"="drinking_water"](area.a); node["amenity"="toilets"](area.a);
  node["amenity"="drinking_water"](area.b); node["amenity"="toilets"](area.b);
  node["amenity"="drinking_water"](area.c); node["amenity"="toilets"](area.c);
  node["amenity"="drinking_water"](area.d); node["amenity"="toilets"](area.d);
  node["amenity"="drinking_water"](area.e); node["amenity"="toilets"](area.e);
  node["amenity"="drinking_water"](area.f); node["amenity"="toilets"](area.f);
  node["amenity"="drinking_water"](area.g); node["amenity"="toilets"](area.g);
  node["amenity"="drinking_water"](area.h); node["amenity"="toilets"](area.h);
  node["amenity"="drinking_water"](area.i); node["amenity"="toilets"](area.i);
  node["amenity"="drinking_water"](area.j); node["amenity"="toilets"](area.j);
  node["amenity"="drinking_water"](area.k); node["amenity"="toilets"](area.k);
  node["amenity"="drinking_water"](area.l); node["amenity"="toilets"](area.l);
  node["amenity"="drinking_water"](area.m); node["amenity"="toilets"](area.m);
  node["amenity"="drinking_water"](area.n); node["amenity"="toilets"](area.n);
  node["amenity"="drinking_water"](area.o); node["amenity"="toilets"](area.o);
  node["amenity"="drinking_water"](area.p); node["amenity"="toilets"](area.p);
  node["amenity"="drinking_water"](area.q); node["amenity"="toilets"](area.q);
  node["amenity"="drinking_water"](area.r); node["amenity"="toilets"](area.r);
);
out body;`;

  const features: any[] = [];

  try {
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(queryStr)}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { success: false, count: 0, message: `Errore Overpass API server: status ${res.status}` };
    }

    const osmData = await res.json();
    const elements = osmData.elements || [];
    
    if (progressCallback) progressCallback(`Elaborazione di ${elements.length} elementi localizzati in Europa...`);

    const elementFeatures = elements
      .filter((el: any) => el.type === 'node')
      .map((el: any) => {
        const lat = Number(el.lat);
        const lng = Number(el.lon);
        const resolved = findNearestEuropeanCity(lat, lng);
        const currentAmenity = (el.tags?.amenity === 'toilets' ? 'toilets' : 'drinking_water') as 'drinking_water' | 'toilets';

        // Deduce a beautiful descriptive name
        let name = el.tags?.name || el.tags?.description;
        if (!name) {
          if (currentAmenity === 'toilets') {
            if (el.tags?.operator) name = `Bagno Pubblico (${el.tags.operator})`;
            else name = `Bagno Pubblico ${resolved.city}`;
          } else {
            if (el.tags?.operator) name = `Fontanella (${el.tags.operator})`;
            else name = `Fontanella Potabile ${resolved.city}`;
          }
        }

        // Deduce address
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
            "amenity": currentAmenity,
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
  } catch (err: any) {
    console.error("OSM sync error:", err);
    return { success: false, count: 0, message: `Eccezione Overpass: ${err.message || err}` };
  }

  if (features.length === 0) {
    return { success: false, count: 0, message: "Nessun elemento scaricato da OSM. Servizio temporaneamente occupato." };
  }

  if (progressCallback) progressCallback(`Trovati ${features.length} elementi. Scrittura in Supabase (Batch da 100 in corso)...`);

  const dbFountains = features.map(feature => {
    const lat = feature.geometry.coordinates[1];
    const lng = feature.geometry.coordinates[0];
    const safeId = feature.id.replace(/\//g, "-");
    
    return mapToDBRecord({
      id: safeId,
      name: feature.properties.name,
      lat: lat,
      lng: lng,
      address: feature.properties.address,
      status: "working",
      waterType: "potabile",
      description: feature.properties.description || (feature.properties.amenity === 'toilets' ? "Bagno pubblico registrato da OpenStreetMap" : "Infrastruttura idrica registrata da OpenStreetMap"),
      addedBy: "OpenStreetMap",
      rating: 3.0,
      photos: [],
      reports: [],
      createdAt: new Date().toISOString(),
      city: feature.properties.city,
      isOsm: true,
      amenity: feature.properties.amenity || "drinking_water"
    });
  });

  // Chunk upserts in batches of 100 for optimal performance
  const chunkSize = 100;
  let succeededCount = 0;
  for (let i = 0; i < dbFountains.length; i += chunkSize) {
    const chunk = dbFountains.slice(i, i + chunkSize);
    if (progressCallback) {
      progressCallback(`Salvataggio Supabase: Batch ${Math.floor(i / chunkSize) + 1}/${Math.ceil(dbFountains.length / chunkSize)} (${succeededCount} salvate)`);
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
    message: `Sincronizzazione completata! ${succeededCount} fontanelle in tutta Europa salvate con successo direttamente su Supabase.` 
  };
}
