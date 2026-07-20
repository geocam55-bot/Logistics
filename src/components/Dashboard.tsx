import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { DeliveryRecord, DeliveryStatus, Branch, Truck as TruckType, User as UserType } from '../types';
import { renderUserAvatarHelper } from './UserProfileModal';
import { 
  Truck as TruckIcon, 
  CheckCircle2, 
  RefreshCw, 
  FileCheck, 
  Package,
  Map as MapIcon,
  Compass,
  Navigation,
  MapPin,
  Radio,
  Info,
  Activity,
  User,
  ExternalLink,
  Locate,
  AlertTriangle,
  Play,
  Pause,
  Zap,
  Globe,
  Camera,
  CloudSun,
  Gauge,
  Eye,
  AlertCircle,
  Settings,
  Search,
  Calendar,
  ChevronUp,
  ChevronDown,
  Clock,
  ArrowUp,
  Sliders,
  Film,
  Maximize2,
  Minimize2,
  Warehouse,
  Store,
  MoreVertical,
  Wrench,
  X,
  Pin,
  Target,
  Crosshair
} from 'lucide-react';

// Regional Coordinate Dictionary for high-accuracy live geolocating
const KNOWN_COORDS: Record<string, { lat: number; lng: number }> = {
  // Nova Scotia, Canada
  'WINDMILL': { lat: 44.7082, lng: -63.5938 },
  'TANTALLON': { lat: 44.6750, lng: -63.8825 },
  'DARTMOUTH': { lat: 44.6636, lng: -63.5683 },
  'BRIDGEWATER': { lat: 44.3789, lng: -64.5126 },
  'HALIFAX': { lat: 44.6488, lng: -63.5752 },
  'CHAIN LAKE': { lat: 44.6295, lng: -63.6651 },
  '137 CHAIN LAKE': { lat: 44.6295, lng: -63.6651 },
  'ELMSDALE': { lat: 44.9752, lng: -63.5042 },
  'ALMON': { lat: 44.6536, lng: -63.6011 },
  'HUBBARDS': { lat: 44.6314, lng: -64.0531 },
  'SACKVILLE': { lat: 44.7642, lng: -63.6823 },
  'BEDFORD': { lat: 44.7303, lng: -63.6617 },
  'TRURO': { lat: 45.3647, lng: -63.2687 },
  'WINDSOR': { lat: 44.9904, lng: -64.1311 },
  'CHESTER': { lat: 44.5424, lng: -64.2405 },
  'ENFIELD': { lat: 44.9406, lng: -63.5358 },
  'LAKESIDE': { lat: 44.6489, lng: -63.7176 },
  'BAYERS LAKE': { lat: 44.6295, lng: -63.6651 },
  'BURNSIDE': { lat: 44.6983, lng: -63.5855 },
  'KENTVILLE': { lat: 45.0775, lng: -64.4965 },
  'HAMMONDS PLAINS': { lat: 44.7364, lng: -63.7854 },
  'COLE HARBOUR': { lat: 44.6644, lng: -63.4842 },
  'ST. MARGARETS BAY': { lat: 44.6225, lng: -63.9538 },
  'ST. MARGARET\'S BAY': { lat: 44.6225, lng: -63.9538 },
  'RONA': { lat: 44.6314, lng: -64.0531 },
  
  // Silicon Valley, California
  'CAMPBELL': { lat: 37.2872, lng: -121.9500 },
  'SUNNYVALE': { lat: 37.3688, lng: -122.0363 },
  'SAN MATEO': { lat: 37.5630, lng: -122.3255 },
  'SAN JOSE': { lat: 37.3382, lng: -121.8863 },
  'LOS ALTOS': { lat: 37.3852, lng: -122.1141 },
  'BERRYESSA': { lat: 37.3382, lng: -121.8863 },
  'HOMESTEAD': { lat: 37.3852, lng: -122.1141 },
  'JAMES ST': { lat: 37.3688, lng: -122.0363 },
  'HILLSDALE': { lat: 37.5630, lng: -122.3255 },
  'ORCHARD CITY': { lat: 37.2872, lng: -121.9500 },
};

const getGpsForLocation = (id: string, nameOrAddress: string): { lat: number; lng: number } => {
  const combined = id + ' ' + nameOrAddress;
  
  // Try matching ||lat:XX ||lng:YY or lat:XX lng:YY
  const latMatch = combined.match(/\|\|lat:\s*(-?\d+(?:\.\d+)?)/i) || combined.match(/lat:\s*(-?\d+(?:\.\d+)?)/i);
  const lngMatch = combined.match(/\|\|lng:\s*(-?\d+(?:\.\d+)?)/i) || combined.match(/lng:\s*(-?\d+(?:\.\d+)?)/i);
  if (latMatch && lngMatch) {
    const parsedLat = parseFloat(latMatch[1]);
    const parsedLng = parseFloat(lngMatch[1]);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      return { lat: parsedLat, lng: parsedLng };
    }
  }

  // Also support matching decimal degrees in brackets or parentheses, e.g. [44.123, -63.456]
  const bracketMatch = combined.match(/[\[\()]\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*[\]\)]/);
  if (bracketMatch) {
    const parsedLat = parseFloat(bracketMatch[1]);
    const parsedLng = parseFloat(bracketMatch[2]);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      return { lat: parsedLat, lng: parsedLng };
    }
  }

  const norm = combined.toUpperCase();
  
  // Try to find a match in our KNOWN_COORDS dictionary
  for (const [key, value] of Object.entries(KNOWN_COORDS)) {
    if (norm.includes(key)) {
      return value;
    }
  }
  
  // Fallback hash logic:
  // If the string contains CA (isolated word), California, or known Bay Area names, place it in Silicon Valley (but not if it contains Canada)
  const isCalifornia = (/\bCA\b/.test(norm) || norm.includes('CALIFORNIA') || norm.includes('BAY AREA') || norm.includes('SILICON')) && !norm.includes('CANADA');
  
  let score = 0;
  for (let i = 0; i < norm.length; i++) {
    score += norm.charCodeAt(i);
  }
  
  if (isCalifornia) {
    const lat = 37.25 + ((score % 50) / 50) * 0.45;
    const lng = -122.35 + (((score * 17) % 50) / 50) * 0.50;
    return { lat, lng };
  } else {
    // Default to Nova Scotia (Halifax region)
    const lat = 44.35 + ((score % 40) / 40) * 0.35;
    const lng = -64.4 + (((score * 17) % 40) / 40) * 0.70;
    return { lat, lng };
  }
};

const cleanAddressText = (address: string | undefined): string => {
  if (!address) return '';
  return address
    .replace(/\|\|lat:\s*(-?\d+(?:\.\d+)?)/gi, '')
    .replace(/\|\|lng:\s*(-?\d+(?:\.\d+)?)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const getTruckCoords = (truck: any, simProgress: Record<string, number>, branches: any[]) => {
  const isTruckGps = truck.gpsSource === 'truck';
  const hasRealGps = isTruckGps 
    ? (truck.gpsLat !== undefined && truck.gpsLng !== undefined && !isNaN(truck.gpsLat) && !isNaN(truck.gpsLng))
    : (truck.lat !== undefined && truck.lng !== undefined && !isNaN(truck.lat) && !isNaN(truck.lng));

  let origLat = 44.6488;
  let origLng = -63.5752;
  let destLat = 44.6518;
  let destLng = -63.5722;
  

  const homeBranch = branches.find(b => b.id === truck.branchId);
  if (homeBranch) {
    const branchCoords = getBranchCoordinates(homeBranch.id, homeBranch.name, homeBranch.address);
    origLat = branchCoords.lat;
    origLng = branchCoords.lng;
    destLat = origLat + 0.003;
    destLng = origLng + 0.003;
    
  }

  const progress = simProgress[truck.id] ?? 0.15;
  const lat = hasRealGps 
    ? (isTruckGps ? truck.gpsLat : truck.lat) 
    : origLat;
  const lng = hasRealGps 
    ? (isTruckGps ? truck.gpsLng : truck.lng) 
    : origLng;

  return { lat, lng, hasRealGps, isTruckGps };
};

const getPercentCoordsFromGps = (lat: number, lng: number): { x: number; y: number } => {
  const isCalifornia = lat < 40;
  
  const latMin = isCalifornia ? 37.20 : 44.25;
  const latMax = isCalifornia ? 37.70 : 44.75;
  const lngMin = isCalifornia ? -122.45 : -64.65;
  const lngMax = isCalifornia ? -121.80 : -63.45;

  // Linear scaling
  const latFactor = Math.min(Math.max((lat - latMin) / (latMax - latMin), 0), 1);
  const lngFactor = Math.min(Math.max((lng - lngMin) / (lngMax - lngMin), 0), 1);

  const x = 15 + lngFactor * 70; // Map directly inside the map container space (15% to 85%)
  const y = 80 - latFactor * 60; // Map directly (80% south to 20% north)

  return { x, y };
};

const getBranchCoordinates = (id: string, name: string, address?: string): { x: number; y: number; lat: number; lng: number } => {
  const { lat, lng } = getGpsForLocation(id, address || name);
  const coords = getPercentCoordsFromGps(lat, lng);
  return { x: coords.x, y: coords.y, lat, lng };
};

const getDeliveryCoordinates = (id: string, address: string, originX: number, originY: number): { x: number; y: number; lat: number; lng: number } => {
  const { lat, lng } = getGpsForLocation(id, address);
  const coords = getPercentCoordsFromGps(lat, lng);
  return { x: coords.x, y: coords.y, lat, lng };
};

const calculateDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Earth radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getBearingLabel = (lat1: number, lng1: number, lat2: number, lng2: number): string => {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  brng = (brng + 360) % 360;
  
  if (brng >= 337.5 || brng < 22.5) return 'North ↑';
  if (brng >= 22.5 && brng < 67.5) return 'Northeast ↗';
  if (brng >= 67.5 && brng < 112.5) return 'East →';
  if (brng >= 112.5 && brng < 157.5) return 'Southeast ↘';
  if (brng >= 157.5 && brng < 202.5) return 'South ↓';
  if (brng >= 202.5 && brng < 247.5) return 'Southwest ↙';
  if (brng >= 247.5 && brng < 292.5) return 'West ←';
  return 'Northwest ↖';
};

const getGpsFromPercentCoords = (x: number, y: number): { lat: number; lng: number } => {
  const latMin = 44.25;
  const latMax = 44.75;
  const lngMin = -64.65;
  const lngMax = -63.45;

  const lng = lngMin + ((x - 15) / 70) * (lngMax - lngMin);
  const lat = latMin + ((80 - y) / 60) * (latMax - latMin);

  return { lat, lng };
};

const getSimulatedStreetName = (lat: number, lng: number): string => {
  const halifaxStreets = [
    'Highway 102 (Bicentennial Dr)',
    'Barrington Street',
    'Robie Street',
    'Spring Garden Road',
    'Bedford Highway (Route 2)',
    'Dunbrack Street',
    'Quinpool Road',
    'Kempt Road',
    'Lower Water Street',
    'Sackville Drive',
    'Windmill Road',
    'Macdonald Bridge Link',
    'Purcells Cove Road',
    'Bayers Road Connector',
    'Gottingen Street',
    'Hollis Street',
    'Windsor Street Overpass',
    'Dartmouth Road',
    'Cole Harbour Road',
    'Waverley Road'
  ];
  
  const score = Math.floor(Math.abs(lat * 1000) + Math.abs(lng * 1000));
  return halifaxStreets[score % halifaxStreets.length];
};

const getSimulatedRoadDetails = (lat: number, lng: number, isMoving: boolean) => {
  const conditionsList = [
    {
      condition: 'Paved Asphalt - Clear',
      traction: 'Excellent (0.92 μ)',
      hazards: 'None reported',
      severity: 'green',
      humidity: '42%'
    },
    {
      condition: 'Wet Tarmac - Light Hydroplaning Risk',
      traction: 'Moderate-Good (0.68 μ)',
      hazards: 'Puddle accumulation on shoulders',
      severity: 'amber',
      humidity: '84%'
    },
    {
      condition: 'Highway 102 - Ongoing Minor Construction',
      traction: 'Good (0.85 μ)',
      hazards: 'Lane constriction in 1.5 km',
      severity: 'amber',
      humidity: '35%'
    },
    {
      condition: 'Coastal Fog - Reduced Visibility',
      traction: 'Good (0.80 μ)',
      hazards: 'Fog patches under 800m',
      severity: 'amber',
      humidity: '98%'
    },
    {
      condition: 'Suspension Bridge - High Crosswinds',
      traction: 'Excellent (0.90 μ)',
      hazards: 'Wind advisory on bridge span',
      severity: 'amber',
      humidity: '55%'
    },
    {
      condition: 'Urban Multi-lane - Commuter Volume',
      traction: 'Good (0.88 μ)',
      hazards: 'Stop-and-go pattern expected',
      severity: 'green',
      humidity: '46%'
    }
  ];
  
  const score = Math.floor(Math.abs(lat * 750) + Math.abs(lng * 1250));
  const base = conditionsList[score % conditionsList.length];
  
  if (!isMoving) {
    return {
      condition: 'Terminal / Loading Dock Bay',
      traction: 'Stationary Lock (1.00 μ)',
      hazards: 'None - Wheel chocks engaged',
      severity: 'green',
      humidity: 'N/A'
    };
  }
  
  return base;
};

interface DashboardProps {
  deliveries: DeliveryRecord[];
  onSelectTab: (tab: string) => void;
  trucks: TruckType[];
  onAddOrUpdateDelivery?: (newRecord: DeliveryRecord) => void;
  branches?: Branch[];
  onUpdateTruck?: (truck: TruckType) => void;
  users?: UserType[];
  currentUser?: UserType | null;
}

export default function Dashboard({ deliveries, onSelectTab, trucks, branches, onUpdateTruck, users, currentUser }: DashboardProps) {
  const activeBranches = branches || [];
  const activeUsers = users || [];

  const isDriver = currentUser?.role === 'Driver';
  const driverName = currentUser?.name || '';
  const driverTrucks = isDriver && driverName
    ? trucks.filter(t => t.driver && t.driver.toLowerCase() === driverName.toLowerCase())
    : [];
  const driverTruckIds = driverTrucks.map(t => t.id);

  const displayDeliveries = isDriver && driverName
    ? deliveries.filter(d => 
        (d.assignedDriver && d.assignedDriver.toLowerCase() === driverName.toLowerCase()) ||
        (d.assignedTruck && driverTruckIds.includes(d.assignedTruck))
      )
    : deliveries;

  const displayTrucks = isDriver && driverName ? driverTrucks : trucks;

  const isDriverOnline = (driverName: string): boolean => {
    if (!driverName) return false;
    const u = activeUsers.find(user => user.name.toLowerCase() === driverName.toLowerCase());
    if (!u || !u.lastActive) return false;
    const diffMs = Date.now() - new Date(u.lastActive).getTime();
    return diffMs < 45000;
  };

  const isTruckOnline = (t: any): boolean => {
    if (t.gpsSource === 'truck' && t.gpsLastHandshake) {
      const diffMs = Date.now() - new Date(t.gpsLastHandshake).getTime();
      return diffMs < 300000; // 5 minutes for hardware GPS
    }
    return isDriverOnline(t.driver);
  };
  
  const [selectedTrackTruckId, setSelectedTrackTruckId] = useState<string | null>(null);
  const selectedTruck = selectedTrackTruckId ? displayTrucks.find(t => t.id === selectedTrackTruckId) : (displayTrucks[0] || trucks[0]);
  const [isPlayingSimulation, setIsPlayingSimulation] = useState<boolean>(true);
  const [simProgress, setSimProgress] = useState<Record<string, number>>({});
  const [lastRadarPingTime, setLastRadarPingTime] = useState<string>(() => new Date().toLocaleTimeString());
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [pingPulseLocation, setPingPulseLocation] = useState<{ x: number, y: number } | null>(null);

  // Persistent tracking for vehicle idling duration to prevent the metric from being hardcoded
  const [idlingStartTime] = useState<number>(() => {
    const saved = localStorage.getItem("prospaces_idling_start_time");
    if (saved) {
      return parseInt(saved, 10);
    } else {
      // Set to 45 minutes ago initially so it starts at exactly 45 minutes
      const fortyFiveMinsAgo = Date.now() - (45 * 60 * 1000);
      localStorage.setItem("prospaces_idling_start_time", String(fortyFiveMinsAgo));
      return fortyFiveMinsAgo;
    }
  });
  
  // Custom Map Visual Themes
  const [mapTheme, setMapTheme] = useState<'default' | 'streets' | 'satellite' | 'terrain' | 'traffic'>('streets');

  // Map engine configuration (Supports TomTom and OpenStreetMap/CartoDB fallbacks)
  const [mapEngine, setMapEngine] = useState<'carto' | 'tomtom'>('carto');
  
  const [tomTomApiKey, setTomTomApiKey] = useState<string>(() => {
    return localStorage.getItem('FLEET_TOMTOM_API_KEY') || 'Q6ALAtN4vWofc1XpL9RfeT7vAwQJ8fG'; // Sample public development key
  });
  
  const [showEngineSettings, setShowEngineSettings] = useState<boolean>(false);
  
  // Real-time sitting still Dispatcher HQ Location (defaults to Halifax City Hall / Atlantic Canada)
  const [hqCoords, setHqCoords] = useState<{ lat: number, lng: number }>({ lat: 44.6488, lng: -63.5752 });
  const [isWatchingGps, setIsWatchingGps] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'off' | 'searching' | 'locked'>('off');

  // Camera Visual Filter setup for Street View
  const [cameraFilter, setCameraFilter] = useState<'normal' | 'nv' | 'thermal' | 'mono'>('normal');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('April');
  const [selectedDay, setSelectedDay] = useState<number>(12);
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [activeActionMenuTruckId, setActiveActionMenuTruckId] = useState<string | null>(null);
  const [viewingTripsTruckId, setViewingTripsTruckId] = useState<string | null>(null);
  const [viewingDetailsTruckId, setViewingDetailsTruckId] = useState<string | null>(null);
  const [viewingCoordinatesTruckId, setViewingCoordinatesTruckId] = useState<string | null>(null);
  const [detailsAccordionOpen, setDetailsAccordionOpen] = useState<{
    general: boolean;
    pinned: boolean;
    events: boolean;
    maintenance: boolean;
    sensors: boolean;
  }>({
    general: false,
    pinned: true,
    events: false,
    maintenance: false,
    sensors: false,
  });
  const [filterByLocationQuery, setFilterByLocationQuery] = useState<string>('');
  const [isTripsAccordionOpen, setIsTripsAccordionOpen] = useState<boolean>(true);
  
  // Custom states for the interactive Reminder Modal
  const [showReminderModal, setShowReminderModal] = useState<boolean>(false);
  const [reminderTruckId, setReminderTruckId] = useState<string | null>(null);
  const [reminderText, setReminderText] = useState<string>('');
  const [reminderType, setReminderType] = useState<string>('Oil Change');
  const [reminderDueDate, setReminderDueDate] = useState<string>('');
  
  // Custom State for Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);
  
  const [isMapFullscreen, setIsMapFullscreen] = useState<boolean>(false);

  // Manage Leaflet map invalidate size and block page scroll during fullscreen
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 200);

    if (isMapFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = '';
    };
  }, [isMapFullscreen]);
  
  // Clip generation animation states
  const [showCreateClipModal, setShowCreateClipModal] = useState<boolean>(false);
  const [renderingClip, setRenderingClip] = useState<boolean>(false);
  const [renderingProgress, setRenderingProgress] = useState<number>(0);
  const [renderingPhase, setRenderingPhase] = useState<string>('');
  const [selectedClipStyle, setSelectedClipStyle] = useState<string>('satellite-timelapse');
  const [selectedClipDuration, setSelectedClipDuration] = useState<string>('30s');

  const [sysLogs, setSysLogs] = useState<string[]>([
    "Fleet control server connected. Latency: 12ms",
    "Live GPS coordinate streams initialized."
  ]);

  const handleGpsSubmit = (truck: TruckType, searchVal: string | undefined) => {
    if (!searchVal || !searchVal.trim()) return;
    const norm = searchVal.trim().toUpperCase();
    
    // Check if user manually entered coords like "lat, lng"
    const coordsMatch = norm.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
    if (coordsMatch) {
      const lat = parseFloat(coordsMatch[1]);
      const lng = parseFloat(coordsMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        if (onUpdateTruck) {
          onUpdateTruck({
            ...truck,
            lat,
            lng
          });
          setSysLogs(prev => [`[${new Date().toLocaleTimeString()}] Live GPS override applied for ${truck.name} at Custom Coords: ${lat.toFixed(5)}, ${lng.toFixed(5)}`, ...prev.slice(0, 4)]);
        }
        return;
      }
    }

    // Try KNOWN_COORDS matching
    let found = false;
    for (const [key, value] of Object.entries(KNOWN_COORDS)) {
      if (norm.includes(key)) {
        if (onUpdateTruck) {
          onUpdateTruck({
            ...truck,
            lat: value.lat,
            lng: value.lng
          });
          setSysLogs(prev => [`[${new Date().toLocaleTimeString()}] Live GPS override applied for ${truck.name} at matches '${key}': ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`, ...prev.slice(0, 4)]);
          found = true;
        }
        break;
      }
    }

    if (!found) {
      // Fallback geocode using hash score so any address gets placed somewhere in Halifax region rather than crashing
      let score = 0;
      for (let i = 0; i < norm.length; i++) {
        score += norm.charCodeAt(i);
      }
      const lat = 44.55 + ((score % 30) / 30) * 0.15;
      const lng = -63.65 + (((score * 17) % 30) / 30) * 0.20;
      if (onUpdateTruck) {
        onUpdateTruck({
          ...truck,
          lat,
          lng
        });
        setSysLogs(prev => [`[${new Date().toLocaleTimeString()}] Live GPS fallback applied for ${truck.name} at: ${lat.toFixed(5)}, ${lng.toFixed(5)}`, ...prev.slice(0, 4)]);
      }
    }
  };

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const lastBoundsKeyRef = useRef<string>('');
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const trafficLayerRef = useRef<L.TileLayer | null>(null);
  const lastFlownTruckIdRef = useRef<string | null>(null);
  const layersRef = useRef<{
    hq: L.LayerGroup | null;
    branches: L.LayerGroup | null;
    deliveries: L.LayerGroup | null;
    trucks: L.LayerGroup | null;
    routes: L.LayerGroup | null;
  }>({
    hq: null,
    branches: null,
    deliveries: null,
    trucks: null,
    routes: null
  });

  // Automatically adjust default HQ coordinates and center based on the active branches' region and current selected driver/truck's branch
  useEffect(() => {
    if (selectedTruck) {
      const homeBranch = activeBranches.find(b => b.id === selectedTruck.branchId);
      if (homeBranch) {
        const coords = getGpsForLocation(homeBranch.id, homeBranch.address || homeBranch.name);
        if (coords && coords.lat !== 0 && coords.lng !== 0) {
          setHqCoords(coords);
          return;
        }
      }
    }

    const hasCaliforniaBranch = activeBranches.some(b => {
      const addr = (b.address || '').toUpperCase();
      const name = (b.name || '').toUpperCase();
      const hasCal = (/\bCA\b/.test(addr) || addr.includes('CALIFORNIA') || name.includes('CAMPBELL') || name.includes('SAN JOSE') || name.includes('CALIFORNIA') || /\bCA\b/.test(name));
      const hasCan = addr.includes('CANADA') || name.includes('CANADA');
      return hasCal && !hasCan;
    });
    
    if (hasCaliforniaBranch) {
      setHqCoords({ lat: 37.3382, lng: -121.8863 }); // California default HQ
    } else {
      setHqCoords({ lat: 44.6488, lng: -63.5752 }); // Halifax default HQ
    }
  }, [activeBranches, selectedTruck]);

  // Smoothly pan map to selected truck's active coordinates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedTrackTruckId || !selectedTruck) {
      if (!selectedTrackTruckId) {
        lastFlownTruckIdRef.current = null;
      }
      return;
    }

    if (lastFlownTruckIdRef.current === selectedTrackTruckId) {
      return;
    }
    lastFlownTruckIdRef.current = selectedTrackTruckId;

    const hasRealGps = (selectedTruck as any).lat !== undefined && 
                        (selectedTruck as any).lng !== undefined && 
                        !isNaN((selectedTruck as any).lat) && 
                        !isNaN((selectedTruck as any).lng);
    let targetLat = (selectedTruck as any).lat;
    let targetLng = (selectedTruck as any).lng;

    if (!hasRealGps) {
      const assignedDelivery = deliveries.find(d => d.assignedTruck === selectedTruck.id && d.status !== DeliveryStatus.DELIVERED);
      if (assignedDelivery) {
        const matchedOrigBranch = activeBranches.find(b => b.id === assignedDelivery.originBranch);
        const orig = getBranchCoordinates(assignedDelivery.originBranch, matchedOrigBranch?.name || '', matchedOrigBranch?.address);
        targetLat = orig.lat;
        targetLng = orig.lng;
      } else {
        const homeBranch = activeBranches.find(b => b.id === selectedTruck.branchId);
        const isProSpaces = selectedTruck.tenantId === 'prospaces';
        const orig = homeBranch 
          ? getBranchCoordinates(homeBranch.id, homeBranch.name, homeBranch.address) 
          : isProSpaces 
            ? { lat: 44.6488, lng: -63.5752 } 
            : { lat: 37.2872, lng: -121.9500 };
        targetLat = orig.lat;
        targetLng = orig.lng;
      }
    }

    if (targetLat !== undefined && targetLng !== undefined && !isNaN(targetLat) && !isNaN(targetLng)) {
      map.flyTo([targetLat, targetLng], 13.5, {
        animate: true,
        duration: 1.2
      });
    }
  }, [selectedTrackTruckId, selectedTruck, activeBranches, deliveries]);

  // 1. Initialize Leaflet map instance on mount
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const hasCaliforniaBranch = activeBranches.some(b => {
      const addr = (b.address || '').toUpperCase();
      const name = (b.name || '').toUpperCase();
      const hasCal = (/\bCA\b/.test(addr) || addr.includes('CALIFORNIA') || name.includes('CAMPBELL') || name.includes('SAN JOSE') || name.includes('CALIFORNIA') || /\bCA\b/.test(name));
      const hasCan = addr.includes('CANADA') || name.includes('CANADA');
      return hasCal && !hasCan;
    });

    const initialCenter: L.LatLngExpression = hasCaliforniaBranch
      ? [37.3382, -121.8863]
      : [44.6488, -63.5752];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 11,
      zoomControl: true,
      scrollWheelZoom: true,
      maxZoom: 18,
      minZoom: 4
    });

    mapRef.current = map;

    // Create layer groups and add them to the map
    layersRef.current.hq = L.layerGroup().addTo(map);
    layersRef.current.branches = L.layerGroup().addTo(map);
    layersRef.current.deliveries = L.layerGroup().addTo(map);
    layersRef.current.trucks = L.layerGroup().addTo(map);
    layersRef.current.routes = L.layerGroup().addTo(map);

    // Set up ResizeObserver to handle container layout changes and prevent grey "blocking" grids
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    // Map click handler to relocate Dispatcher HQ coordinates - only if Shift key is held to prevent accidental relocation!
    map.on('click', (e: L.LeafletMouseEvent) => {
      const isShiftKey = e.originalEvent && e.originalEvent.shiftKey;
      if (!isShiftKey) {
        return; // Ignored to avoid accidental relocations while interacting with the map
      }

      setIsWatchingGps(isWatch => {
        if (isWatch) {
          setSysLogs(prev => [
            `[${new Date().toLocaleTimeString()}] Relocation cancelled: Device GPS Tracking is active.`,
            ...prev.slice(0, 4)
          ]);
          return isWatch;
        }
        
        const { lat, lng } = e.latlng;
        setHqCoords({ lat, lng });
        setSysLogs(prev => [
          `[${new Date().toLocaleTimeString()}] Headquarters coordinates manually relocated to GPS ${lat.toFixed(4)}N, ${lng.toFixed(4)}W.`,
          ...prev.slice(0, 4)
        ]);
        return isWatch;
      });
    });

    return () => {
      resizeObserver.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 2. Update base tile layers on mapTheme or mapEngine change
  useEffect(() => {
    if (!mapRef.current) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }
    if (trafficLayerRef.current) {
      trafficLayerRef.current.remove();
      trafficLayerRef.current = null;
    }

    let urlTemplate = '';
    let attribution = '';
    let hasSubdomains = false;
    let customSubdomains = '';

    if (mapTheme === 'terrain') {
      // Use premium Esri Topography & Terrain basemap
      urlTemplate = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
      attribution = 'Tiles &copy; Esri &mdash; Esri, USGS, NOAA';
    } else if (mapTheme === 'streets') {
      // Use premium Esri World Street Map (highly detailed streets, roads, and names with zero blocking/rate limits)
      urlTemplate = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
      attribution = 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, TomTom, and the GIS User Community';
    } else if (mapTheme === 'osm') {
      // Use standard OpenStreetMap with correct 'abc' subdomain configuration to prevent 404 blockages
      urlTemplate = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
      hasSubdomains = true;
      customSubdomains = 'abc';
    } else if (mapEngine === 'tomtom' && tomTomApiKey) {
      hasSubdomains = true;
      customSubdomains = 'abcd';
      if (mapTheme === 'satellite') {
        urlTemplate = `https://{s}.api.tomtom.com/map/1/tile/sat/main/{z}/{x}/{y}.jpg?key=${tomTomApiKey}`;
        attribution = '&copy; TomTom Satellite Imagery';
      } else {
        // default or traffic
        urlTemplate = `https://{s}.api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${tomTomApiKey}`;
        attribution = '&copy; TomTom Map Display';
      }
    } else {
      // Fallback Engine (CartoDB)
      if (mapTheme === 'satellite') {
        urlTemplate = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        attribution = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
      } else {
        // default or traffic
        urlTemplate = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
        attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
        hasSubdomains = true;
        customSubdomains = 'abcd';
      }
    }

    const tileOptions: L.TileLayerOptions = {
      attribution,
      maxZoom: (mapTheme === 'streets' || mapTheme === 'osm') ? 19 : 18,
    };

    if (hasSubdomains && customSubdomains) {
      tileOptions.subdomains = customSubdomains;
    }

    const tileLayer = L.tileLayer(urlTemplate, tileOptions).addTo(mapRef.current);
    tileLayerRef.current = tileLayer;

    // Add traffic flow overlay if Traffic theme is selected and TomTom key is available
    if (mapTheme === 'traffic' && tomTomApiKey) {
      const trafficUrl = `https://{s}.api.tomtom.com/traffic/map/4/tile/flow/absolute/{z}/{x}/{y}.png?key=${tomTomApiKey}`;
      const trafficOptions: L.TileLayerOptions = {
        maxZoom: 18,
        subdomains: 'abcd',
        opacity: 0.85
      };
      const trafficLayer = L.tileLayer(trafficUrl, trafficOptions).addTo(mapRef.current);
      trafficLayerRef.current = trafficLayer;
    }
  }, [mapTheme, mapEngine, tomTomApiKey]);

  // 3. Update all markers and route vectors dynamically on state/telemetry changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const { hq, branches: bGroup, deliveries: dGroup, trucks: tGroup, routes: rGroup } = layersRef.current;
    if (hq) hq.clearLayers();
    if (bGroup) bGroup.clearLayers();
    if (dGroup) dGroup.clearLayers();
    if (tGroup) tGroup.clearLayers();
    if (rGroup) rGroup.clearLayers();

    // Plot hq
    if (hq) {
      const hqIcon = L.divIcon({
        className: 'custom-hq-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <span class="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-blue-500 opacity-60"></span>
            <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-600 border border-white shadow-lg"></span>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      L.marker([hqCoords.lat, hqCoords.lng], {
        icon: hqIcon,
        title: 'HQ (Dispatcher)'
      })
      .addTo(hq)
      .bindPopup(`
        <div class="font-sans text-xs p-1">
          <p class="font-bold text-slate-800">Dispatch Headquarters</p>
          <p class="text-[10px] text-slate-500">Location: ${hqCoords.lat.toFixed(4)}N, ${hqCoords.lng.toFixed(4)}W</p>
          <p class="text-[9px] text-blue-600 mt-1 font-semibold">${isWatchingGps ? "🛰️ Live GPS Connected" : "📍 Anchored Point (Shift + Click map to relocate)"}</p>
        </div>
      `);
    }

    // Plot Branches/DC Nodes
    if (bGroup) {
      activeBranches.forEach(branch => {
        const coords = getBranchCoordinates(branch.id, branch.name, branch.address);
        const isDC = branch.type === 'DC';
        const count = displayDeliveries.filter(d => d.originBranch === branch.id && d.status !== DeliveryStatus.DELIVERED).length;

        const iconSvg = isDC 
          ? `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-warehouse shrink-0"><path d="M22 22H2"/><path d="M10 22v-5a2 2 0 0 1 4 0v5"/><path d="M16 11V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v6"/><rect width="18" height="12" x="3" y="10" rx="2"/><path d="M18 10V5a2 2 0 0 0-2-2h-8A2 2 0 0 0 6 5v5"/></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-store shrink-0"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V7"/><path d="M18 7v3a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V7"/><path d="M14 7v3a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V7"/><path d="M10 7v3a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V7"/><path d="M6 7v3a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V7"/></svg>`;

        const cleanName = branch.name
          .replace(/^ProSpaces\s*-\s*/i, '')
          .replace(/^ProSpaces\s+/i, '')
          .replace(/^\d+\s*-\s*/, '')
          .replace(/^\d+\s+/, '');

        const branchIcon = L.divIcon({
          className: 'custom-branch-marker',
          html: `
            <div class="relative -translate-y-1 bg-slate-900 border-2 ${
              isDC ? 'border-red-500 text-red-400' : 'border-blue-400 text-blue-400'
            } shadow-lg py-0.5 px-1.5 rounded-md text-[9px] font-mono leading-none flex items-center gap-1.5 justify-center whitespace-nowrap min-w-[75px]">
              ${iconSvg}
              <span class="font-bold">${isDC ? "DC" : "STORE"}</span>
              <span class="text-white opacity-95 font-sans font-semibold">${cleanName}</span>
              ${count > 0 ? `<span class="bg-amber-500 text-slate-950 px-1 rounded-full font-sans font-extrabold text-[8px]">${count}</span>` : ''}
            </div>
          `,
          iconSize: [120, 20],
          iconAnchor: [60, 10]
        });

        L.marker([coords.lat, coords.lng], {
          icon: branchIcon
        })
        .addTo(bGroup)
        .bindTooltip(`
          <div class="font-sans text-xs p-1 space-y-1 text-left">
            <p class="font-bold text-slate-100">${branch.name}</p>
            <p class="text-[9.5px] text-amber-400 font-medium">${isDC ? "Distribution Center" : "Store Depot"}</p>
            ${branch.address ? `<p class="text-[9.5px] text-slate-300 border-t border-slate-800 pt-1 mt-1 leading-relaxed whitespace-normal">${branch.address}</p>` : ''}
          </div>
        `, {
          permanent: false,
          direction: 'top',
          offset: [0, -10],
          className: 'bg-slate-900 border border-slate-800 text-white rounded-lg px-2.5 py-1.5 shadow-xl font-sans min-w-[180px] max-w-[240px]'
        })
        .bindPopup(`
          <div class="font-sans text-xs p-1.5 space-y-1">
            <p class="font-bold text-slate-850">${branch.name}</p>
            <p class="text-[10px] text-slate-500">Facility Type: ${branch.type === 'DC' ? 'Distribution Center' : 'Regional Store Depot'}</p>
            ${branch.address ? `<p class="text-[10px] text-slate-600 font-medium mt-1">${branch.address}</p>` : ''}
            <p class="text-[9px] text-slate-400 mt-0.5">GPS Coords: ${coords.lat.toFixed(4)}N, ${coords.lng.toFixed(4)}W</p>
            <p class="text-[10px] text-amber-600 mt-1.5 font-bold border-t border-slate-100 pt-1">Pending Carrier Loads: ${count}</p>
          </div>
        `);
      });
    }

    // Plot Customer Delivery Destinations
    if (dGroup) {
      displayDeliveries.filter(d => d.status !== DeliveryStatus.DELIVERED).forEach(delivery => {
        const isAssigned = !!delivery.assignedTruck;
        if (isAssigned) {
          const matchedTruck = displayTrucks.find(t => t.id === delivery.assignedTruck);
          if (matchedTruck) {
            const online = isTruckOnline(matchedTruck);
            if (!online) {
              return; // Hide destination if driver is offline
            }
          }
        }
        const matchedOrigBranch = activeBranches.find(b => b.id === delivery.originBranch);
        const origCoords = getBranchCoordinates(delivery.originBranch, matchedOrigBranch?.name || '', matchedOrigBranch?.address);
        const destCoords = getDeliveryCoordinates(delivery.id, delivery.deliveryAddress, origCoords.x, origCoords.y);

        const deliveryIcon = L.divIcon({
          className: 'custom-delivery-marker',
          html: `
            <div class="p-1 rounded-full border border-slate-900 shadow-md ${
              isAssigned ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-100'
            }">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="lucide lucide-map-pin"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
          `,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        L.marker([destCoords.lat, destCoords.lng], {
          icon: deliveryIcon
        })
        .addTo(dGroup)
        .bindPopup(`
          <div class="font-sans text-xs p-1.5 space-y-0.5 font-sans">
            <p class="font-bold text-slate-900">🎯 Recipient: ${delivery.customerName}</p>
            <p class="text-[10px] text-slate-600">${cleanAddressText(delivery.deliveryAddress)}</p>
            <p class="text-[9px] text-slate-500">Invoice: ${delivery.invoiceNumber} ${delivery.weight ? `&bull; Weight: ${delivery.weight}` : ''}</p>
            <div class="mt-1.5 flex items-center gap-1.5 border-t border-slate-100 pt-1.5 font-sans">
              <span class="px-1.5 py-0.25 text-[8.5px] font-extrabold rounded bg-amber-100 text-amber-800 uppercase">
                ${delivery.status.replace('_', ' ')}
              </span>
              <span class="text-[9px] text-slate-500 font-medium">${isAssigned ? `Driver: ${delivery.assignedTruck}` : 'Pending Driver'}</span>
            </div>
          </div>
        `);
      });
    }

    // Plot drivers / trucks & lines
    let activeTruckGps: { lat: number; lng: number } | null = null;
    const allPlottedCoords: L.LatLngExpression[] = [];

    if (hqCoords && !isNaN(hqCoords.lat) && !isNaN(hqCoords.lng)) {
      allPlottedCoords.push([hqCoords.lat, hqCoords.lng]);
    }

    activeBranches.forEach(branch => {
      const coords = getBranchCoordinates(branch.id, branch.name, branch.address);
      if (coords && !isNaN(coords.lat) && !isNaN(coords.lng)) {
        allPlottedCoords.push([coords.lat, coords.lng]);
      }
    });

    displayDeliveries.filter(d => d.status !== DeliveryStatus.DELIVERED).forEach(delivery => {
      const isAssigned = !!delivery.assignedTruck;
      if (isAssigned) {
        const matchedTruck = displayTrucks.find(t => t.id === delivery.assignedTruck);
        if (matchedTruck) {
          const online = isTruckOnline(matchedTruck);
          if (!online) return; // Skip bounds plotting if driver is offline
        }
      }
      const matchedOrigBranch = activeBranches.find(b => b.id === delivery.originBranch);
      const origCoords = getBranchCoordinates(delivery.originBranch, matchedOrigBranch?.name || '', matchedOrigBranch?.address);
      const destCoords = getDeliveryCoordinates(delivery.id, delivery.deliveryAddress, origCoords.x, origCoords.y);
      if (destCoords && !isNaN(destCoords.lat) && !isNaN(destCoords.lng)) {
        allPlottedCoords.push([destCoords.lat, destCoords.lng]);
      }
    });

    if (tGroup && rGroup) {
      displayTrucks.forEach(truck => {
        let origLat: number;
        let origLng: number;
        let destLat: number;
        let destLng: number;
        let isMoving = false;
        
        const isOnline = isTruckOnline(truck);

        const assignedDelivery = displayDeliveries.find(d => d.assignedTruck === truck.id && d.status !== DeliveryStatus.DELIVERED);
        if (assignedDelivery) {
          const matchedOrigBranch = activeBranches.find(b => b.id === assignedDelivery.originBranch);
          const orig = getBranchCoordinates(assignedDelivery.originBranch, matchedOrigBranch?.name || '', matchedOrigBranch?.address);
          const dest = getDeliveryCoordinates(assignedDelivery.id, assignedDelivery.deliveryAddress, orig.x, orig.y);
          origLat = isNaN(orig.lat) ? 44.6488 : orig.lat;
          origLng = isNaN(orig.lng) ? -63.5752 : orig.lng;
          destLat = isNaN(dest.lat) ? 44.6488 : dest.lat;
          destLng = isNaN(dest.lng) ? -63.5752 : dest.lng;
          isMoving = assignedDelivery.status === DeliveryStatus.PICKED_AND_LOADED && isPlayingSimulation && isOnline;
        } else {
          const homeBranch = activeBranches.find(b => b.id === truck.branchId);
          const isProSpaces = truck.tenantId === 'prospaces';
          const orig = homeBranch 
            ? getBranchCoordinates(homeBranch.id, homeBranch.name, homeBranch.address) 
            : isProSpaces 
              ? { lat: 44.6488, lng: -63.5752 } 
              : { lat: 37.2872, lng: -121.9500 };
          origLat = isNaN(orig.lat) ? 44.6488 : orig.lat;
          origLng = isNaN(orig.lng) ? -63.5752 : orig.lng;
          destLat = origLat + 0.003;
          destLng = origLng + 0.003;
          isMoving = false;
        }

        let { lat: truckLat, lng: truckLng, hasRealGps } = getTruckCoords(truck, simProgress, activeBranches);

        if (isNaN(truckLat) || isNaN(truckLng)) {
          truckLat = origLat;
          truckLng = origLng;
        }
        
        if (!isNaN(truckLat) && !isNaN(truckLng)) {
          allPlottedCoords.push([truckLat, truckLng]);
        }

        const isSelected = selectedTrackTruckId === truck.id;
        if (isSelected || (!selectedTrackTruckId && displayTrucks[0]?.id === truck.id)) {
          activeTruckGps = { lat: truckLat, lng: truckLng };
        }

        // Draw route line if delivery is active and driver is online
        if (assignedDelivery && isOnline && !isNaN(origLat) && !isNaN(origLng) && !isNaN(destLat) && !isNaN(destLng)) {
          L.polyline([[origLat, origLng], [destLat, destLng]], {
            color: isSelected ? '#f59e0b' : '#64748b',
            weight: isSelected ? 3.5 : 2,
            dashArray: isSelected ? '6,6' : '4,4',
            opacity: isSelected ? 0.95 : 0.6
          }).addTo(rGroup);
        }

        const truckIcon = L.divIcon({
          className: 'custom-truck-marker',
          html: `
            <div class="p-1.5 rounded-full shadow-lg border-2 flex items-center justify-center transition-all ${
              isSelected 
                ? 'bg-amber-500 border-white text-slate-950 scale-110 ring-4 ring-amber-500/35' 
                : isMoving 
                  ? 'bg-emerald-600 border-emerald-400 text-white animate-pulse' 
                  : 'bg-slate-700 border-slate-500 text-slate-300'
            }">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="lucide lucide-truck"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M19 18h2a1 1 0 0 0 1-1v-5.14a1 1 0 0 0-.293-.707l-4.07-4.07a1 1 0 0 0-.707-.293H14"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        const popupMessage = !isOnline
          ? `Driver Offline (Stationary)`
          : hasRealGps 
            ? `Broadcasting Live Coordinates (Currently at 137 Chain Lake Drive / Bayer's Lake)`
            : assignedDelivery
              ? `Delivering order ${assignedDelivery.invoiceNumber}`
              : 'Standby / Refueling';

        const isTruckGps = (truck as any).gpsSource === 'truck';
        const activeGpsSourceLabel = isTruckGps 
          ? `<span class="bg-amber-100 text-amber-800 text-[9px] font-mono font-bold px-1.5 py-0.25 rounded-md border border-amber-200">🛰️ Stationary: ${(truck as any).gpsDeviceId || 'Core Telematics'}</span>`
          : `<span class="bg-blue-100 text-blue-800 text-[9px] font-mono font-bold px-1.5 py-0.25 rounded-md border border-blue-200">📱 Mobile Device Geolocation</span>`;

        const markerInstance = L.marker([truckLat, truckLng], {
          icon: truckIcon,
          zIndexOffset: isSelected ? 1000 : 100
        })
        .addTo(tGroup)
        .bindTooltip(`${truck.name} (${truck.driver || 'No Driver'})`, {
          permanent: false,
          direction: 'top',
          offset: [0, -10],
          className: 'bg-slate-900 border border-slate-800 text-white font-semibold text-[11px] rounded px-2 py-0.5 shadow-md font-sans'
        })
        .bindPopup(`
          <div class="font-sans text-xs p-1.5 space-y-1">
            <div class="flex items-center gap-1.5 border-b border-slate-105 pb-1 font-sans">
              <span class="w-1.5 h-1.5 rounded-full ${isMoving ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}"></span>
              <p class="font-bold text-slate-900">${truck.name}</p>
            </div>
            <p class="text-[10.5px] text-slate-700 font-medium font-sans">Driver: <strong class="text-blue-600">${truck.driver || 'No Driver'}</strong></p>
            <div class="my-1">${activeGpsSourceLabel}</div>
            <p class="text-[10px] text-slate-500">ID: ${truck.id} &bull; Type: ${truck.type || 'Flatbed'}</p>
            <p class="text-[9px] text-slate-400 font-mono font-sans">GPS: ${truckLat.toFixed(5)}N, ${truckLng.toFixed(5)}W</p>
            <p class="text-[9.5px] text-amber-600 font-bold mt-1 font-sans">${popupMessage}</p>
          </div>
        `);

        // Update selected truck when clicking on marker
        markerInstance.on('click', () => {
          setSelectedTrackTruckId(prev => prev === truck.id ? null : truck.id);
        });
      });
    }

    // Telemetry wire linking dispatcher to chosen driver
    if (activeTruckGps && hqCoords && rGroup) {
      L.polyline([[hqCoords.lat, hqCoords.lng], [activeTruckGps.lat, activeTruckGps.lng]], {
        color: '#2563eb',
        weight: 1.5,
        dashArray: '4,6',
        opacity: 0.75
      }).addTo(rGroup);
    }

    // Auto-fit geographic boundaries to fit all markers elegantly without jittering on every progress update
    const branchesKey = activeBranches.map(b => b.id).sort().join(',');
    const deliveriesCount = displayDeliveries.filter(d => d.status !== DeliveryStatus.DELIVERED).length;
    const currentBoundsKey = `${branchesKey}-${deliveriesCount}-${displayTrucks.length}`;
    
    if (lastBoundsKeyRef.current !== currentBoundsKey && allPlottedCoords.length > 0 && map) {
      lastBoundsKeyRef.current = currentBoundsKey;
      try {
        map.fitBounds(L.latLngBounds(allPlottedCoords), { padding: [50, 50], maxZoom: 13 });
      } catch (e) {
        console.warn("Could not fit map bounds dynamically:", e);
      }
    }
  }, [hqCoords, activeBranches, displayDeliveries, displayTrucks, simProgress, selectedTrackTruckId, isPlayingSimulation, isWatchingGps]);

  // Statistics
  const total = displayDeliveries.length;
  const registered = displayDeliveries.filter(d => d.status === DeliveryStatus.REGISTERED).length;
  const picked = displayDeliveries.filter(d => d.status === DeliveryStatus.PICKED_AND_LOADED).length;
  const delivered = displayDeliveries.filter(d => d.status === DeliveryStatus.DELIVERED).length;
  const returned = displayDeliveries.filter(d => d.status === DeliveryStatus.RETURNED).length;

  const bogoStats = activeBranches.map(branch => {
    const branchDeliveries = displayDeliveries.filter(d => d.originBranch === branch.id);
    return {
      ...branch,
      count: branchDeliveries.length,
      delivered: branchDeliveries.filter(d => d.status === DeliveryStatus.DELIVERED).length,
      pending: branchDeliveries.filter(d => d.status === DeliveryStatus.REGISTERED || d.status === DeliveryStatus.PICKED_AND_LOADED).length
    };
  });

  

  // Render clip progression ticker
  useEffect(() => {
    if (!renderingClip) return;
    setRenderingProgress(0);
    setRenderingPhase('Initializing renderer stream canvas...');
    
    const interval = setInterval(() => {
      setRenderingProgress(prev => {
        const next = prev + 5;
        if (next >= 100) {
          clearInterval(interval);
          setRenderingPhase('Render complete! Packing file container...');
          setTimeout(() => {
            setRenderingPhase('Export successful!');
            setTimeout(() => {
              setRenderingClip(false);
              setShowCreateClipModal(false);
              alert('Video clip successfully generated and downloaded to machine logs as high-definition MP4. Clip Style: ' + selectedClipStyle);
            }, 1000);
          }, 1000);
          return 100;
        }
        
        // Dynamic status phases
        if (next < 25) {
          setRenderingPhase(`Overlaying 3D Vector terrain tiles... Frame ${Math.round(next * 9)}/900`);
        } else if (next < 50) {
          setRenderingPhase(`Mapping high-fidelity GPS telemetry vectors... Frame ${Math.round(next * 9)}/900`);
        } else if (next < 75) {
          setRenderingPhase(`Fetching dynamic street view logs and safety hazard pins... Frame ${Math.round(next * 9)}/900`);
        } else {
          setRenderingPhase(`Converting binary raster stream into H.264 MP4 container...`);
        }
        
        return next;
      });
    }, 180);
    
    return () => clearInterval(interval);
  }, [renderingClip, selectedClipStyle]);

  // Real browser-based Geolocation tracker
  useEffect(() => {
    if (!isWatchingGps) {
      setGpsStatus('off');
      return;
    }

    setGpsStatus('searching');
    if (!navigator.geolocation) {
      setGpsError("Geolocation API not supported by browser.");
      setGpsStatus('off');
      return;
    }

    const successHandler = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      
      // Determine if they are inside the general Nova Scotia region
      const inRegion = latitude >= 43.5 && latitude <= 45.5 && longitude >= -65.5 && longitude <= -62.5;
      
      if (inRegion) {
        setHqCoords({ lat: latitude, lng: longitude });
        setGpsError(null);
      } else {
        // Position isn't within general Canada Nova Scotia - bridge elements dynamically so they can still see it!
        setHqCoords({ lat: 44.6488, lng: -63.5752 }); // Halifax Center fallback
        setGpsError("Bridges enabled: Your real location is outside Nova Scotia. Active dispatch point set at Halifax Harbor.");
      }
      setGpsStatus('locked');
      setSysLogs(prev => [
        `[${new Date().toLocaleTimeString()}] Live GPS Stream Lock initialized at ${latitude.toFixed(4)}N, ${longitude.toFixed(4)}W.`,
        ...prev.slice(0, 4)
      ]);
    };

    const errorHandler = (err: GeolocationPositionError) => {
      console.warn("Geolocation permission error:", err);
      setGpsError("Access restricted. Active Dispatch Center set at central Halifax City Hall.");
      setHqCoords({ lat: 44.6488, lng: -63.5752 }); // Fallback
      setGpsStatus('locked');
      setSysLogs(prev => [
        `[${new Date().toLocaleTimeString()}] Dynamic GPS fallback active. Tracking seated dispatcher beacon.`,
        ...prev.slice(0, 4)
      ]);
    };

    const watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isWatchingGps]);

  // Run a manual Radar Ping
  const triggerRadarPing = () => {
    setIsPinging(true);
    setLastRadarPingTime(new Date().toLocaleTimeString());
    setSysLogs(prevLogs => [
      `[${new Date().toLocaleTimeString()}] Broadcast Active Sweep Ping to all regional flatbeds.`,
      ...prevLogs.slice(0, 4)
    ]);
    setTimeout(() => {
      setIsPinging(false);
    }, 1200);
  };

  // Converts progress (0-1) to a readable timestamp of the active day
  const getTimelineTimestamp = (progress: number): string => {
    // Let's assume the trip runs from 1:00 PM to 4:00 PM (180 minutes span)
    const startHour = 13; // 1:00 PM
    const totalMinutes = 180;
    const currentMinutes = Math.round(progress * totalMinutes);
    const date = new Date();
    date.setHours(startHour);
    date.setMinutes(currentMinutes);
    date.setSeconds(0);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <div className="space-y-6" id="dashboard-tab">
      
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        
        <div className="bg-white border border-gray-100 p-4 rounded-xl shadow-sm flex items-center space-x-3 hover:shadow-md transition-all">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-mono text-gray-500 uppercase">Total Orders</p>
            <h3 className="text-2xl font-bold font-sans text-gray-900">{total}</h3>
          </div>
        </div>

        <div className="bg-white border border-gray-100 p-4 rounded-xl shadow-sm flex items-center space-x-3 hover:shadow-md transition-all">
          <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
            <FileCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-mono text-gray-500 uppercase">Registered</p>
            <h3 className="text-2xl font-bold font-sans text-orange-600">{registered}</h3>
          </div>
        </div>

        <div className="bg-white border border-gray-100 p-4 rounded-xl shadow-sm flex items-center space-x-3 hover:shadow-md transition-all">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <TruckIcon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-mono text-gray-500 uppercase">Picked / Loaded</p>
            <h3 className="text-2xl font-bold font-sans text-amber-600">{picked}</h3>
          </div>
        </div>

        <div className="bg-white border border-gray-100 p-4 rounded-xl shadow-sm flex items-center space-x-3 hover:shadow-md transition-all">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-mono text-gray-500 uppercase">Delivered</p>
            <h3 className="text-2xl font-bold font-sans text-green-600">{delivered}</h3>
          </div>
        </div>

        <div className="bg-white border border-gray-100 p-4 rounded-xl shadow-sm flex items-center space-x-3 hover:shadow-md col-span-2 md:col-span-1 transition-all">
          <div className="p-3 bg-red-50 text-red-600 rounded-lg">
            <RefreshCw className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-mono text-gray-500 uppercase">Returns/Refused</p>
            <h3 className="text-2xl font-bold font-sans text-red-600">{returned}</h3>
          </div>
        </div>

      </div>

      {/* Interactive Regional Dispatch & Live Driver GPS Tracker */}
      <div className={`bg-white border border-slate-200/80 shadow-md overflow-hidden flex flex-col transition-all duration-300 ${
        isMapFullscreen 
          ? 'fixed inset-0 z-[100] m-0 rounded-none w-screen h-screen' 
          : 'relative rounded-2xl'
      }`}>
        <div className="bg-slate-900 px-6 py-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <h4 className="font-sans font-bold text-white tracking-tight text-base sm:text-lg flex items-center gap-2">
                <Compass className="h-5 w-5 text-amber-500 animate-spin" style={{ animationDuration: '8s' }} />
                Live Regional Dispatch Grid & Driver GPS Monitor
              </h4>
            </div>
            <p className="text-xs text-slate-400 font-normal">
              Active telemetry synchronized with Canadian Maritime HRM logistics routing and live regional depots
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Theme Selectors */}
            <div className="flex items-center space-x-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setMapTheme('streets')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                  mapTheme === 'streets' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                Detailed Streets
              </button>
              <button
                type="button"
                onClick={() => setMapTheme('osm')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                  mapTheme === 'osm' 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                OpenStreetMap
              </button>
              <button
                type="button"
                onClick={() => setMapTheme('default')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                  mapTheme === 'default' 
                    ? 'bg-sky-600 text-white shadow-xs' 
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                Simplified
              </button>
              <button
                type="button"
                onClick={() => setMapTheme('satellite')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                  mapTheme === 'satellite' 
                    ? 'bg-amber-600 text-white shadow-xs' 
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                Satellite
              </button>
              <button
                type="button"
                onClick={() => setMapTheme('terrain')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                  mapTheme === 'terrain' 
                    ? 'bg-emerald-600 text-white shadow-xs' 
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                Terrain
              </button>
              <button
                type="button"
                onClick={() => setMapTheme('traffic')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                  mapTheme === 'traffic' 
                    ? 'bg-rose-600 text-white shadow-xs' 
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                Traffic
              </button>
            </div>

            {/* Desktop Fullscreen Toggle Anchor */}
            <button
              type="button"
              onClick={() => setIsMapFullscreen(!isMapFullscreen)}
              className="hidden md:inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-semibold transition-all cursor-pointer select-none border-l border-slate-700 pl-3 ml-1"
            >
              {isMapFullscreen ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span>Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span>Expand Map Fullscreen</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className={`grid grid-cols-1 lg:grid-cols-12 font-sans ${
          isMapFullscreen ? 'flex-1 min-h-0' : 'min-h-[480px]'
        }`}>
          
          {/* Real zoomable Leaflet Map Container */}
          <div className={`lg:col-span-8 p-4 relative border-b lg:border-b-0 lg:border-r border-slate-200/85 flex flex-col justify-between overflow-hidden bg-slate-50 ${
            isMapFullscreen ? 'h-full min-h-0' : 'min-h-[430px] lg:min-h-[500px]'
          }`}>
            <div className="relative flex-1 w-full rounded-2xl overflow-hidden shadow-inner border border-slate-200">
              <div 
                ref={mapContainerRef} 
                className="absolute inset-0 w-full h-full z-10" 
                style={{ background: '#f8fafc' }}
              />
              
              {/* Floating map visual elements */}
              <div className="absolute top-3 right-3 text-[10px] font-mono uppercase tracking-widest flex items-center space-x-2 z-20 bg-slate-900/90 border border-slate-800 py-1.5 px-2.5 rounded-lg text-slate-200 shadow-md">
                <Activity className="h-3 w-3 text-emerald-500 animate-pulse" />
                <span>Interactive Live Fleet grid</span>
              </div>

              {/* TomTom Map Engine Settings Popup overlay */}
              {showEngineSettings && mapEngine === 'tomtom' && (
                <div className="absolute top-14 right-3 w-72 bg-slate-900/95 backdrop-blur-md text-white rounded-xl border border-slate-800 p-4 shadow-xl z-20 animate-fade-in font-sans space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider text-amber-400">
                      <Settings className="w-4 h-4 animate-spin" style={{ animationDuration: '6s' }} />
                      TomTom Engine Configuration
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowEngineSettings(false)}
                      className="text-slate-400 hover:text-white text-xs font-bold px-1.5 py-0.5 hover:bg-slate-800 rounded font-mono cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  
                  <div className="space-y-2.5 text-[11px]">
                    <p className="text-slate-300 leading-normal">
                      The live fleet map is currently streaming spatial raster tiles served directly from TomTom Developer APIs.
                    </p>
                    
                    <div className="space-y-1">
                      <label className="block text-[9px] uppercase font-mono tracking-wider text-slate-400 font-bold">
                        TomTom API Key:
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="password"
                          value={tomTomApiKey}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTomTomApiKey(val);
                            localStorage.setItem('FLEET_TOMTOM_API_KEY', val);
                          }}
                          placeholder="Paste TomTom API Key"
                          className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-100 font-mono text-[10px] focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setTomTomApiKey('Q6ALAtN4vWofc1XpL9RfeT7vAwQJ8fG'); // reset to default
                            localStorage.setItem('FLEET_TOMTOM_API_KEY', 'Q6ALAtN4vWofc1XpL9RfeT7vAwQJ8fG');
                          }}
                          className="px-2 py-1 bg-slate-800 text-slate-300 rounded hover:bg-slate-705 text-[9.5px] font-mono hover:text-white font-bold cursor-pointer"
                          title="Click to reset to evaluation default key"
                        >
                          Default
                        </button>
                      </div>
                      <span className="text-[9px] text-slate-500 block leading-tight">
                        Don't have a key? Get a free developer key at <a href="https://developer.tomtom.com" target="_blank" rel="noreferrer" className="text-amber-400 hover:underline hover:text-amber-300">developer.tomtom.com</a> with 2,500 daily requests.
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Map Style Mapping:</span>
                        <span className="text-emerald-400 font-bold uppercase">{mapTheme}</span>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-normal">
                        Visual themes automap to corresponding TomTom Basic Daylight, Night, and Imagery layers.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Location Coordinates Popup Overlay */}
              {viewingCoordinatesTruckId && (() => {
                const selectedCoordinatesTruck = displayTrucks.find(t => t.id === viewingCoordinatesTruckId);
                if (!selectedCoordinatesTruck) return null;

                const lat = selectedCoordinatesTruck.gpsLat || selectedCoordinatesTruck.lat || 44.690383;
                const lng = selectedCoordinatesTruck.gpsLng || selectedCoordinatesTruck.lng || -63.599217;
                
                const getTruckAddress = (truck: any) => {
                  if (!truck) return '500 Windmill Rd, Dartmouth, NS B3B 1B3, Canada';
                  const branch = activeBranches.find(b => b.id === truck.branchId);
                  if (branch && branch.address) return branch.address;
                  const delivery = displayDeliveries.find(d => d.assignedTruck === truck.id && d.status !== DeliveryStatus.DELIVERED);
                  if (delivery && delivery.deliveryAddress) return delivery.deliveryAddress;
                  return '500 Windmill Rd, Dartmouth, NS B3B 1B3, Canada';
                };

                const address = getTruckAddress(selectedCoordinatesTruck);

                return (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl border border-slate-100 p-6 shadow-2xl z-20 animate-fade-in font-sans space-y-4 w-[350px] max-w-[90%] select-none">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-800">
                        Location coordinates
                      </h3>
                      <button
                        type="button"
                        onClick={() => setViewingCoordinatesTruckId(null)}
                        className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors cursor-pointer flex items-center justify-center"
                        title="Close"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-3.5 pt-1">
                      <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 text-slate-700 shrink-0 mt-0.5 fill-slate-700" />
                        <span className="text-slate-600 font-medium text-xs leading-normal">
                          {address}
                        </span>
                      </div>

                      <div className="flex items-start gap-3">
                        <Crosshair className="h-4 w-4 text-slate-700 shrink-0 mt-0.5" />
                        <span className="text-slate-600 font-mono text-xs leading-normal">
                          {lat.toFixed(6)}, {lng.toFixed(6)}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setToastMessage(`Historical asset proximity query initiated near coordinates`);
                          setSysLogs(prev => [`[${new Date().toLocaleTimeString()}] Who was here query triggered for GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`, ...prev.slice(0, 3)]);
                        }}
                        className="flex-1 py-2 px-3 border border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                      >
                        Who was here?
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const nearby = activeBranches.map(b => {
                            const coords = getBranchCoordinates(b.id, b.name, b.address);
                            const dist = Math.sqrt(Math.pow(coords.lat - lat, 2) + Math.pow(coords.lng - lng, 2)) * 111;
                            return { name: b.name, dist };
                          }).sort((a, b) => a.dist - b.dist)[0];

                          setToastMessage(`Nearest Hub: ${nearby.name} (${nearby.dist.toFixed(1)} km)`);
                          setSysLogs(prev => [`[${new Date().toLocaleTimeString()}] Landmark search: Nearest depot is ${nearby.name} @ ${nearby.dist.toFixed(2)}km.`, ...prev.slice(0, 3)]);
                        }}
                        className="flex-1 py-2 px-3 bg-[#007A64] hover:bg-[#006351] text-white font-bold rounded-lg text-xs transition-all cursor-pointer text-center"
                      >
                        Find nearby
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="hidden">
            {/* Visual Vector Map Canvas */}
          <div 
            onClick={() => {}}
            className={`lg:col-span-8 p-6 relative border-b lg:border-b-0 lg:border-r flex flex-col justify-between overflow-hidden cursor-crosshair group select-none transition-all duration-300 min-h-[380px] ${
              mapTheme !== 'satellite' 
                ? 'bg-sky-50/70 border-slate-200 bg-[radial-gradient(#94a3b8_0.8px,transparent_0.8px)] [background-size:20px_20px]' 
                : 'bg-slate-950/95 border-slate-800 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]'
            }`}
          >
            
            <div className="absolute top-4 right-4 text-[10px] font-mono uppercase tracking-widest flex items-center space-x-2 z-20 bg-slate-900/90 border border-slate-850 py-1.5 px-2.5 rounded-lg text-slate-300 shadow-md">
              <Activity className="h-3 w-3 text-emerald-500 animate-pulse" />
              <span>HRM Grid Centroid: REF_44_64N</span>
            </div>

            {/* High Fidelity Vector Coastlines / Island Geo-Topology Background Layer */}
            <div className="absolute inset-0 pointer-events-none w-full h-full">
              <svg className="w-full h-full opacity-90 transition-all duration-500" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                {(() => {
                  const colors = 
                    mapTheme !== 'satellite' 
                      ? { water: '#b2e2f2', land: '#faf9f5', shore: '#0284c7', bridge: '#ef4444', highway: '#94a3b8' } 
                      : { water: '#050e1e', land: '#111e30', shore: '#38bdf8', bridge: '#10b981', highway: '#112240' };
                  
                  return (
                    <g>
                      {/* Deep Water base fill */}
                      <rect width="100" height="100" fill={colors.water} className="transition-all duration-500" />

                      {/* Main Peninsula and West Mainland Shoreline Structure */}
                      <path
                        d="M -10,-10 L 48,-10 Q 42,15 44,22 T 38,36 T 32,45 T 18,52 T -10,65 Z"
                        fill={colors.land}
                        stroke={colors.shore}
                        strokeWidth="0.8"
                        className="transition-all duration-500"
                      />

                      {/* Bedford Basin enclosed water body */}
                      <path
                        d="M 44,12 C 41,6 54,4 58,10 C 60,18 48,22 44,12 Z"
                        fill={colors.water}
                        stroke={colors.shore}
                        strokeWidth="0.5"
                        className="transition-all duration-500"
                      />

                      {/* Eastern Dartmouth Landmass */}
                      <path
                        d="M 110,-10 L 64,-10 Q 56,12 61,22 T 66,33 T 75,44 T 88,52 T 110,55 Z"
                        fill={colors.land}
                        stroke={colors.shore}
                        strokeWidth="0.8"
                        className="transition-all duration-500"
                      />

                      {/* Southerly Bay / South Shore Landmasses (Bridgewater region) */}
                      <path
                        d="M -10,63 L 26,58 Q 30,68 22,78 T 10,88 T -10,100 Z"
                        fill={colors.land}
                        stroke={colors.shore}
                        strokeWidth="0.8"
                        className="transition-all duration-500"
                      />

                      {/* Islands */}
                      <circle cx="55" cy="46" r="1.5" fill={colors.land} stroke={colors.shore} strokeWidth="0.3" className="transition-all duration-500" /> { /* McNabs Island */}
                      <circle cx="51" cy="38" r="0.8" fill={colors.land} stroke={colors.shore} strokeWidth="0.3" className="transition-all duration-500" /> { /* Georges Island */}

                      {/* Major Logistics Bridges Crossing the Harbour Narrows */}
                      <line x1="43" y1="21" x2="60" y2="19" stroke={colors.bridge} strokeWidth="0.4" strokeDasharray="1,1" className="transition-all duration-500" />
                      <line x1="40" y1="34" x2="63" y2="30" stroke={colors.bridge} strokeWidth="0.4" className="transition-all duration-500" />

                      {/* Major Highways Ribbons */}
                      <path d="M 10,12 L 40,24 Q 44,28 52,28 T 72,25 T 90,15" fill="none" stroke={colors.highway} strokeWidth="0.5" strokeDasharray="2,2" opacity="0.6" className="transition-all duration-500" />
                      <path d="M 22,10 L 22,85" fill="none" stroke={colors.highway} strokeWidth="0.3" opacity="0.5" className="transition-all duration-500" />
                    </g>
                  );
                })()}
              </svg>
            </div>

            {/* Live connecting tether line-of-sight signal projection between Headquarters (Sitting Still) and current selected truck */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-15" xmlns="http://www.w3.org/2000/svg">
              {(() => {
                const hqPercent = getPercentCoordsFromGps(hqCoords.lat, hqCoords.lng);
                const matchedTruck = selectedTrackTruckId ? displayTrucks.find(t => t.id === selectedTrackTruckId) : displayTrucks[0];
                if (!matchedTruck) return null;

                let origLat: number;
                let origLng: number;
                let destLat: number;
                let destLng: number;

                const assignedDelivery = displayDeliveries.find(d => d.assignedTruck === matchedTruck.id && d.status !== DeliveryStatus.DELIVERED);
                if (assignedDelivery) {
                  const orig = getBranchCoordinates(assignedDelivery.originBranch, activeBranches.find(b => b.id === assignedDelivery.originBranch)?.name || '');
                  const dest = getDeliveryCoordinates(assignedDelivery.id, assignedDelivery.deliveryAddress, orig.x, orig.y);
                  origLat = orig.lat; origLng = orig.lng;
                  destLat = dest.lat; destLng = dest.lng;
                } else {
                  const homeBranch = activeBranches.find(b => b.id === matchedTruck.branchId);
                  const isProSpaces = matchedTruck.tenantId === 'prospaces';
                  const orig = homeBranch 
                    ? getBranchCoordinates(homeBranch.id, homeBranch.name) 
                    : isProSpaces 
                      ? { lat: 44.6488, lng: -63.5752 } 
                      : { lat: 37.2872, lng: -121.9500 };
                  origLat = orig.lat; origLng = orig.lng;
                  destLat = orig.lat + 0.003; destLng = orig.lng + 0.003;
                }

                const { lat: truckLat, lng: truckLng, hasRealGps } = getTruckCoords(matchedTruck, simProgress, activeBranches);
                const percentCoords = getPercentCoordsFromGps(truckLat, truckLng);
                const truckX = percentCoords.x;
                const truckY = percentCoords.y;

                const distance = calculateDistanceKm(hqCoords.lat, hqCoords.lng, truckLat, truckLng);

                return (
                  <g key="tether-wire">
                    <line
                       x1={`${hqPercent.x}%`}
                       y1={`${hqPercent.y}%`}
                       x2={`${truckX}%`}
                       y2={`${truckY}%`}
                      stroke={mapTheme !== 'satellite' ? '#2563eb' : '#06b6d4'}
                      strokeWidth="2"
                      strokeDasharray="4,6"
                      opacity="0.8"
                    />
                    <foreignObject
                       x={`${(hqPercent.x + truckX) / 2 - 40}%`}
                       y={`${(hqPercent.y + truckY) / 2 - 12}%`}
                      width="80"
                      height="24"
                      className="overflow-visible pointer-events-none"
                    >
                      <div className="bg-slate-900/90 text-white font-mono text-[9px] font-semibold border border-slate-755 py-0.5 px-1.5 rounded-md shadow-md text-center flex items-center justify-center gap-1">
                        <span>🛰️ {distance.toFixed(1)} km</span>
                      </div>
                    </foreignObject>
                  </g>
                );
              })()}
            </svg>

            {/* Live routing visualizer paths for active vehicles */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" xmlns="http://www.w3.org/2000/svg">
              {displayTrucks.map(truck => {
                let origLat: number;
                let origLng: number;
                let destLat: number;
                let destLng: number;

                const assignedDelivery = displayDeliveries.find(d => d.assignedTruck === truck.id && d.status !== DeliveryStatus.DELIVERED);
                if (assignedDelivery) {
                  const orig = getBranchCoordinates(assignedDelivery.originBranch, activeBranches.find(b => b.id === assignedDelivery.originBranch)?.name || '');
                  const dest = getDeliveryCoordinates(assignedDelivery.id, assignedDelivery.deliveryAddress, orig.x, orig.y);
                  origLat = orig.lat; origLng = orig.lng;
                  destLat = dest.lat; destLng = dest.lng;
                } else {
                  const homeBranch = activeBranches.find(b => b.id === truck.branchId);
                  const isProSpaces = truck.tenantId === 'prospaces';
                  const orig = homeBranch 
                    ? getBranchCoordinates(homeBranch.id, homeBranch.name) 
                    : isProSpaces 
                      ? { lat: 44.6488, lng: -63.5752 } 
                      : { lat: 37.2872, lng: -121.9500 };
                  origLat = orig.lat; origLng = orig.lng;
                  destLat = orig.lat + 0.003; destLng = orig.lng + 0.003;
                }

                const origPercent = getPercentCoordsFromGps(origLat, origLng);
                const destPercent = getPercentCoordsFromGps(destLat, destLng);
                
                const x1 = `${origPercent.x}%`;
                const y1 = `${origPercent.y}%`;
                const x2 = `${destPercent.x}%`;
                const y2 = `${destPercent.y}%`;
                
                const isSelected = selectedTrackTruckId === truck.id;

                return (
                  <g key={`route-${truck.id}`}>
                    <line 
                      x1={x1} 
                      y1={y1} 
                      x2={x2} 
                      y2={y2} 
                      stroke={isSelected ? "#f59e0b" : (mapTheme !== 'satellite' ? '#64748b' : '#475569')} 
                      strokeWidth={isSelected ? "2.5" : "1.5"} 
                      strokeDasharray={isSelected ? "5,5" : "4,4"}
                      opacity={isSelected ? "0.9" : "0.5"}
                    />
                    <circle 
                      cx={x2} 
                      cy={y2} 
                      r={isSelected ? "8" : "4"} 
                      fill="none" 
                      stroke={isSelected ? "#ef4444" : "#cbd5e1"} 
                      strokeWidth="1.5" 
                      opacity="0.6"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Map Plot Markers layer */}
            <div className="relative w-full h-full min-h-[360px] z-20">
              
              {isPinging && (
                <div className="absolute inset-0 pointer-events-none border border-slate-700/10 rounded-full animate-ping bg-amber-500/2 opacity-10" />
              )}

              {/* 1. Dispatcher sitting still HQ anchor plot */}
              {(() => {
                const hqPercent = getPercentCoordsFromGps(hqCoords.lat, hqCoords.lng);
                return (
                  <div
                    style={{ left: `${hqPercent.x}%`, top: `${hqPercent.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group z-35"
                  >
                    <span className="flex h-5 w-5 relative items-center justify-center">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-60"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600 border border-white shadow-lg shadow-black/80"></span>
                    </span>
                    <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-blue-900 border border-blue-750 text-white font-mono text-[8.5px] py-0.5 px-2 rounded shadow-md whitespace-nowrap z-40">
                      📍 HQ ({isWatchingGps ? "Device GPS" : "Anchor Point"})
                    </div>
                  </div>
                );
              })()}

              {/* 2. Branch/DC Nodes */}
              {activeBranches.map(branch => {
                const coords = getBranchCoordinates(branch.id, branch.name, branch.address);
                const isDC = branch.type === 'DC';
                const countOfActiveDeliveriesAtBranch = displayDeliveries.filter(d => d.originBranch === branch.id && d.status !== DeliveryStatus.DELIVERED).length;

                const cleanName = branch.name
                  .replace(/^ProSpaces\s*-\s*/i, '')
                  .replace(/^ProSpaces\s+/i, '')
                  .replace(/^\d+\s*-\s*/, '')
                  .replace(/^\d+\s+/, '');

                return (
                  <div
                    key={`marker-${branch.id}`}
                    style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-10 transition-all hover:scale-110"
                    title={`${branch.name} (${branch.type})`}
                  >
                    <div className={`p-1.5 rounded-lg border-2 ${
                      isDC 
                        ? 'bg-red-950 border-red-500 text-red-400' 
                        : 'bg-blue-950 border-blue-500 text-blue-400'
                    } shadow-lg shadow-black/50 flex items-center justify-center space-x-1.5 whitespace-nowrap`}>
                      {isDC ? <Warehouse className="h-3 w-3 shrink-0" /> : <Store className="h-3 w-3 shrink-0" />}
                      <span className="text-[9px] font-mono leading-none font-bold">{isDC ? "DC" : "STORE"}</span>
                      <span className="text-white text-[9px] font-sans font-semibold">{cleanName}</span>
                    </div>

                    {countOfActiveDeliveriesAtBranch > 0 && (
                      <span className="absolute -top-2.5 -right-2 px-1 py-0.25 bg-amber-500 text-black font-semibold text-[8px] font-mono rounded-full scale-90 border border-slate-900 leading-none">
                        {countOfActiveDeliveriesAtBranch}
                      </span>
                    )}

                    {/* Popover label on Hover */}
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 text-[10px] text-white px-2.5 py-1.5 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-25 font-sans min-w-[180px] max-w-[240px] whitespace-normal space-y-0.5">
                      <span className="font-semibold block text-slate-100">{branch.name}</span>
                      <p className="text-[9px] text-amber-400 font-medium">{isDC ? "Distribution Center" : "Regional Store Depot"}</p>
                      {branch.address && (
                        <p className="text-[9px] text-slate-300 border-t border-slate-800 pt-1 mt-1 leading-normal">{branch.address}</p>
                      )}
                      <p className="text-[8px] text-slate-500 font-mono mt-1">ID: {branch.id} &bull; GPS: {coords.lat.toFixed(4)}N, {coords.lng.toFixed(4)}W</p>
                    </div>
                  </div>
                );
              })}

              {/* 3. Customer Delivery Destination Pins */}
              {displayDeliveries.filter(d => {
                if (d.status === DeliveryStatus.DELIVERED) return false;
                if (d.assignedTruck) {
                  const matchedTruck = displayTrucks.find(t => t.id === d.assignedTruck);
                  if (matchedTruck) {
                    const online = isTruckOnline(matchedTruck);
                    if (!online) return false; // Filter out destinations of offline drivers
                  }
                }
                return true;
              }).map(delivery => {
                const matchedOrigBranch = activeBranches.find(b => b.id === delivery.originBranch);
                const origCoords = getBranchCoordinates(delivery.originBranch, matchedOrigBranch?.name || '', matchedOrigBranch?.address);
                const destCoords = getDeliveryCoordinates(delivery.id, delivery.deliveryAddress, origCoords.x, origCoords.y);
                const isAssigned = !!delivery.assignedTruck;

                return (
                  <div
                    key={`pin-${delivery.id}`}
                    style={{ left: `${destCoords.x}%`, top: `${destCoords.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-5 transition-all hover:scale-115"
                    title={`Recipient: ${delivery.customerName}`}
                  >
                    <div className={`p-1 rounded-full border shadow-md ${
                      isAssigned 
                        ? 'bg-amber-955 border-amber-500 text-amber-400' 
                        : (mapTheme !== 'satellite' ? 'bg-slate-300 border-slate-500 text-slate-700' : 'bg-slate-900 border-slate-700 text-slate-450')
                    }`}>
                      <MapPin className="h-2.5 w-2.5" />
                    </div>

                    {/* Popover */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 text-[10px] text-white px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-25 font-sans space-y-0.5">
                      <p className="font-semibold text-slate-150">🎯 Recipient: {delivery.customerName}</p>
                      <p className="text-[8px] text-slate-400 font-mono">Invoice: {delivery.invoiceNumber} &bull; {cleanAddressText(delivery.deliveryAddress)}</p>
                      <p className="text-[8px] text-amber-400">Status: {delivery.status.replace('_', ' ')} {isAssigned ? `(Assigned: ${delivery.assignedTruck})` : '(Unassigned)'}</p>
                    </div>
                  </div>
                );
              })}

              {/* 4. Live Active Driver Trucks Layer */}
              {displayTrucks.map(truck => {
                let origLat: number;
                let origLng: number;
                let destLat: number;
                let destLng: number;
                let isMoving = false;
                
                const isOnline = isTruckOnline(truck);

                const assignedDelivery = displayDeliveries.find(d => d.assignedTruck === truck.id && d.status !== DeliveryStatus.DELIVERED);
                if (assignedDelivery) {
                  const matchedOrigBranch = activeBranches.find(b => b.id === assignedDelivery.originBranch);
                  const orig = getBranchCoordinates(assignedDelivery.originBranch, matchedOrigBranch?.name || '', matchedOrigBranch?.address);
                  const dest = getDeliveryCoordinates(assignedDelivery.id, assignedDelivery.deliveryAddress, orig.x, orig.y);
                  origLat = orig.lat; origLng = orig.lng;
                  destLat = dest.lat; destLng = dest.lng;
                  isMoving = assignedDelivery.status === DeliveryStatus.PICKED_AND_LOADED && isPlayingSimulation && isOnline;
                } else {
                  const homeBranch = activeBranches.find(b => b.id === truck.branchId);
                  const isProSpaces = truck.tenantId === 'prospaces';
                  const orig = homeBranch 
                    ? getBranchCoordinates(homeBranch.id, homeBranch.name, homeBranch.address) 
                    : isProSpaces 
                      ? { lat: 44.6488, lng: -63.5752 } 
                      : { lat: 37.2872, lng: -121.9500 };
                  origLat = orig.lat; origLng = orig.lng;
                  destLat = orig.lat + 0.003; destLng = orig.lng + 0.003;
                  isMoving = false;
                }

                const { lat: truckLat, lng: truckLng, hasRealGps } = getTruckCoords(truck, simProgress, activeBranches);
                const percentCoords = getPercentCoordsFromGps(truckLat, truckLng);
                const xPosition = percentCoords.x;
                const yPosition = percentCoords.y;

                const isSelected = selectedTrackTruckId === truck.id;

                return (
                  <button
                    key={`gps-truck-${truck.id}`}
                    type="button"
                    style={{ left: `${xPosition}%`, top: `${yPosition}%` }}
                    onClick={(e) => {
                      e.stopPropagation(); // Stop click from propagating and moving the HQ anchor!
                      setSelectedTrackTruckId(isSelected ? null : truck.id);
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 p-1.5 rounded-full shadow-lg border-2 z-30 cursor-pointer group transition-all duration-1000 hover:scale-120 ${
                      isSelected 
                        ? 'bg-amber-500 border-white text-slate-950 scale-110 ring-4 ring-amber-500/35' 
                        : isMoving 
                          ? 'bg-blue-600 border-blue-400 text-white animate-pulse' 
                          : 'bg-slate-800 border-slate-600 text-slate-300'
                    }`}
                  >
                    <div className="relative">
                      {isMoving && (
                        <span className="absolute -inset-1 rounded-full animate-ping bg-blue-500/20" />
                      )}
                      <TruckIcon className="h-3.5 w-3.5 transform-gpu" />
                    </div>

                    {/* Popover display info */}
                    <div className="absolute bottom-9 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-850 text-[10px] text-white px-2.5 py-1.5 rounded-xl shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-40 font-sans space-y-0.5">
                      <p className="font-extrabold text-white flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isMoving ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                        🚚 {truck.name} ({truck.type || 'Flatbed'})
                      </p>
                      <p className="text-[8.5px] text-amber-400 font-medium font-sans">Driver: {truck.driver || 'No assigned driver'}</p>
                      {assignedDelivery ? (
                        <>
                          <p className="text-[8px] text-emerald-400 font-mono font-semibold">Active Run: {assignedDelivery.id}</p>
                          <p className="text-[8px] text-slate-400 font-mono">Manifest Status: {assignedDelivery.status}</p>
                          <p className="text-[8px] text-slate-400">Destination: {cleanAddressText(assignedDelivery.deliveryAddress)}</p>
                        </>
                      ) : (
                        <p className="text-[8px] text-slate-400 italic">Idle at home depot base</p>
                      )}
                    </div>
                  </button>
                );
              })}

            </div>

            {/* Bottom Legend Map Panel */}
            <div className={`mt-4 pt-3 border-t flex flex-wrap items-center justify-between text-[11px] gap-2 pr-2 transition-colors duration-300 z-10 ${
              mapTheme !== 'satellite' ? 'border-slate-300 text-slate-600' : 'border-slate-850 text-slate-400'
            }`}>
              <div className="flex flex-wrap items-center gap-4 font-medium">
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 bg-red-950 border border-red-500 rounded text-[8px] font-bold flex items-center justify-center text-red-400 font-mono">DC</span>
                  <span>DC Depots</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 bg-blue-600 rounded-full border border-blue-400"></span>
                  <span>Active Drivers</span>
                </span>
                <span className="flex items-center space-x-1.5 font-sans">
                  <span className="w-2.5 h-2.5 bg-blue-600 rounded-full border border-white relative inline-flex">
                    <span className="animate-ping absolute inset-0 rounded-full bg-blue-400 opacity-75"></span>
                  </span>
                  <span>Dispatcher (You)</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <MapPin className="h-3 w-3 text-amber-500" />
                  <span>Pending Dropoffs</span>
                </span>
              </div>
              <span className="font-mono text-[9.5px] uppercase opacity-75">
                Dynamic Map Grids Engine &bull; Halifax Regional Municipality
              </span>
            </div>

          </div>
        </div>

          {/* Telemetry Multi-Vehicle Tracking List Panel (Matches screenshot layout exactly) */}
          <div className={`lg:col-span-4 p-5 bg-slate-50 border-l border-slate-200 flex flex-col justify-between space-y-4 ${
            isMapFullscreen ? 'h-full min-h-0 overflow-hidden' : 'min-h-[500px]'
          }`}>
            
            {(() => {
              const currentIdlingMinutes = Math.floor((Date.now() - idlingStartTime) / 60000);
              const combinedFleetList = displayTrucks.map(t => {
                const assignedDelivery = displayDeliveries.find(d => d.assignedTruck === t.id && d.status !== DeliveryStatus.DELIVERED);
                const isLoaded = assignedDelivery ? assignedDelivery.status === DeliveryStatus.PICKED_AND_LOADED : false;
                const { hasRealGps } = getTruckCoords(t, simProgress, activeBranches);
                const isOnline = isTruckOnline(t);
                const speedValue = t.gpsSpeed !== undefined ? Math.round(t.gpsSpeed) : (assignedDelivery && isLoaded && isPlayingSimulation && !hasRealGps && isOnline ? 45 : 0);
                return {
                  ...t,
                  id: t.id,
                  name: t.name,
                  driver: t.driver || 'No Driver',
                  type: t.type || 'Carrier',
                  activeSpeed: speedValue,
                  avatar: (() => {
                    const matchedUser = activeUsers.find(u => u.name.toLowerCase() === (t.driver || '').toLowerCase());
                    return matchedUser?.avatarUrl || '';
                  })(),
                  trips: assignedDelivery ? [
                    {
                      id: assignedDelivery.id,
                      title: isLoaded ? 'In Transit' : 'Unloaded Depot Hold',
                      subtitle: assignedDelivery.invoiceNumber,
                      stops: [
                        { address: activeBranches.find(b => b.id === assignedDelivery.originBranch)?.name || 'DC Base Depot', time: '02:00 pm', type: 'start' },
                        { address: assignedDelivery.deliveryAddress, time: 'Pending', type: 'end' }
                      ]
                    }
                  ] : [],
                  pastTrips: [],
                  metrics: {
                    accels: 0,
                    excessiveSpeed: '0',
                    harshBrakes: 0,
                    idling: t.gpsIdlingMins !== undefined ? String(t.gpsIdlingMins) : (speedValue > 0 ? '0' : String(currentIdlingMinutes))
                  }
                };
              });

              if (viewingDetailsTruckId) {
                const selectedTruckRow = combinedFleetList.find(t => t.id === viewingDetailsTruckId) || combinedFleetList[0];
                
                const fuelPercent = selectedTruckRow?.id ? (72 - (selectedTruckRow.id.charCodeAt(0) % 25)) : 55;
                const isIgnitionOn = selectedTruckRow?.activeSpeed > 0;
                const lastIgnitionStr = isIgnitionOn ? 'Just now' : `${3 + (selectedTruckRow?.id ? selectedTruckRow.id.charCodeAt(0) % 10 : 2)} h ${15 + (selectedTruckRow?.id ? selectedTruckRow.id.charCodeAt(1) % 40 : 8)} min ago`;
                const odometerVal = selectedTruckRow?.currentMileage || (120000 + (selectedTruckRow?.id ? selectedTruckRow.id.charCodeAt(0) * 1234 : 168931));
                const engineHrs = selectedTruckRow?.engineHours || (3000 + (selectedTruckRow?.id ? selectedTruckRow.id.charCodeAt(0) * 35 : 7361));
                const speedKmh = Math.round((selectedTruckRow?.activeSpeed || 0) * 1.60934);

                return (
                  <div className="space-y-4 flex-1 flex flex-col overflow-hidden animate-fade-in font-sans">
                    {/* Header with name and close button */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <h2 className="text-sm font-semibold text-slate-800">
                        {selectedTruckRow?.id} - {selectedTruckRow?.name}
                      </h2>
                      <button 
                        type="button"
                        onClick={() => setViewingDetailsTruckId(null)}
                        className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Close details"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Accordion list */}
                    <div className="flex-1 overflow-y-auto space-y-1 pr-1 text-xs text-slate-705">
                      {/* 1. General Accordion */}
                      <div className="border-b border-slate-100">
                        <button
                          type="button"
                          onClick={() => setDetailsAccordionOpen(prev => ({ ...prev, general: !prev.general }))}
                          className="w-full py-3 flex items-center justify-between text-left font-semibold text-slate-700 hover:text-slate-900 transition-colors"
                        >
                          <span>General</span>
                          {detailsAccordionOpen.general ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </button>
                        {detailsAccordionOpen.general && (
                          <div className="pb-3 px-1 space-y-2.5 animate-slide-down">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-medium">Asset ID</span>
                              <span className="text-slate-900 font-semibold">{selectedTruckRow?.id}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-medium">Type</span>
                              <span className="text-slate-900 font-semibold">{selectedTruckRow?.type}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-medium">Assigned Driver</span>
                              <span className="text-slate-900 font-semibold">{selectedTruckRow?.driver || 'Unassigned'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-medium">Branch Base</span>
                              <span className="text-slate-900 font-semibold">
                                {activeBranches.find(b => b.id === selectedTruckRow?.branchId)?.name || 'ProSpaces Elmsdale'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-medium">License Plate</span>
                              <span className="text-slate-900 font-semibold">{selectedTruckRow?.licensePlate || 'NS-FLT-881'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-medium">VIN</span>
                              <span className="text-slate-900 font-semibold font-mono text-[10px]">{selectedTruckRow?.vin || '1FTFW1RG4KFA88291'}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2. Your pinned sensors Accordion */}
                      <div className="border-b border-slate-100">
                        <button
                          type="button"
                          onClick={() => setDetailsAccordionOpen(prev => ({ ...prev, pinned: !prev.pinned }))}
                          className="w-full py-3 flex items-center justify-between text-left"
                        >
                          <div className="flex items-center space-x-2 text-teal-700">
                            <Pin className="h-4 w-4 text-teal-600 rotate-45 fill-teal-600 shrink-0" />
                            <span className="font-semibold text-teal-700">Your pinned sensors</span>
                            <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 cursor-help" title="These sensors are pinned to this asset's dashboard" />
                          </div>
                          {detailsAccordionOpen.pinned ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </button>
                        {detailsAccordionOpen.pinned && (
                          <div className="pb-3 px-1 space-y-2.5 animate-slide-down">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-medium font-sans">Fuel level</span>
                              <span className="text-slate-900 font-medium">{fuelPercent} %</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-medium font-sans">Ignition</span>
                              <span className="text-slate-900 font-medium">{isIgnitionOn ? 'On' : 'Off'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-medium font-sans">Last ignition on</span>
                              <span className="text-slate-900 font-medium">{lastIgnitionStr}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-medium font-sans">Odometer</span>
                              <span className="text-slate-900 font-medium">{odometerVal.toLocaleString()} km</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-medium font-sans">Operating hours</span>
                              <span className="text-slate-900 font-medium">{engineHrs.toLocaleString()} h</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-medium font-sans">PTO hours</span>
                              <span className="text-slate-900 font-medium">0 h</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-medium font-sans">Speed</span>
                              <span className="text-slate-900 font-medium">{speedKmh} km/h</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 3. Latest events Accordion */}
                      <div className="border-b border-slate-100">
                        <button
                          type="button"
                          onClick={() => setDetailsAccordionOpen(prev => ({ ...prev, events: !prev.events }))}
                          className="w-full py-3 flex items-center justify-between text-left font-semibold text-slate-700 hover:text-slate-900 transition-colors"
                        >
                          <span>Latest events</span>
                          {detailsAccordionOpen.events ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </button>
                        {detailsAccordionOpen.events && (
                          <div className="pb-3 px-1 space-y-3 animate-slide-down">
                            <div className="space-y-2">
                              <div className="flex items-start justify-between text-[11px]">
                                <div>
                                  <p className="font-semibold text-slate-900">Geofence Entry: Dartmouth Depot</p>
                                  <p className="text-slate-400 text-[10px]">Dartmouth DC depot boundaries</p>
                                </div>
                                <span className="text-slate-500 font-mono text-[10px] shrink-0">10:15 AM ADT</span>
                              </div>
                              <div className="flex items-start justify-between text-[11px] pt-1.5 border-t border-slate-100">
                                <div>
                                  <p className="font-semibold text-slate-900">Stop completed: 84 Charm Ln</p>
                                  <p className="text-slate-400 text-[10px]">Halifax customer residence delivery</p>
                                </div>
                                <span className="text-slate-500 font-mono text-[10px] shrink-0">08:45 AM ADT</span>
                              </div>
                              <div className="flex items-start justify-between text-[11px] pt-1.5 border-t border-slate-100">
                                <div>
                                  <p className="font-semibold text-slate-900">Ignition turned off</p>
                                  <p className="text-slate-400 text-[10px]">At customer address park-and-unload</p>
                                </div>
                                <span className="text-slate-500 font-mono text-[10px] shrink-0">07:55 AM ADT</span>
                              </div>
                              <div className="flex items-start justify-between text-[11px] pt-1.5 border-t border-slate-100">
                                <div>
                                  <p className="font-semibold text-slate-900">Ignition turned on</p>
                                  <p className="text-slate-400 text-[10px]">ProSpaces Elmsdale dispatcher launch</p>
                                </div>
                                <span className="text-slate-500 font-mono text-[10px] shrink-0">07:23 AM ADT</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 4. Maintenance reminders Accordion */}
                      <div className="border-b border-slate-100">
                        <button
                          type="button"
                          onClick={() => setDetailsAccordionOpen(prev => ({ ...prev, maintenance: !prev.maintenance }))}
                          className="w-full py-3 flex items-center justify-between text-left font-semibold text-slate-700 hover:text-slate-900 transition-colors"
                        >
                          <span>Maintenance reminders</span>
                          {detailsAccordionOpen.maintenance ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </button>
                        {detailsAccordionOpen.maintenance && (
                          <div className="pb-3 px-1 space-y-3 animate-slide-down">
                            <div className="space-y-2">
                              <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-xl text-[11px] flex items-start gap-2">
                                <span className="text-amber-500 shrink-0">🔧</span>
                                <div className="flex-1">
                                  <p className="font-bold text-amber-900">Oil Change Due Soon</p>
                                  <p className="text-slate-550 text-[10px] mt-0.5 font-medium">Due at: {(odometerVal + 2500).toLocaleString()} km (Approx. 2,500 km remaining)</p>
                                </div>
                              </div>
                              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] flex items-start gap-2">
                                <span className="text-slate-500 shrink-0">🚗</span>
                                <div className="flex-1">
                                  <p className="font-bold text-slate-700">Tire Rotation & Alignment</p>
                                  <p className="text-slate-550 text-[10px] mt-0.5 font-medium">Due at: {(odometerVal + 5400).toLocaleString()} km (Approx. 5,400 km remaining)</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setReminderTruckId(selectedTruckRow?.id || '');
                                  setReminderText(`Routine maintenance inspection for ${selectedTruckRow?.name || ''}`);
                                  setReminderType("Oil Change");
                                  setReminderDueDate(new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0]);
                                  setShowReminderModal(true);
                                }}
                                className="w-full py-1.5 px-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg text-[10px] text-slate-600 hover:text-slate-800 font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                              >
                                + Add Maintenance Reminder
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 5. Sensors Accordion */}
                      <div className="border-b border-slate-100">
                        <button
                          type="button"
                          onClick={() => setDetailsAccordionOpen(prev => ({ ...prev, sensors: !prev.sensors }))}
                          className="w-full py-3 flex items-center justify-between text-left font-semibold text-slate-700 hover:text-slate-900 transition-colors"
                        >
                          <span>Sensors</span>
                          {detailsAccordionOpen.sensors ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </button>
                        {detailsAccordionOpen.sensors && (
                          <div className="pb-3 px-1 space-y-2.5 animate-slide-down">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-medium">Engine Temp</span>
                              <span className="text-slate-900 font-semibold">88 °C</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-medium">Battery Voltage</span>
                              <span className="text-slate-900 font-semibold">13.8 V</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-medium">Tire Pressure (FL / FR)</span>
                              <span className="text-slate-900 font-semibold">110 / 112 PSI</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-medium">Tire Pressure (RL / RR)</span>
                              <span className="text-slate-900 font-semibold">115 / 115 PSI</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-medium">Cabin Temperature</span>
                              <span className="text-slate-900 font-semibold">21.5 °C</span>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                );
              }

              if (viewingTripsTruckId) {
                const selectedTruckRow = combinedFleetList.find(t => t.id === viewingTripsTruckId) || combinedFleetList[0];
                
                const branchName = activeBranches.find(b => b.id === selectedTruckRow?.branchId)?.name || 'ProSpaces Elmsdale';
                const branchAddr = activeBranches.find(b => b.id === selectedTruckRow?.branchId)?.address || '500 Windmill Rd, Dartmouth, NS B3B 1B3, Canada';
                
                const activeRun = selectedTruckRow?.trips?.[0];
                const destAddr = activeRun?.stops?.[1]?.address || '84 Charm Ln, Halifax, NS B3E, Canada';
                const driverName = selectedTruckRow?.driver || 'Bob Rafters';

                const baseLegs = [
                  {
                    id: 'leg-1',
                    type: 'Business',
                    startTime: '7:23 AM ADT',
                    endTime: '7:55 AM ADT',
                    startAddress: branchAddr,
                    endAddress: destAddr,
                    driverName: driverName,
                    distanceKm: 31.9,
                    durationMins: 32,
                    idleMins: 4,
                    exceptionCount: 0
                  },
                  { type: 'pause' as const, durationMins: 35 },
                  {
                    id: 'leg-2',
                    type: 'Business',
                    startTime: '8:31 AM ADT',
                    endTime: '9:15 AM ADT',
                    startAddress: destAddr,
                    endAddress: '137 Chain Lake Dr, Halifax, NS B3S 1B3, Canada',
                    driverName: driverName,
                    distanceKm: 42.1,
                    durationMins: 44,
                    idleMins: 12,
                    exceptionCount: 1
                  },
                  { type: 'pause' as const, durationMins: 20 },
                  {
                    id: 'leg-3',
                    type: 'Business',
                    startTime: '9:35 AM ADT',
                    endTime: '10:45 AM ADT',
                    startAddress: '137 Chain Lake Dr, Halifax, NS B3S 1B3, Canada',
                    endAddress: branchAddr,
                    driverName: driverName,
                    distanceKm: 54.32,
                    durationMins: 70,
                    idleMins: 17,
                    exceptionCount: 0
                  }
                ];

                const query = filterByLocationQuery.toLowerCase();
                const filteredLegs = baseLegs.filter(leg => {
                  if (leg.type === 'pause') return true;
                  return (
                    leg.startAddress.toLowerCase().includes(query) ||
                    leg.endAddress.toLowerCase().includes(query)
                  );
                });

                const totalTrips = baseLegs.filter(l => l.type === 'Business').length;
                const totalDistance = baseLegs.reduce((acc, l) => l.type === 'Business' ? acc + l.distanceKm : acc, 0);
                const totalDuration = baseLegs.reduce((acc, l) => l.type === 'Business' ? acc + l.durationMins : acc, 0);
                const totalIdle = baseLegs.reduce((acc, l) => l.type === 'Business' ? acc + l.idleMins : acc, 0);
                const totalExceptions = baseLegs.reduce((acc, l) => l.type === 'Business' ? acc + l.exceptionCount : acc, 0);

                const totalDurationStr = `${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m`;
                const totalIdleStr = `${totalIdle}m`;

                return (
                  <div className="space-y-4 flex-1 flex flex-col overflow-hidden animate-fade-in font-sans">
                    <div className="flex items-center justify-between pb-1">
                      <button 
                        type="button"
                        onClick={() => {
                          setViewingTripsTruckId(null);
                          setFilterByLocationQuery('');
                        }}
                        className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 transition-all cursor-pointer shadow-xs"
                      >
                        ← Back to Fleet List
                      </button>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-600 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                        Trips Dashboard
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-500">Date and time</label>
                        <div className="w-full bg-slate-100/80 border border-slate-200/80 rounded-xl px-3.5 py-2.5 flex items-center space-x-2.5 text-xs text-slate-700 font-medium">
                          <Calendar className="h-4 w-4 text-slate-500" />
                          <span>Jul 20, 2026 12:00 AM - Jul 20, 2026 11:59 PM</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-500">Asset</label>
                          <div className="relative">
                            <select
                              value={viewingTripsTruckId || ''}
                              onChange={(e) => setViewingTripsTruckId(e.target.value)}
                              className="w-full bg-slate-100/80 hover:bg-slate-200/50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] text-slate-700 font-bold appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-teal-500/20"
                            >
                              {combinedFleetList.map(t => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                            <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-500 text-[10px] font-bold">
                              ▼
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-500">Driver</label>
                          <div className="relative">
                            <select
                              value={selectedTruckRow?.driver || ''}
                              onChange={(e) => {
                                const newDriver = e.target.value;
                                if (onUpdateTruck && selectedTruckRow) {
                                  onUpdateTruck({
                                    ...selectedTruckRow,
                                    driver: newDriver
                                  });
                                }
                              }}
                              className="w-full bg-slate-100/80 hover:bg-slate-200/50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] text-slate-705 font-medium appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-teal-500/20"
                            >
                              <option value="">Driver</option>
                              {activeUsers.map(u => (
                                <option key={u.id} value={u.name}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                            <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-500 text-[10px] font-bold">
                              ▼
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={filterByLocationQuery}
                            onChange={(e) => setFilterByLocationQuery(e.target.value)}
                            placeholder="Filter by location"
                            className="w-full bg-slate-100 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-705 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                          />
                          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                            <MapPin className="h-4 w-4 text-slate-505" />
                          </div>
                          {filterByLocationQuery && (
                            <button
                              type="button"
                              onClick={() => setFilterByLocationQuery('')}
                              className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 font-mono text-[10px]"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-all text-slate-600 cursor-pointer shadow-xs"
                          title="Filter options"
                        >
                          <Sliders className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="p-3 bg-white rounded-2xl border border-slate-200/80 grid grid-cols-5 gap-1 text-center select-none font-sans mt-3 shadow-xs">
                        <div className="flex flex-col items-center justify-center space-y-0.5">
                          <span className="text-[11px]">🔀</span>
                          <span className="text-[11px] font-extrabold text-slate-800">{totalTrips}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center space-y-0.5 border-l border-slate-100">
                          <span className="text-[11px]">📍</span>
                          <span className="text-[10px] font-extrabold text-slate-800">{totalDistance.toFixed(2)}km</span>
                        </div>
                        <div className="flex flex-col items-center justify-center space-y-0.5 border-l border-slate-100">
                          <span className="text-[11px]">🕒</span>
                          <span className="text-[10px] font-extrabold text-slate-800 whitespace-nowrap">{totalDurationStr}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center space-y-0.5 border-l border-slate-100">
                          <span className="text-[11px]">⏸️</span>
                          <span className="text-[10px] font-extrabold text-slate-800 whitespace-nowrap">{totalIdleStr}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center space-y-0.5 border-l border-slate-100">
                          <span className="text-[11px] text-rose-500">🚨</span>
                          <span className="text-[11px] font-extrabold text-rose-600">{totalExceptions}</span>
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-[10.5px] text-slate-600 flex items-start space-x-2 font-medium leading-normal shadow-xs">
                        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                        <span>
                          For more details of all the assets data points please go to{' '}
                          <button 
                            type="button" 
                            onClick={() => {
                              setSelectedTrackTruckId(viewingTripsTruckId);
                              setToastMessage(`Viewing Track & Events for ${selectedTruckRow?.name}`);
                            }} 
                            className="text-blue-700 hover:text-blue-900 underline font-extrabold cursor-pointer"
                          >
                            Track & Events
                          </button>
                        </span>
                      </div>

                      <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-xs">
                        <button
                          type="button"
                          onClick={() => setIsTripsAccordionOpen(!isTripsAccordionOpen)}
                          className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200 transition-colors text-left"
                        >
                          <div className="flex items-center space-x-2 text-xs font-extrabold text-slate-800">
                            <Eye className="h-4 w-4 text-slate-500" />
                            <span>Mon, Jul 20, 2026</span>
                          </div>
                          <div className="flex items-center space-x-3 text-[10px] font-bold text-slate-500">
                            <span className="flex items-center gap-0.5">📍 {totalDistance.toFixed(2)}km</span>
                            <span className="flex items-center gap-0.5 text-rose-600 font-extrabold">🚨 {totalExceptions}</span>
                            {isTripsAccordionOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                          </div>
                        </button>

                        {isTripsAccordionOpen && (
                          <div className="p-3 space-y-3 bg-slate-50/20 max-h-[400px] overflow-y-auto">
                            {filteredLegs.map((leg, index) => {
                              if (leg.type === 'pause') {
                                return (
                                  <div key={`pause-${index}`} className="flex items-center justify-start pl-4 py-1">
                                    <span className="px-2.5 py-0.5 bg-slate-200/70 border border-slate-300 rounded-lg text-[9px] font-extrabold text-slate-600 flex items-center gap-1 shadow-xs">
                                      📍 Pause {leg.durationMins}m
                                    </span>
                                  </div>
                                );
                              }

                              return (
                                <div 
                                  key={leg.id}
                                  className="bg-teal-50/50 border-l-4 border-teal-500 rounded-r-xl p-3 shadow-xs space-y-2 transition-all hover:bg-teal-50"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] uppercase font-black tracking-wider text-teal-800">
                                      {leg.type}
                                    </span>
                                    {leg.exceptionCount > 0 && (
                                      <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[8px] font-black rounded-md flex items-center gap-0.5">
                                        🚨 {leg.exceptionCount} ALERT
                                      </span>
                                    )}
                                  </div>

                                  <div className="relative pl-3 space-y-2 text-[11px] text-slate-705">
                                    <div className="absolute left-1 top-2 bottom-2 w-0.5 bg-teal-200" />
                                    <div className="relative">
                                      <div className="absolute -left-3 top-1 w-1.5 h-1.5 rounded-full bg-teal-500 border border-white" />
                                      <p className="leading-tight">
                                        <span className="font-extrabold text-teal-950">{leg.startTime}</span>{' '}
                                        <span className="text-slate-500">{leg.startAddress}</span>
                                      </p>
                                    </div>
                                    <div className="relative">
                                      <div className="absolute -left-3 top-1 w-1.5 h-1.5 rounded-full bg-teal-600 border border-white" />
                                      <p className="leading-tight">
                                        <span className="font-extrabold text-teal-950">{leg.endTime}</span>{' '}
                                        <span className="text-slate-500">{leg.endAddress}</span>
                                      </p>
                                    </div>
                                  </div>

                                  <div className="pt-2 border-t border-teal-100 flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-semibold gap-1">
                                    <div className="flex items-center space-x-1 text-slate-700 font-extrabold">
                                      <User className="h-3 w-3 text-teal-600" />
                                      <span>{leg.driverName}</span>
                                    </div>
                                    <div className="flex items-center space-x-2 text-slate-505 text-[9.5px]">
                                      <span className="flex items-center gap-0.5">📍 {leg.distanceKm}km</span>
                                      <span className="flex items-center gap-0.5">🕒 {leg.durationMins}m</span>
                                      <span className="flex items-center gap-0.5">⏸️ {leg.idleMins}m</span>
                                      <span className="flex items-center gap-0.5 text-rose-500">🚨 {leg.exceptionCount}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {filteredLegs.length === 0 && (
                              <div className="text-center py-6 text-slate-400 text-xs">
                                No stops match location filter
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              // Apply Search Query filter
              const filteredFleet = combinedFleetList.filter(item => {
                const query = searchQuery.toLowerCase();
                return (
                  item.name.toLowerCase().includes(query) ||
                  item.driver.toLowerCase().includes(query) ||
                  item.id.toLowerCase().includes(query) ||
                  item.type.toLowerCase().includes(query)
                );
              });

              return (
                <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-705 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-inner focus:ring-1 focus:ring-blue-500/20"
                    />
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                      <Search className="h-4 w-4" />
                    </div>
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 font-mono text-[10px]"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className={`flex-1 overflow-y-auto space-y-3.5 pr-1 ${
                    isMapFullscreen ? 'max-h-[calc(100vh-280px)] lg:max-h-[calc(100vh-240px)]' : 'max-h-[500px]'
                  }`}>
                    {filteredFleet.length === 0 ? (
                      <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
                        No vehicles match "{searchQuery}"
                      </div>
                    ) : (
                      filteredFleet.map(truckRow => {
                        const isSelected = selectedTrackTruckId === truckRow.id;
                        const activeRun = truckRow.trips[0];
                        const isMoving = truckRow.activeSpeed > 0;
                        const speedText = truckRow.activeSpeed > 0 ? `${truckRow.activeSpeed} mph` : '0 mph';
                        const isOnline = isTruckOnline(truckRow);
                        const statusText = isMoving ? 'Moving' : (isOnline ? 'Idling' : 'Parked');
                        
                        const statusBg = isMoving 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100/70' 
                          : isOnline 
                            ? 'bg-amber-50 text-amber-700 border-amber-100/70' 
                            : 'bg-slate-100 text-slate-700 border-slate-200/60';
                        
                    const statusDotColor = isMoving 
                      ? 'bg-emerald-600' 
                      : isOnline 
                        ? 'bg-amber-500' 
                        : 'bg-slate-600';

                    // Helper to get deterministic but static looking last sync time
                    const getLastSyncText = (truck: any) => {
                      if (truck.gpsLastHandshake) {
                        const diffMs = Date.now() - new Date(truck.gpsLastHandshake).getTime();
                        if (diffMs > 0) {
                          const diffMins = Math.floor(diffMs / 60000);
                          if (diffMins < 1) return "Last sync < 1 min ago";
                          if (diffMins < 60) return `Last sync ${diffMins} min ago`;
                          const diffHrs = Math.floor(diffMins / 60);
                          const remainingMins = diffMins % 60;
                          return `Last sync ${diffHrs} h ${remainingMins} min ago`;
                        }
                      }
                      const idHash = (truck.id || "").split("").reduce((sum: number, ch: string) => sum + ch.charCodeAt(0), 0);
                      const hrs = (idHash % 11) + 1;
                      const mins = (idHash * 7) % 60;
                      return `Last sync ${hrs} h ${mins} min ago`;
                    };

                    // Helper to get custom colors for vehicle icons based on screenshot
                    const getTruckIconDetails = (name: string) => {
                      const lower = name.toLowerCase();
                      if (lower.includes('almon') || lower.includes('2401')) {
                        return { color: 'text-amber-500 bg-amber-50 border-amber-100', textClass: 'text-amber-600' };
                      } else if (lower.includes('mtn') || lower.includes('2404') || lower.includes('2408')) {
                        return { color: 'text-blue-500 bg-blue-50 border-blue-100', textClass: 'text-blue-600' };
                      }
                      return { color: 'text-slate-500 bg-slate-50 border-slate-200/60', textClass: 'text-slate-600' };
                    };

                    const iconDetails = getTruckIconDetails(truckRow.name);

                    return (
                      <div 
                        key={truckRow.id}
                        className={`relative border border-slate-200/65 rounded-xl transition-all duration-300 overflow-visible cursor-pointer ${
                          isSelected 
                            ? 'bg-[#e6f9f5] border-teal-200 ring-2 ring-teal-500/10' 
                            : 'bg-white hover:bg-slate-50'
                        }`}
                        onClick={() => {
                          setSelectedTrackTruckId(truckRow.id);
                        }}
                      >
                        {/* Interactive Click Shield Overlay to close open dropdown menu */}
                        {activeActionMenuTruckId === truckRow.id && (
                          <div 
                            className="fixed inset-0 z-40 cursor-default" 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setActiveActionMenuTruckId(null); 
                            }} 
                          />
                        )}

                        {/* Main row layout */}
                        <div className="p-4 flex items-start justify-between gap-3 select-none">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {/* Vehicle Icon on Left */}
                            <div className={`p-2.5 rounded-lg border shrink-0 flex items-center justify-center ${iconDetails.color}`}>
                              <TruckIcon className="w-5 h-5" />
                            </div>

                            {/* Center details block */}
                            <div className="flex-1 min-w-0 space-y-1.5">
                              {/* Row 1: Name and Status Badge */}
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="font-sans font-bold text-slate-850 leading-none text-xs md:text-[13px] truncate">
                                  {truckRow.name}
                                </h4>
                                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold leading-none shrink-0 ${statusBg}`}>
                                  <span className={`w-1.5 h-1.5 ${statusDotColor} rounded-full inline-block`}></span>
                                  <span>{statusText}</span>
                                </div>
                              </div>

                              {/* Row 2: Driver icon and driver name */}
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 leading-none">
                                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{truckRow.driver}</span>
                              </div>

                              {/* Row 3: Clock icon and last sync */}
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 leading-none">
                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{getLastSyncText(truckRow)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Options dropdown button (three vertical dots) */}
                          <div className="relative shrink-0 z-50">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveActionMenuTruckId(activeActionMenuTruckId === truckRow.id ? null : truckRow.id);
                              }}
                              className={`p-1.5 hover:bg-slate-200/50 rounded-md transition-colors cursor-pointer ${
                                isSelected ? 'text-teal-600 hover:text-teal-700' : 'text-slate-400 hover:text-slate-600'
                              }`}
                            >
                              <MoreVertical className="w-4.5 h-4.5" />
                            </button>

                            {/* Dropdown menu items */}
                            {activeActionMenuTruckId === truckRow.id && (
                              <div 
                                className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 text-slate-705 py-1 text-[11px] select-none font-sans divide-y divide-slate-100 animate-fade-in"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="py-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedTrackTruckId(truckRow.id);
                                      setViewingDetailsTruckId(truckRow.id);
                                      setViewingTripsTruckId(null);
                                      setViewingCoordinatesTruckId(null);
                                      setActiveActionMenuTruckId(null);
                                      setToastMessage(`Showing details for ${truckRow.name}`);
                                    }}
                                    className="w-full text-left px-4 py-1.5 hover:bg-teal-50 hover:text-teal-800 transition-colors flex items-center font-semibold"
                                  >
                                    Details
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedTrackTruckId(truckRow.id);
                                      setViewingTripsTruckId(truckRow.id);
                                      setViewingDetailsTruckId(null);
                                      setViewingCoordinatesTruckId(null);
                                      setActiveActionMenuTruckId(null);
                                      setToastMessage(`Viewing trips for ${truckRow.name}`);
                                      setSysLogs(prev => [`[${new Date().toLocaleTimeString()}] Trips schedule requested for ${truckRow.name}.`, ...prev.slice(0, 3)]);
                                    }}
                                    className="w-full text-left px-4 py-1.5 hover:bg-teal-50 hover:text-teal-800 transition-colors flex items-center font-semibold"
                                  >
                                    Trips
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedTrackTruckId(truckRow.id);
                                      setViewingDetailsTruckId(null);
                                      setViewingCoordinatesTruckId(null);
                                      setActiveActionMenuTruckId(null);
                                      setToastMessage(`Track & Events engaged for ${truckRow.name}`);
                                      setSysLogs(prev => [`[${new Date().toLocaleTimeString()}] Tracking trajectory stream engaged for ${truckRow.name}.`, ...prev.slice(0, 3)]);
                                      if (mapRef.current) {
                                        const lat = truckRow.gpsLat || truckRow.lat || 44.6488;
                                        const lng = truckRow.gpsLng || truckRow.lng || -63.5752;
                                        mapRef.current.setView([lat, lng], 14);
                                      }
                                    }}
                                    className="w-full text-left px-4 py-1.5 hover:bg-teal-50 hover:text-teal-800 transition-colors flex items-center font-semibold"
                                  >
                                    Track & Events
                                  </button>
                                </div>

                                <div className="py-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenuTruckId(null);
                                      const lat = truckRow.gpsLat || truckRow.lat || 44.6488;
                                      const lng = truckRow.gpsLng || truckRow.lng || -63.5752;
                                      const nearby = activeBranches.map(b => {
                                        const coords = getBranchCoordinates(b.id, b.name, b.address);
                                        const dist = Math.sqrt(Math.pow(coords.lat - lat, 2) + Math.pow(coords.lng - lng, 2)) * 111;
                                        return { name: b.name, dist };
                                      }).sort((a, b) => a.dist - b.dist)[0];

                                      setToastMessage(`Nearest Hub: ${nearby.name} (${nearby.dist.toFixed(1)} km)`);
                                      setSysLogs(prev => [`[${new Date().toLocaleTimeString()}] Landmark search for ${truckRow.name}: Nearest depot is ${nearby.name} @ ${nearby.dist.toFixed(2)}km.`, ...prev.slice(0, 3)]);
                                    }}
                                    className="w-full text-left px-4 py-1.5 hover:bg-teal-50 hover:text-teal-800 transition-colors flex items-center font-semibold"
                                  >
                                    Find nearby
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenuTruckId(null);
                                      const shareLink = `https://prospaces.ca/track/${truckRow.id}`;
                                      navigator.clipboard.writeText(shareLink);
                                      setToastMessage("Live share link copied to clipboard!");
                                      setSysLogs(prev => [`[${new Date().toLocaleTimeString()}] Live tracking hash generated: ${shareLink}`, ...prev.slice(0, 3)]);
                                    }}
                                    className="w-full text-left px-4 py-1.5 hover:bg-teal-50 hover:text-teal-800 transition-colors flex items-center font-semibold"
                                  >
                                    Live share
                                  </button>
                                </div>

                                <div className="py-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenuTruckId(null);
                                      setReminderTruckId(truckRow.id);
                                      setReminderText(`Routine inspection for ${truckRow.name}`);
                                      setReminderType("Oil Change");
                                      setReminderDueDate(new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0]);
                                      setShowReminderModal(true);
                                    }}
                                    className="w-full text-left px-4 py-1.5 hover:bg-teal-50 hover:text-teal-800 transition-colors flex items-center"
                                  >
                                    <div className="flex items-center w-full">
                                      <div className="bg-slate-850 text-white rounded-full p-0.5 mr-2 flex items-center justify-center w-4 h-4 shrink-0">
                                        <Wrench className="w-2.5 h-2.5" />
                                      </div>
                                      <span className="font-bold">New reminder</span>
                                    </div>
                                  </button>
                                </div>

                                <div className="py-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenuTruckId(null);
                                      setViewingCoordinatesTruckId(truckRow.id);
                                      setViewingDetailsTruckId(null);
                                      setViewingTripsTruckId(null);
                                      const lat = truckRow.gpsLat || truckRow.lat || 44.6488;
                                      const lng = truckRow.gpsLng || truckRow.lng || -63.5752;
                                      const coordStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                                      navigator.clipboard.writeText(coordStr);
                                      setToastMessage(`Coords copied: ${coordStr}`);
                                      setSysLogs(prev => [`[${new Date().toLocaleTimeString()}] Coordinates copied for ${truckRow.name}: ${coordStr}`, ...prev.slice(0, 3)]);
                                    }}
                                    className="w-full text-left px-4 py-1.5 hover:bg-teal-50 hover:text-teal-800 transition-colors flex items-center font-semibold"
                                  >
                                    Coordinates
                                  </button>
                                </div>

                                <div className="py-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenuTruckId(null);
                                      const gpsTabBtn = document.getElementById("tab-gps");
                                      if (gpsTabBtn) {
                                        gpsTabBtn.click();
                                        setToastMessage(`Directing to hardware settings for ${truckRow.name}`);
                                      } else {
                                        setToastMessage(`Edit mode requested for ${truckRow.name}`);
                                      }
                                    }}
                                    className="w-full text-left px-4 py-1.5 hover:bg-teal-50 hover:text-teal-800 transition-colors flex items-center font-semibold"
                                  >
                                    Edit
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>


                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}

            {/* Live Street view details or Radar Ping Console logs collapsed at the bottom footer */}
            <div className="pt-2.5 border-t border-slate-200 space-y-2 text-slate-505">
              
              <div className="flex items-center justify-between text-[10px] font-mono leading-none">
                <span className="flex items-center gap-1 font-semibold uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live HUD Perspective
                </span>
                <span className="text-[9px] uppercase">{cameraFilter === 'normal' ? 'Normal Lens' : cameraFilter.toUpperCase() + ' Active'}</span>
              </div>

              {/* Collapsed view Live Street View rendering */}
              <div className="relative h-14 w-full rounded-xl bg-slate-950 overflow-hidden border border-slate-200 flex items-center justify-center">
                
                {/* Active HUD perspectives */}
                <div className="absolute inset-0 opacity-40 select-none pointer-events-none">
                  <svg className="w-full h-full" viewBox="0 0 100 50" preserveAspectRatio="none">
                    <polygon points="50,15 20,50 80,50" fill="#0f172a" />
                    <line x1="50" y1="15" x2="50" y2="50" stroke="#f59e0b" strokeWidth="0.5" strokeDasharray="2,2" />
                  </svg>
                </div>

                <div className="relative text-[9px] font-mono text-center text-slate-300 z-10 p-2 leading-tight">
                  <Camera className="w-3 w-3 inline mr-1 text-blue-400 animate-pulse" />
                  <span className="font-semibold text-white">Halifax Fleet HUD Trace</span>
                  <p className="text-[8px] text-slate-400 mt-0.5">Click "Toggle live-eye feed" on any driver row to see camera.</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-[9px] font-mono text-slate-405">
                <span>Console Log Sync:</span>
                <span className="text-blue-650 font-bold">12ms latency</span>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Main Grid: Hub Capacity + Registered Active Fleet */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Hub capacity breakdown panel */}
        <div className="bg-white border border-gray-100 p-5 rounded-xl shadow-sm lg:col-span-6 flex flex-col justify-between">
          <div>
            <h4 className="font-sans font-semibold text-gray-900 tracking-tight text-lg mb-1">🏪 Branch Locations & DC Capacity</h4>
            <p className="text-xs text-gray-500 mb-4">Real-time breakdown of orders processed per registered store & delivery hub</p>
            
            {bogoStats.length === 0 ? (
              <div className="text-center py-12 text-gray-400 font-mono text-xs border border-dashed border-gray-200 rounded-xl">
                No stores or hubs registered. Use "Setup New Stores" to add locations.
              </div>
            ) : (
              <div className="space-y-3.5">
                {bogoStats.map(branch => {
                  const percentage = total > 0 ? (branch.count / total) * 100 : 0;
                  return (
                    <div key={branch.id} className="p-3 border border-slate-50 hover:bg-slate-50 rounded-lg transition-colors">
                      <div className="flex items-center justify-between text-xs font-medium text-gray-800 mb-1">
                        <div className="flex items-center space-x-1.5">
                          {branch.type === 'DC' ? (
                            <span className="px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-100 rounded text-[9px] font-semibold font-mono">DC</span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[9px] font-semibold font-mono">Store</span>
                          )}
                          <span className="text-gray-900 font-sans font-semibold">{branch.name}</span>
                        </div>
                        <span className="font-mono text-gray-500">{branch.count} orders ({Math.round(percentage)}%)</span>
                      </div>
                      {/* Visual Bar */}
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${branch.type === 'DC' ? 'bg-red-500' : 'bg-blue-500'}`} 
                          style={{ width: `${Math.max(percentage, 3)}%` }}
                        ></div>
                      </div>
                      {/* Mini Stats */}
                      <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1 font-mono">
                        <span>{branch.delivered} Delivered successfully</span>
                        <span>{branch.pending} Out in workflow</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>
              Active Hub Monitor
            </span>
            <button 
              onClick={() => onSelectTab('scanner')} 
              className="text-blue-600 hover:underline font-semibold text-xs flex items-center cursor-pointer"
            >
              Scan Verification Dashboard &rarr;
            </button>
          </div>
        </div>

        {/* Dynamic Registered Vehicles/Drivers */}
        <div className="bg-white border border-gray-100 p-5 rounded-xl shadow-sm lg:col-span-6 flex flex-col justify-between">
          <div>
            <h4 className="font-sans font-semibold text-gray-900 tracking-tight text-lg mb-1">🚚 Fleet Registry Status</h4>
            <p className="text-xs text-gray-500 mb-4 font-normal">Active custom-setup vehicles, assigned drivers, and hub affiliations</p>
            
            {displayTrucks.length === 0 ? (
              <div className="text-center py-14 text-gray-400 font-mono text-xs border border-dashed border-gray-200 rounded-xl space-y-3 flex flex-col items-center justify-center">
                <p>No active delivery vehicles registered.</p>
                <button
                  onClick={() => onSelectTab('fleet')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-sans px-3 py-1.5 rounded-lg border border-blue-500/30 text-xs font-semibold cursor-pointer shadow-sm transition-colors"
                >
                  🚚 Set Up Active Vehicles
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-1">
                {displayTrucks.map(truck => {
                  const associatedBranch = activeBranches.find(b => b.id === truck.branchId);
                  return (
                    <div key={truck.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl transition-all hover:border-blue-200/50 hover:bg-white hover:shadow-sm space-y-2 flex flex-col justify-between">
                      <div className="flex items-start justify-between">
                        <div className="space-y-0.5">
                          <h5 className="font-semibold text-gray-900 text-xs truncate max-w-[140px] uppercase font-sans tracking-wide">
                            {truck.name}
                          </h5>
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100/50 rounded text-[9px] font-mono uppercase font-bold">
                            {truck.type || 'Flatbed'}
                          </span>
                        </div>
                        <span className="p-1.5 bg-blue-100/60 rounded-lg text-blue-600">
                          <TruckIcon className="w-3.5 h-3.5" />
                        </span>
                      </div>
                      
                      <div className="space-y-1 transform-gpu">
                        <p className="text-[10px] text-gray-500 flex items-center">
                          <span className="w-1.5 h-1.5 rounded bg-amber-500 mr-1.5"></span>
                          Driver: <strong className="text-gray-800 ml-1 truncate max-w-[100px]">{truck.driver || 'N/A'}</strong>
                        </p>
                        <p className="text-[10px] text-gray-500 flex items-center">
                          <span className="w-1.5 h-1.5 rounded bg-slate-400 mr-1.5"></span>
                          Hub: <span className="text-slate-600 ml-1 font-medium truncate max-w-[110px]">{associatedBranch?.name || 'Central Store'}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono font-medium">ERP Telemetry Synchronized</span>
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs text-slate-500 font-medium font-sans">Tracking API: Connected</span>
            </div>
          </div>
        </div>

      </div>

      {/* Recent History Highlights */}
      <div className="bg-white border border-gray-100 p-5 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-sans font-semibold text-gray-900 tracking-tight text-lg">Live Delivery Pipeline History</h4>
            <p className="text-xs text-gray-500">Recent real-time scanning action logs across HRM branches</p>
          </div>
          <button 
            onClick={() => onSelectTab('queue')}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
          >
            Open Logistics Board
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase font-mono">
                <th className="pb-3 pt-1">Barcode / order</th>
                <th className="pb-3 pt-1">Customer</th>
                <th className="pb-3 pt-1">Branch</th>
                <th className="pb-3 pt-1">Current State</th>
                <th className="pb-3 pt-1">Driver & Truck</th>
                <th className="pb-3 pt-1 text-right">Last Action Time</th>
              </tr>
            </thead>
            <tbody className="text-xs text-gray-700 divide-y divide-gray-50">
              {displayDeliveries.slice(0, 5).map(delivery => {
                // Get last event
                const lastEvent = delivery.history[delivery.history.length - 1];
                return (
                  <tr key={delivery.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5">
                      <div className="font-semibold font-mono text-blue-600">{delivery.id}</div>
                      <div className="text-[10px] text-gray-400 font-mono">SO: {delivery.epicorSalesOrder} | Invoice: {delivery.invoiceNumber}</div>
                    </td>
                    <td className="py-2.5">
                      <div className="font-sans font-semibold text-gray-900">{delivery.customerName}</div>
                      <div className="text-[10px] text-gray-400 truncate max-w-xs">{delivery.deliveryAddress}</div>
                    </td>
                    <td className="py-2.5">
                      <span className="font-medium text-slate-600 text-[11px]">
                        {activeBranches.find(b => b.id === delivery.originBranch)?.name.replace('ProSpaces ', '') || delivery.originBranch}
                      </span>
                    </td>
                    <td className="py-2.5">
                      {delivery.status === DeliveryStatus.REGISTERED && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-100">
                          1️⃣ Registered
                        </span>
                      )}
                      {delivery.status === DeliveryStatus.PICKED_AND_LOADED && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                          2️⃣ Loaded
                        </span>
                      )}
                      {delivery.status === DeliveryStatus.DELIVERED && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-100">
                          3️⃣ Delivered
                        </span>
                      )}
                      {delivery.status === DeliveryStatus.RETURNED && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-100">
                          ⚠️ Returned / Refused
                        </span>
                      )}
                    </td>
                    <td className="py-2.5">
                      {(() => {
                        const matchedTruck = displayTrucks.find(t => t.id === delivery.assignedTruck);
                        if (matchedTruck) {
                          return (
                            <div className="space-y-0.5">
                              <span className="text-gray-900 font-sans font-semibold flex items-center pr-1 truncate text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>
                                {matchedTruck.driver}
                              </span>
                              <span className="font-mono text-[9px] bg-blue-50 text-blue-700 px-1 py-0.25 rounded font-bold uppercase inline-block">
                                🚚 {matchedTruck.name}
                              </span>
                            </div>
                          );
                        } else if (delivery.assignedDriver) {
                          return (
                            <span className="text-gray-900 font-sans font-medium flex items-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>
                              {delivery.assignedDriver}
                            </span>
                          );
                        } else {
                          return <span className="text-gray-400 font-mono text-[10px]">Unassigned</span>;
                        }
                      })()}
                    </td>
                    <td className="py-2.5 text-right font-mono text-gray-500 text-[11px]">
                      {new Date(lastEvent?.timestamp || delivery.registeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-scale-up">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-slate-800 text-white rounded-full p-1.5 flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-sans font-bold text-sm">Schedule Maintenance Reminder</h3>
                  <p className="text-[10px] text-slate-300 font-mono">
                    Vehicle ID: {reminderTruckId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReminderModal(false)}
                className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const truckName = displayTrucks.find(t => t.id === reminderTruckId)?.name || reminderTruckId;
              setSysLogs(prev => [
                `[${new Date().toLocaleTimeString()}] Scheduled [${reminderType}] Alert for ${truckName}: "${reminderText}" due on ${reminderDueDate}`,
                ...prev.slice(0, 3)
              ]);
              setToastMessage(`Reminder scheduled for ${truckName}!`);
              setShowReminderModal(false);
            }} className="p-5 space-y-4 text-xs font-sans">
              
              <div className="space-y-1">
                <label className="text-slate-700 font-bold block">Service Category</label>
                <select
                  value={reminderType}
                  onChange={(e) => setReminderType(e.target.value)}
                  className="w-full border bg-white border-slate-200 px-3 py-2 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="Oil Change">Oil Change & Filter Service</option>
                  <option value="Brake Inspection">Brake pads & Rotors Inspection</option>
                  <option value="Tire Rotation">Tire Tread, Pressure & Rotation</option>
                  <option value="Annual Safety">Annual MVIS Safety Inspection</option>
                  <option value="Custom Maintenance">Custom Service/Alert Reminder</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 font-bold block">Due Date</label>
                <input
                  type="date"
                  required
                  value={reminderDueDate}
                  onChange={(e) => setReminderDueDate(e.target.value)}
                  className="w-full border bg-white border-slate-200 px-3 py-2 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 font-bold block">Reminder Notes</label>
                <textarea
                  required
                  rows={3}
                  value={reminderText}
                  onChange={(e) => setReminderText(e.target.value)}
                  placeholder="e.g. Schedule booking with Halifax fleet terminal."
                  className="w-full border bg-white border-slate-200 px-3 py-2 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 placeholder-slate-400"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowReminderModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Set Alert</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Floating Action Menu Toast notification feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
