import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { DeliveryRecord, DeliveryStatus, Branch, Truck as TruckType } from '../types';
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
  Film
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
  const norm = (id + ' ' + nameOrAddress).toUpperCase();
  
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

const getBranchCoordinates = (id: string, name: string): { x: number; y: number; lat: number; lng: number } => {
  const { lat, lng } = getGpsForLocation(id, name);
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
}

export default function Dashboard({ deliveries, onSelectTab, trucks, branches, onUpdateTruck }: DashboardProps) {
  const activeBranches = branches || [];
  
  const [selectedTrackTruckId, setSelectedTrackTruckId] = useState<string | null>(null);
  const [isPlayingSimulation, setIsPlayingSimulation] = useState<boolean>(true);
  const [simProgress, setSimProgress] = useState<Record<string, number>>({});
  const [lastRadarPingTime, setLastRadarPingTime] = useState<string>(() => new Date().toLocaleTimeString());
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [pingPulseLocation, setPingPulseLocation] = useState<{ x: number, y: number } | null>(null);
  
  // Custom Map Visual Themes
  const [mapTheme, setMapTheme] = useState<'daylight' | 'cyber' | 'satellite'>('daylight');

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
  const [expandedTruckId, setExpandedTruckId] = useState<string | null>(null);
  
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

  // Automatically adjust default HQ coordinates and center based on the active branches' region
  useEffect(() => {
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
  }, [activeBranches]);

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

    // Map click handler to relocate Dispatcher HQ coordinates
    map.on('click', (e: L.LeafletMouseEvent) => {
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

    let urlTemplate = '';
    let attribution = '';
    let hasSubdomains = false;

    if (mapEngine === 'tomtom' && tomTomApiKey) {
      hasSubdomains = true;
      if (mapTheme === 'daylight') {
        urlTemplate = `https://{s}.api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${tomTomApiKey}`;
        attribution = '&copy; TomTom Map Display';
      } else if (mapTheme === 'cyber') {
        urlTemplate = `https://{s}.api.tomtom.com/map/1/tile/basic/night/{z}/{x}/{y}.png?key=${tomTomApiKey}`;
        attribution = '&copy; TomTom Map Display (Night Mode)';
      } else {
        urlTemplate = `https://{s}.api.tomtom.com/map/1/tile/sat/main/{z}/{x}/{y}.jpg?key=${tomTomApiKey}`;
        attribution = '&copy; TomTom Satellite Imagery';
      }
    } else {
      // Fallback Engine
      if (mapTheme === 'daylight') {
        urlTemplate = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
        attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
      } else if (mapTheme === 'cyber') {
        urlTemplate = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
      } else {
        urlTemplate = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        attribution = 'Tiles &copy; Esri &mdash; Source: Esri, USDA, USGS, and the GIS User Community';
      }
    }

    const tileOptions: L.TileLayerOptions = {
      attribution,
      maxZoom: 18,
    };

    if (hasSubdomains) {
      tileOptions.subdomains = 'abcd';
    }

    const tileLayer = L.tileLayer(urlTemplate, tileOptions).addTo(mapRef.current);

    tileLayerRef.current = tileLayer;
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
          <p class="text-[9px] text-blue-600 mt-1 font-semibold">${isWatchingGps ? "🛰️ Live GPS Connected" : "📍 Anchored Point (Click map to move)"}</p>
        </div>
      `);
    }

    // Plot Branches/DC Nodes
    if (bGroup) {
      activeBranches.forEach(branch => {
        const coords = getBranchCoordinates(branch.id, branch.name);
        const isDC = branch.type === 'DC';
        const count = deliveries.filter(d => d.originBranch === branch.id && d.status !== DeliveryStatus.DELIVERED).length;

        const branchIcon = L.divIcon({
          className: 'custom-branch-marker',
          html: `
            <div class="relative -translate-y-1 bg-slate-900 border-2 ${
              isDC ? 'border-red-500 text-red-00' : 'border-blue-400 text-blue-400 font-bold'
            } shadow-lg py-0.5 px-1.5 rounded-md text-[9px] font-mono leading-none flex items-center gap-1">
              <span>${isDC ? "DC" : "DEP"}</span>
              <span class="text-white opacity-80">${branch.name.split(' ')[0]}</span>
              ${count > 0 ? `<span class="bg-amber-500 text-slate-950 px-1 rounded-full font-sans font-extrabold text-[8px]">${count}</span>` : ''}
            </div>
          `,
          iconSize: [110, 20],
          iconAnchor: [55, 10]
        });

        L.marker([coords.lat, coords.lng], {
          icon: branchIcon
        })
        .addTo(bGroup)
        .bindPopup(`
          <div class="font-sans text-xs p-1">
            <p class="font-bold text-slate-850">${branch.name}</p>
            <p class="text-[10px] text-slate-500">Facility Type: ${branch.type === 'DC' ? 'Distribution Center' : 'Regional Depot'}</p>
            <p class="text-[9px] text-slate-400">GPS Coords: ${coords.lat.toFixed(4)}N, ${coords.lng.toFixed(4)}W</p>
            <p class="text-[10px] text-amber-600 mt-1 font-bold">Pending Carrier Loads: ${count}</p>
          </div>
        `);
      });
    }

    // Plot Customer Delivery Destinations
    if (dGroup) {
      deliveries.filter(d => d.status !== DeliveryStatus.DELIVERED).forEach(delivery => {
        const origCoords = getBranchCoordinates(delivery.originBranch, activeBranches.find(b => b.id === delivery.originBranch)?.name || '');
        const destCoords = getDeliveryCoordinates(delivery.id, delivery.deliveryAddress, origCoords.x, origCoords.y);
        const isAssigned = !!delivery.assignedTruck;

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
            <p class="text-[10px] text-slate-600">${delivery.deliveryAddress}</p>
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

    if (hqCoords) {
      allPlottedCoords.push([hqCoords.lat, hqCoords.lng]);
    }

    activeBranches.forEach(branch => {
      const coords = getBranchCoordinates(branch.id, branch.name);
      allPlottedCoords.push([coords.lat, coords.lng]);
    });

    deliveries.filter(d => d.status !== DeliveryStatus.DELIVERED).forEach(delivery => {
      const origCoords = getBranchCoordinates(delivery.originBranch, activeBranches.find(b => b.id === delivery.originBranch)?.name || '');
      const destCoords = getDeliveryCoordinates(delivery.id, delivery.deliveryAddress, origCoords.x, origCoords.y);
      allPlottedCoords.push([destCoords.lat, destCoords.lng]);
    });

    if (tGroup && rGroup) {
      trucks.forEach(truck => {
        let origLat: number;
        let origLng: number;
        let destLat: number;
        let destLng: number;
        let isMoving = false;

        const assignedDelivery = deliveries.find(d => d.assignedTruck === truck.id && d.status !== DeliveryStatus.DELIVERED);
        if (assignedDelivery) {
          const orig = getBranchCoordinates(assignedDelivery.originBranch, activeBranches.find(b => b.id === assignedDelivery.originBranch)?.name || '');
          const dest = getDeliveryCoordinates(assignedDelivery.id, assignedDelivery.deliveryAddress, orig.x, orig.y);
          origLat = orig.lat;
          origLng = orig.lng;
          destLat = dest.lat;
          destLng = dest.lng;
          isMoving = assignedDelivery.status === DeliveryStatus.PICKED_AND_LOADED && isPlayingSimulation;
        } else {
          const homeBranch = activeBranches.find(b => b.id === truck.branchId);
          const isRona = truck.tenantId === 'ronaatlantic';
          const orig = homeBranch 
            ? getBranchCoordinates(homeBranch.id, homeBranch.name) 
            : isRona 
              ? { lat: 44.6488, lng: -63.5752 } 
              : { lat: 37.2872, lng: -121.9500 };
          origLat = orig.lat;
          origLng = orig.lng;
          destLat = orig.lat + 0.003;
          destLng = orig.lng + 0.003;
          isMoving = false;
        }

        const progress = simProgress[truck.id] ?? 0.15;
        const hasRealGps = (truck as any).lat !== undefined && (truck as any).lng !== undefined;
        const truckLat = hasRealGps ? (truck as any).lat : (origLat + (destLat - origLat) * progress);
        const truckLng = hasRealGps ? (truck as any).lng : (origLng + (destLng - origLng) * progress);
        allPlottedCoords.push([truckLat, truckLng]);

        const isSelected = selectedTrackTruckId === truck.id;
        if (isSelected || (!selectedTrackTruckId && trucks[0]?.id === truck.id)) {
          activeTruckGps = { lat: truckLat, lng: truckLng };
        }

        // Route line: From start depot to customer address
        L.polyline([[origLat, origLng], [destLat, destLng]], {
          color: isSelected ? '#f59e0b' : '#64748b',
          weight: isSelected ? 3.5 : 2,
          dashArray: isSelected ? '6,6' : '4,4',
          opacity: isSelected ? 0.95 : 0.6
        }).addTo(rGroup);

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

        const popupMessage = hasRealGps 
          ? `Broadcasting Live Coordinates (Currently at 137 Chain Lake Drive / Bayer's Lake)`
          : assignedDelivery
            ? `Delivering order ${assignedDelivery.invoiceNumber} (${Math.round(progress * 100)}% complete)`
            : 'Standby / Refueling';

        const markerInstance = L.marker([truckLat, truckLng], {
          icon: truckIcon,
          zIndexOffset: isSelected ? 1000 : 100
        })
        .addTo(tGroup)
        .bindPopup(`
          <div class="font-sans text-xs p-1.5 space-y-1">
            <div class="flex items-center gap-1.5 border-b border-slate-105 pb-1 font-sans">
              <span class="w-1.5 h-1.5 rounded-full ${isMoving ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}"></span>
              <p class="font-bold text-slate-900">${truck.name}</p>
            </div>
            <p class="text-[10px] text-slate-500">ID: ${truck.id} &bull; Type: ${truck.type || 'Flatbed'}</p>
            <p class="text-[9px] text-slate-400 font-mono font-sans">GPS: ${truckLat.toFixed(5)}N, ${truckLng.toFixed(5)}W</p>
            <p class="text-[9.5px] text-amber-600 font-bold mt-1 font-sans">${popupMessage}</p>
          </div>
        `);

        // Update selected truck in state when clicking on marker
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
    const deliveriesCount = deliveries.filter(d => d.status !== DeliveryStatus.DELIVERED).length;
    const currentBoundsKey = `${branchesKey}-${deliveriesCount}-${trucks.length}`;
    
    if (lastBoundsKeyRef.current !== currentBoundsKey && allPlottedCoords.length > 0 && map) {
      lastBoundsKeyRef.current = currentBoundsKey;
      try {
        map.fitBounds(L.latLngBounds(allPlottedCoords), { padding: [50, 50], maxZoom: 13 });
      } catch (e) {
        console.warn("Could not fit map bounds dynamically:", e);
      }
    }
  }, [hqCoords, activeBranches, deliveries, trucks, simProgress, selectedTrackTruckId, isPlayingSimulation, isWatchingGps]);

  // Statistics
  const total = deliveries.length;
  const registered = deliveries.filter(d => d.status === DeliveryStatus.REGISTERED).length;
  const picked = deliveries.filter(d => d.status === DeliveryStatus.PICKED_AND_LOADED).length;
  const delivered = deliveries.filter(d => d.status === DeliveryStatus.DELIVERED).length;
  const returned = deliveries.filter(d => d.status === DeliveryStatus.RETURNED).length;

  const bogoStats = activeBranches.map(branch => {
    const branchDeliveries = deliveries.filter(d => d.originBranch === branch.id);
    return {
      ...branch,
      count: branchDeliveries.length,
      delivered: branchDeliveries.filter(d => d.status === DeliveryStatus.DELIVERED).length,
      pending: branchDeliveries.filter(d => d.status === DeliveryStatus.REGISTERED || d.status === DeliveryStatus.PICKED_AND_LOADED).length
    };
  });

  // GPS Simulation Loop
  useEffect(() => {
    if (!isPlayingSimulation) return;
    const interval = setInterval(() => {
      setSimProgress(prev => {
        const next = { ...prev };
        trucks.forEach(t => {
          const current = prev[t.id] || 0.15;
          const assignedDelivery = deliveries.find(d => d.assignedTruck === t.id && d.status !== DeliveryStatus.DELIVERED);
          
          if (assignedDelivery && assignedDelivery.status === DeliveryStatus.PICKED_AND_LOADED) {
            let increment = 0.035;
            let nextVal = current + increment;
            if (nextVal > 1.0) {
              nextVal = 0.05; // Reset or loop travel path
              setSysLogs(prevLogs => [
                `[${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}] Beacon ${t.id} reached milestone. Dispatch verified.`,
                ...prevLogs.slice(0, 4)
              ]);
            }
            next[t.id] = nextVal;
          } else {
            // Unassigned or not loaded yet - stay stationary at start
            next[t.id] = 0.0;
          }
        });
        return next;
      });
    }, 1800);
    return () => clearInterval(interval);
  }, [trucks, deliveries, isPlayingSimulation]);

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
        setGpsError("Bridges enabled: Your real location is outside Nova Scotia. Simulated dispatch point locked at Halifax Harbor.");
      }
      setGpsStatus('locked');
      setSysLogs(prev => [
        `[${new Date().toLocaleTimeString()}] Live GPS Stream Lock initialized at ${latitude.toFixed(4)}N, ${longitude.toFixed(4)}W.`,
        ...prev.slice(0, 4)
      ]);
    };

    const errorHandler = (err: GeolocationPositionError) => {
      console.warn("Geolocation permission error:", err);
      setGpsError("Access restricted. Simulating Dispatch Center at central Halifax City Hall.");
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
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-md overflow-hidden flex flex-col">
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
                onClick={() => setMapTheme('daylight')}
                className={`px-2 py-1 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                  mapTheme === 'daylight' 
                    ? 'bg-sky-600 text-white shadow-xs' 
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                Daylight Chart
              </button>
              <button
                type="button"
                onClick={() => setMapTheme('cyber')}
                className={`px-2 py-1 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                  mapTheme === 'cyber' 
                    ? 'bg-cyan-600 text-white shadow-xs' 
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                Cyber HUD
              </button>
              <button
                type="button"
                onClick={() => setMapTheme('satellite')}
                className={`px-2 py-1 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                  mapTheme === 'satellite' 
                    ? 'bg-amber-600 text-white shadow-xs' 
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                Satellite Zoom
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[480px] font-sans">
          
          {/* Real zoomable Leaflet Map Container */}
          <div className="lg:col-span-8 p-4 relative border-b lg:border-b-0 lg:border-r border-slate-200/85 flex flex-col justify-between overflow-hidden min-h-[430px] lg:min-h-[500px] bg-slate-50">
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
                          title="Click to reset to evaluation demo key"
                        >
                          Demo
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
            </div>
          </div>

          <div className="hidden">
            {/* Visual Vector Map Canvas */}
          <div 
            onClick={() => {}}
            className={`lg:col-span-8 p-6 relative border-b lg:border-b-0 lg:border-r flex flex-col justify-between overflow-hidden cursor-crosshair group select-none transition-all duration-300 min-h-[380px] ${
              mapTheme === 'daylight' 
                ? 'bg-sky-50/70 border-slate-200 bg-[radial-gradient(#94a3b8_0.8px,transparent_0.8px)] [background-size:20px_20px]' 
                : mapTheme === 'cyber' 
                  ? 'bg-slate-950/95 border-slate-800 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]' 
                  : 'bg-[#050f21] border-slate-800 bg-[radial-gradient(#112240_1px,transparent_1px)] [background-size:18px_18px]'
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
                    mapTheme === 'daylight' 
                      ? { water: '#b2e2f2', land: '#faf9f5', shore: '#0284c7', bridge: '#ef4444', highway: '#94a3b8' } 
                      : mapTheme === 'cyber' 
                        ? { water: '#020617', land: '#0f172a', shore: '#06b6d4', bridge: '#f59e0b', highway: '#1e293b' } 
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
                const matchedTruck = selectedTrackTruckId ? trucks.find(t => t.id === selectedTrackTruckId) : trucks[0];
                if (!matchedTruck) return null;

                let origLat: number;
                let origLng: number;
                let destLat: number;
                let destLng: number;

                const assignedDelivery = deliveries.find(d => d.assignedTruck === matchedTruck.id && d.status !== DeliveryStatus.DELIVERED);
                if (assignedDelivery) {
                  const orig = getBranchCoordinates(assignedDelivery.originBranch, activeBranches.find(b => b.id === assignedDelivery.originBranch)?.name || '');
                  const dest = getDeliveryCoordinates(assignedDelivery.id, assignedDelivery.deliveryAddress, orig.x, orig.y);
                  origLat = orig.lat; origLng = orig.lng;
                  destLat = dest.lat; destLng = dest.lng;
                } else {
                  const homeBranch = activeBranches.find(b => b.id === matchedTruck.branchId);
                  const isRona = matchedTruck.tenantId === 'ronaatlantic';
                  const orig = homeBranch 
                    ? getBranchCoordinates(homeBranch.id, homeBranch.name) 
                    : isRona 
                      ? { lat: 44.6488, lng: -63.5752 } 
                      : { lat: 37.2872, lng: -121.9500 };
                  origLat = orig.lat; origLng = orig.lng;
                  destLat = orig.lat + 0.003; destLng = orig.lng + 0.003;
                }

                const progress = simProgress[matchedTruck.id] ?? 0.15;
                const hasRealGps = (matchedTruck as any).lat !== undefined && (matchedTruck as any).lng !== undefined;
                const truckLat = hasRealGps ? (matchedTruck as any).lat : (origLat + (destLat - origLat) * progress);
                const truckLng = hasRealGps ? (matchedTruck as any).lng : (origLng + (destLng - origLng) * progress);
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
                      stroke={mapTheme === 'daylight' ? '#2563eb' : '#06b6d4'}
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
              {trucks.map(truck => {
                let origLat: number;
                let origLng: number;
                let destLat: number;
                let destLng: number;

                const assignedDelivery = deliveries.find(d => d.assignedTruck === truck.id && d.status !== DeliveryStatus.DELIVERED);
                if (assignedDelivery) {
                  const orig = getBranchCoordinates(assignedDelivery.originBranch, activeBranches.find(b => b.id === assignedDelivery.originBranch)?.name || '');
                  const dest = getDeliveryCoordinates(assignedDelivery.id, assignedDelivery.deliveryAddress, orig.x, orig.y);
                  origLat = orig.lat; origLng = orig.lng;
                  destLat = dest.lat; destLng = dest.lng;
                } else {
                  const homeBranch = activeBranches.find(b => b.id === truck.branchId);
                  const isRona = truck.tenantId === 'ronaatlantic';
                  const orig = homeBranch 
                    ? getBranchCoordinates(homeBranch.id, homeBranch.name) 
                    : isRona 
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
                      stroke={isSelected ? "#f59e0b" : (mapTheme === 'daylight' ? '#64748b' : '#475569')} 
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
                const coords = getBranchCoordinates(branch.id, branch.name);
                const isDC = branch.type === 'DC';
                const countOfActiveDeliveriesAtBranch = deliveries.filter(d => d.originBranch === branch.id && d.status !== DeliveryStatus.DELIVERED).length;

                return (
                  <div
                    key={`marker-${branch.id}`}
                    style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-10 transition-all hover:scale-110"
                    title={`${branch.name} (${branch.type})`}
                  >
                    <div className={`p-1.5 rounded-lg border-2 ${
                      isDC 
                        ? 'bg-red-950 border-red-500 text-red-400 font-bold' 
                        : 'bg-blue-950 border-blue-505 text-blue-400 font-bold'
                    } shadow-lg shadow-black/50 flex items-center justify-center`}>
                      <span className="text-[9px] font-mono leading-none">{isDC ? "DC" : "DEP"}</span>
                    </div>

                    {countOfActiveDeliveriesAtBranch > 0 && (
                      <span className="absolute -top-2.5 -right-2 px-1 py-0.25 bg-amber-500 text-black font-semibold text-[8px] font-mono rounded-full scale-90 border border-slate-900 leading-none">
                        {countOfActiveDeliveriesAtBranch}
                      </span>
                    )}

                    {/* Popover label on Hover */}
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 text-[10px] text-white px-2 py-1 rounded shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-25 font-sans">
                      <span className="font-semibold">{branch.name}</span>
                      <p className="text-[8px] text-slate-400 font-mono">ID: {branch.id} &bull; GPS: {coords.lat.toFixed(4)}N, {coords.lng.toFixed(4)}W</p>
                    </div>
                  </div>
                );
              })}

              {/* 3. Customer Delivery Destination Pins */}
              {deliveries.filter(d => d.status !== DeliveryStatus.DELIVERED).map(delivery => {
                const origCoords = getBranchCoordinates(delivery.originBranch, activeBranches.find(b => b.id === delivery.originBranch)?.name || '');
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
                        : (mapTheme === 'daylight' ? 'bg-slate-300 border-slate-500 text-slate-700' : 'bg-slate-900 border-slate-700 text-slate-450')
                    }`}>
                      <MapPin className="h-2.5 w-2.5" />
                    </div>

                    {/* Popover */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 text-[10px] text-white px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-25 font-sans space-y-0.5">
                      <p className="font-semibold text-slate-150">🎯 Recipient: {delivery.customerName}</p>
                      <p className="text-[8px] text-slate-400 font-mono">Invoice: {delivery.invoiceNumber} &bull; {delivery.deliveryAddress}</p>
                      <p className="text-[8px] text-amber-400">Status: {delivery.status.replace('_', ' ')} {isAssigned ? `(Assigned: ${delivery.assignedTruck})` : '(Unassigned)'}</p>
                    </div>
                  </div>
                );
              })}

              {/* 4. Live Active Driver Trucks Layer */}
              {trucks.map(truck => {
                let origLat: number;
                let origLng: number;
                let destLat: number;
                let destLng: number;
                let isMoving = false;

                const assignedDelivery = deliveries.find(d => d.assignedTruck === truck.id && d.status !== DeliveryStatus.DELIVERED);
                if (assignedDelivery) {
                  const orig = getBranchCoordinates(assignedDelivery.originBranch, activeBranches.find(b => b.id === assignedDelivery.originBranch)?.name || '');
                  const dest = getDeliveryCoordinates(assignedDelivery.id, assignedDelivery.deliveryAddress, orig.x, orig.y);
                  origLat = orig.lat; origLng = orig.lng;
                  destLat = dest.lat; destLng = dest.lng;
                  isMoving = assignedDelivery.status === DeliveryStatus.PICKED_AND_LOADED && isPlayingSimulation;
                } else {
                  const homeBranch = activeBranches.find(b => b.id === truck.branchId);
                  const isRona = truck.tenantId === 'ronaatlantic';
                  const orig = homeBranch 
                    ? getBranchCoordinates(homeBranch.id, homeBranch.name) 
                    : isRona 
                      ? { lat: 44.6488, lng: -63.5752 } 
                      : { lat: 37.2872, lng: -121.9500 };
                  origLat = orig.lat; origLng = orig.lng;
                  destLat = orig.lat + 0.003; destLng = orig.lng + 0.003;
                  isMoving = false;
                }

                const progress = simProgress[truck.id] ?? 0.15;
                const hasRealGps = (truck as any).lat !== undefined && (truck as any).lng !== undefined;
                const truckLat = hasRealGps ? (truck as any).lat : (origLat + (destLat - origLat) * progress);
                const truckLng = hasRealGps ? (truck as any).lng : (origLng + (destLng - origLng) * progress);
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
                          <p className="text-[8px] text-slate-400">Destination: {assignedDelivery.deliveryAddress}</p>
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
              mapTheme === 'daylight' ? 'border-slate-300 text-slate-600' : 'border-slate-850 text-slate-400'
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
          <div className="lg:col-span-4 p-5 bg-slate-50 border-l border-slate-200 flex flex-col justify-between space-y-4 min-h-[500px]">
            
            <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
              
              {/* 2. Interactive Search input bar with magnifying glass */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search"
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-inner focus:ring-1 focus:ring-blue-500/20"
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

              {/* 3. Listed Active Fleet Vehicles */}
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 max-h-[500px]">
                {(() => {
                  const combinedFleetList = trucks.map(t => {
                    const assignedDelivery = deliveries.find(d => d.assignedTruck === t.id && d.status !== DeliveryStatus.DELIVERED);
                    const isLoaded = assignedDelivery ? assignedDelivery.status === DeliveryStatus.PICKED_AND_LOADED : false;
                    const speedValue = assignedDelivery && isLoaded && isPlayingSimulation ? 45 : 0;
                    return {
                      ...t,
                      id: t.id,
                      name: t.name,
                      driver: t.driver || 'No Driver',
                      type: t.type || 'Carrier',
                      activeSpeed: speedValue,
                      avatar: '',
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
                        idling: speedValue > 0 ? '5' : '45'
                      }
                    };
                  });
                  
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

                  if (filteredFleet.length === 0) {
                    return (
                      <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
                        No vehicles match "{searchQuery}"
                      </div>
                    );
                  }

                  return filteredFleet.map(truckRow => {
                    const isExpanded = expandedTruckId === truckRow.id;
                    const speedText = truckRow.activeSpeed > 0 ? `${truckRow.activeSpeed} mph` : '0 mph';
                    const activeRun = truckRow.trips[0];
                    
                    return (
                      <div 
                        key={truckRow.id}
                        className={`bg-white rounded-2xl border transition-all duration-350 shadow-xs overflow-hidden ${
                          isExpanded 
                            ? 'border-blue-400 ring-4 ring-blue-500/5' 
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        
                        {/* Vehicle Card Header */}
                        <div 
                          className="p-4 flex items-center justify-between cursor-pointer select-none gap-3"
                          onClick={() => {
                            setExpandedTruckId(isExpanded ? null : truckRow.id);
                            setSelectedTrackTruckId(truckRow.id); // Bind map centered tracker to selected list row!
                          }}
                        >
                          
                          <div className="flex items-center gap-3">
                            
                            {/* Driver Profile Face or placeholder circle */}
                            {truckRow.avatar ? (
                              <img 
                                src={truckRow.avatar} 
                                alt={truckRow.driver} 
                                className="w-10 h-10 rounded-full object-cover border-2 border-slate-105"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-slate-105 border-2 border-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs uppercase">
                                {truckRow.driver.slice(0, 2)}
                              </div>
                            )}

                            <div>
                              <h4 className="font-sans font-bold text-slate-900 leading-tight text-xs flex items-center gap-1.5 md:text-[13px]">
                                {truckRow.name}
                              </h4>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5 leading-none">
                                Current Speed: <span className={truckRow.activeSpeed > 0 ? "text-emerald-600 font-bold" : "text-slate-500"}>{speedText}</span>
                              </p>
                              <p className="text-[11px] text-slate-500 font-semibold mt-1">
                                {truckRow.driver}
                              </p>
                            </div>

                          </div>

                          {/* Chevron Icon toggler */}
                          <button
                            type="button"
                            className={`p-1 hover:bg-slate-50 text-slate-400 rounded-lg transition-transform ${isExpanded ? 'rotate-180 text-blue-600' : ''}`}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>

                        </div>

                        {/* Expandable Trips Details overlay and Behavior Metrics */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 bg-white p-4 space-y-4">
                            
                            {/* Trip list progress block */}
                            {activeRun ? (
                              <div className="space-y-3">
                                
                                <div className="flex items-center justify-between border-b border-dashed border-slate-100 pb-1.5">
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 font-sans leading-none flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                    {activeRun.title}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400 font-bold">
                                    {activeRun.subtitle}
                                  </span>
                                </div>

                                {/* Itinerary Stops list */}
                                <div className="space-y-3 relative pl-4 border-l-2 border-slate-100 ml-1.5">
                                  {activeRun.stops.map((stop, sIndex) => (
                                    <div key={sIndex} className="relative text-[11px] leading-tight">
                                      
                                      {/* Stop Marker Circle */}
                                      <div className={`absolute -left-[23px] top-0.5 w-[12px] h-[12px] rounded-full flex items-center justify-center ${
                                        stop.type === 'start' 
                                          ? 'bg-slate-400' 
                                          : 'bg-[#0070f3] text-white text-[8px] font-extrabold'
                                      }`}>
                                        {stop.type === 'start' ? (
                                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                        ) : '1'}
                                      </div>

                                      <div className="flex justify-between gap-1">
                                        <span className="text-slate-705 font-medium truncate max-w-[150px]" title={stop.address}>
                                          {stop.address}
                                        </span>
                                        <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap">
                                          {stop.time}
                                        </span>
                                      </div>

                                    </div>
                                  ))}
                                </div>

                                {/* Parked pills, matching screenshot format */}
                                {('parkedText' in activeRun && (activeRun as any).parkedText) && (
                                  <div className="py-1.5 flex justify-center">
                                    <span className="px-2.5 py-0.5 bg-slate-50 border border-slate-200 text-slate-450 rounded-full text-[10px] font-mono font-medium flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-slate-300" />
                                      {(activeRun as any).parkedText}
                                    </span>
                                  </div>
                                )}

                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-400 italic">No active dispatch ticket associated.</p>
                            )}

                            {/* Collapsible History Logs list */}
                            {truckRow.pastTrips.length > 0 && (
                              <div className="pt-2 border-t border-slate-100 space-y-2">
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Past Itinerary Logs</span>
                                <div className="space-y-2">
                                  {truckRow.pastTrips.map((pastTrip) => (
                                    <div key={pastTrip.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[10px] space-y-2">
                                      
                                      <div className="flex items-center justify-between text-slate-600 font-bold">
                                        <span className="text-blue-600">{pastTrip.title}</span>
                                        <span className="font-mono">{pastTrip.distance} &bull; {pastTrip.duration}</span>
                                      </div>

                                      <div className="space-y-1.5 relative pl-3.5 border-l border-blue-400/50">
                                        {pastTrip.stops.map((pStop, sIndex) => (
                                          <div key={sIndex} className="flex justify-between gap-1 text-[9.5px]">
                                            <span className="truncate max-w-[140px] text-slate-500">{pStop.address}</span>
                                            <span className="font-mono text-slate-400">{pStop.time}</span>
                                          </div>
                                        ))}
                                      </div>

                                      {pastTrip.parkedText && (
                                        <div className="flex justify-center pt-0.5">
                                          <span className="px-2 py-0.25 bg-white border border-slate-150 text-[8.5px] font-mono text-slate-400 rounded-lg">
                                            {pastTrip.parkedText}
                                          </span>
                                        </div>
                                      )}

                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Live GPS Dispatch Override Panel */}
                            <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5 mt-2 bg-amber-50/20 p-2.5 rounded-xl border border-dashed border-amber-200">
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 flex items-center justify-between">
                                <span className="flex items-center gap-1">📍 Live Dispatch GPS Override</span>
                                {((truckRow as any).lat !== undefined || (truckRow as any).lng !== undefined) && (
                                  <button
                                    onClick={() => {
                                      if (onUpdateTruck) {
                                        const updated = { ...truckRow };
                                        delete (updated as any).lat;
                                        delete (updated as any).lng;
                                        onUpdateTruck(updated);
                                        setSysLogs(prev => [`[${new Date().toLocaleTimeString()}] Reset ${truckRow.name} to automatic branch GPS.`, ...prev.slice(0, 4)]);
                                      }
                                    }}
                                    className="text-[9px] text-red-500 hover:underline font-semibold"
                                  >
                                    Reset GPS
                                  </button>
                                )}
                              </span>
                              
                              <p className="text-[9.5px] text-slate-500 leading-tight">
                                Broadcast this driver's coordinates manually. Auto-resolves names like <strong>137 Chain Lake Drive</strong>:
                              </p>

                              <div className="flex gap-1.5 mt-1">
                                <input
                                  type="text"
                                  id={`override-address-${truckRow.id}`}
                                  placeholder="e.g. 137 Chain Lake Drive"
                                  className="flex-1 px-2 py-1 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-hidden bg-white text-slate-800"
                                  defaultValue={((truckRow as any).lat !== undefined || (truckRow as any).lng !== undefined) ? `${(truckRow as any).lat?.toFixed(5)}, ${(truckRow as any).lng?.toFixed(5)}` : ""}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const inputVal = (e.currentTarget as HTMLInputElement).value;
                                      handleGpsSubmit(truckRow, inputVal);
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const input = document.getElementById(`override-address-${truckRow.id}`) as HTMLInputElement | null;
                                    if (input) {
                                      handleGpsSubmit(truckRow, input.value);
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-amber-600 text-white hover:bg-amber-700 rounded font-bold text-xs transition-colors"
                                >
                                  Apply
                                </button>
                              </div>

                              {/* Quick selector chips */}
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleGpsSubmit(truckRow, "137 Chain Lake Drive")}
                                  className="px-1.5 py-0.5 bg-white/80 border border-amber-200/50 hover:bg-amber-100/50 hover:text-amber-700 text-[9px] text-slate-700 rounded transition-colors font-semibold"
                                >
                                  📍 137 Chain Lake (Currently At)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleGpsSubmit(truckRow, "500 Windmill Road")}
                                  className="px-1.5 py-0.5 bg-white/80 border border-slate-200 hover:bg-blue-100/50 hover:text-blue-700 text-[9px] text-slate-700 rounded transition-colors font-semibold"
                                >
                                  📍 500 Windmill Rd
                                </button>
                              </div>
                            </div>

                            {/* Simulation settings toggle directly inside card for awesome utility */}
                            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2.5 text-[10px] text-slate-500 font-mono">
                              <span className="flex items-center gap-1 leading-none py-0.5">
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                                Diagnostics Live
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  // Open and trigger streetview Simulated camera widget overlay of this truck!
                                  setCameraFilter(f => f === 'normal' ? 'nv' : 'normal');
                                  setSysLogs(prev => [`[${new Date().toLocaleTimeString()}] Diagnostics bind: ${truckRow.name} Camera pipeline engaged.`, ...prev.slice(0,3)]);
                                }}
                                className="px-2 py-0.5 border border-slate-200 hover:bg-slate-50 rounded font-semibold text-slate-600 transition-colors"
                              >
                                Toggle live-eye feed
                              </button>
                            </div>

                            {/* 4. DRIVER PERFORMANCE METRICS (Direct representation from user's image request) */}
                            <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-105 grid grid-cols-4 gap-2 text-center select-none font-sans mt-3">
                              
                              {/* Column 1: Rapid Accels */}
                              <div className="flex flex-col items-center justify-between space-y-1">
                                <span className="font-mono text-xs font-black text-slate-800 bg-white border border-slate-200 outline-hidden w-6 h-6 leading-none flex items-center justify-center rounded-lg shadow-xs">
                                  {truckRow.metrics.accels}
                                </span>
                                <div className="text-[8.5px] text-slate-500 font-semibold tracking-tight leading-tight pt-1">
                                  Rapid Accels
                                </div>
                              </div>

                              {/* Column 2: Excessive Speed */}
                              <div className="flex flex-col items-center justify-between space-y-1">
                                <span className={`font-mono text-xs font-black w-6 h-6 leading-none flex items-center justify-center rounded-lg shadow-xs bg-white border ${
                                  truckRow.metrics.excessiveSpeed !== '0' ? 'text-amber-600 border-amber-200 bg-amber-50/20' : 'text-slate-800 border-slate-200'
                                }`}>
                                  {truckRow.metrics.excessiveSpeed}
                                </span>
                                <div className="text-[8.5px] text-slate-500 font-semibold tracking-tight leading-tight pt-1">
                                  Excessive Mins Spd
                                </div>
                              </div>

                              {/* Column 3: Harsh Brakes */}
                              <div className="flex flex-col items-center justify-between space-y-1">
                                <span className={`font-mono text-xs font-black w-6 h-6 leading-none flex items-center justify-center rounded-lg shadow-xs bg-white border ${
                                  truckRow.metrics.harshBrakes > 0 ? 'text-rose-600 border-rose-250' : 'text-slate-800 border-slate-200'
                                }`}>
                                  {truckRow.metrics.harshBrakes}
                                </span>
                                <div className="text-[8.5px] text-slate-500 font-semibold tracking-tight leading-tight pt-1">
                                  Harsh Brakes
                                </div>
                              </div>

                              {/* Column 4: Minutes Idling */}
                              <div className="flex flex-col items-center justify-between space-y-1">
                                <span className="font-mono text-xs font-black text-slate-800 bg-white border border-slate-200 outline-hidden w-6 h-6 leading-none flex items-center justify-center rounded-lg shadow-xs">
                                  {truckRow.metrics.idling}
                                </span>
                                <div className="text-[8.5px] text-slate-500 font-semibold tracking-tight leading-tight pt-1">
                                  Minutes Idling
                                </div>
                              </div>

                            </div>

                          </div>
                        )}

                      </div>
                    );
                  });
                })()}
              </div>

            </div>

            {/* Simulated Live Street view details or Radar Ping Console logs collapsed at the bottom footer */}
            <div className="pt-2.5 border-t border-slate-200 space-y-2 text-slate-505">
              
              <div className="flex items-center justify-between text-[10px] font-mono leading-none">
                <span className="flex items-center gap-1 font-semibold uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live HUD Perspective
                </span>
                <span className="text-[9px] uppercase">{cameraFilter === 'normal' ? 'Normal Lens' : cameraFilter.toUpperCase() + ' Active'}</span>
              </div>

              {/* Collapsed view simulated Street View rendering */}
              <div className="relative h-14 w-full rounded-xl bg-slate-950 overflow-hidden border border-slate-200 flex items-center justify-center">
                
                {/* Simulated perspectives */}
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
            
            {trucks.length === 0 ? (
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
                {trucks.map(truck => {
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
              {deliveries.slice(0, 5).map(delivery => {
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
                        const matchedTruck = trucks.find(t => t.id === delivery.assignedTruck);
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

    </div>
  );
}
