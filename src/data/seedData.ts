import { Fountain } from '../types';

export const SEED_FOUNTAINS: Fountain[] = [
  // --- ROMA ---
  {
    id: 'f-roma-navona',
    name: 'Nasone di Piazza Navona',
    lat: 41.8986,
    lng: 12.4731,
    address: 'Piazza Navona (Lato Nord, vicino Fontana dei Calderari)',
    status: 'working',
    waterType: 'potabile',
    description: 'Il classico e amatissimo "nasone" romano in ghisa. L\'acqua sgorga freschissima e ininterrottamente direttamente dal Gran Sasso. Perfetto per rinfrescarsi durate il tour romano.',
    addedBy: 'Valerio R.',
    rating: 4.8,
    photos: [
      'https://images.unsplash.com/photo-1548543604-a87c9909abec?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?w=600&auto=format&fit=crop&q=80'
    ],
    createdAt: '2025-05-10T14:30:00Z',
    city: 'Roma',
    waterFlowRate: 'high',
    reports: [
      {
        id: 'r-001',
        type: 'comment',
        comment: 'Portata d\'acqua eccellente, fredda come sempre. C\'è spesso una piccola coda di turisti ma scorre velocemente!',
        user: 'Marco Bianchi',
        userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
        createdAt: '2026-06-01T10:00:00Z',
        rating: 5
      }
    ]
  },
  {
    id: 'f-roma-colosseo',
    name: 'Nasone del Colosseo',
    lat: 41.8902,
    lng: 12.4935,
    address: 'Via dei Fori Imperiali, di fronte all\'ingresso Metro Colosseo',
    status: 'working',
    waterType: 'potabile',
    description: 'Fornisce un servizio vitale a migliaia di turisti in visita al Colosseo ogni giorno. Acqua potabile di ottima qualità. Presente anche la fessura sul becco per bere "a spruzzo".',
    addedBy: 'Sara T.',
    rating: 4.9,
    photos: [
      'https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?w=600&auto=format&fit=crop&q=80'
    ],
    createdAt: '2025-04-12T09:15:00Z',
    city: 'Roma',
    waterFlowRate: 'medium',
    reports: [
      {
        id: 'r-002',
        type: 'comment',
        comment: 'Un toccasana assoluto sotto il sole di mezzogiorno nei pressi dei Fori. Funzionante al 100%.',
        user: 'Elena Ferrari',
        userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
        createdAt: '2026-06-05T15:30:00Z',
        rating: 5
      }
    ]
  },
  {
    id: 'f-roma-testaccio',
    name: 'Nasone di Testaccio',
    lat: 41.8791,
    lng: 12.4782,
    address: 'Piazza di Santa Maria Liberatrice (all\'interno del giardinetto)',
    status: 'broken',
    waterType: 'potabile',
    description: 'Questo nasone si trova all\'interno del giardino della piazza, frequentatissimo da bambini e genitori del rione. Purtroppo la manopola è stata danneggiata.',
    addedBy: 'Giuseppe M.',
    rating: 3.2,
    photos: [
      'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&auto=format&fit=crop&q=80'
    ],
    createdAt: '2025-08-20T17:40:00Z',
    city: 'Roma',
    waterFlowRate: 'low',
    reports: [
      {
        id: 'r-003',
        type: 'report_broken',
        comment: 'La manopola superiore perde moltissimo e l\'acqua esce a stento da sotto. C\'è una forte pozzanghera alla base. Necessita manutenzione immediata.',
        statusBefore: 'working',
        statusAfter: 'broken',
        user: 'Luca N.',
        userAvatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&auto=format&fit=crop&q=80',
        createdAt: '2026-06-08T08:20:00Z'
      }
    ]
  },
  {
    id: 'f-roma-fiori',
    name: 'Nasone di Campo de\' Fiori',
    lat: 41.8971,
    lng: 12.4722,
    address: 'Piazza Campo de\' Fiori (all\'angolo con Via dei Giubbonari)',
    status: 'working',
    waterType: 'potabile',
    description: 'Immerso nello storico mercato rionale e circondato da osterie. Utilissimo sia per i banchi del mercato che per chi passeggia ed esplora la movida serale.',
    addedBy: 'Claudia F.',
    rating: 4.5,
    photos: [
      'https://images.unsplash.com/photo-1508430831466-82541e550c05?w=600&auto=format&fit=crop&q=80'
    ],
    createdAt: '2025-09-02T11:00:00Z',
    city: 'Roma',
    waterFlowRate: 'medium',
    reports: []
  },

  // --- TORINO ---
  {
    id: 'f-torino-castello',
    name: 'Toret di Piazza Castello',
    lat: 45.0708,
    lng: 7.6856,
    address: 'Piazza Castello (angolo con Via Garibaldi)',
    status: 'working',
    waterType: 'potabile',
    description: 'Il classico "Toret" torinese in ghisa di colore verde bottiglia, caratterizzato dalla graziosa testa di toro dalla quale sgorga l\'acqua dalle corna. Un vero monumento piemontese!',
    addedBy: 'Piero L.',
    rating: 4.9,
    photos: [
      'https://images.unsplash.com/photo-1554124403-ec5271954f9a?w=600&auto=format&fit=crop&q=80'
    ],
    createdAt: '2025-01-15T10:00:00Z',
    city: 'Torino',
    waterFlowRate: 'medium',
    reports: [
      {
        id: 'r-004',
        type: 'comment',
        comment: 'Acqua freschissima! Tipico simbolo di Torino e in perfette condizioni.',
        user: 'Gabriella S.',
        userAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80',
        createdAt: '2026-05-28T18:10:00Z',
        rating: 5
      }
    ]
  },
  {
    id: 'f-torino-vale',
    name: 'Toret del Valentino',
    lat: 45.0566,
    lng: 7.6865,
    address: 'Parco del Valentino (vicino alla Società Canottieri)',
    status: 'working',
    waterType: 'potabile',
    description: 'Famoso toret situato nel polmone verde di Torino, lungo i viali del Valentino. Utilizzato moltissimo da runner, ciclisti o da chi passeggia sulla sponda del Po.',
    addedBy: 'Davide P.',
    rating: 4.7,
    photos: [
      'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=600&auto=format&fit=crop&q=80'
    ],
    createdAt: '2025-03-20T08:00:00Z',
    city: 'Torino',
    waterFlowRate: 'high',
    reports: []
  },
  {
    id: 'f-torino-vittorio',
    name: 'Toret di Piazza Vittorio',
    lat: 45.0645,
    lng: 7.6961,
    address: 'Piazza Vittorio Veneto (lato meridionale, nei pressi dei portici)',
    status: 'dry',
    waterType: 'potabile',
    description: 'Bellissimo Toret in una delle piazze più grandi d\'Europa. Purtroppo temporaneamente secco a causa di lavori alle tubature della zona.',
    addedBy: 'Michela G.',
    rating: 2.5,
    photos: [],
    createdAt: '2025-06-11T16:20:00Z',
    city: 'Torino',
    reports: [
      {
        id: 'r-005',
        type: 'status_change',
        comment: 'Il Toret è completamente spento. Nessun rumore d\'acqua all\'interno. Forse un blocco programmato dell\'acquedotto.',
        statusBefore: 'working',
        statusAfter: 'dry',
        user: 'Alberto Beria',
        userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
        createdAt: '2026-06-07T12:00:00Z'
      }
    ]
  },

  // --- MILANO ---
  {
    id: 'f-milano-duomo',
    name: 'Vedovella del Duomo',
    lat: 45.4641,
    lng: 9.1901,
    address: 'Piazza del Duomo (angolo destro del porticato, lato Palazzo Reale)',
    status: 'working',
    waterType: 'potabile',
    description: 'La storica "Vedovella" milanese (detto anche Drago Verde), in bronzo e ottone, decorata con una testa di drago stilizzata. Prende il nome di vedovella per il continuo sgorgare dell\'acqua, che ricorda il pianto incessante di una vedova. Un pezzo di storia incastonato nel cuore di Milano.',
    addedBy: 'Lorenzo B.',
    rating: 4.9,
    photos: [
      'https://images.unsplash.com/photo-1488085061387-422e29b40080?w=600&auto=format&fit=crop&q=80'
    ],
    createdAt: '2025-02-18T11:45:00Z',
    city: 'Milano',
    waterFlowRate: 'medium',
    reports: [
      {
        id: 'r-006',
        type: 'comment',
        comment: 'Acqua fredda e buonissima, sapore minerale eccellente. Il drago luccica, molto ben tenuta.',
        user: 'Simona V.',
        userAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&auto=format&fit=crop&q=80',
        createdAt: '2026-06-02T14:15:00Z',
        rating: 5
      }
    ]
  },
  {
    id: 'f-milano-castello',
    name: 'Drago Verde del Castello Sforzesco',
    lat: 45.4699,
    lng: 9.1798,
    address: 'Piazza Castello (ingresso principale, vicino alla fontana grande circolare)',
    status: 'working',
    waterType: 'potabile',
    description: 'La fontanella ideale per i visitatori del castello Sforzesco e di Parco Sempione. Questa vedovella in ghisa ha la tradizionale bocca a drago in ottone rifinito.',
    addedBy: 'Stefano R.',
    rating: 4.6,
    photos: [],
    createdAt: '2025-04-10T15:30:00Z',
    city: 'Milano',
    waterFlowRate: 'medium',
    reports: []
  },
  {
    id: 'f-milano-brera',
    name: 'Drago Verde di Brera',
    lat: 45.4719,
    lng: 9.1878,
    address: 'Via dei Fiori Chiari (angolo Via Brera, zona pedonale)',
    status: 'working',
    waterType: 'potabile',
    description: 'Tipica fontanella situata nel bellissimo quartiere storico e pedonale degli artisti di Brera. Utilizzata da turisti, studenti dell\'Accademia e residenti locali.',
    addedBy: 'Matteo G.',
    rating: 4.4,
    photos: [
      'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&auto=format&fit=crop&q=80'
    ],
    createdAt: '2025-07-15T18:00:00Z',
    city: 'Milano',
    waterFlowRate: 'low',
    reports: []
  },

  // --- FIRENZE ---
  {
    id: 'f-firenze-signoria',
    name: 'Fontanella di Piazza della Signoria',
    lat: 43.7698,
    lng: 11.2562,
    address: 'Piazza della Signoria (alle spalle del monumento equestre di Cosimo I)',
    status: 'working',
    waterType: 'potabile',
    description: 'Elegante e discreta fontanella in pietra situata nel centro storico rinascimentale di Firenze. Offre acqua fredda direttamente dalle linee collinari del Chianti.',
    addedBy: 'Alessia F.',
    rating: 4.7,
    photos: [],
    createdAt: '2025-02-02T13:10:00Z',
    city: 'Firenze',
    waterFlowRate: 'low',
    reports: []
  },
  {
    id: 'f-firenze-case',
    name: 'Casa dell\'Acqua di Piazza Alberti',
    lat: 43.7709,
    lng: 11.2825,
    address: 'Piazza Leon Battista Alberti (lato giardini)',
    status: 'working',
    waterType: 'frizzante',
    description: 'Chiosco ad alta tecnologia del Comune che offre gratuitamente acqua naturale fresca purificata e acqua frizzante gasata. Un vero modello di sostenibilità per ridurre le bottiglie di plastica!',
    addedBy: 'Consiglio Comunale Fi',
    rating: 4.9,
    photos: [
      'https://images.unsplash.com/photo-1548543604-a87c9909abec?w=600&auto=format&fit=crop&q=80'
    ],
    createdAt: '2025-01-20T09:00:00Z',
    city: 'Firenze',
    hasFilter: true,
    waterFlowRate: 'high',
    reports: [
      {
        id: 'r-007',
        type: 'comment',
        comment: 'Eccezionale! Acqua frizzante di altissima qualità, freschissima a soli 10 centesimi al litro (o gratis per residenti con targa). Pulitissima.',
        user: 'Francesco de Rossi',
        userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
        createdAt: '2026-06-04T11:00:00Z',
        rating: 5
      }
    ]
  },

  // --- NAPOLI ---
  {
    id: 'f-napoli-plebiscito',
    name: 'Fontanella di Piazza Plebiscito',
    lat: 40.8359,
    lng: 14.2488,
    address: 'Piazza del Plebiscito (all\'interno del colonnato sinistro)',
    status: 'working',
    waterType: 'potabile',
    description: 'Stupenda fontanellina in ottone che offre una rinfrescata eccezionale a chi attraversa l\'enorme distesa assolata di Piazza del Plebiscito o passeggia per Via Chiaia.',
    addedBy: 'Gennaro S.',
    rating: 4.8,
    photos: [],
    createdAt: '2025-03-12T16:00:00Z',
    city: 'Napoli',
    waterFlowRate: 'high',
    reports: []
  },
  {
    id: 'f-napoli-spaccanapoli',
    name: 'Fontanella Spaccanapoli',
    lat: 40.8492,
    lng: 14.2568,
    address: 'Via Benedetto Croce (vicino alla Chiesa di Santa Chiara)',
    status: 'broken',
    waterType: 'potabile',
    description: 'La storica fontanella in via del centro storico. Spesso imbrattata e purtroppo inutilizzabile a causa del danneggiamento della bocchetta d\'erogazione.',
    addedBy: 'Marianna A.',
    rating: 2.1,
    photos: [],
    createdAt: '2025-05-25T11:45:00Z',
    city: 'Napoli',
    waterFlowRate: 'low',
    reports: [
      {
        id: 'r-008',
        type: 'report_broken',
        comment: 'La fontanella spruzza acqua ovunque lateralmente, bagnando chi prova a bere. Il getto è debolissimo. Segnalato all\'ABC Napoli.',
        statusBefore: 'working',
        statusAfter: 'broken',
        user: 'Ciro Esposito',
        userAvatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&auto=format&fit=crop&q=80',
        createdAt: '2026-06-06T14:30:00Z'
      }
    ]
  }
];

export const CITIES = [
  { name: 'Tutte le città', value: 'all' },
  { name: 'Milano', value: 'Milano', lat: 45.4642, lng: 9.1900, zoom: 13 },
  { name: 'Roma', value: 'Roma', lat: 41.8902, lng: 12.4922, zoom: 13 },
  { name: 'Torino', value: 'Torino', lat: 45.0703, lng: 7.6869, zoom: 13 },
  { name: 'Napoli', value: 'Napoli', lat: 40.8518, lng: 14.2681, zoom: 13 },
  { name: 'Firenze', value: 'Firenze', lat: 43.7696, lng: 11.2558, zoom: 13 },
  { name: 'Venezia', value: 'Venezia', lat: 45.4408, lng: 12.3155, zoom: 13 },
  { name: 'Parigi', value: 'Parigi', lat: 48.8566, lng: 2.3522, zoom: 13 },
  { name: 'Londra', value: 'Londra', lat: 51.5074, lng: -0.1278, zoom: 13 },
  { name: 'Berlino', value: 'Berlino', lat: 52.5200, lng: 13.4050, zoom: 13 },
  { name: 'Madrid', value: 'Madrid', lat: 40.4168, lng: -3.7038, zoom: 13 },
  { name: 'Barcellona', value: 'Barcellona', lat: 41.3851, lng: 2.1734, zoom: 13 },
  { name: 'Vienna', value: 'Vienna', lat: 48.2082, lng: 16.3738, zoom: 13 },
  { name: 'Amsterdam', value: 'Amsterdam', lat: 52.3676, lng: 4.9041, zoom: 13 },
  { name: 'Bruxelles', value: 'Bruxelles', lat: 50.8503, lng: 4.3517, zoom: 13 },
  { name: 'Monaco di Baviera', value: 'Monaco di Baviera', lat: 48.1351, lng: 11.5820, zoom: 13 },
  { name: 'Lisbona', value: 'Lisbona', lat: 38.7223, lng: -9.1393, zoom: 13 },
  { name: 'Atene', value: 'Atene', lat: 37.9838, lng: 23.7275, zoom: 13 },
  { name: 'Dublino', value: 'Dublino', lat: 53.3498, lng: -6.2603, zoom: 13 }
];
