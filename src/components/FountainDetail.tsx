import React, { useState, useRef } from 'react';
import { Fountain, Report, FountainStatus, WaterType } from '../types';
import { 
  X, Star, MapPin, Calendar, User, Info, 
  CheckCircle2, AlertTriangle, CloudRain, ShieldCheck, 
  MessageSquare, Camera, ArrowLeft, Heart, Sparkles,
  Compass
} from 'lucide-react';

interface FountainDetailProps {
  fountain: Fountain;
  onClose: () => void;
  onAddReport: (fountainId: string, type: 'status_change' | 'comment' | 'photo' | 'report_broken', comment: string, statusAfter: FountainStatus, rating: number, photo: string | null) => void;
}

export default function FountainDetail({ fountain, onClose, onAddReport }: FountainDetailProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'segnala'>('info');
  const [ratingInput, setRatingInput] = useState<number>(5);
  const [commentInput, setCommentInput] = useState<string>('');
  const [statusInput, setStatusInput] = useState<FountainStatus>(fountain.status);
  
  // Drag and drop photo upload state
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getStatusLabelAndColor = (status: FountainStatus) => {
    switch (status) {
      case 'working':
        return { label: 'Funzionante', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 };
      case 'dry':
        return { label: 'Secca / Spenta', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: AlertTriangle };
      case 'broken':
        return { label: 'Guasta / Perdite', color: 'bg-rose-100 text-rose-800 border-rose-200', icon: AlertTriangle };
    }
  };

  const statusInfo = getStatusLabelAndColor(fountain.status);
  const StatusIcon = statusInfo.icon;

  const getWaterTypeLabel = (type: WaterType) => {
    switch (type) {
      case 'potabile': return 'Acqua Potabile';
      case 'non_potabile': return 'Acqua Non Potabile';
      case 'frizzante': return 'Acqua Frizzante / Filtrata';
    }
  };

  // Drag and drop handlers
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

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() && !photoBase64) return;

    // Deduce report type
    let reportType: 'status_change' | 'comment' | 'photo' | 'report_broken' = 'comment';
    if (photoBase64) {
      reportType = 'photo';
    } else if (statusInput !== fountain.status) {
      reportType = statusInput === 'broken' ? 'report_broken' : 'status_change';
    }

    onAddReport(
      fountain.id,
      reportType,
      commentInput,
      statusInput,
      ratingInput,
      photoBase64
    );

    // Reset Form
    setCommentInput('');
    setPhotoBase64(null);
    setActiveTab('info');
  };

  return (
    <div className="flex flex-col h-full bg-natural-bg text-natural-dark shadow-2xl relative select-none">
      {/* Header Panel */}
      <div className="p-4 border-b border-natural-border flex items-center justify-between bg-brand text-white shrink-0">
        <button 
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-natural-light hover:text-white transition-colors cursor-pointer font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Torna alla lista
        </button>
        <button 
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-brand-hover text-natural-light hover:text-white transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Gallery / Image header */}
        <div className="relative h-48 md:h-56 bg-natural-border/25 overflow-hidden shrink-0">
          {fountain.photos.length > 0 ? (
            <img 
              src={fountain.photos[0]} 
              alt={fountain.name} 
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-natural-light to-natural-border/30 text-natural-muted p-6">
              <Camera className="w-10 h-10 mb-2 opacity-60 text-natural-muted" />
              <span className="text-xs font-semibold select-none">Nessuna foto disponibile</span>
              <p className="text-xxs text-natural-muted select-none text-center max-w-[200px] mt-1">Carica la prima foto per guadagnare punti reputazione!</p>
            </div>
          )}
          {/* Water Type Floating Badge */}
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs px-3 py-1 rounded-full text-xs font-semibold text-natural-dark border border-natural-border shadow-xs flex items-center gap-1">
            <span>💧</span> {getWaterTypeLabel(fountain.waterType)}
          </div>
        </div>

        {/* Core Fountain Identity */}
        <div className="p-5 border-b border-natural-border bg-white">
          <div className="flex justify-between items-start gap-3">
            <div>
              <h2 className="text-xl font-serif font-bold text-natural-dark tracking-tight leading-snug">{fountain.name}</h2>
              <p className="text-xs text-natural-muted font-medium flex items-center gap-1.5 mt-1.5">
                <MapPin className="w-3.5 h-3.5 text-brand shrink-0" />
                {fountain.address && fountain.city && fountain.address.toLowerCase().includes(fountain.city.toLowerCase()) ? fountain.address : `${fountain.address || ''}${fountain.city ? `, ${fountain.city}` : ''}`}
              </p>
              <p className="text-xs text-natural-muted font-medium flex items-center gap-1.5 mt-1">
                <Compass className="w-3.5 h-3.5 text-brand shrink-0" />
                Lat: {fountain.lat.toFixed(5)}, Lng: {fountain.lng.toFixed(5)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5 items-center">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.color}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {statusInfo.label}
            </span>
            <div className="flex items-center text-amber-650 gap-1 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100/60 text-xs font-semibold">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
              <span>{fountain.rating.toFixed(1)} / 5</span>
            </div>
          </div>
        </div>

        {/* Segmented Controls for TABs */}
        <div className="p-4 bg-white border-b border-natural-border shrink-0 flex gap-2">
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all ${
              activeTab === 'info'
                ? 'bg-brand text-white shadow-xs'
                : 'text-natural-dark hover:text-brand hover:bg-natural-light/50'
            } cursor-pointer`}
          >
            Info & Segnalazioni ({fountain.reports.length})
          </button>
          <button
            onClick={() => setActiveTab('segnala')}
            className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all ${
              activeTab === 'segnala'
                ? 'bg-brand text-white shadow-xs'
                : 'text-natural-dark hover:text-brand hover:bg-natural-light/50'
            } cursor-pointer`}
          >
            Aggiorna / Carica foto
          </button>
        </div>

        {/* Tab 1: Informations and Reports timeline */}
        {activeTab === 'info' && (
          <div className="p-5 space-y-5">
            <div>
              <h3 className="text-xxs font-bold text-natural-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                <Info className="w-3 h-3 text-natural-muted" /> Descrizione Fontanella
              </h3>
              <p className="text-sm text-natural-dark leading-relaxed bg-white p-4 rounded-2xl border border-natural-border/70">
                {fountain.description || "Nessuna descrizione specificata dal creatore."}
              </p>
            </div>

            {/* Quick specifications */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="p-3 bg-natural-light rounded-xl border border-natural-border/40">
                <span className="text-xxs font-bold text-brand uppercase tracking-wide block">Portata d&apos;acqua</span>
                <span className="text-xs font-bold text-natural-dark block capitalize mt-0.5">
                  {fountain.waterFlowRate === 'high' ? '⚡ Veloce / Forte' : fountain.waterFlowRate === 'medium' ? '🕒 Moderata' : '💧 Bassa / Lenta'}
                </span>
              </div>
              <div className="p-3 bg-natural-light rounded-xl border border-natural-border/40">
                <span className="text-xxs font-bold text-brand uppercase tracking-wide block">Filtro Purificante</span>
                <span className="text-xs font-bold text-natural-dark block mt-0.5">
                  {fountain.hasFilter ? '✅ Presente (Sanificato)' : '❌ Assente (Diretta)'}
                </span>
              </div>
            </div>

            {/* Photos Carousel/Row if more than 1 photo */}
            {fountain.photos.length > 1 && (
              <div>
                <h3 className="text-xxs font-bold text-natural-muted uppercase tracking-wider mb-2.5">
                  Galleria fotografica ({fountain.photos.length})
                </h3>
                <div className="flex gap-2 overflow-x-auto pb-1 text-center font-serif">
                  {fountain.photos.map((photo, index) => (
                    <div key={index} className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-natural-border">
                      <img 
                        src={photo} 
                        alt="" 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover hover:scale-105 transition-transform" 
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reports Timelines */}
            <div className="space-y-3.5">
              <h3 className="text-xxs font-bold text-natural-muted uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Cronologia Segnalazioni & Recensioni
              </h3>

              {fountain.reports.length > 0 ? (
                <div className="relative border-l-2 border-natural-border pl-4 space-y-4 ml-2">
                  {fountain.reports.map((report) => (
                    <div key={report.id} className="relative">
                      {/* Floating dot for timeline */}
                      <span className={`absolute -left-[23px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                        report.type === 'report_broken' ? 'bg-rose-500' : report.type === 'status_change' ? 'bg-amber-400' : 'bg-brand'
                      }`} />

                      <div className="p-3 bg-white border border-natural-border rounded-xl shadow-xs">
                        <div className="flex items-center justify-between text-xxs text-natural-muted font-bold mb-1.5">
                          <span className="flex items-center gap-1 text-natural-dark">
                            {report.userAvatar ? (
                              <img src={report.userAvatar} alt={report.user} referrerPolicy="no-referrer" className="w-4 h-4 rounded-full object-cover" />
                            ) : (
                              <User className="w-3.5 h-3.5 text-natural-muted" />
                            )}
                            {report.user}
                          </span>
                          <span className="font-mono text-[10px]">
                            {new Date(report.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>

                        {/* If status has changed */}
                        {(report.statusBefore || report.statusAfter) && (
                          <div className="mb-2 text-xxs text-natural-muted font-semibold flex items-center gap-1">
                            <span>🔄 Stato modificato:</span>
                            <span className="line-through">{report.statusBefore === 'working' ? 'Funzionante' : 'Secca'}</span>
                            <span>➔</span>
                            <span className="text-brand font-bold">{report.statusAfter === 'working' ? 'Funzionante' : report.statusAfter === 'dry' ? 'Secca' : 'Guasta'}</span>
                          </div>
                        )}

                        {/* Stars if user rated */}
                        {report.rating && (
                          <div className="flex gap-0.5 mb-1.5">
                            {Array.from({ length: 5 }).map((_, starIndex) => (
                              <Star 
                                key={starIndex} 
                                className={`w-3.5 h-3.5 ${
                                  starIndex < (report.rating || 0) ? 'fill-amber-450 text-amber-500' : 'text-natural-border'
                                }`} 
                              />
                            ))}
                          </div>
                        )}

                        <p className="text-xs text-natural-dark leading-normal font-medium">{report.comment}</p>

                        {/* Embedded uploaded photo if present */}
                        {report.photoUrl && (
                          <div className="mt-2 text-center">
                            <img 
                              src={report.photoUrl} 
                              alt="Log carica" 
                              referrerPolicy="no-referrer"
                              className="max-h-24 max-w-full rounded-lg object-contain border border-natural-border mx-auto" 
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center bg-white border border-natural-border rounded-2xl">
                  <p className="text-xs text-natural-muted font-medium select-none">Nessuna segnalazione registrata ancora.</p>
                  <button
                    onClick={() => setActiveTab('segnala')}
                    className="mt-2 text-xs font-semibold text-brand hover:text-brand-hover cursor-pointer"
                  >
                    Fai il primo report!
                  </button>
                </div>
              )}
            </div>

            {/* Verification credentials footer */}
            <div className="pt-4 border-t border-natural-border flex items-center gap-2.5 text-xxs text-natural-muted">
              <ShieldCheck className="w-4 h-4 text-brand shrink-0" />
              <span>Inserito originariamente da <strong>@{fountain.addedBy}</strong> il {new Date(fountain.createdAt).toLocaleDateString('it-IT')}. Controllo qualità attivo.</span>
            </div>
          </div>
        )}

        {/* Tab 2: Write Report and Upload Photo */}
        {activeTab === 'segnala' && (
          <form onSubmit={handleSubmitReport} className="p-5 space-y-4">
            <h4 className="text-sm font-serif font-bold text-natural-dark flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-brand" /> Aggiorna lo stato della fontanella
            </h4>
            
            <div className="space-y-3 p-4 bg-white border border-natural-border rounded-2xl">
              {/* Radio grid to modify status */}
              <div>
                <label className="block text-xxs font-bold uppercase text-natural-muted tracking-wider mb-2"> Stato Corrente </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatusInput('working')}
                    className={`py-2 px-1 text-center text-xs font-bold rounded-xl border transition-all ${
                      statusInput === 'working' 
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs' 
                        : 'bg-white border-natural-border text-natural-dark hover:bg-natural-light'
                    } cursor-pointer`}
                  >
                    🟢 Attiva
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusInput('dry')}
                    className={`py-2 px-1 text-center text-xs font-bold rounded-xl border transition-all ${
                      statusInput === 'dry' 
                        ? 'bg-amber-600 border-amber-600 text-white shadow-xs' 
                        : 'bg-white border-natural-border text-natural-dark hover:bg-natural-light'
                    } cursor-pointer`}
                  >
                    🟡 Secca
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusInput('broken')}
                    className={`py-2 px-1 text-center text-xs font-bold rounded-xl border transition-all ${
                      statusInput === 'broken' 
                        ? 'bg-rose-600 border-rose-600 text-white shadow-xs' 
                        : 'bg-white border-natural-border text-natural-dark hover:bg-natural-light'
                    } cursor-pointer`}
                  >
                    🔴 Guasta
                  </button>
                </div>
              </div>

              {/* Rate */}
              <div>
                <label className="block text-xxs font-bold uppercase text-natural-muted tracking-wider mb-1.5"> Punteggio Portata d&apos;acqua </label>
                <div className="flex gap-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setRatingInput(i + 1)}
                      className="text-[#e5e5d1] hover:text-amber-500 transition-colors focus:outline-none cursor-pointer"
                    >
                      <Star 
                        className={`w-6 h-6 ${
                          i < ratingInput ? 'text-amber-500 fill-amber-400' : 'text-[#e5e5d1]'
                        }`} 
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-natural-muted ml-2 py-0.5">({ratingInput} stelle)</span>
                </div>
              </div>
            </div>

            {/* Comment Textarea */}
            <div>
              <label className="block text-xxs font-bold uppercase text-natural-muted tracking-wider mb-2"> Commento o Dettagli sul guasto </label>
              <textarea
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                rows={3}
                required={!photoBase64} // Must fill either comment or photo
                placeholder="Scrivi qui i dettagli sul getto d'acqua, sulla potabilità, pulizia o se necessita riparazione..."
                className="w-full text-sm border border-natural-border/70 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all bg-white placeholder-natural-muted/65 text-natural-dark"
              />
            </div>

            {/* Custom Drag-and-Drop Photo Upload Area */}
            <div>
              <label className="block text-xxs font-bold uppercase text-natural-muted tracking-wider mb-2"> 
                Carica Foto della Fontanella (Drag &amp; Drop supportato)
              </label>
              
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileInput}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
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
                    <p className="text-xxs font-bold text-emerald-800">Foto caricata con successo!</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhotoBase64(null);
                      }}
                      className="text-xxs font-bold text-red-500 hover:text-red-700 underline cursor-pointer"
                    >
                      Rimuovi e riprova
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <Camera className="w-8 h-8 text-natural-muted mb-1" />
                    <span className="text-xs font-bold text-natural-dark">Trascina qui la tua immagine</span>
                    <p className="text-xxs text-natural-muted mt-1">oppure clicca per cercarla nei tuoi file</p>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl mt-4 shadow-md shadow-[#5a5a4025] transition-all active:scale-98 cursor-pointer"
            >
              Invia Segnalazione Condivisa
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
