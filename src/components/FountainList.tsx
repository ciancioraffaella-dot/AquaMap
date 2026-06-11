import { useState } from 'react';
import { Fountain, FountainFilter, FountainStatus, WaterType } from '../types';
import { CITIES } from '../data/seedData';
import { Search, Filter, Droplet, Star, MapPin, Eye, Compass, ThumbsUp, RefreshCw } from 'lucide-react';

interface FountainListProps {
  fountains: Fountain[];
  filters: FountainFilter;
  setFilters: (filters: FountainFilter) => void;
  selectedFountainId: string | null;
  onSelectFountain: (id: string | null) => void;
  userLocation: { lat: number; lng: number } | null;
  onSelectCity: (cityValue: string) => void;
  onRefreshOsm?: () => Promise<void>;
}

// Haversine formula to compute distance in meters
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2: number, lng1: number) => ((lng2 - lng1) * Math.PI) / 180)(lon2, lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function FountainList({
  fountains,
  filters,
  setFilters,
  selectedFountainId,
  onSelectFountain,
  userLocation,
  onSelectCity,
  onRefreshOsm,
}: FountainListProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncOsm = async () => {
    if (!onRefreshOsm || isSyncing) return;
    setIsSyncing(true);
    try {
      await onRefreshOsm();
    } finally {
      setIsSyncing(false);
    }
  };

  // Status badges mapping
  const getStatusBadge = (status: FountainStatus) => {
    switch (status) {
      case 'working':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Funzionante
          </span>
        );
      case 'dry':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Secca
          </span>
        );
      case 'broken':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
            Guasta / Riaprare
          </span>
        );
    }
  };

  const getWaterTypeBadge = (type: WaterType) => {
    switch (type) {
      case 'potabile':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xxs font-medium bg-cyan-50/80 text-cyan-800 border border-cyan-100">
            💧 Potabile
          </span>
        );
      case 'non_potabile':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xxs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
            ⛔ Non Potabile
          </span>
        );
      case 'frizzante':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xxs font-medium bg-blue-50 text-blue-700 border border-blue-100 font-semibold">
            ✨ Frizzante / Casa Acqua
          </span>
        );
    }
  };

  // Filter and compute distance for fountains
  const fountainsWithDistance = fountains.map((f) => {
    let distance: number | undefined;
    if (userLocation) {
      distance = getDistance(userLocation.lat, userLocation.lng, f.lat, f.lng);
    }
    return { ...f, distance };
  });

  // Apply filters
  const filteredFountains = fountainsWithDistance.filter((f) => {
    // Search query match (name, description, city, address)
    const matchesSearch =
      f.name.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
      f.description.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
      f.address.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
      f.city.toLowerCase().includes(filters.searchQuery.toLowerCase());

    // Status match
    const matchesStatus = filters.status === 'all' || f.status === filters.status;

    // Water type match
    const matchesWaterType = filters.waterType === 'all' || f.waterType === filters.waterType;

    // City match
    const matchesCity = filters.city === 'all' || f.city === filters.city;

    // If 'only nearby' is selected, distance must be within a threshold (e.g., 20km) and userLocation must exist
    const matchesNearby = !filters.onlyNearby || (f.distance !== undefined && f.distance <= 20000);

    return matchesSearch && matchesStatus && matchesWaterType && matchesCity && matchesNearby;
  });

  // Sort: If user location is active, sort by distance. Otherwise, sort by rating and city
  const sortedFountains = [...filteredFountains].sort((a, b) => {
    if (userLocation) {
      if (a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
    }
    // Secondary sort: working first, then highest rating
    if (a.status === 'working' && b.status !== 'working') return -1;
    if (a.status !== 'working' && b.status === 'working') return 1;
    return b.rating - a.rating;
  });

  return (
    <div className="flex flex-col h-full bg-natural-bg select-none">
      {/* Brand Header */}
      <div className="p-4 bg-white border-b border-natural-border flex items-center justify-between shrink-0 font-sans">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand text-white shadow-sm">
            <Droplet className="w-4 h-4 fill-white text-white" />
          </div>
          <div>
            <h1 className="text-base font-serif font-semibold text-natural-dark tracking-tight">
              AquaMap
            </h1>
            <p className="text-[10px] text-natural-muted font-medium">Mappa Globale delle Fontanelle</p>
          </div>
        </div>

        {onRefreshOsm && (
          <button
            onClick={handleSyncOsm}
            disabled={isSyncing}
            className={`p-2 rounded-xl border border-natural-border text-natural-muted hover:text-brand hover:border-brand-hover/40 bg-white hover:bg-brand-light/30 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
              isSyncing ? 'opacity-85 pointer-events-none' : ''
            }`}
            title="Sincronizza fontanelle da OpenStreetMap (OSM) su Supabase"
            id="btn-sync-osm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-brand' : ''}`} />
            <span>{isSyncing ? 'Sincronizzazione...' : 'Sincronizza OSM'}</span>
          </button>
        )}
      </div>

      {/* Primary Search Controls */}
      <div className="p-4 border-b border-natural-border shrink-0 bg-[#fdfbf7]">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-natural-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Cerca via, nome o città..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="w-full pl-9 pr-4 py-2 text-sm bg-natural-light border border-natural-border/30 rounded-full focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all text-natural-dark placeholder-natural-muted/60"
            />
          </div>
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`px-3 py-2 border rounded-xl flex items-center gap-1.5 text-sm font-medium transition-all ${
              showAdvancedFilters || filters.status !== 'all' || filters.waterType !== 'all'
                ? 'bg-brand text-white border-brand'
                : 'bg-white border-natural-border text-natural-dark hover:bg-natural-light'
            } cursor-pointer`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filtri</span>
          </button>
        </div>

        {/* Advanced Filters Drawer */}
        {showAdvancedFilters && (
          <div className="mt-4 p-3.5 bg-white border border-natural-border rounded-2xl shadow-sm space-y-3">
            {/* Status Segmented Control */}
            <div>
              <label className="block text-xxs font-bold uppercase tracking-wider text-natural-muted mb-1.5">
                Stato della Fontanella
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['all', 'working', 'dry', 'broken'] as const).map((stat) => (
                  <button
                    key={stat}
                    onClick={() => setFilters({ ...filters, status: stat })}
                    className={`py-1.5 px-1 text-center text-xs font-medium rounded-lg border transition-all truncate capitalize ${
                      filters.status === stat
                        ? 'bg-brand border-brand text-white shadow-sm'
                        : 'bg-natural-light border-transparent text-natural-dark hover:bg-natural-border/30'
                    } cursor-pointer`}
                  >
                    {stat === 'all'
                      ? 'Tutte'
                      : stat === 'working'
                      ? 'Attive'
                      : stat === 'dry'
                      ? 'Secche'
                      : 'Guaste'}
                  </button>
                ))}
              </div>
            </div>

            {/* Water Type Filter */}
            <div>
              <label className="block text-xxs font-bold uppercase tracking-wider text-natural-muted mb-1.5">
                Tipologia Acqua
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['all', 'potabile', 'non_potabile', 'frizzante'] as const).map((wt) => (
                  <button
                    key={wt}
                    onClick={() => setFilters({ ...filters, waterType: wt })}
                    className={`py-1.5 px-1 text-center text-xs font-medium rounded-lg border transition-all truncate ${
                      filters.waterType === wt
                        ? 'bg-brand border-brand text-white shadow-sm'
                        : 'bg-natural-light border-transparent text-natural-dark hover:bg-natural-border/30'
                    } cursor-pointer`}
                  >
                    {wt === 'all'
                      ? 'Qualsiasi'
                      : wt === 'potabile'
                      ? 'Potabile'
                      : wt === 'non_potabile'
                      ? 'Non Pot.'
                      : 'Frizzante'}
                  </button>
                ))}
              </div>
            </div>

            {/* GPS Nearby Switcher */}
            {userLocation && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-natural-dark font-medium">Risultati vicini a me (&lt;20km)</span>
                <button
                  onClick={() => setFilters({ ...filters, onlyNearby: !filters.onlyNearby })}
                  className={`w-11 h-6 rounded-full transition-all relative ${
                    filters.onlyNearby ? 'bg-brand' : 'bg-natural-border'
                  } cursor-pointer`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transform transition-all ${
                      filters.onlyNearby ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Listing container */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-natural-bg">
        {sortedFountains.length > 0 ? (
          <div className="p-4 space-y-3">
            {sortedFountains.map((fountain) => {
              const isSelected = fountain.id === selectedFountainId;
              return (
                <div
                  key={fountain.id}
                  onClick={() => onSelectFountain(fountain.id)}
                  className={`p-3.5 bg-white border rounded-2xl transition-all duration-200 cursor-pointer text-natural-dark ${
                    isSelected
                      ? 'border-brand ring-4 ring-brand/10 bg-natural-light/20 shadow-md transform -translate-y-0.5'
                      : 'border-natural-border hover:border-brand/40 hover:shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-serif font-semibold text-sm text-natural-dark truncate leading-tight flex-1">
                      {fountain.name}
                    </h3>
                    {fountain.distance !== undefined && (
                      <span className="text-xxs font-semibold text-brand bg-brand-light px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0 font-mono">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {formatDistance(fountain.distance)}
                      </span>
                    )}
                  </div>

                  {/* Badges Row */}
                  <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                    {getStatusBadge(fountain.status)}
                    {getWaterTypeBadge(fountain.waterType)}
                  </div>

                  {/* Address */}
                  <p className="mt-2 text-xs text-natural-muted font-medium line-clamp-1 flex items-center gap-1">
                    <span className="opacity-70">📍</span> {fountain.address}{fountain.city ? `, ${fountain.city}` : ''}
                  </p>

                  {/* Stats and image thumbnail preview */}
                  <div className="mt-3.5 pt-3.5 border-t border-natural-border/50 flex items-center justify-between text-xxs text-natural-muted font-medium">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center text-amber-600 gap-0.5 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100/50">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                        <span className="font-bold text-amber-700">{fountain.rating.toFixed(1)}</span>
                      </div>
                      <span>•</span>
                      <span className="text-natural-muted font-medium">
                        {fountain.reports.length === 1
                          ? '1 segnalazione'
                          : `${fountain.reports.length} segnalazioni`}
                      </span>
                    </div>

                    {fountain.photos.length > 0 && (
                      <div className="flex items-center -space-x-1.5">
                        {fountain.photos.slice(0, 3).map((photo, i) => (
                          <img
                            key={i}
                            src={photo}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-5 h-5 rounded-full object-cover border border-white shadow-xs"
                          />
                        ))}
                        {fountain.photos.length > 3 && (
                          <div className="w-5 h-5 rounded-full bg-natural-light text-natural-dark border border-white text-[9px] font-bold flex items-center justify-center">
                            +{fountain.photos.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-natural-muted max-w-sm mx-auto flex flex-col items-center justify-center h-full">
            <div className="w-16 h-16 rounded-full bg-natural-light flex items-center justify-center text-natural-muted mb-4 shadow-sm border border-natural-border/30">
              <Compass className="w-8 h-8 text-natural-muted animate-spin" style={{ animationDuration: '8s' }} />
            </div>
            <h4 className="font-serif font-semibold text-natural-dark text-base">Nessuna fontanella trovata</h4>
            <p className="mt-1.5 text-xs text-natural-muted leading-relaxed">
              Prova a cambiare città, digitare un indirizzo diverso o ad azzerare i filtri di ricerca nel menù.
            </p>
            <button
              onClick={() => setFilters({ searchQuery: '', status: 'all', waterType: 'all', onlyNearby: false, city: 'all' })}
              className="mt-4 text-xs font-semibold text-brand hover:text-brand-hover px-4 py-2 bg-natural-light hover:bg-natural-border/20 rounded-xl transition-colors border border-natural-border/60 cursor-pointer"
            >
              Azzera tutti i filtri
            </button>
          </div>
        )}
      </div>

      {/* Quick stats banner in Footer */}
      <div className="p-3 bg-brand text-natural-light border-t border-brand-hover shrink-0 text-[10px] flex items-center justify-between font-medium select-none uppercase tracking-wider">
        <span className="opacity-90">{fountains.length} Fontanelle Censite</span>
        <span className="font-bold text-white bg-brand-hover/80 py-0.5 px-2.5 rounded-full border border-white/10">
          {fountains.filter(f => f.status === 'working').length} attive
        </span>
      </div>
    </div>
  );
}
