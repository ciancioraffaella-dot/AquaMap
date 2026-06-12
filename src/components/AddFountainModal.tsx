import React, { useState, useRef, useEffect } from 'react';
import { FountainStatus, WaterType } from '../types';
import { X, MapPin, Camera, AlertOctagon, CornerDownRight, Compass } from 'lucide-react';

interface AddFountainModalProps {
  coordinates: { lat: number; lng: number; address: string } | null;
  onClose: () => void;
  onSave: (data: {
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
  }) => void;
}

export default function AddFountainModal({ coordinates, onClose, onSave }: AddFountainModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<FountainStatus>('working');
  const [waterType, setWaterType] = useState<WaterType>('potabile');
  const [city, setCity] = useState('');
  const [flowRate, setFlowRate] = useState<'low' | 'medium' | 'high'>('medium');
  const [hasFilter, setHasFilter] = useState(false);
  const [addedBy, setAddedBy] = useState('EsploratoreAcqua');
  
  // Drag and Drop Photo
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prefill address and guess city when coordinates prop changes
  useEffect(() => {
    if (coordinates) {
      setAddress(coordinates.address);
      
      // Attempt to guess the city from the address dynamically
      const addressLower = coordinates.address.toLowerCase();
      const parts = coordinates.address.split(',');
      let guessedCity = 'Altra';
      
      if (addressLower.includes('roma')) {
        guessedCity = 'Roma';
      } else if (addressLower.includes('milano')) {
        guessedCity = 'Milano';
      } else if (addressLower.includes('torino')) {
        guessedCity = 'Torino';
      } else if (addressLower.includes('napoli')) {
        guessedCity = 'Napoli';
      } else if (addressLower.includes('firenze')) {
        guessedCity = 'Firenze';
      } else if (parts.length > 0) {
        // Dynamically guess from the address parts
        const possibleCity = parts[parts.length - 1].trim();
        if (possibleCity && isNaN(Number(possibleCity)) && possibleCity.length > 2) {
          guessedCity = possibleCity;
        } else if (parts.length > 1) {
          const secondPossible = parts[parts.length - 2].trim();
          if (secondPossible && isNaN(Number(secondPossible)) && secondPossible.length > 2) {
            guessedCity = secondPossible;
          }
        }
      }
      
      // Capitalize first letter cleanly
      if (guessedCity && guessedCity !== 'Altra') {
        guessedCity = guessedCity.charAt(0).toUpperCase() + guessedCity.slice(1);
      }
      
      setCity(guessedCity);
    }
  }, [coordinates]);

  if (!coordinates) return null;

  // Drag and drop photo upload
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name,
      description,
      lat: coordinates.lat,
      lng: coordinates.lng,
      address: address || coordinates.address,
      status,
      waterType,
      city: city || 'Roma',
      flowRate,
      hasFilter,
      photo: photoBase64,
      addedBy: addedBy || 'Anonimo',
    });
  };

  return (
    <div className="flex flex-col h-full bg-natural-bg text-natural-dark shadow-2xl relative select-none">
      {/* Header */}
      <div className="p-4 border-b border-natural-border flex items-center justify-between bg-brand text-white shrink-0">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 animate-spin" style={{ animationDuration: '8s' }} />
          <h2 className="text-sm font-serif font-bold tracking-tight">Inserisci Nuova Fontanella</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-brand-hover text-natural-light hover:text-white transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Coordinates Preview */}
        <div className="bg-white rounded-2xl p-4 border border-natural-border text-xs text-natural-dark flex flex-col gap-1">
          <div className="flex items-center gap-1 font-semibold text-brand">
            <MapPin className="w-4 h-4 shrink-0 text-brand" />
            <span>Punto Georeferenziato Rilevato</span>
          </div>
          <div className="flex items-center gap-1.5 pl-5 text-natural-muted mt-1 font-semibold font-mono">
            <span>Lat: {coordinates.lat.toFixed(5)}</span>
            <span>•</span>
            <span>Lng: {coordinates.lng.toFixed(5)}</span>
          </div>
        </div>

        {/* Name input */}
        <div>
          <label className="block text-xxs font-bold uppercase text-natural-muted tracking-wider mb-1.5">
            Nome della Fontanella *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="es. Nasone di Via Condotti, Toret Piazza Bernini..."
            className="w-full text-sm border border-natural-border/70 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all bg-white text-natural-dark"
          />
        </div>

        {/* Address */}
        <div>
          <label className="block text-xxs font-bold uppercase text-natural-muted tracking-wider mb-1.5">
            Indirizzo / Località Rilevata
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Modifica l'indirizzo per essere più specifico..."
            className="w-full text-sm border border-natural-border/70 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all bg-white text-natural-dark"
          />
        </div>

        {/* City & Creator Row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xxs font-bold uppercase text-natural-muted tracking-wider mb-1.5">
              Città Riferimento
            </label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full text-sm border border-natural-border/70 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all bg-white text-natural-dark cursor-pointer"
            >
              <option value="Roma">Roma</option>
              <option value="Milano">Milano</option>
              <option value="Torino">Torino</option>
              <option value="Napoli">Napoli</option>
              <option value="Firenze">Firenze</option>
              <option value="Altra">Altra Città</option>
            </select>
          </div>
          <div>
            <label className="block text-xxs font-bold uppercase text-natural-muted tracking-wider mb-1.5">
              Il tuo Nickname
            </label>
            <input
              type="text"
              required
              value={addedBy}
              onChange={(e) => setAddedBy(e.target.value)}
              placeholder="es. Marco_90"
              className="w-full text-sm border border-natural-border/70 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all bg-white text-natural-dark"
            />
          </div>
        </div>

        {/* Water Type & Flow speed */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xxs font-bold uppercase text-natural-muted tracking-wider mb-1.5">
              Tipologia Acqua
            </label>
            <select
              value={waterType}
              onChange={(e) => setWaterType(e.target.value as WaterType)}
              className="w-full text-sm border border-natural-border/70 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all bg-white text-natural-dark cursor-pointer"
            >
              <option value="potabile">💧 Potabile</option>
              <option value="frizzante">✨ Frizzante / Casa dell&apos;Acqua</option>
              <option value="non_potabile">⛔ Non Potabile</option>
            </select>
          </div>
          <div>
            <label className="block text-xxs font-bold uppercase text-natural-muted tracking-wider mb-1.5">
              Portata del Getto
            </label>
            <select
              value={flowRate}
              onChange={(e) => setFlowRate(e.target.value as 'low' | 'medium' | 'high')}
              className="w-full text-sm border border-natural-border/70 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all bg-white text-natural-dark cursor-pointer"
            >
              <option value="low">💧 Debole</option>
              <option value="medium">🕒 Normale</option>
              <option value="high">⚡ Forte / Abbondante</option>
            </select>
          </div>
        </div>

        {/* Status segment control */}
        <div>
          <label className="block text-xxs font-bold uppercase text-natural-muted tracking-wider mb-2">
            Stato Attuale della Fontanella *
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setStatus('working')}
              className={`py-2 text-center text-xs font-bold rounded-xl border transition-all ${
                status === 'working'
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                  : 'bg-white border-natural-border text-natural-dark hover:bg-natural-light'
              } cursor-pointer`}
            >
              🟢 Funzionante
            </button>
            <button
              type="button"
              onClick={() => setStatus('dry')}
              className={`py-2 text-center text-xs font-bold rounded-xl border transition-all ${
                status === 'dry'
                  ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
                  : 'bg-white border-natural-border text-natural-dark hover:bg-natural-light'
              } cursor-pointer`}
            >
              🟡 Secca / Chiara
            </button>
            <button
              type="button"
              onClick={() => setStatus('broken')}
              className={`py-2 text-center text-xs font-bold rounded-xl border transition-all ${
                status === 'broken'
                  ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                  : 'bg-white border-natural-border text-natural-dark hover:bg-natural-light'
              } cursor-pointer`}
            >
              🔴 Rotta
            </button>
          </div>
        </div>

        {/* Toggle option for filters */}
        <div className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-natural-border">
          <div>
            <span className="text-xs font-bold text-natural-dark block">Filtri di Purificazione</span>
            <span className="text-[10px] text-natural-muted font-medium block">Ha un sistema integrato attivo di depurazione o refrigerazione?</span>
          </div>
          <button
            type="button"
            onClick={() => setHasFilter(!hasFilter)}
            className={`w-11 h-6 rounded-full transition-all relative shrink-0 ${
              hasFilter ? 'bg-brand' : 'bg-natural-border'
            } cursor-pointer`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transform transition-all ${
                hasFilter ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* Detailed description */}
        <div>
          <label className="block text-xxs font-bold uppercase text-natural-muted tracking-wider mb-2">
            Descrizione Estesa
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2.5}
            placeholder="Scrivi indicazioni dettagliate sul punto esatto, ad esempio: si trova nascosto dietro l'edicola o sotto i giardini..."
            className="w-full text-sm border border-natural-border/70 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all bg-white placeholder-natural-muted/60 text-natural-dark"
          />
        </div>

        {/* Photo drag and drop */}
        <div>
          <label className="block text-xxs font-bold uppercase text-natural-muted tracking-wider mb-2">
            Allega una prima Foto (Drag-and-Drop)
          </label>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerFileInput}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-brand bg-brand-light'
                : photoBase64
                ? 'border-emerald-500 bg-emerald-50/10'
                : 'border-natural-border hover:border-brand/60 hover:bg-white'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            {photoBase64 ? (
              <div className="space-y-2">
                <img
                  src={photoBase64}
                  alt="Caricata"
                  referrerPolicy="no-referrer"
                  className="max-h-24 mx-auto rounded-lg object-contain shadow-xs border border-emerald-200"
                />
                <p className="text-xxs font-bold text-emerald-800">Foto allegata!</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhotoBase64(null);
                  }}
                  className="text-xxs font-bold text-red-500 hover:text-red-700 underline cursor-pointer"
                >
                  Ritiro foto
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center">
                <Camera className="w-9 h-9 text-natural-muted mb-1" />
                <span className="text-xs font-bold text-natural-dark">Trascina foto qui</span>
                <p className="text-xxs text-natural-muted mt-1">oppure selezionala manualmente</p>
              </div>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="pt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-natural-border text-natural-dark text-xs font-bold rounded-xl hover:bg-natural-light transition-all cursor-pointer"
          >
            Annulla
          </button>
          <button
            type="submit"
            className="flex-1 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl shadow-md shadow-[#5a5a4025] transition-all active:scale-98 cursor-pointer"
          >
            Pubblica Fontanella
          </button>
        </div>
      </form>
    </div>
  );
}
