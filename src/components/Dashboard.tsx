import React, { useState, useEffect, useRef } from 'react';
import { DeliveryRecord, DeliveryStatus, Branch, Truck as TruckType } from '../types';
import { BRANCHES } from '../data';
import { 
  Truck as TruckIcon, 
  CheckCircle2, 
  TrendingUp, 
  RefreshCw, 
  MapPin, 
  Store, 
  Calendar, 
  FileCheck, 
  Package,
  Compass,
  Navigation,
  Smartphone,
  Signal,
  Wifi,
  AlertCircle,
  Play,
  Square,
  UserCheck,
  CheckSquare,
  Activity
} from 'lucide-react';

interface DashboardProps {
  deliveries: DeliveryRecord[];
  onSelectTab: (tab: string) => void;
  trucks: TruckType[];
  onAddOrUpdateDelivery?: (newRecord: DeliveryRecord) => void;
  branches?: Branch[];
}

export default function Dashboard({ deliveries, onSelectTab, trucks, onAddOrUpdateDelivery, branches }: DashboardProps) {
  const activeBranches = branches && branches.length > 0 ? branches : BRANCHES;
  // Statistics
  const total = deliveries.length;
  const registered = deliveries.filter(d => d.status === DeliveryStatus.REGISTERED).length;
  const picked = deliveries.filter(d => d.status === DeliveryStatus.PICKED_AND_LOADED).length;
  const delivered = deliveries.filter(d => d.status === DeliveryStatus.DELIVERED).length;
  const returned = deliveries.filter(d => d.status === DeliveryStatus.RETURNED).length;

  // Active UI Tabs for the right-hand panel
  const [activeRightSubTab, setActiveRightSubTab] = useState<'capacity' | 'gps'>('gps');
  
  // Real Driver profiles dataset
  const DRIVERS = [
    { id: 'driver-01', name: 'Dave MacNeil', truck: 'Truck-1 Crane Boom (NS-F01)', phone: '1 (902) 880-6011', lat: 44.6784, lng: -63.5857, store: 'Windmill Rd DC', status: 'At Delivery Site' },
    { id: 'driver-02', name: 'Sarah Jenkins', truck: 'Truck-2 Flatbed (NS-F02)', phone: '1 (902) 880-6022', lat: 44.6534, lng: -63.6012, store: '01065 - Almon RONA (Halifax)', status: 'In Transit' },
    { id: 'driver-03', name: 'Marc LeBlanc', truck: 'Truck-3 Fleet Pickup (NS-P03)', phone: '1 (902) 880-6033', lat: 44.6865, lng: -63.8710, store: '01075 - Tantallon RONA', status: 'At Yard' },
    { id: 'driver-04', name: 'Robert Chiasson', truck: 'Truck-4 Curtain Flatbed (NS-C04)', phone: '1 (902) 880-6044', lat: 44.9750, lng: -63.5100, store: '01070 - Elmsdale RONA', status: 'Loading' },
    { id: 'driver-05', name: 'John Miller', truck: 'Truck-1 Boom Truck (NS-F05)', phone: '1 (902) 880-6055', lat: 44.6400, lng: -63.6700, store: '01065 - Almon RONA (Halifax)', status: 'On Break' },
    { id: 'driver-06', name: 'Clara Smith', truck: 'Truck-2 Box Truck (NS-B06)', phone: '1 (902) 880-6066', lat: 44.6950, lng: -63.6200, store: 'Windmill Rd DC', status: 'At Yard' }
  ];

  const [selectedDriverId, setSelectedDriverId] = useState('driver-01');
  const activeDriver = DRIVERS.find(d => d.id === selectedDriverId) || DRIVERS[0];

  const [simPhone, setSimPhone] = useState(activeDriver.phone);
  const [simDriver, setSimDriver] = useState(activeDriver.name);
  const [signatureName, setSignatureName] = useState('Dave');
  const [selectedOrderToDeliver, setSelectedOrderToDeliver] = useState('');
  const [signatureModeActive, setSignatureModeActive] = useState(false);
  const [mapStyle, setMapStyle] = useState<'r' | 'h' | 'a'>('r');

  // Sync inputs when selectedDriverId changes
  useEffect(() => {
    setSimDriver(activeDriver.name);
    setSimPhone(activeDriver.phone);
    setSignatureName(activeDriver.name.split(' ')[0]);
  }, [selectedDriverId]);

  // Map Container Resize Observer for dynamic, responsive Bing Maps embedding
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapWidth, setMapWidth] = useState<number>(750);
  const [mapHeight, setMapHeight] = useState<number>(385);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0) setMapWidth(Math.floor(width));
        if (height > 0) setMapHeight(Math.floor(height));
      }
    });

    observer.observe(mapContainerRef.current);
    
    // Initial measurement
    const rect = mapContainerRef.current.getBoundingClientRect();
    if (rect.width > 0) setMapWidth(Math.floor(rect.width));
    if (rect.height > 0) setMapHeight(Math.floor(rect.height));

    return () => {
      observer.disconnect();
    };
  }, []);

  // Leaflet iFrame Ref and message communication
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Real GPS Geolocation States
  const [realGpsActive, setRealGpsActive] = useState(false);
  const [realGpsCoords, setRealGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [realGpsError, setRealGpsError] = useState<string | null>(null);
  const [gpsWatchId, setGpsWatchId] = useState<number | null>(null);
  const [realGpsMeta, setRealGpsMeta] = useState<{
    accuracy?: number | null;
    altitude?: number | null;
    speed?: number | null;
    heading?: number | null;
  } | null>(null);

  // Constants & coordinates for map projection
  const START_POINT = { x: 255, y: 110, lat: 44.6784, lng: -63.5857, label: "Windmill Rd DC" };

  const DESTINATIONS: Record<string, { x: number, y: number, lat: number, lng: number, label: string }> = {
    WINDMILL_DC: { x: 255, y: 110, lat: 44.6784, lng: -63.5857, label: "Windmill Rd DC" },
    '01065_ALMON': { x: 110, y: 190, lat: 44.6534, lng: -63.6012, label: "01065 - Almon (Halifax)" },
    '01075_TANTALLON': { x: 60, y: 250, lat: 44.6865, lng: -63.8710, label: "01075 - Tantallon" },
    '01070_ELMSDALE': { x: 190, y: 35, lat: 44.9750, lng: -63.5100, label: "01070 - Elmsdale" }
  };

  // Distance calculator using Haversine algorithm
  const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // Distance in km
    return d;
  };

  // Get SVG coordinate for real-world GPS streams
  const getRealGpsSvgCoords = () => {
    if (!realGpsCoords) return null;
    const { lat, lng } = realGpsCoords;
    return { x: 250, y: 200, isProjected: false };
  };

  // Handle setting up background web browser location tracking
  const toggleRealGps = () => {
    if (realGpsActive) {
      if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        setGpsWatchId(null);
      }
      setRealGpsActive(false);
      setRealGpsCoords(null);
      setRealGpsMeta(null);
    } else {
      setRealGpsError(null);
      if (!navigator.geolocation) {
        setRealGpsError("Geolocation is not supported by your browser");
        return;
      }
      
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setRealGpsActive(true);
          setRealGpsCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setRealGpsMeta({
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            speed: position.coords.speed,
            heading: position.coords.heading
          });
        },
        (error) => {
          let msg = "Failed to fetch GPS";
          if (error.code === error.PERMISSION_DENIED) {
            msg = "Location permission denied. Please allow location in your browser / device settings.";
          }
          setRealGpsError(msg);
          setRealGpsActive(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
      setGpsWatchId(watchId);
    }
  };

  // Clean up watchers
  useEffect(() => {
    return () => {
      if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
      }
    };
  }, [gpsWatchId]);

  const currentLat = realGpsActive && realGpsCoords ? realGpsCoords.lat : activeDriver.lat;
  const currentLng = realGpsActive && realGpsCoords ? realGpsCoords.lng : activeDriver.lng;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage({
          type: 'UPDATE_COORDS',
          lat: currentLat,
          lng: currentLng,
          driverName: activeDriver.name,
          truckName: activeDriver.truck,
          style: mapStyle
        }, '*');
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [currentLat, currentLng, activeDriver.name, activeDriver.truck, mapStyle]);

  const handleIframeLoad = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'UPDATE_COORDS',
        lat: currentLat,
        lng: currentLng,
        driverName: activeDriver.name,
        truckName: activeDriver.truck,
        style: mapStyle
      }, '*');
    }
  };

  const getLeafletMapHtml = () => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
  <style>
    html, body, #map {
      height: 100%;
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    
    /* Elegant tooltip style */
    .custom-tooltip {
      background: rgba(15, 23, 42, 0.95) !important;
      border: 1px solid rgba(100, 116, 139, 0.4) !important;
      color: #f8fafc !important;
      font-size: 11px !important;
      font-family: inherit !important;
      border-radius: 8px !important;
      padding: 6px 10px !important;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1) !important;
    }
    .custom-tooltip::before {
      border-top-color: rgba(15, 23, 42, 0.95) !important;
    }

    /* Pulsating ring for the Truck */
    .truck-marker-container {
      position: relative;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .truck-glow {
      position: absolute;
      width: 32px;
      height: 32px;
      background: rgba(245, 158, 11, 0.25);
      border: 2px solid #f59e0b;
      border-radius: 50%;
      animation: pulse 1.8s ease-out infinite;
    }
    .truck-icon-inner {
      width: 26px;
      height: 26px;
      background: #f59e0b;
      border: 1.5px solid #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.15);
      z-index: 2;
    }

    @keyframes pulse {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }

    /* DC Warehouse Marker Icon style */
    .dc-marker-container {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
    }
    .dc-inner {
      width: 22px;
      height: 22px;
      background: #dc2626;
      border: 1.5px solid #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 3px 5px rgb(0 0 0 / 0.2);
    }

    /* Retail Store Locator Icon style */
    .retail-marker-container {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
    }
    .retail-inner {
      width: 18px;
      height: 18px;
      background: #2563eb;
      border: 1.5px solid #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 3px 5px rgb(0 0 0 / 0.2);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script>
    var map = L.map('map', {
      zoomControl: true,
      attributionControl: true
    }).setView([44.6784, -63.5857], 11);

    var roadLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; CartoDB &copy; OpenStreetMap'
    });

    var satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Active GIS Satellite Imagery'
    });

    roadLayer.addTo(map);
    var currentStyle = 'r';

    // Custom Icons config
    var dcIcon = L.divIcon({
      html: '<div class="dc-marker-container"><div class="dc-inner"><span style="color:white; font-size:11px; font-weight:bold; line-height:1;">🏭</span></div></div>',
      className: '',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    var retailIcon = L.divIcon({
      html: '<div class="retail-marker-container"><div class="retail-inner"><span style="color:white; font-size:9px; font-weight:bold; line-height:1;">🏪</span></div></div>',
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    // Static Locations
    L.marker([44.6784, -63.5857], { icon: dcIcon })
      .bindTooltip('🏭 <b>Dartmouth Distribution Center</b><br><span style="font-size:10px;color:#ccc;">Main Logistics Hub</span>', { className: 'custom-tooltip', direction: 'top' })
      .addTo(map);

    L.marker([44.6534, -63.6012], { icon: retailIcon })
      .bindTooltip('🏪 <b>01065 - Almon (Halifax)</b><br><span style="font-size:10px;color:#ccc;">RONA Retail Store</span>', { className: 'custom-tooltip', direction: 'top' })
      .addTo(map);

    L.marker([44.6865, -63.8710], { icon: retailIcon })
      .bindTooltip('🏪 <b>01075 - Tantallon</b><br><span style="font-size:10px;color:#ccc;">RONA Retail Store</span>', { className: 'custom-tooltip', direction: 'top' })
      .addTo(map);

    L.marker([44.9750, -63.5100], { icon: retailIcon })
      .bindTooltip('🏪 <b>01070 - Elmsdale</b><br><span style="font-size:10px;color:#ccc;">RONA Retail Store</span>', { className: 'custom-tooltip', direction: 'top' })
      .addTo(map);

    // Dynamic Active delivery vehicle marker
    var truckMarker = null;

    var truckIcon = L.divIcon({
      html: '<div class="truck-marker-container"><div class="truck-glow"></div><div class="truck-icon-inner"><span style="color:white; font-size:14px; line-height:1;">🚚</span></div></div>',
      className: '',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    function updateTruck(lat, lng, name, truck, style) {
      if (!lat || !lng) return;

      // Style toggle mapping
      if (style !== currentStyle) {
        if (style === 'a' || style === 'h') {
          map.removeLayer(roadLayer);
          satelliteLayer.addTo(map);
        } else {
          map.removeLayer(satelliteLayer);
          roadLayer.addTo(map);
        }
        currentStyle = style;
      }

      var tooltipContent = '🚛 <b>Primary Active Unit:</b><br/>' + 
                           '<b>👤 ' + name + '</b><br/>' + 
                           '<span style="font-size:10px;color:#ccc;font-weight:bold;">Unit: ' + truck + '</span>';

      if (!truckMarker) {
        truckMarker = L.marker([lat, lng], { icon: truckIcon })
          .addTo(map)
          .bindTooltip(tooltipContent, { className: 'custom-tooltip', direction: 'top', permanent: true, interactive: true });
      } else {
        truckMarker.setLatLng([lat, lng]);
        truckMarker.setTooltipContent(tooltipContent);
      }

      // Fly to truck coordinate beautifully
      map.flyTo([lat, lng], 11.5, { animate: true, duration: 1.2 });
    }

    // Listens to parent container coord updates
    window.addEventListener('message', function(event) {
      var data = event.data;
      if (data && data.type === 'UPDATE_COORDS') {
        updateTruck(data.lat, data.lng, data.driverName, data.truckName, data.style);
      }
    });
  </script>
</body>
</html>`;
  };

  // Handle mock delivery completion signature inside simulator
  const handleSimulatedDeliveryComplete = () => {
    if (!selectedOrderToDeliver) return;
    const order = deliveries.find(d => d.id === selectedOrderToDeliver);
    if (!order || !onAddOrUpdateDelivery) return;

    const updated: DeliveryRecord = {
      ...order,
      status: DeliveryStatus.DELIVERED,
      deliveredAt: new Date().toISOString(),
      customerSignature: `Signed by ${signatureName} (Simulator Verification)`,
      history: [
        ...order.history,
        {
          status: DeliveryStatus.DELIVERED,
          timestamp: new Date().toISOString(),
          location: DESTINATIONS[order.originBranch]?.label || "Target Destination Handover",
          operator: `${simDriver} (${simPhone})`,
          notes: `Delivered and verified via live Mobile GPS tracking. Recipient electronic signature logged: ${signatureName}.`
        }
      ]
    };

    onAddOrUpdateDelivery(updated);
    setSignatureModeActive(false);
    setSelectedOrderToDeliver('');
    alert(`Order ${order.id} has been marked as DELIVERED in the active database!`);
  };

  const bogoStats = activeBranches.map(branch => {
    const branchDeliveries = deliveries.filter(d => d.originBranch === branch.id);
    return {
      ...branch,
      count: branchDeliveries.length,
      delivered: branchDeliveries.filter(d => d.status === DeliveryStatus.DELIVERED).length,
      pending: branchDeliveries.filter(d => d.status === DeliveryStatus.REGISTERED || d.status === DeliveryStatus.PICKED_AND_LOADED).length
    };
  });

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

      {/* Dynamic Tracker Controls: Driver Dropdown + Map Style */}
      <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 p-5 rounded-2xl shadow-xl text-white mb-6 border border-blue-900/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 transform translate-x-12 -translate-y-12 opacity-5 pointer-events-none">
          <TruckIcon className="w-96 h-96" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight">Active Fleet GPS Command Station</h3>
            <p className="text-xs text-indigo-200">Select any active flatbed or heavy crane boom truck to view real-time location via Bing Maps</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2 bg-slate-950/60 p-1.5 rounded-xl border border-indigo-500/30">
              <span className="text-[10px] uppercase font-mono font-bold text-indigo-300 px-2">Driver Unit:</span>
              <select
                id="driver-select-control"
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold cursor-pointer max-w-xs"
              >
                {DRIVERS.map(drv => (
                  <option key={drv.id} value={drv.id}>
                    👤 {drv.name} — {drv.truck} ({drv.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center bg-slate-950/60 p-1 rounded-xl border border-indigo-500/30">
              <span className="text-[10px] uppercase font-mono font-bold text-indigo-300 px-2 shrink-0">Map Style:</span>
              <div className="flex bg-slate-900 p-0.5 rounded-lg">
                {[
                  { key: 'r', label: 'Road View' },
                  { key: 'a', label: 'Satellite' },
                  { key: 'h', label: 'Hybrid' }
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setMapStyle(opt.key as any)}
                    className={`px-2.5 py-1 text-[10px] rounded-md font-medium transition-all ${
                      mapStyle === opt.key 
                        ? 'bg-blue-600 text-white font-semibold' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Map + Branch Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Interactive GIS Fleet Mapping Container */}
        <div className="bg-white border border-gray-100 p-5 rounded-xl shadow-sm lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-sans font-semibold text-gray-900 tracking-tight text-lg">RONA Logistics Hub Map</h4>
                <p className="text-xs text-gray-500">Live interactive fleet mapping & route monitoring</p>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="bg-blue-100 text-blue-800 text-[10px] uppercase font-mono px-2 py-0.5 rounded-full">
                  Interactive GIS Mode
                </span>
                {realGpsActive && (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] uppercase font-mono px-2 py-0.5 rounded-full animate-pulse font-bold flex items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-ping"></span>
                    Live Device Coordinates
                  </span>
                )}
              </div>
            </div>
            
            {/* High-Fidelity Custom Leaflet GIS Map Viewer */}
            <div ref={mapContainerRef} className="relative border border-slate-250/80 rounded-xl bg-slate-100 h-[385px] w-full overflow-hidden shadow-sm flex items-center justify-center">
              <iframe 
                ref={iframeRef}
                id="rona-gis-map-iframe"
                title="RONA Logistics High-Fidelity Map"
                width="100%" 
                height="100%" 
                frameBorder="0" 
                srcDoc={getLeafletMapHtml()}
                onLoad={handleIframeLoad}
                scrolling="no"
                className="w-full h-full border-0 absolute inset-0 rounded-xl"
              />
              
              {/* Floating Real GPS Info Dashboard Widget */}
              <div className="absolute top-2 left-2 p-3 bg-slate-900/90 [backdrop-filter:blur(4px)] border border-slate-700/50 rounded-xl space-y-1 shadow-lg max-w-xs text-white select-none z-10 animate-fade-in text-[10.5px]">
                <div className="flex items-center justify-between border-b border-slate-700/50 pb-1">
                  <div className="flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    <span className="font-sans font-bold text-[8.5px] uppercase tracking-wide text-amber-400">Current Unit Telemetry</span>
                  </div>
                  <span className="text-[7.5px] text-slate-400 font-mono">
                    {realGpsActive ? `Acc: ±${realGpsMeta?.accuracy ? realGpsMeta.accuracy.toFixed(1) : '8'}m` : 'Preset Coords'}
                  </span>
                </div>
                
                <div className="space-y-0.5 font-mono select-text">
                  <p className="flex items-center justify-between">
                    <span className="text-slate-400 text-[8.5px]">Driver:</span>
                    <span className="font-bold text-white text-right">{activeDriver.name}</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="text-slate-400 text-[8.5px]">Latitude:</span>
                    <span className="font-bold text-amber-300">{currentLat.toFixed(6)}° N</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="text-slate-400 text-[8.5px]">Longitude:</span>
                    <span className="font-bold text-amber-300">{currentLng.toFixed(6)}° W</span>
                  </p>
                </div>
                
                <div className="text-[9.5px] font-sans border-t border-slate-700/50 pt-1 space-y-0.5 leading-tight text-slate-350">
                  {(() => {
                    const distances = [
                      { name: "Windmill Rd DC", dist: getDistanceFromLatLonInKm(currentLat, currentLng, 44.6784, -63.5857) },
                      { name: "Almon RONA", dist: getDistanceFromLatLonInKm(currentLat, currentLng, 44.6534, -63.6012) },
                      { name: "Tantallon RONA", dist: getDistanceFromLatLonInKm(currentLat, currentLng, 44.6865, -63.8710) },
                      { name: "Elmsdale RONA", dist: getDistanceFromLatLonInKm(currentLat, currentLng, 44.9750, -63.5100) }
                    ];
                    distances.sort((a, b) => a.dist - b.dist);
                    const closest = distances[0];
                    return (
                      <>
                        <p className="flex items-center justify-between">
                          <span>🛰️ Nearest Hub:</span>
                          <span className="font-bold text-white max-w-[120px] truncate block text-right">{closest.name}</span>
                        </p>
                        <p className="flex items-center justify-between">
                          <span>📏 Distance:</span>
                          <span className="font-bold font-mono text-amber-300">{closest.dist.toFixed(2)} km</span>
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Map Legend */}
              <div className="absolute bottom-2 left-2 bg-slate-900/90 [backdrop-filter:blur(4px)] border border-slate-700/50 px-2 py-1.5 rounded-lg text-[9px] space-y-1 shadow-md text-white">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse"></span>
                  <span className="font-sans font-medium text-slate-250 text-amber-305">Selected Driver: 🚚 Pulsating Truck Icon</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-600 inline-block"></span>
                  <span className="font-sans text-slate-355">Central DC Hub (🏭 Red Circle)</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
                  <span className="font-sans text-slate-355">Local Stores (🏪 Blue Circle)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-gray-500 pb-1">
            <span className="flex items-center"><MapPin className="h-3 w-3 mr-1 text-red-500" /> Active Fleet Coordinates Area: Dartmouth, Halifax Regional Municipality</span>
            <button 
              id="workflow-simulate-btn"
              onClick={() => onSelectTab('scanner')} 
              className="text-blue-600 hover:underline font-semibold text-xs flex items-center"
            >
              Go to Scan Verification Workflow &rarr;
            </button>
          </div>
        </div>

        {/* Branch Delivery breakdown & Live Mobile GPS Simulator */}
        <div className="bg-white border border-gray-100 p-5 rounded-xl shadow-sm lg:col-span-5 flex flex-col justify-between">
          <div>
            {/* Tab Header Selector */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 mb-4">
              <div className="flex space-x-2">
                <button 
                  onClick={() => setActiveRightSubTab('capacity')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${activeRightSubTab === 'capacity' ? 'bg-slate-100 text-slate-850' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  🏫 Hub Capacity
                </button>
                <button 
                  onClick={() => setActiveRightSubTab('gps')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1 ${activeRightSubTab === 'gps' ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700 font-medium'}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>📱 Live Driver Device</span>
                </button>
              </div>
            </div>

            {activeRightSubTab === 'capacity' ? (
              <div>
                <h4 className="font-sans font-semibold text-gray-900 tracking-tight text-lg mb-1">Branch Locations Capacity</h4>
                <p className="text-xs text-gray-500 mb-4">Breakdown of orders processed per store & delivery hub</p>
                
                <div className="space-y-3.5">
                  {bogoStats.map(branch => {
                    const percentage = total > 0 ? (branch.count / total) * 100 : 0;
                    return (
                      <div key={branch.id} className="p-2 border border-slate-50 hover:bg-slate-50 rounded-lg transition-colors">
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
              </div>
            ) : (
              <div className="space-y-4">
                {/* Visual iPhone Frame */}
                <div className="relative border-4 border-slate-800 rounded-[32px] bg-slate-950 p-4 shadow-xl overflow-hidden font-sans border-t-[8px]">
                  {/* Dynamic Island Notch */}
                  <div className="absolute top-1 left-12 right-12 h-4 bg-slate-800 rounded-full mx-auto z-20 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 bg-slate-900 rounded-full mr-2"></span>
                    <span className="w-1 h-1 bg-blue-950 rounded-full"></span>
                  </div>

                  {/* Device Status Bar */}
                  <div className="flex justify-between items-center text-[8.5px] text-slate-400 font-mono mb-2 px-2 pt-1 border-b border-slate-900 pb-1">
                    <div className="font-bold flex items-center space-x-1">
                      <span>12:26</span>
                      <span className="text-[7px] text-blue-400">RONA Guest</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Wifi className="h-2.5 w-2.5 text-slate-400" />
                      <Signal className="h-2.5 w-2.5 text-emerald-400" />
                      <span className="font-bold text-[8px]">5G</span>
                      <div className="w-4 h-2 border border-slate-400 rounded-sm p-0.25 flex items-center">
                        <div className="bg-slate-350 h-full w-[85%] rounded-[0.5px]"></div>
                      </div>
                    </div>
                  </div>

                  {/* Simulator Screen Body */}
                  <div className="bg-slate-900 text-white rounded-2xl p-3.5 space-y-3.5 text-xs border border-slate-800">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center space-x-1">
                        <Smartphone className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
                        <span className="font-bold text-[10.5px] tracking-wide text-gray-100">GPS Tracker Active</span>
                      </div>
                      <span className="bg-emerald-500/20 text-emerald-400 font-mono text-[7px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
                        ONLINE
                      </span>
                    </div>

                    {/* Verified Link Info */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase tracking-wider text-slate-400 font-mono block">Registered Device Operator</label>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                          <span className="text-slate-500 block text-[7.5px] uppercase font-mono">Mobile Line</span>
                          <input 
                            type="text" 
                            value={simPhone} 
                            disabled
                            className="bg-transparent text-emerald-400 font-bold font-mono focus:outline-none w-full p-0 text-xs opacity-80"
                          />
                        </div>
                        <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                          <span className="text-slate-500 block text-[7.5px] uppercase font-mono">Driver Identity</span>
                          <input 
                            type="text" 
                            value={simDriver} 
                            disabled
                            className="bg-transparent text-white font-semibold focus:outline-none w-full p-0 text-xs opacity-80"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Driver Selector inside iPhone */}
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-wider text-slate-400 font-mono block">Switch Mobile Driver View</label>
                      <select 
                        value={selectedDriverId}
                        onChange={(e) => setSelectedDriverId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-amber-400 font-semibold focus:outline-none"
                      >
                        {DRIVERS.map(drv => (
                          <option key={drv.id} value={drv.id}>{drv.name} - {drv.truck.split(' ')[0]}</option>
                        ))}
                      </select>
                    </div>

                    {/* Geolocation Streaming Section */}
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] uppercase text-slate-400 font-mono font-bold flex items-center">
                          <Compass className="h-3 w-3 text-teal-400 mr-1 animate-spin" style={{ animationDuration: '6s' }} /> GPS Telemetry
                        </span>
                        {realGpsActive && (
                          <span className="text-[8px] text-emerald-400 flex items-center font-mono animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-ping"></span>
                            Live Streaming
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
                        <div className="bg-slate-900 py-1 px-1.5 rounded border border-slate-850">
                          <span className="text-[7.5px] text-slate-500 block uppercase">Latitude</span>
                          <span className="font-bold text-gray-250 text-gray-255">
                            {currentLat.toFixed(5)}
                          </span>
                        </div>
                        <div className="bg-slate-900 py-1 px-1.5 rounded border border-slate-850">
                          <span className="text-[7.5px] text-slate-500 block uppercase">Longitude</span>
                          <span className="font-bold text-gray-250 text-gray-255">
                            {currentLng.toFixed(5)}
                          </span>
                        </div>
                      </div>

                      {realGpsError && (
                        <p className="text-[9px] text-red-400 leading-normal flex items-start">
                          <AlertCircle className="h-3 w-3 text-red-400 mr-1 mt-0.5 shrink-0" />
                          <span>{realGpsError}</span>
                        </p>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={toggleRealGps}
                          className={`flex-1 py-1 px-2.5 text-[10px] font-bold rounded-lg flex items-center justify-center space-x-1 border transition-all ${
                            realGpsActive 
                              ? 'bg-red-950 text-red-300 border-red-800 hover:bg-red-900' 
                              : 'bg-slate-900 text-teal-400 border-teal-500/30 hover:border-teal-500 hover:bg-slate-850'
                          }`}
                        >
                          <Navigation className={`h-3 w-3 ${realGpsActive ? 'animate-bounce' : ''}`} />
                          <span>{realGpsActive ? '🛑 Stop Device GPS' : '🎯 Use Real iPhone GPS'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Driver Mobile Sign-off Module */}
                    <div className="bg-blue-950/40 p-2.5 rounded-xl border border-blue-900/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9.5px] uppercase text-blue-300 font-mono font-bold flex items-center">
                          <CheckSquare className="h-3.5 w-3.5 mr-1 text-blue-400" /> Driver Mobile Handover
                        </span>
                      </div>
                      
                      {signatureModeActive ? (
                        <div className="space-y-2">
                          <div className="bg-slate-950 p-2 rounded-lg border border-blue-900 space-y-1.5">
                            <label className="text-[8.5px] text-blue-300 uppercase font-mono block">Recipient Sign-off signature</label>
                            <input 
                              type="text" 
                              value={signatureName} 
                              onChange={(e) => setSignatureName(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[11px] text-yellow-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Name of Receiver"
                            />
                            
                            {/* Signature canvas simulation */}
                            <div className="bg-slate-900 aspect-[3/1] border border-dashed border-slate-800 rounded flex items-center justify-center relative cursor-crosshair overflow-hidden">
                              <span className="text-slate-600 text-[9px] font-mono select-none">Draw/Verified Sign-off Box</span>
                              <div className="absolute left-2 top-2 text-slate-500 font-serif text-[18px] italic select-none">
                                {signatureName || "Sign name"}
                              </div>
                              {/* Signature line simulation overlay */}
                              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                                <path d="M 15,35 Q 40,15 80,35 T 160,25 T 220,38" fill="transparent" stroke="#eab308" strokeWidth="1.5" strokeDasharray="3 3"/>
                              </svg>
                            </div>
                          </div>

                          <div className="flex gap-1.5">
                            <button
                              onClick={() => setSignatureModeActive(false)}
                              className="flex-1 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded font-bold text-slate-400 text-[10px]"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSimulatedDeliveryComplete}
                              className="flex-[2] py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded font-bold shadow-md text-[10px] flex items-center justify-center space-x-1"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Confirm Delivered</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[10px] text-slate-300 leading-normal">
                            Deliveries that are loaded or in transit can be signed off directly in mobile driver view.
                          </p>
                          
                          <div>
                            <select
                              value={selectedOrderToDeliver}
                              onChange={(e) => {
                                setSelectedOrderToDeliver(e.target.value);
                                setSignatureModeActive(true);
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-[11px] text-amber-400 focus:outline-none font-mono font-bold"
                            >
                              <option value="">-- Tap to Sign Off Pending Lift --</option>
                              {deliveries.filter(d => d.status !== DeliveryStatus.DELIVERED).map(d => (
                                <option key={d.id} value={d.id}>
                                  📋 {d.id} ({d.customerName}) — {d.status}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>

                </div>

                <div className="text-[10px] text-gray-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 leading-relaxed space-y-1">
                  <p className="font-bold text-gray-700">💡 How Mobile GPS Tracking Works:</p>
                  <p>
                    1. RONA drivers load materials onto flatbed trucks and launch this Logistics Web Portal on their device.
                  </p>
                  <p>
                    2. Once they permit <strong>"🎯 Use Real iPhone GPS"</strong>, the application hooks their real-world GPS sensor.
                  </p>
                  <p>
                    3. Live updates are pushed into the HQ Dashboard Map in real-time. Try it with your phone!
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">Connected ERP: Epicor - Eagle</span>
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs text-slate-500 font-medium">Tracking API: Connected</span>
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
                        {activeBranches.find(b => b.id === delivery.originBranch)?.name.replace('RONA ', '') || delivery.originBranch}
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
