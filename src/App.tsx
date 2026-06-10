import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import aquamapData from '../aquamap.json';
import FountainMap from './components/FountainMap';
import FountainList from './components/FountainList';
import FountainDetail from './components/FountainDetail';
import AddFountainModal from './components/AddFountainModal';
import { CITIES } from './data/seedData';
import { Fountain, FountainFilter, FountainStatus, WaterType, Report } from './types';
import { Map, List, Droplet, Plus, Compass, Info, Heart, HelpCircle, X } from 'lucide-react';

import { collection, query, where, getDocs, doc, setDoc, limit } from 'firebase/firestore';
import { db } from './lib/firebase';

const sanitizeId = (id: any): string => {
  if (!id) return `f-${Math.random().toString(36).substring(2, 9)}`;
  return String(id).replace(/\//g, '-');
};

export default function App() {
  const [fountains, setFountains] = useState<Fountain[]>([]);
  const [selectedFountainId, setSelectedFountainId] = useState<string | null>(null);
  const [osmFountains, setOsmFountains] = useState<Fountain[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<FountainFilter>({
    searchQuery: '',
    status: 'all',
    waterType: 'all',
    onlyNearby: false,
    city: 'all',
  });

  // Mobile navigation views: 'map' vs 'list' toggle
  const [activeView, setActiveView] = useState<'map' | 'list'>('map');

  // Center state to feed back down to Leaflet when map navigation is triggered
  const [mapCenter, setMapCenter] = useState({
    lat: 25.0,
    lng: 0.0,
    zoom: 2,
    trigger: 0,
  });

  // GPS coordinates of the user once located
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Address and coordinates when map is clicked to add a new fountain
  const [addCoords, setAddCoords] = useState<{ lat: number; lng: number; address: string } | null>(null);

  // Show Quick Guide explanation modal
  const [showHowToModal, setShowHowToModal] = useState(false);

  // Load and save address cache
  const [addressCache, setAddressCache] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('osm_address_cache_v2');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Track map bounds coordinates viewport
  const [currentBounds, setCurrentBounds] = useState<{
    latMin: number;
    latMax: number;
    lngMin: number;
    lngMax: number;
  } | null>(null);

  // Trigger Onboarding modal check
  useEffect(() => {
    const hasVisited = localStorage.getItem('visited_fountains_app');
    if (!hasVisited) {
      setShowHowToModal(true);
      localStorage.setItem('visited_fountains_app', 'true');
    }
  }, []);

  // Auto-clear toast notifications
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Sync / Seed initial OSM fountains to Firebase 'aquamap' collection if empty
  useEffect(() => {
    const tempOsmFountains = (aquamapData as any).features.map((feature: any) => {
      const lat = feature.geometry.coordinates[1];
      const lng = feature.geometry.coordinates[0];
      const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      const address = addressCache[cacheKey] || feature.properties.address || feature.properties['addr:street'] || 'Indirizzo non presente';
      const safeId = sanitizeId(feature.id);

      return {
        id: safeId,
        name: feature.properties.name || feature.properties.description || 'Fontanella',
        lat: lat,
        lng: lng,
        address: address,
        status: 'working' as FountainStatus,
        waterType: 'potabile' as WaterType,
        description: feature.properties.description || 'Dati da OSM',
        addedBy: 'OSM',
        rating: 3.0,
        photos: [],
        reports: [],
        createdAt: new Date().toISOString(),
        city: feature.properties.city || 'Milano',
        isOsm: true
      };
    });

    if (tempOsmFountains.length === 0) return;

    const seedFirebaseIfNeeded = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'aquamap'), limit(1)));
        if (snap.empty) {
          console.log("Seeding global OSM fountains to Firestore 'aquamap' collection...");
          for (const item of tempOsmFountains) {
            await setDoc(doc(db, 'aquamap', item.id), item);
          }
          console.log("OSM Seeding complete!");
        }
      } catch (err) {
        console.error("OSM Seeding check error:", err);
      }
    };

    seedFirebaseIfNeeded();
  }, [addressCache]);

  // Load fountains from Firebase when bounds change
  useEffect(() => {
    if (!currentBounds) return;

    const fetchFountainsByBounds = async () => {
      try {
        const { latMin, latMax, lngMin, lngMax } = currentBounds;

        // 1. Fetch userdefined_fountains within latitude bounds
        const userRef = collection(db, 'userdefined_fountains');
        const qUser = query(
          userRef,
          where('lat', '>=', latMin),
          where('lat', '<=', latMax)
        );
        const userSnap = await getDocs(qUser);
        const userList: Fountain[] = [];
        userSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (data.lng >= lngMin && data.lng <= lngMax) {
            userList.push({
              ...data,
              id: docSnap.id,
              isOsm: false
            });
          }
        });

        // 2. Fetch aquamap within latitude bounds
        const aquaRef = collection(db, 'aquamap');
        const qAqua = query(
          aquaRef,
          where('lat', '>=', latMin),
          where('lat', '<=', latMax)
        );
        const aquaSnap = await getDocs(qAqua);
        const aquaList: Fountain[] = [];
        aquaSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (data.lng >= lngMin && data.lng <= lngMax) {
            aquaList.push({
              ...data,
              id: docSnap.id,
              isOsm: true
            });
          }
        });

        setFountains(userList);
        setOsmFountains(aquaList);
      } catch (err) {
        console.error("Error fetching fountains from Firebase by bounds:", err);
      }
    };

    // Debounce the fetch slightly to prevent excessive network operations
    const timer = setTimeout(fetchFountainsByBounds, 350);
    return () => clearTimeout(timer);
  }, [currentBounds]);

  // Background geocoding worker: resolves at most 1 item every 2 seconds to respect Nominatim TOS
  useEffect(() => {
    const featuresToResolve = (aquamapData as any).features.filter((feature: any) => {
      const lat = feature.geometry.coordinates[1];
      const lng = feature.geometry.coordinates[0];
      const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      return !addressCache[cacheKey];
    });

    if (featuresToResolve.length === 0) return;

    let index = 0;
    const interval = setInterval(async () => {
      if (index >= featuresToResolve.length) {
        clearInterval(interval);
        return;
      }

      const feature = featuresToResolve[index];
      const lat = feature.geometry.coordinates[1];
      const lng = feature.geometry.coordinates[0];
      const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=it`, {
          headers: { 'User-Agent': 'AquaMapFountainsApp/1.0' }
        });
        if (res.ok) {
          const data = await res.json();
          const cleanAddress = data.display_name
            ? data.display_name.split(',').slice(0, 3).join(',').trim()
            : `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
          
          setAddressCache(prev => {
            const next = { ...prev, [cacheKey]: cleanAddress };
            localStorage.setItem('osm_address_cache_v2', JSON.stringify(next));
            return next;
          });
        }
      } catch (err) {
        console.error('Reverse geocode worker error:', err);
      }

      index++;
    }, 2000);

    return () => clearInterval(interval);
  }, [osmFountains.length]);

  // Combine both sources
  const allFountains = [...fountains, ...osmFountains];

  // Sync selected fountain centering and track last centered ID to prevent infinite updates
  const lastCenteredIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedFountainId && selectedFountainId !== lastCenteredIdRef.current) {
      const selected = fountains.find((f) => f.id === selectedFountainId) || 
                       osmFountains.find((f) => f.id === selectedFountainId);
      if (selected) {
        lastCenteredIdRef.current = selectedFountainId;
        setMapCenter({
          lat: selected.lat,
          lng: selected.lng,
          zoom: 16,
          trigger: Date.now(),
        });
        setActiveView('map');
      }
    } else if (!selectedFountainId) {
      lastCenteredIdRef.current = null;
    }
  }, [selectedFountainId, fountains, osmFountains]);

  // Handle setting active city
  const handleSelectCity = (cityValue: string) => {
    setFilters((prev) => ({ ...prev, city: cityValue }));

    if (cityValue === 'all') {
      // Zoom out to global default viewport
      setMapCenter({
        lat: 25.0,
        lng: 0.0,
        zoom: 2,
        trigger: Date.now(),
      });
    } else {
      const cityData = CITIES.find((c) => c.value === cityValue);
      if (cityData && cityData.lat && cityData.lng) {
        setMapCenter({
          lat: cityData.lat,
          lng: cityData.lng,
          zoom: cityData.zoom || 13,
          trigger: Date.now(),
        });
      }
    }
  };

  // Callback to insert newly registered water fountain to Firebase userdefined_fountains
  const handleSaveFountain = async (data: {
    name: string;
    description: string;
    lat: number;
    lng: number;
    address: string;
    status: FountainStatus;
    waterType: WaterType;
    city: string;
    flowRate: 'low' | 'medium' | 'high';
    hasFilter: boolean;
    photo: string | null;
    addedBy: string;
  }) => {
    const newFountain: Fountain = {
      id: `f-${Date.now()}`,
      name: data.name,
      description: data.description,
      lat: data.lat,
      lng: data.lng,
      address: data.address,
      status: data.status,
      waterType: data.waterType,
      addedBy: data.addedBy,
      rating: 5.0, // initial
      photos: data.photo ? [data.photo] : [],
      reports: [],
      createdAt: new Date().toISOString(),
      city: data.city,
      waterFlowRate: data.flowRate,
      hasFilter: data.hasFilter,
    };

    try {
      await setDoc(doc(db, 'userdefined_fountains', newFountain.id), newFountain);
      setFountains((prev) => [...prev, newFountain]);
    } catch (err) {
      console.error("Error saving userdefined fountain:", err);
    }

    setAddCoords(null);
    setSelectedFountainId(newFountain.id);
  };

  // Callback to submit a community report and sync with Firebase
  const handleAddReport = async (
    fountainId: string,
    type: 'status_change' | 'comment' | 'photo' | 'report_broken',
    comment: string,
    statusAfter: FountainStatus,
    rating: number,
    photo: string | null
  ) => {
    const isUserDef = fountains.some((f) => f.id === fountainId);
    const targetColl = isUserDef ? 'userdefined_fountains' : 'aquamap';

    const currentList = isUserDef ? fountains : osmFountains;
    const f = currentList.find((item) => item.id === fountainId);
    if (!f) return;

    const newReport: Report = {
      id: `r-${Date.now()}`,
      type,
      comment,
      statusBefore: f.status,
      statusAfter,
      photoUrl: photo || undefined,
      user: 'Tu (Esploratore)',
      userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      createdAt: new Date().toISOString(),
      rating,
    };

    const newReports = [newReport, ...f.reports];

    // Recalculate average stars rating
    const ratedLogs = newReports.filter((r) => r.rating !== undefined);
    const aggregatedRating =
      ratedLogs.length > 0
        ? ratedLogs.reduce((acc, curr) => acc + (curr.rating || 0), 0) / ratedLogs.length
        : f.rating;

    // Append photo to fountain images gallery
    const updatedPhotos = photo ? [photo, ...f.photos] : f.photos;

    const updatedFountain = {
      ...f,
      status: statusAfter,
      rating: Number(aggregatedRating.toFixed(1)),
      photos: updatedPhotos,
      reports: newReports,
    };

    try {
      await setDoc(doc(db, targetColl, fountainId), updatedFountain);
      if (isUserDef) {
        setFountains((prev) => prev.map((item) => (item.id === fountainId ? updatedFountain : item)));
      } else {
        setOsmFountains((prev) => prev.map((item) => (item.id === fountainId ? updatedFountain : item)));
      }
    } catch (err) {
      console.error("Error saving report on Firebase:", err);
    }
  };

  return (
    <div id="full-app-root" className="flex flex-col h-screen w-screen overflow-hidden bg-natural-bg font-sans text-natural-dark">
      {/* Upper Navigation and Core Brand row */}
      <header className="md:hidden bg-brand text-white p-3 flex justify-between items-center shrink-0 shadow-md border-b border-brand-hover/40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-light rounded-lg flex items-center justify-center text-brand font-black">
            <Droplet className="w-4 h-4 fill-brand text-brand" />
          </div>
          <span className="font-serif font-extrabold text-sm tracking-tight text-white">AquaMap</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHowToModal(true)}
            className="p-1 px-2.5 bg-brand-hover hover:bg-brand text-white/90 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" /> Aiuto
          </button>
        </div>
      </header>

      {/* Primary Layout Engine */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* LEFT COMPONENT: Searching & Listing Sidebar (visible always on desktop, conditionally on mobile) */}
        <div
          className={`w-full md:w-[380px] lg:w-[420px] shrink-0 border-r border-natural-border h-full flex flex-col z-20 transition-all duration-300 ${
            activeView === 'list' ? 'flex' : 'hidden md:flex'
          }`}
        >
          <FountainList
            fountains={allFountains}
            filters={filters}
            setFilters={setFilters}
            selectedFountainId={selectedFountainId}
            onSelectFountain={setSelectedFountainId}
            userLocation={userLocation}
            onSelectCity={handleSelectCity}
          />
        </div>

        {/* MIDDLE COMPONENT: Interactive Map View */}
        <div
          className={`flex-1 h-full flex flex-col relative z-10 ${
            activeView === 'map' ? 'flex' : 'hidden md:flex'
          }`}
        >
          <FountainMap
            fountains={allFountains}
            osmFountains={osmFountains}
            selectedFountainId={selectedFountainId}
            onSelectFountain={setSelectedFountainId}
            onMapClick={setAddCoords}
            centerState={mapCenter}
            userLocation={userLocation}
            setUserLocation={setUserLocation}
            onBoundsChange={setCurrentBounds}
          />

          {/* Desktop header overlay (gives it a floating premium appearance) */}
          <div className="hidden md:flex absolute top-4 left-4 z-40 items-center gap-2">
            <button
              onClick={() => setShowHowToModal(true)}
              className="px-4 py-2 bg-brand/90 hover:bg-brand backdrop-blur-md text-white rounded-xl shadow-xl border border-brand-hover/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              <HelpCircle className="w-4 h-4 text-brand-light" /> Come funziona?
            </button>
          </div>
        </div>

        {/* SLIDE-OVER DRAWER/PANEL: Selected Fountain Information or Register Form */}
        <AnimatePresence>
          {(selectedFountainId || addCoords) && (
            <motion.div
              initial={{ x: '100%', opacity: 0.9 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.9 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="absolute md:relative inset-y-0 right-0 w-full md:w-[420px] lg:w-[460px] bg-natural-bg border-l border-natural-border z-[100] h-full flex flex-col shadow-2xl shrink-0"
              id="curtain-panel"
            >
              {selectedFountainId ? (
                (() => {
                  const found = allFountains.find((f) => f.id === selectedFountainId);
                  return found ? (
                    <FountainDetail
                      fountain={found}
                      onClose={() => setSelectedFountainId(null)}
                      onAddReport={handleAddReport}
                    />
                  ) : null;
                })()
              ) : (
                <AddFountainModal
                  coordinates={addCoords}
                  onClose={() => setAddCoords(null)}
                  onSave={handleSaveFountain}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* MOBILE FLOATING INTERFACE: Quick Action/View Switcher */}
      <div className="md:hidden bg-white border-t border-natural-border py-2 px-6 flex justify-around items-center shrink-0 z-35 shadow-lg">
        <button
          onClick={() => setActiveView('map')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
            activeView === 'map' ? 'text-brand scale-105' : 'text-natural-muted hover:text-natural-dark'
          }`}
        >
          <Map className="w-5.5 h-5.5" />
          <span className="text-[10px] font-bold">Mappa</span>
        </button>

        {/* Floating Quick Plus (Tells users to tap on local map directly) */}
        <button
          onClick={() => {
            setActiveView('map');
            setToastMessage('Seleziona un punto qualsiasi sulla mappa per impostare la posizione GPS e mappare una fontanella!');
          }}
          className="flex items-center justify-center w-11 h-11 bg-brand hover:bg-brand-hover text-white rounded-full shadow-lg shadow-[#5a5a4040] cursor-pointer -mt-6 border-3 border-white transition-transform active:scale-90"
          title="Aggiungi Fontanella"
        >
          <Plus className="w-5.5 h-5.5 stroke-[2.5]" />
        </button>

        <button
          onClick={() => setActiveView('list')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
            activeView === 'list' ? 'text-brand scale-105' : 'text-natural-muted hover:text-natural-dark'
          }`}
        >
          <List className="w-5.5 h-5.5" />
          <span className="text-[10px] font-bold">Elenco</span>
        </button>
      </div>

      {/* HOW-TO GUIDE INSTRUCTIONAL DIALOG: Welcome onboarding */}
      <AnimatePresence>
        {showHowToModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-natural-dark/40 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 15 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              className="bg-natural-bg rounded-3xl p-6 max-w-md w-full shadow-2xl border border-natural-border text-natural-dark relative"
            >
              <button
                onClick={() => setShowHowToModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-brand-light text-natural-muted hover:text-natural-dark cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center text-white shrink-0">
                  <Droplet className="w-5 h-5 fill-brand-light text-brand-light" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-natural-dark">Benvenuto su AquaMap!</h3>
                  <p className="text-[10px] text-brand font-bold uppercase tracking-wider">Uniti per la mappatura dell&apos;acqua pubblica nel mondo</p>
                </div>
              </div>

              <div className="space-y-4 text-xs font-semibold text-natural-dark/90 leading-relaxed">
                <p className="font-medium text-natural-dark/80">
                  Questo portale ti consente di esplorare, aggiungere e monitorare in tempo reale lo stato delle fontanelle di tutto il mondo.
                </p>

                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-natural-border">
                    <span className="text-brand text-sm mt-0.5">📍</span>
                    <div>
                      <span className="font-bold text-natural-dark block">Mappatura GPS</span>
                      <span className="text-[11px] text-natural-muted font-medium">Fai clic in qualsiasi point sulla mappa per posizionare il perno e registrare una nuova fontanella.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-natural-border">
                    <span className="text-brand text-sm mt-0.5">🔄</span>
                    <div>
                      <span className="font-bold text-natural-dark block">Segnalazioni Condivise</span>
                      <span className="text-[11px] text-natural-muted font-medium">La fontanella è secca o rotta? Apri i dettagli, clicca &quot;Segnala&quot; e aggiorna lo stato per avvisare la community.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-natural-border">
                    <span className="text-brand text-sm mt-0.5">📷</span>
                    <div>
                      <span className="font-bold text-natural-dark block">Uploader Foto Intuitivo</span>
                      <span className="text-[11px] text-natural-muted font-medium">Condividi foto reali trascinandole direttamente nel box di caricamento o selezionandole dal tuo dispositivo.</span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowHowToModal(false)}
                className="mt-6 w-full py-2.5 bg-brand hover:bg-brand-hover text-white font-bold text-xs rounded-xl shadow-md shadow-[#5a5a4025] transition-transform active:scale-95 cursor-pointer"
              >
                Inizia l&apos;esplorazione
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Toast System */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[11000] max-w-md w-[calc(100%-2rem)] px-5 py-3.5 bg-brand text-white border border-brand-light/25 shadow-2xl rounded-2xl flex items-center gap-2.5"
          >
            <Droplet className="w-5 h-5 text-brand-light fill-brand-light shrink-0" />
            <span className="text-xs font-bold leading-normal">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
