export type FountainStatus = 'working' | 'dry' | 'broken'; // 'working' = Funzionante, 'dry' = Secca, 'broken' = Danneggiata/Senza Manopola/Perdite

export type WaterType = 'potabile' | 'non_potabile' | 'frizzante'; // Potabile, Non Potabile, Frizzante/Fresca (Case dell'Acqua)

export interface Report {
  id: string;
  type: 'status_change' | 'comment' | 'photo' | 'report_broken';
  comment: string;
  statusBefore?: FountainStatus;
  statusAfter?: FountainStatus;
  photoUrl?: string;
  user: string;
  userAvatar?: string;
  createdAt: string;
  rating?: number; // Optional review stars (1-5)
}

export interface Fountain {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  status: FountainStatus;
  waterType: WaterType;
  description: string;
  addedBy: string;
  rating: number; // calculated average rating
  photos: string[]; // List of photo URLs (or base64 strings)
  reports: Report[];
  createdAt: string;
  city: string;
  waterFlowRate?: 'high' | 'medium' | 'low'; // Portata d'acqua
  hasFilter?: boolean; // Se ha filtri purificatori
  isOsm?: boolean; // True if sourced from OpenStreetMap
  amenity?: 'drinking_water' | 'toilets'; // Special tipologia di servizio
}

export interface FountainFilter {
  searchQuery: string;
  status: FountainStatus | 'all';
  waterType: WaterType | 'all';
  onlyNearby: boolean;
  city: string | 'all';
  amenity: 'all' | 'drinking_water' | 'toilets';
}
