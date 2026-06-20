import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import FountainMap from './components/FountainMap';
import FountainList from './components/FountainList';
import FountainDetail from './components/FountainDetail';
import AddFountainModal from './components/AddFountainModal';
import { CITIES } from './data/seedData';
import { Fountain, FountainFilter, FountainStatus, WaterType, Report } from './types';
import { Map as MapIcon, List, Droplet, Plus, Info, Heart, HelpCircle, X, Search, MapPin, RefreshCw } from 'lucide-react';
import { fetchFountains, insertFountain, submitReport, formatReverseGeocodeAddress, syncOsmClientSide, findNearestEuropeanCity } from './supabaseClient';

const sanitizeId = (id: any): string => {
  if (!id) return `f-${Math.random().toString(36).substring(2, 9)}`;
  return String(id).replace(/\//g, '-');
};

export default function App() {
  const [fountains, setFountains] = useState<Fountain[]>(() => {
    try {
      const saved = localStorage.getItem('userdefined_fountains_local');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedFountainId, setSelectedFountainId] = useState<string | null>(null);
  const [fountainUpdates, setFountainUpdates] = useState<Record<string, { status: FountainStatus; rating: number; photos: string[]; reports: Report[] }>>(() => {
    try {
      const saved = localStorage.getItem('osm_fountain_updates_local');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [osmFountains, setOsmFountains] = useState<Fountain[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<FountainFilter>({
    searchQuery: '',
    status: 'all',
    waterType: 'all',
    onlyNearby: false,
    city: 'all',
    amenity: 'all',
  });

  // State to track if the map click is active for placing a service
  const [isMapAddActive, setIsMapAddActive] = useState(false);

  // Automatically align selected menu amenity with active map filter when placing is activated
  useEffect(() => {
    if (isMapAddActive) {
      if (filters.amenity === 'toilets') {
        setAddMenuAmenity('toilets');
      } else if (filters.amenity === 'drinking_water') {
        setAddMenuAmenity('drinking_water');
      }
    }
  }, [isMapAddActive, filters.amenity]);

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

  // Dedicated menu state for inserting new amenities
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addMenuStep, setAddMenuStep] = useState<'selection' | 'address'>('selection');
  const [addMenuAmenity, setAddMenuAmenity] = useState<'drinking_water' | 'toilets'>('drinking_water');
  
  // Geolevel address fields
  const [typedAddress, setTypedAddress] = useState('');
  const [typedCity, setTypedCity] = useState('');
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);

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

  // Persist userdefined fountains to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('userdefined_fountains_local', JSON.stringify(fountains));
    } catch (e) {
      console.error('Failed to save fountains locally:', e);
    }
  }, [fountains]);

  // Persist custom updates to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('osm_fountain_updates_local', JSON.stringify(fountainUpdates));
    } catch (e) {
      console.error('Failed to save updates locally:', e);
    }
  }, [fountainUpdates]);

  // Viewport borders for OSM live querying
  const [currentBounds, setCurrentBounds] = useState<{
    latMin: number;
    latMax: number;
    lngMin: number;
    lngMax: number;
  } | null>(null);

  // Debounce and dynamically load OSM fountains matching viewport boundaries
  useEffect(() => {
    if (!currentBounds) return;

    const timer = setTimeout(async () => {
      try {
        console.log("[AquaMap] Viewport changed, executing targeted spatial load for bounds:", currentBounds);
        const fetched = await fetchFountains(currentBounds);
        if (fetched && fetched.length > 0) {
          const osmList = fetched.filter((f) => f.isOsm);
          const userList = fetched.filter((f) => !f.isOsm);
          
          setOsmFountains(osmList);
          if (userList.length > 0) {
            setFountains((prev) => {
              const map = new Map(prev.map((f) => [f.id, f]));
              userList.forEach((u) => map.set(u.id, u));
              return Array.from(map.values());
            });
          }
        }
      } catch (err) {
        console.error("Spatial index load failed:", err);
      }
    }, 450); // 450ms debounce - perfect balance of speed and throttle

    return () => clearTimeout(timer);
  }, [currentBounds]);

  // Load all fountains from Supabase on mount
  useEffect(() => {
    const loadFromSupabase = async () => {
      try {
        const fetched = await fetchFountains();
        if (fetched && fetched.length > 0) {
          const osmList = fetched.filter((f) => f.isOsm);
          const userList = fetched.filter((f) => !f.isOsm);
          setOsmFountains(osmList);
          setFountains(userList);
        }
      } catch (err) {
        console.error("Backend Supabase retrieve error:", err);
      }
    };
    loadFromSupabase();
  }, []);

  // On-demand geocoding for selected fountain to enrich generic or missing address data
  useEffect(() => {
    if (!selectedFountainId) return;
    const selected = fountains.find((f) => f.id === selectedFountainId) || 
                     osmFountains.find((f) => f.id === selectedFountainId);
    if (!selected) return;

    const cacheKey = `${selected.lat.toFixed(5)},${selected.lng.toFixed(5)}`;
    
    // Only resolve if not already cached and we don't have a structured street address
    const needsGeocoding = !addressCache[cacheKey] && 
      (!selected.address || 
       selected.address === 'Indirizzo non presente' || 
       selected.address === 'Indirizzo non disponibile' || 
       selected.address === 'Dati da OpenStreetMap' || 
       selected.address === 'N/D' || 
       selected.address === 'n/d' || 
       selected.address === 'N.D.' || 
       selected.address.startsWith('Zona centrale') ||
       selected.address.startsWith('Lat:'));

    if (!needsGeocoding) return;

    const fetchGeo = async () => {
      try {
        const isGitHubPages = window.location.hostname.includes("github.io");
        const url = isGitHubPages
          ? `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${selected.lat}&lon=${selected.lng}&accept-language=it`
          : `/api/reverse-geocode?lat=${selected.lat}&lng=${selected.lng}`;

        const res = await fetch(url, {
          headers: isGitHubPages ? {} : { 'User-Agent': 'AquaMapWorldApplication/4.0 (ciancio.raffaella@gmail.com)' }
        });
        if (res.ok) {
          const data = await res.json();
          let cleanAddress = `Lat: ${selected.lat.toFixed(5)}, Lng: ${selected.lng.toFixed(5)}`;
          if (data) {
            const parsed = formatReverseGeocodeAddress(data);
            cleanAddress = parsed.address;
          }
            
          setAddressCache(prev => {
            const next = { ...prev, [cacheKey]: cleanAddress };
            localStorage.setItem('osm_address_cache_v2', JSON.stringify(next));
            return next;
          });
        }
      } catch (err) {
        console.error('On-demand geocode error:', err);
      }
    };

    fetchGeo();
  }, [selectedFountainId, addressCache, fountains, osmFountains]);

  // Combine both sources and enrich with on-demand cached geocoded address or fallback nearest city/address
  const allFountains = useMemo(() => {
    return [...fountains, ...osmFountains].map((f) => {
      let currentCity = f.city;
      let currentAddress = f.address;

      const isPlaceholderCity = !currentCity || 
                                currentCity === 'Altro' || 
                                currentCity === 'Altra' || 
                                currentCity === 'Sconosciuta' ||
                                currentCity === 'N/D' ||
                                currentCity === 'n/d' ||
                                currentCity === 'N.D.';

      const isPlaceholderAddress = !currentAddress || 
                                  currentAddress === 'Indirizzo non presente' || 
                                  currentAddress === 'Indirizzo non disponibile' ||
                                  currentAddress === 'Dati da OpenStreetMap' || 
                                  currentAddress === 'N/D' ||
                                  currentAddress === 'n/d' ||
                                  currentAddress === 'N.D.' ||
                                  currentAddress === 'Sconosciuta' ||
                                  currentAddress.startsWith('Lat:');

      // If city is placeholder-y or missing, associate it beautifully using coordinate lookup
      if (isPlaceholderCity) {
        const resolved = findNearestEuropeanCity(f.lat, f.lng);
        currentCity = resolved.city;
        if (isPlaceholderAddress) {
          currentAddress = resolved.address;
        }
      }

      // If address is placeholder-y but we have a valid city, create a beautiful fallback address
      if (isPlaceholderAddress && !isPlaceholderCity && currentCity) {
        currentAddress = `Zona centrale di ${currentCity}, Italia`;
      }

      // Check if we have an on-demand cached precise reverse-geocoded address
      const cacheKey = `${f.lat.toFixed(5)},${f.lng.toFixed(5)}`;
      if (addressCache[cacheKey]) {
        currentAddress = addressCache[cacheKey];
      }

      return {
        ...f,
        city: currentCity,
        address: currentAddress
      };
    });
  }, [fountains, osmFountains, addressCache]);

  const isSearching = filters.searchQuery.trim().length > 0;

  // Filter fountains that match the current search query globally
  const filteredSearchAllFountains = useMemo(() => {
    if (!isSearching) return allFountains;
    const query = filters.searchQuery.trim().toLowerCase();
    return allFountains.filter((f) => {
      return (
        f.name.toLowerCase().includes(query) ||
        (f.description && f.description.toLowerCase().includes(query)) ||
        f.address.toLowerCase().includes(query) ||
        f.city.toLowerCase().includes(query)
      );
    });
  }, [allFountains, isSearching, filters.searchQuery]);

  // Filter fountains that are inside the current map viewport
  const visibleFountainsInViewport = useMemo(() => {
    if (!currentBounds) {
      return allFountains;
    }
    return allFountains.filter((f) => {
      return (
        f.lat >= currentBounds.latMin &&
        f.lat <= currentBounds.latMax &&
        f.lng >= currentBounds.lngMin &&
        f.lng <= currentBounds.lngMax
      );
    });
  }, [allFountains, currentBounds]);

  // Determine what list of fountains should be rendered in the left list view
  const listFountainsToRender = useMemo(() => {
    if (isSearching) {
      return filteredSearchAllFountains;
    }
    return visibleFountainsInViewport;
  }, [isSearching, filteredSearchAllFountains, visibleFountainsInViewport]);

  // Zoomed too far warning: only when NOT searching, as searching overrides the full view to display answers
  const isZoomedOutTooFar = currentBounds 
    ? (!isSearching && visibleFountainsInViewport.length > 200) 
    : false;

  // Auto-center map on search matches (first matching fountains) OR dynamic OSM Nominatim Geocoding lookup on any city name
  const lastCenteredQueryRef = useRef<string>('');

  useEffect(() => {
    const query = filters.searchQuery.trim();
    if (query.length < 3) {
      lastCenteredQueryRef.current = '';
      return;
    }

    if (query.toLowerCase() === lastCenteredQueryRef.current.toLowerCase()) return;

    // Use debounce timer to prevent hitting rate limits while typing
    const timer = setTimeout(async () => {
      // 1. Check if we already have local matching objects in loaded bounds
      const localMatches = allFountains.filter((f) => {
        return (
          f.name.toLowerCase().includes(query.toLowerCase()) ||
          (f.description && f.description.toLowerCase().includes(query.toLowerCase())) ||
          f.address.toLowerCase().includes(query.toLowerCase()) ||
          f.city.toLowerCase().includes(query.toLowerCase())
        );
      });

      if (localMatches.length > 0) {
        lastCenteredQueryRef.current = query;
        const firstMatch = localMatches[0];
        setMapCenter({
          lat: firstMatch.lat,
          lng: firstMatch.lng,
          zoom: localMatches.length === 1 ? 17 : 14,
          trigger: Date.now(),
        });
        return;
      }

      // 2. Otherwise query Osm Nominatim API to geocode any city or address globally
      try {
        const isGitHubPages = window.location.hostname.includes("github.io");
        const url = isGitHubPages
          ? `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&accept-language=it`
          : `/api/geocode?q=${encodeURIComponent(query)}`;

        const response = await fetch(url, {
          headers: isGitHubPages ? {} : { 'User-Agent': 'AquaMapWorldApplication/4.0 (ciancio.raffaella@gmail.com)' }
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            const firstResult = data[0];
            const lat = Number(firstResult.lat);
            const lng = Number(firstResult.lon);

            lastCenteredQueryRef.current = query;
            setMapCenter({
              lat,
              lng,
              zoom: 14,
              trigger: Date.now(),
            });
            setToastMessage(`Mappa spostata su: ${firstResult.display_name.split(',')[0]} (Zona ${query})`);
          }
        }
      } catch (err) {
        console.error("Geocoding lookup error:", err);
      }
    }, 1000); // 1s typing debounce is perfect and friendly

    return () => clearTimeout(timer);
  }, [filters.searchQuery, allFountains]);

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

  // Callback to insert newly registered water fountain
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
    amenity: 'drinking_water' | 'toilets';
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
      amenity: data.amenity,
    };

    // Client-side optimistic update
    setFountains((prev) => [...prev, newFountain]);
    setAddCoords(null);
    setSelectedFountainId(newFountain.id);

    // Persist real-time to Supabase
    try {
      const savedFountain = await insertFountain(newFountain);
      if (savedFountain) {
        // swap state record with confirmed server-supplied db structure
        setFountains((prev) => prev.map(f => f.id === newFountain.id ? savedFountain : f));
        setToastMessage(`${data.amenity === 'toilets' ? 'Bagno Pubblico' : 'Fontanella'} salvato con successo su Supabase!`);
      }
    } catch (err) {
      console.warn("Could not save to Supabase. Operating with local localStorage fallback:", err);
    }
  };

  // geocode address via standard OpenStreetMap Nominatim and open save form
  const handleAddressGeocoding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedAddress || !typedCity) return;
    setGeocodingLoading(true);
    setGeocodingError(null);

    try {
      const query = `${typedAddress}, ${typedCity}`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&accept-language=it`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AquaMapWorldApplication/4.0 (ciancio.raffaella@gmail.com)' }
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          
          setAddCoords({
            lat,
            lng,
            address: data[0].display_name || `${typedAddress}, ${typedCity}`
          });
          
          setShowAddMenu(false);
          setTypedAddress('');
          setTypedCity('');
        } else {
          setGeocodingError("Indirizzo non trovato. Verifica la digitazione (es. Via Garibaldi 12, Milano).");
        }
      } else {
        setGeocodingError("Servizio di geocodifica momentaneamente offline, riprova più tardi.");
      }
    } catch (err) {
      console.error("Geocoding exception:", err);
      setGeocodingError("Impossibile contattare il server di geocodifica.");
    } finally {
      setGeocodingLoading(false);
    }
  };

  const handleSelectMapClickOption = () => {
    setShowAddMenu(false);
    setActiveView('map');
    setIsMapAddActive(true);
    setToastMessage(`Tocca un punto qualsiasi sulla mappa per posizionare il servizio: ${addMenuAmenity === 'toilets' ? 'Bagno Pubblico 🚻' : 'Fontanella ⛲'}`);
  };

  // Callback to submit a community report
  const handleAddReport = async (
    fountainId: string,
    type: 'status_change' | 'comment' | 'photo' | 'report_broken',
    comment: string,
    statusAfter: FountainStatus,
    rating: number,
    photo: string | null
  ) => {
    const isUserDef = fountains.some((f) => f.id === fountainId);
    
    // 1. Core local storage and reactive client updates (Optimistic Update)
    if (isUserDef) {
      setFountains((prev) =>
        prev.map((f) => {
          if (f.id !== fountainId) return f;

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
          const ratedLogs = newReports.filter((r) => r.rating !== undefined);
          const aggregatedRating =
            ratedLogs.length > 0
              ? ratedLogs.reduce((acc, curr) => acc + (curr.rating || 0), 0) / ratedLogs.length
              : f.rating;
          const updatedPhotos = photo ? [photo, ...f.photos] : f.photos;

          return {
            ...f,
            status: statusAfter,
            rating: Number(aggregatedRating.toFixed(1)),
            photos: updatedPhotos,
            reports: newReports,
          };
        })
      );
    } else {
      const f = osmFountains.find((item) => item.id === fountainId);
      if (f) {
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
        const ratedLogs = newReports.filter((r) => r.rating !== undefined);
        const aggregatedRating =
          ratedLogs.length > 0
            ? ratedLogs.reduce((acc, curr) => acc + (curr.rating || 0), 0) / ratedLogs.length
            : f.rating;
        const updatedPhotos = photo ? [photo, ...f.photos] : f.photos;

        setFountainUpdates((prev) => ({
          ...prev,
          [fountainId]: {
            status: statusAfter,
            rating: Number(aggregatedRating.toFixed(1)),
            photos: updatedPhotos,
            reports: newReports,
          },
        }));
      }
    }

    // 2. Sync to Supabase Table via unified submitReport helper
    try {
      const reportPayload = { type, comment, statusAfter, rating, photo };
      const syncedFountain = await submitReport(fountainId, reportPayload);
      if (syncedFountain) {
        if (syncedFountain.isOsm) {
          setOsmFountains((prev) => prev.map((item) => (item.id === fountainId ? syncedFountain : item)));
        } else {
          setFountains((prev) => prev.map((item) => (item.id === fountainId ? syncedFountain : item)));
        }
        setToastMessage("Segnalazione salvata con successo su Supabase!");
      }
    } catch (err) {
      console.warn("Could not save report to Supabase. Saved only in local memory:", err);
    }
  };

  const handleRefreshOsm = async () => {
    if (window.location.hostname.includes("github.io")) {
      try {
        setToastMessage("Inizio della sincronizzazione client-side con OpenStreetMap...");
        const result = await syncOsmClientSide((loadingMsg) => {
          setToastMessage(loadingMsg);
        });
        if (result.success) {
          setToastMessage(result.message);
          // Reload all fountains from direct Supabase
          const fetched = await fetchFountains();
          if (fetched && fetched.length > 0) {
            const osmList = fetched.filter((f) => f.isOsm);
            const userList = fetched.filter((f) => !f.isOsm);
            setOsmFountains(osmList);
            setFountains(userList);
          }
        } else {
          setToastMessage(`Errore: ${result.message}`);
        }
      } catch (err: any) {
        console.error("OSM sync trigger error client-side:", err);
        setToastMessage(`Errore di connessione: ${err.message || err}`);
      }
      return;
    }
    try {
      setToastMessage("Inizio della sincronizzazione con OpenStreetMap... Potrebbe richiedere 10-15 secondi.");
      const res = await fetch("/api/fountains/refresh-osm", {
        method: "POST",
      });
      if (res.ok) {
        setToastMessage("Sincronizzazione completata con successo! Caricamento delle fontanelle...");
        const loadRes = await fetch("/api/fountains");
        if (loadRes.ok) {
          const fetched: Fountain[] = await loadRes.json();
          if (fetched && fetched.length > 0) {
            const osmList = fetched.filter((f) => f.isOsm);
            const userList = fetched.filter((f) => !f.isOsm);
            setOsmFountains(osmList);
            setFountains(userList);
          }
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setToastMessage(`Errore di sincronizzazione: ${errData.error || res.statusText}`);
      }
    } catch (err: any) {
      console.error("OSM sync trigger error:", err);
      setToastMessage("Errore di connessione durante la sincronizzazione con OSM.");
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
            fountains={isZoomedOutTooFar ? [] : listFountainsToRender}
            filters={filters}
            setFilters={setFilters}
            selectedFountainId={selectedFountainId}
            onSelectFountain={setSelectedFountainId}
            userLocation={userLocation}
            onSelectCity={handleSelectCity}
            onRefreshOsm={handleRefreshOsm}
            onAddClick={() => {
              setShowAddMenu(true);
              setAddMenuStep('selection');
            }}
          />
        </div>

        {/* MIDDLE COMPONENT: Interactive Map View */}
        <div
          className={`flex-1 h-full flex flex-col relative z-10 ${
            activeView === 'map' ? 'flex' : 'hidden md:flex'
          }`}
        >
          <FountainMap
            fountains={isZoomedOutTooFar ? [] : listFountainsToRender.filter((f) => !f.isOsm).filter((f) => {
              const matchesStatus = filters.status === 'all' || f.status === filters.status;
              const matchesWaterType = filters.waterType === 'all' || f.waterType === filters.waterType;
              const matchesCity = filters.city === 'all' || f.city === filters.city;
              const matchesAmenity = filters.amenity === 'all' || 
                                     f.amenity === filters.amenity || 
                                     (filters.amenity === 'drinking_water' && !f.amenity);
              return matchesStatus && matchesWaterType && matchesCity && matchesAmenity;
            })}
            osmFountains={isZoomedOutTooFar ? [] : listFountainsToRender.filter((f) => f.isOsm).filter((f) => {
              const matchesStatus = filters.status === 'all' || f.status === filters.status;
              const matchesWaterType = filters.waterType === 'all' || f.waterType === filters.waterType;
              const matchesCity = filters.city === 'all' || f.city === filters.city;
              const matchesAmenity = filters.amenity === 'all' || 
                                     f.amenity === filters.amenity || 
                                     (filters.amenity === 'drinking_water' && !f.amenity);
              return matchesStatus && matchesWaterType && matchesCity && matchesAmenity;
            })}
            selectedFountainId={selectedFountainId}
            onSelectFountain={setSelectedFountainId}
            onMapClick={(coords) => {
              setAddCoords(coords);
              setIsMapAddActive(false);
            }}
            centerState={mapCenter}
            userLocation={userLocation}
            setUserLocation={setUserLocation}
            onBoundsChange={setCurrentBounds}
            filters={filters}
            setFilters={setFilters}
            isMapAddActive={isMapAddActive}
            setIsMapAddActive={setIsMapAddActive}
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
                  defaultAmenity={addMenuAmenity}
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
          <MapIcon className="w-5.5 h-5.5" />
          <span className="text-[10px] font-bold">Mappa</span>
        </button>

        {/* Floating Quick Plus (Tells users to tap on local map directly) */}
        <button
          onClick={() => {
            setShowAddMenu(true);
            setAddMenuStep('selection');
          }}
          className="flex items-center justify-center w-11 h-11 bg-brand hover:bg-brand-hover text-white rounded-full shadow-lg shadow-[#5a5a4040] cursor-pointer -mt-6 border-3 border-white transition-transform active:scale-90"
          title="Aggiungi Servizio"
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

      {/* ADD AMENITY WORKFLOW MENU OVERLAY */}
      <AnimatePresence>
        {showAddMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-natural-dark/50 backdrop-blur-xs flex items-center justify-center p-4 z-[9990]"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              className="bg-natural-bg rounded-3xl p-6 max-w-md w-full shadow-2xl border border-natural-border text-natural-dark relative"
            >
              <button
                onClick={() => setShowAddMenu(false)}
                type="button"
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-brand-light text-natural-muted hover:text-natural-dark cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              {addMenuStep === 'selection' ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-serif font-extrabold tracking-tight text-brand flex items-center gap-2">
                      <span>⛲</span> Mappa un Servizio
                    </h2>
                    <p className="text-xs text-natural-muted mt-1 font-semibold">
                      Aiuta la community a far crescere i punti acqua e igienici della città!
                    </p>
                  </div>

                  {/* Question 1: Quale amenity vuoi inserire? */}
                  <div className="space-y-2">
                    <label className="block text-xxs font-bold uppercase text-natural-muted tracking-wider">
                      1. Quale tipo di servizio vuoi inserire?
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setAddMenuAmenity('drinking_water')}
                        className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                          addMenuAmenity === 'drinking_water'
                            ? 'border-brand bg-brand-light/30 text-brand ring-2 ring-brand/20'
                            : 'border-natural-border hover:border-brand/40 hover:bg-white text-natural-dark'
                        }`}
                      >
                        <span className="text-2xl block mb-1">⛲</span>
                        <span className="text-xs font-bold block">Fontanella</span>
                        <span className="text-[10px] text-natural-muted block mt-0.5 font-medium">Acqua potabile</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAddMenuAmenity('toilets')}
                        className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                          addMenuAmenity === 'toilets'
                            ? 'border-indigo-600 bg-indigo-50/20 text-indigo-700 ring-2 ring-indigo-600/20'
                            : 'border-natural-border hover:border-indigo-600/40 hover:bg-white text-natural-dark'
                        }`}
                      >
                        <span className="text-2xl block mb-1">🚻</span>
                        <span className="text-xs font-bold block">Bagno Pubblico</span>
                        <span className="text-[10px] text-natural-muted block mt-0.5 font-medium">Servizi igienici</span>
                      </button>
                    </div>
                  </div>

                  {/* Question 2: Come la vuoi inserire? */}
                  <div className="space-y-3">
                    <label className="block text-xxs font-bold uppercase text-natural-muted tracking-wider">
                      2. Come lo vuoi inserire?
                    </label>
                    
                    {/* Method 1: Clic su mappa */}
                    <button
                      type="button"
                      onClick={handleSelectMapClickOption}
                      className="w-full p-4 rounded-2xl border border-natural-border hover:border-brand/60 hover:bg-white text-left transition-all cursor-pointer flex items-center gap-4 group"
                    >
                      <div className="w-10 h-10 bg-brand-light/50 group-hover:bg-brand-light rounded-xl flex items-center justify-center text-brand shrink-0">
                        <MapPin className="w-5 h-5 animate-pulse" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold block text-natural-dark">Clic sulla mappa</span>
                        <span className="text-[10px] text-natural-muted block mt-0.5 font-medium">Tocca direttamente sulla mappa il punto stradale esatto.</span>
                      </div>
                    </button>

                    {/* Method 2: Da indirizzo */}
                    <button
                      type="button"
                      onClick={() => setAddMenuStep('address')}
                      className="w-full p-4 rounded-2xl border border-natural-border hover:border-brand/60 hover:bg-white text-left transition-all cursor-pointer flex items-center gap-4 group"
                    >
                      <div className="w-10 h-10 bg-emerald-50 group-hover:bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                        <Search className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0 font-sans">
                        <span className="text-xs font-bold block text-natural-dark">Da indirizzo stradale</span>
                        <span className="text-[10px] text-natural-muted block mt-0.5 font-medium">Inserisci indirizzo e città per trovarlo all&apos;istante.</span>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-serif font-extrabold tracking-tight text-emerald-700 flex items-center gap-2">
                      <span>📍</span> Trova Indirizzo
                    </h2>
                    <p className="text-xs text-natural-muted mt-1 font-semibold">
                      Inserisci i dettagli stradali per localizzare il servizio sulla mappa ed attivare la scheda.
                    </p>
                  </div>

                  <form onSubmit={handleAddressGeocoding} className="space-y-4">
                    <div>
                      <label className="block text-xxs font-bold uppercase text-natural-muted tracking-wider mb-1.5">
                        Indirizzo e Numero Civico *
                      </label>
                      <input
                        type="text"
                        required
                        value={typedAddress}
                        onChange={(e) => setTypedAddress(e.target.value)}
                        placeholder="es. Via del Corso 11"
                        className="w-full text-sm border border-natural-border/70 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all bg-white text-natural-dark"
                      />
                    </div>

                    <div>
                      <label className="block text-xxs font-bold uppercase text-natural-muted tracking-wider mb-1.5">
                        Città *
                      </label>
                      <input
                        type="text"
                        required
                        value={typedCity}
                        onChange={(e) => setTypedCity(e.target.value)}
                        placeholder="es. Roma"
                        className="w-full text-sm border border-natural-border/70 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all bg-white text-natural-dark"
                      />
                    </div>

                    {geocodingError && (
                      <div className="p-3 bg-red-50 rounded-xl text-red-600 text-xxs font-bold leading-normal">
                        ⚠️ {geocodingError}
                      </div>
                    )}

                    <div className="pt-2 flex gap-3 font-sans">
                      <button
                        type="button"
                        onClick={() => setAddMenuStep('selection')}
                        className="flex-1 py-2.5 border border-natural-border text-natural-dark text-xs font-bold rounded-xl hover:bg-natural-light transition-all cursor-pointer"
                      >
                        Indietro
                      </button>
                      <button
                        type="submit"
                        disabled={geocodingLoading}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {geocodingLoading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>In corso...</span>
                          </>
                        ) : (
                          <span>Trova ed Inserisci</span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Toast System */}
      <AnimatePresence mode="wait">
        {(isZoomedOutTooFar || toastMessage) && (
          <motion.div
            key={isZoomedOutTooFar ? "zoomed-out-warning" : "dynamic-toast"}
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[11000] max-w-md w-[calc(100%-2rem)] px-5 py-3.5 text-white border shadow-2xl rounded-2xl flex items-center gap-2.5 ${
              isZoomedOutTooFar 
                ? "bg-amber-600 border-amber-500/30 font-medium" 
                : "bg-brand border-brand-light/25 shadow-brand/10"
            }`}
          >
            {isZoomedOutTooFar ? (
              <Info className="w-5 h-5 text-amber-200 shrink-0" />
            ) : (
              <Droplet className="w-5 h-5 text-brand-light fill-brand-light shrink-0" />
            )}
            <span className="text-xs font-bold leading-normal">
              {isZoomedOutTooFar 
                ? "Troppe fontanelle nell'area (più di 200). Zoomma più vicino per visualizzarle!"
                : toastMessage}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
