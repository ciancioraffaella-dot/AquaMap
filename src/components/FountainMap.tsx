import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Fountain, FountainStatus, FountainFilter } from '../types';
import { Locate, Navigation, Plus, Compass } from 'lucide-react';
import { formatReverseGeocodeAddress } from '../supabaseClient';

interface FountainMapProps {
  fountains: Fountain[];
  osmFountains: Fountain[];
  selectedFountainId: string | null;
  onSelectFountain: (id: string | null) => void;
  onMapClick: (coords: { lat: number; lng: number; address: string }) => void;
  centerState: { lat: number; lng: number; zoom: number; trigger: number };
  userLocation: { lat: number; lng: number } | null;
  setUserLocation: (loc: { lat: number; lng: number }) => void;
  onBoundsChange?: (bounds: { latMin: number; latMax: number; lngMin: number; lngMax: number }) => void;
  filters?: FountainFilter;
  setFilters?: React.Dispatch<React.SetStateAction<FountainFilter>>;
  isMapAddActive?: boolean;
  setIsMapAddActive?: (val: boolean) => void;
}

export default function FountainMap({
  fountains,
  osmFountains,
  selectedFountainId,
  onSelectFountain,
  onMapClick,
  centerState,
  userLocation,
  setUserLocation,
  onBoundsChange,
  filters,
  setFilters,
  isMapAddActive = false,
  setIsMapAddActive,
}: FountainMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.FeatureGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);

  const isMapAddActiveRef = useRef(isMapAddActive);
  useEffect(() => {
    isMapAddActiveRef.current = isMapAddActive;
  }, [isMapAddActive]);

  // Helper to construct SVG markers for different fountain states
  const createCustomIcon = (status: FountainStatus, isActive: boolean, amenity?: string) => {
    const isToilets = amenity === 'toilets';
    let bgColor = 'bg-brand';
    let ringStyle = isActive ? 'ring-4 ring-brand scale-115 z-[1000]' : 'hover:scale-110';
    let iconHtml = '';

    if (isToilets) {
      bgColor = 'bg-indigo-600';
      ringStyle = isActive ? 'ring-4 ring-indigo-500 scale-115 z-[1000]' : 'hover:scale-110';
      if (status === 'broken') {
        bgColor = 'bg-rose-600';
      } else if (status === 'dry') {
        bgColor = 'bg-amber-600';
      }
      iconHtml = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M7 21v-6H5v-5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v5H9v6z"/><circle cx="8" cy="5" r="1"/><path d="M16 21v-5h1v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4h1v5z"/><circle cx="15" cy="5" r="1"/></svg>
      `;
    } else {
      if (status === 'working') {
        bgColor = 'bg-emerald-600';
        iconHtml = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-white animate-pulse"><path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-11-7-11S5 10.7 5 15a7 7 0 0 0 7 7z"/></svg>
        `;
      } else if (status === 'dry') {
        bgColor = 'bg-amber-600';
        iconHtml = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-white"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9.1 9.1a7 7 0 0 0 9.9 9.9"/><path d="m14.9 14.9 2.1-3.9s-7-11-7-11S5 10.7 5 15a7 7 0 0 0 1.2 3.9"/></svg>
        `;
      } else {
        // broken
        bgColor = 'bg-rose-600';
        iconHtml = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        `;
      }
    }

    return L.divIcon({
      html: `
        <div class="flex items-center justify-center w-9 h-9 rounded-full shadow-md text-white transition-all duration-300 ${bgColor} ${ringStyle}">
          ${iconHtml}
          ${isActive ? '<div class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white ripple-ping animate-ping"></div>' : ''}
        </div>
      `,
      className: 'custom-fountain-marker',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  };

  // --- Initialize Map ---
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Ensure we create the map instance exactly once
    const map = L.map(mapContainerRef.current, {
      zoomControl: false, // will reposition it later
      attributionControl: true,
    }).setView([45.4642, 9.1900], 13); // Milano by default

    // Add standard modern CartoDB Voyager map tiles (looks much cleaner & premium than standard OSM)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Custom positioned zoom control at bottom-right
    L.control.zoom({
      position: 'bottomright'
    }).addTo(map);

    // Create a markers group
    const markersGroup = L.featureGroup().addTo(map);

    mapRef.current = map;
    markersGroupRef.current = markersGroup;

    // Handle map click for registering new fountains
    map.on('click', async (e: L.LeafletMouseEvent) => {
      if (!isMapAddActiveRef.current) {
        onSelectFountain(null);
        return;
      }

      const { lat, lng } = e.latlng;
      setAddressLoading(true);
      let addressStr = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;

      // Try server-side reverse geocoding via secure proxy API first, or fallback direct to Osm Nominatim if on GitHub Pages
      try {
        const isGitHubPages = window.location.hostname.includes("github.io");
        const url = isGitHubPages
          ? `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=it`
          : `/api/reverse-geocode?lat=${lat}&lng=${lng}`;

        const response = await fetch(url, {
          headers: isGitHubPages ? {} : { 'User-Agent': 'AquaMapWorldApplication/4.0 (ciancio.raffaella@gmail.com)' }
        });

        if (response.ok) {
          const data = await response.json();
          if (data) {
            const parsed = formatReverseGeocodeAddress(data);
            addressStr = parsed.address;
          }
        }
      } catch (err) {
        console.error('Reverse geocoding error', err);
      } finally {
        setAddressLoading(false);
      }

      onMapClick({ lat, lng, address: addressStr });
    });

    const handleMapMovement = () => {
      const bounds = map.getBounds();
      setMapBounds(bounds);

      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      if (onBoundsChange) {
        onBoundsChange({
          latMin: sw.lat,
          latMax: ne.lat,
          lngMin: sw.lng,
          lngMax: ne.lng,
        });
      }
    };

    map.on('moveend', handleMapMovement);
    map.on('zoomend', handleMapMovement);

    const boundsTimer = setTimeout(handleMapMovement, 100);

    return () => {
      clearTimeout(boundsTimer);
      map.off('moveend', handleMapMovement);
      map.off('zoomend', handleMapMovement);
      map.remove();
      mapRef.current = null;
      markersGroupRef.current = null;
      userMarkerRef.current = null;
    };
  }, []);

  // --- Dynamic City / Selection Centering ---
  useEffect(() => {
    if (!mapRef.current || centerState.trigger === 0) return;
    mapRef.current.setView([centerState.lat, centerState.lng], centerState.zoom, {
      animate: true,
      duration: 1.0,
    });
  }, [centerState]);

  // --- Sync Markers with Fountains list (including OSM) ---
  useEffect(() => {
    const map = mapRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();
    
    // Combine local + osm
    const allFountains = [...fountains, ...osmFountains];

    // Filter by bounds with a padded buffer zone to keep scroll operation completely fluid
    let visibleFountains = allFountains;
    if (mapBounds) {
      const paddedBounds = mapBounds.pad(0.15); // 15% padding
      visibleFountains = allFountains.filter((f) => {
        if (f.id === selectedFountainId) return true;
        return paddedBounds.contains([f.lat, f.lng]);
      });
    }

    visibleFountains.forEach((fountain) => {
      const isActive = fountain.id === selectedFountainId;
      const marker = L.marker([fountain.lat, fountain.lng], {
        icon: createCustomIcon(fountain.status, isActive, fountain.amenity),
      });

      // Interactive popup
      marker.on('click', (e) => {
        onSelectFountain(fountain.id);
        L.DomEvent.stopPropagation(e);
      });

      markersGroup.addLayer(marker);
    });
  }, [fountains, osmFountains, selectedFountainId, mapBounds]);

  // --- Handle Geolocation ---
  const handleGPSLocation = () => {
    if (!mapRef.current) return;
    setGpsLoading(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('La geolocalizzazione non è supportata dal tuo browser.');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setGpsLoading(false);

        // Pan and Zoom
        mapRef.current?.setView([latitude, longitude], 15, {
          animate: true,
          duration: 1.2
        });

        // Add or update live position pulsing marker (using premium blue GPS dot with surrounding pulse glow)
        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng([latitude, longitude]);
        } else {
          const userIcon = L.divIcon({
            html: `
              <div class="relative flex items-center justify-center">
                <div class="absolute w-7 h-7 bg-blue-500 rounded-full opacity-30 animate-ping"></div>
                <div class="relative w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>
              </div>
            `,
            className: 'user-pulse-marker',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });

          userMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon })
            .addTo(mapRef.current!)
            .bindPopup('<strong class="text-xs text-brand font-bold select-none">La tua posizione</strong>', { offset: [0, -6] });
        }
      },
      (error) => {
        console.error('GPS error:', error);
        setGpsLoading(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsError('Permesso di localizzazione negato. Abilita il GPS nelle impostazioni.');
        } else {
          setGpsError('Impossibile rilevare la posizione GPS in questo momento.');
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Auto-centering user location on map ready
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapRef.current) {
        handleGPSLocation();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div id="map-wrap" className="relative w-full h-full min-h-[300px] md:min-h-0 bg-natural-bg flex-1 h-[45vh] md:h-full overflow-hidden">
      {/* Target Container for Leaflet */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Action Buttons floating on map in the top right corner */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        {/* GPS location button */}
        <button
          onClick={handleGPSLocation}
          id="btn-localize"
          className="flex items-center justify-center w-11 h-11 bg-white hover:bg-natural-light text-natural-dark rounded-xl shadow-lg border border-natural-border transition-all active:scale-95 cursor-pointer hover:text-brand"
          title="Rileva la mia posizione GPS"
          disabled={gpsLoading}
        >
          {gpsLoading ? (
            <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Navigation className="w-5 h-5 text-brand fill-brand-light" />
          )}
        </button>
      </div>

      {/* Help Banner at the Top Middle of the map only during active placing */}
      {isMapAddActive && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 max-w-xs md:max-w-md w-max bg-emerald-600/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-xl border border-emerald-500/30 flex items-center gap-2 text-white text-xs md:text-sm animate-pulse">
          <span className="text-sm">📍</span>
          <span className="font-bold text-white leading-normal">
            Tocca la mappa nel punto esatto per posizionare!
          </span>
          <button
            onClick={() => setIsMapAddActive && setIsMapAddActive(false)}
            className="ml-1 bg-black/30 hover:bg-black/50 text-white hover:text-rose-200 text-[10px] font-black px-2 py-0.5 rounded-md transition-colors cursor-pointer"
          >
            ANNULLA
          </button>
        </div>
      )}

      {addressLoading && (
        <div className="absolute bottom-20 left-4 z-20 bg-white shadow-xl rounded-xl px-4 py-3 flex items-center gap-3 border border-natural-border text-natural-dark text-xs font-semibold">
          <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
          <span>Acquisizione indirizzo...</span>
        </div>
      )}

      {/* Floating Filter Selector over the Map */}
      {filters && setFilters && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white/95 backdrop-blur-md p-1 rounded-2xl shadow-xl border border-natural-border flex items-center gap-1 whitespace-nowrap">
          <button
            onClick={() => setFilters(prev => ({ ...prev, amenity: 'all' }))}
            className={`px-3 py-1.5 rounded-xl text-[11px] md:text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              filters.amenity === 'all'
                ? 'bg-brand text-white'
                : 'text-natural-dark hover:bg-natural-light border border-transparent'
            }`}
          >
            <span>🌍</span>
            <span>Tutti</span>
          </button>
          <button
            onClick={() => setFilters(prev => ({ ...prev, amenity: 'drinking_water' }))}
            className={`px-3 py-1.5 rounded-xl text-[11px] md:text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              filters.amenity === 'drinking_water'
                ? 'bg-emerald-600 text-white'
                : 'text-natural-dark hover:bg-natural-light border border-transparent'
            }`}
          >
            <span>⛲</span>
            <span>Fontanelle</span>
          </button>
          <button
            onClick={() => setFilters(prev => ({ ...prev, amenity: 'toilets' }))}
            className={`px-3 py-1.5 rounded-xl text-[11px] md:text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              filters.amenity === 'toilets'
                ? 'bg-indigo-600 text-white'
                : 'text-natural-dark hover:bg-natural-light border border-transparent'
            }`}
          >
            <span>🚻</span>
            <span>Bagni</span>
          </button>
        </div>
      )}

      {/* GPS Error Alert Toast */}
      {gpsError && (
        <div className="absolute top-20 right-4 z-20 bg-[#fdfbf6] shadow-xl rounded-xl p-3 border border-natural-border text-natural-dark text-xs max-w-xs flex items-start gap-2">
          <span>⚠️</span>
          <div>
            <div className="font-bold select-none text-brand">GPS Info</div>
            <p className="mt-0.5 text-natural-muted leading-normal font-semibold">{gpsError}</p>
          </div>
          <button
            onClick={() => setGpsError(null)}
            className="text-brand hover:text-brand-hover ml-auto font-bold pl-2 cursor-pointer text-sm"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
