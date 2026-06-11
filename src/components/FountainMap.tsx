import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Fountain, FountainStatus } from '../types';
import { Locate, Navigation, Plus, Compass } from 'lucide-react';

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
}: FountainMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.FeatureGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);

  // Helper to construct SVG markers for different fountain states
  const createCustomIcon = (status: FountainStatus, isActive: boolean) => {
    let bgColor = 'bg-brand';
    let ringStyle = isActive ? 'ring-4 ring-brand scale-115 z-[1000]' : 'hover:scale-110';
    let iconHtml = '';

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
      const { lat, lng } = e.latlng;
      setAddressLoading(true);
      let addressStr = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;

      // Try server-side reverse geocoding via our secure proxy API.
      // Safe to try, with robust fallback if network fails or offline.
      try {
        const response = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.display_name) {
            // Trim to cleaner address
            const parts = data.display_name.split(',');
            addressStr = parts.slice(0, 3).join(',').trim();
          }
        }
      } catch (err) {
        console.error('Reverse geocoding error', err);
      } finally {
        setAddressLoading(false);
      }

      onMapClick({ lat, lng, address: addressStr });
    });

    const triggerBoundsChange = () => {
      const bounds = map.getBounds();
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

    map.on('moveend', triggerBoundsChange);
    map.on('zoomend', triggerBoundsChange);

    const boundsTimer = setTimeout(triggerBoundsChange, 100);

    return () => {
      clearTimeout(boundsTimer);
      map.off('moveend', triggerBoundsChange);
      map.off('zoomend', triggerBoundsChange);
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

    allFountains.forEach((fountain) => {
      const isActive = fountain.id === selectedFountainId;
      const marker = L.marker([fountain.lat, fountain.lng], {
        icon: createCustomIcon(fountain.status, isActive),
      });

      // Interactive popup
      marker.on('click', (e) => {
        onSelectFountain(fountain.id);
        L.DomEvent.stopPropagation(e);
      });

      markersGroup.addLayer(marker);
    });
  }, [fountains, osmFountains, selectedFountainId]);

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

        // Add or update live position pulsing marker (using matching earthy brand highlight)
        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng([latitude, longitude]);
        } else {
          const userIcon = L.divIcon({
            html: `
              <div class="relative flex items-center justify-center w-6 h-6 border-2 border-white rounded-full bg-[#5a5a40] shadow-lg pulse-primary">
                <div class="w-2.5 h-2.5 bg-white rounded-full"></div>
              </div>
            `,
            className: 'user-pulse-marker',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          userMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon })
            .addTo(mapRef.current!)
            .bindPopup('<strong class="text-xs font-serif text-natural-dark">La tua posizione</strong>', { offset: [0, -10] });
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

  return (
    <div id="map-wrap" className="relative w-full h-full min-h-[300px] md:min-h-0 bg-natural-bg flex-1 h-[45vh] md:h-full overflow-hidden">
      {/* Target Container for Leaflet */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Geolocalize floating button */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
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

      {/* Help Banner at the Top Middle of the map */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 max-w-xs md:max-w-md w-max bg-brand/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border border-brand-hover/40 flex items-center gap-2 text-white pointer-events-none text-xs md:text-sm">
        <Compass className="w-4 h-4 text-brand-light shrink-0" />
        <span className="font-medium text-natural-light">
          Tocca la mappa per aggiungere una fontanella
        </span>
      </div>

      {addressLoading && (
        <div className="absolute bottom-20 left-4 z-20 bg-white shadow-xl rounded-xl px-4 py-3 flex items-center gap-3 border border-natural-border text-natural-dark text-xs font-semibold">
          <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
          <span>Acquisizione indirizzo...</span>
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
