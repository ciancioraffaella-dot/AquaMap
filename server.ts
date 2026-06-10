import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

// Read Firebase config safely inside the server environment
const rawConfig = fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf-8");
const firebaseConfig = JSON.parse(rawConfig);

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId || "(default)");

let cachedOsmData: any = null;
let lastCacheUpdate: number = 0;
const AQUAMAP_FILE = "aquamap.json";
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000; // 1 week

async function updateAquamapJson() {
  console.log("Starting weekly OSM query for global drinking fountains...");
  
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
        headers: { 'User-Agent': `AquaMapWorldApplication/1.0` }
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
      
      // Delay to respect OSM Nominatim/Overpass rate limits
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (err) {
      console.error(`Error querying OSM for ${area.name}:`, err);
    }
  }

  if (features.length > 0) {
    const geoJson = {
      type: "FeatureCollection",
      generator: "overpass-interpreter-aquamap",
      copyright: "The data included in this document is from www.openstreetmap.org. Overpass API. ODbL.",
      timestamp: new Date().toISOString(),
      features
    };
    
    fs.writeFileSync(AQUAMAP_FILE, JSON.stringify(geoJson, null, 2));
    console.log(`Successfully updated aquamap.json with ${features.length} worldwide fountains!`);

    // Charge the fountains in Firestore 'aquamap' collection
    console.log(`Syncing ${features.length} fountains to Firebase Firestore 'aquamap' collection...`);
    for (const feature of features) {
      try {
        const lat = feature.geometry.coordinates[1];
        const lng = feature.geometry.coordinates[0];
        const safeId = feature.id.replace(/\//g, "-");
        const item = {
          id: safeId,
          name: feature.properties.name || "Fontanella",
          lat: lat,
          lng: lng,
          address: feature.properties.address || "Dati da OpenStreetMap",
          status: "working",
          waterType: "potabile",
          description: "Dati provenienti da OpenStreetMap",
          addedBy: "OpenStreetMap",
          rating: 3.0,
          photos: [],
          reports: [],
          createdAt: new Date().toISOString(),
          city: feature.properties.city || "Milano"
        };
        await setDoc(doc(db, "aquamap", safeId), item);
      } catch (fErr) {
        console.error(`Failed to upload ${feature.id} to Firestore`, fErr);
      }
    }
    console.log("Sync to Firebase Completed!");
  } else {
    console.log("No features resolved, keeping existing aquamap.json");
  }
}

function checkWeeklyUpdate() {
  let shouldUpdate = false;
  if (!fs.existsSync(AQUAMAP_FILE)) {
    shouldUpdate = true;
  } else {
    const stats = fs.statSync(AQUAMAP_FILE);
    const mtime = stats.mtimeMs;
    if (Date.now() - mtime > ONE_WEEK) {
      shouldUpdate = true;
    }
  }
  
  if (shouldUpdate) {
    updateAquamapJson().catch(err => console.error("Error in weekly updates:", err));
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Run weekly backup update check
  checkWeeklyUpdate();

  // API routes
  app.get("/api/fountains/osm", async (req, res) => {
    try {
      if (fs.existsSync(AQUAMAP_FILE)) {
        const fileContent = fs.readFileSync(AQUAMAP_FILE, "utf-8");
        const geojson = JSON.parse(fileContent);
        
        const fountains = geojson.features.map((feature: any) => ({
          id: feature.id.replace(/\//g, "-"),
          name: feature.properties.name || "Fontanella",
          lat: feature.geometry.coordinates[1],
          lng: feature.geometry.coordinates[0],
          address: feature.properties.address || "Dati da OpenStreetMap",
          status: "working",
          waterType: "potabile",
          description: "Dati provenienti da OpenStreetMap",
          addedBy: "OpenStreetMap",
          rating: 3.0,
          photos: [],
          reports: [],
          createdAt: new Date().toISOString(),
          city: feature.properties.city || "Milano",
          isOsm: true
        }));
        
        res.json(fountains);
      } else {
        res.json([]);
      }
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
