import React, { useState } from 'react';
import { Truck, Branch } from '../types';
import { 
  Compass, Plus, Radio, Server, Wifi, Cpu, Settings2, Trash2, 
  MapPin, Activity, CheckCircle2, ShieldAlert, Navigation2, Check
} from 'lucide-react';

interface GpsSetupProps {
  trucks: Truck[];
  branches: Branch[];
  onUpdateTruck: (truck: Truck) => void;
}

export default function GpsSetup({ trucks, branches, onUpdateTruck }: GpsSetupProps) {
  // Input states for building a GPS connection record
  const [selectedTruckId, setSelectedTruckId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('Samsara VG54 Core Gateway');
  const [simIccid, setSimIccid] = useState('Bell Mobility Business IoT');
  const [initialLat, setInitialLat] = useState('44.6488');
  const [initialLng, setInitialLng] = useState('-63.5752');
  
  // Status feedback states
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter trucks that do NOT have a stationary GPS configured yet
  const unconfiguredTrucks = trucks.filter(t => !t.gpsDeviceId);

  // Common pre-configured devices for easy setup
  const DEVICE_MODELS = [
    'Samsara VG54 Core Gateway',
    'Geotab GO9 Telematics',
    'CalAmp LMU-3030 OBD-II',
    'Garmin Fleet 790 Android Pro',
    'Sierra Wireless RV50X LTE'
  ];

  // Common SIM carrier plans
  const CARRIER_PLANS = [
    'Bell Mobility Business IoT',
    'Rogers Communications Enterprise LTE',
    'Telus IoT Secure Fleet Plan',
    'AT&T Mobility Global IoT (Roaming)',
    'T-Mobile US LTE Fleet Custom'
  ];

  // Location quick presets
  const LOCATION_PRESETS = [
    { name: 'Halifax Harbor HQ Depot', lat: '44.6488', lng: '-63.5752' },
    { name: 'Dartmouth Windmill Road DC', lat: '44.6835', lng: '-63.6015' },
    { name: 'Tantallon Store Footprint', lat: '44.6842', lng: '-63.8823' },
    { name: 'Bedford Highway Corridor', lat: '44.7214', lng: '-63.6652' },
    { name: 'Sackville Terminal Depo', lat: '44.7642', lng: '-63.6823' }
  ];

  const handleBuildConnection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTruckId) {
      setErrorMsg('Please select a vehicle from the registered fleet.');
      return;
    }
    if (!deviceId.trim()) {
      setErrorMsg('Please enter a stationary GPS Hardware Serial / Device ID.');
      return;
    }

    const targetTruck = trucks.find(t => t.id === selectedTruckId);
    if (!targetTruck) return;

    const latVal = parseFloat(initialLat);
    const lngVal = parseFloat(initialLng);

    const updatedTruck: Truck = {
      ...targetTruck,
      gpsSource: 'truck', // Auto-switch to newly configured truck GPS
      gpsDeviceId: deviceId.trim(),
      gpsDeviceName: deviceName,
      gpsSimIccid: simIccid,
      gpsStatus: 'Connected',
      gpsLastHandshake: new Date().toISOString(),
      gpsLat: !isNaN(latVal) ? latVal : 44.6488,
      gpsLng: !isNaN(lngVal) ? lngVal : -63.5752
    };

    onUpdateTruck(updatedTruck);
    
    // Reset Form
    setSelectedTruckId('');
    setDeviceId('');
    setErrorMsg(null);
    setSuccessMsg(`Stationary GPS Hardware [${deviceId.trim()}] successfully paired with ${targetTruck.name}! Truck default tracking source set to 'Stationary Truck GPS'.`);
    
    setTimeout(() => {
      setSuccessMsg(null);
    }, 5000);
  };

  const handleToggleGpsSource = (truck: Truck, source: 'mobile' | 'truck') => {
    const updated: Truck = {
      ...truck,
      gpsSource: source,
      gpsLastHandshake: new Date().toISOString()
    };
    onUpdateTruck(updated);
  };

  const handleRemoveConnection = (truck: Truck) => {
    if (window.confirm(`Are you sure you want to decouple the stationary GPS unit from ${truck.name}? This will revert tracking back to Driver Mobile GPS.`)) {
      const updated: Truck = {
        ...truck,
        gpsSource: 'mobile',
        gpsDeviceId: '',
        gpsDeviceName: '',
        gpsSimIccid: '',
        gpsStatus: 'Disconnected',
        gpsLastHandshake: '',
        gpsLat: undefined,
        gpsLng: undefined
      };
      onUpdateTruck(updated);
    }
  };

  const handleSimulatePing = (truck: Truck, latStr: string, lngStr: string) => {
    const latVal = parseFloat(latStr);
    const lngVal = parseFloat(lngStr);
    if (isNaN(latVal) || isNaN(lngVal)) {
      alert('Please enter valid numeric latitude and longitude values.');
      return;
    }

    const updated: Truck = {
      ...truck,
      gpsLat: latVal,
      gpsLng: lngVal,
      gpsStatus: 'Connected',
      gpsLastHandshake: new Date().toISOString()
    };
    onUpdateTruck(updated);
  };

  return (
    <div className="space-y-6 animate-fade-in" id="gps-setup-view">
      
      {/* Tab Header */}
      <div>
        <h4 className="font-sans font-bold text-gray-900 tracking-tight text-xl">Truck Hardware GPS Integration</h4>
        <p className="text-xs text-gray-500">
          Provision stationary IoT telematics gateways, configure SIM card network connectivity, and choose live telemetry sources.
        </p>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-semibold flex items-start space-x-2 animate-pulse">
          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs font-semibold flex items-start space-x-2">
          <ShieldAlert className="h-4.5 w-4.5 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left hand side: GPS Connection Builder Form */}
        <div className="lg:col-span-5 bg-white border border-slate-100 p-5 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-50">
            <Settings2 className="h-4 w-4 text-blue-600 animate-spin" style={{ animationDuration: '4s' }} />
            <h5 className="text-sm font-bold text-gray-900">Configure IoT GPS Connection</h5>
          </div>

          <form onSubmit={handleBuildConnection} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Select Fleet Truck</label>
              <select
                required
                value={selectedTruckId}
                onChange={(e) => {
                  setSelectedTruckId(e.target.value);
                  // Auto fill initial lat/lng from associated branch coordinates if possible
                  const matched = trucks.find(t => t.id === e.target.value);
                  if (matched) {
                    const branch = branches.find(b => b.id === matched.branchId);
                    if (branch) {
                      const latMatch = (branch.address || '').match(/\|\|lat:\s*(-?\d+(?:\.\d+)?)/i);
                      const lngMatch = (branch.address || '').match(/\|\|lng:\s*(-?\d+(?:\.\d+)?)/i);
                      if (latMatch && lngMatch) {
                        setInitialLat(latMatch[1]);
                        setInitialLng(lngMatch[1]);
                      }
                    }
                  }
                }}
                className="w-full border bg-white border-slate-200 px-3 py-2 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              >
                <option value="">-- Choose registered Truck --</option>
                {unconfiguredTrucks.map(truck => (
                  <option key={truck.id} value={truck.id}>
                    {truck.name} ({truck.id}) &bull; Driver: {truck.driver}
                  </option>
                ))}
                {unconfiguredTrucks.length === 0 && (
                  <option disabled value="">(All trucks currently have GPS configured)</option>
                )}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Device Hardware ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SAMSARA-VG54-92"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  className="w-full border bg-white border-slate-200 px-3 py-2 rounded-lg text-xs font-mono text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Device Model</label>
                <select
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="w-full border bg-white border-slate-200 px-3 py-2 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                >
                  {DEVICE_MODELS.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">SIM Card / Cellular Carrier</label>
              <select
                value={simIccid}
                onChange={(e) => setSimIccid(e.target.value)}
                className="w-full border bg-white border-slate-200 px-3 py-2 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              >
                {CARRIER_PLANS.map(plan => (
                  <option key={plan} value={plan}>{plan}</option>
                ))}
              </select>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-3">
              <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block font-mono">
                ⚓ Initial Telemetry Deployment Coordinates
              </span>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 block mb-1">Latitude</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 44.6488"
                    value={initialLat}
                    onChange={(e) => setInitialLat(e.target.value)}
                    className="w-full border bg-white border-slate-200 px-3 py-1.5 rounded text-xs font-mono text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 block mb-1">Longitude</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. -63.5752"
                    value={initialLng}
                    onChange={(e) => setInitialLng(e.target.value)}
                    className="w-full border bg-white border-slate-200 px-3 py-1.5 rounded text-xs font-mono text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Location presets */}
              <div className="pt-2 border-t border-slate-200/50">
                <span className="text-[9px] font-semibold text-gray-400 uppercase block mb-1">Anchor Presets</span>
                <div className="flex flex-wrap gap-1.5">
                  {LOCATION_PRESETS.map((preset, i) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setInitialLat(preset.lat);
                        setInitialLng(preset.lng);
                      }}
                      className="text-[9px] px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-gray-600 font-medium rounded-md cursor-pointer transition-colors"
                    >
                      📍 {preset.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center space-x-1.5 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Build Stationary GPS Connection Record</span>
            </button>
          </form>
        </div>

        {/* Right hand side: Configured GPS devices & tracking telemetry */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Table 1: Stationary GPS Hardware Connections */}
          <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm space-y-3">
            <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center">
              <Server className="h-4 w-4 mr-1.5 text-blue-600" />
              Stationary GPS Hardwired Connections Table
            </h5>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold">
                    <th className="px-3 py-2 text-left">Vehicle / Driver</th>
                    <th className="px-3 py-2 text-left">Hardware ID</th>
                    <th className="px-3 py-2 text-left">SIM Profile</th>
                    <th className="px-3 py-2 text-center">Net Status</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {trucks.filter(t => t.gpsDeviceId).map(truck => (
                    <tr key={truck.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2.5 font-sans">
                        <div className="font-semibold text-gray-900">{truck.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">{truck.id} &bull; {truck.driver}</div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 font-semibold">
                        <div>{truck.gpsDeviceId}</div>
                        <div className="text-[9px] text-gray-400 font-sans">{truck.gpsDeviceName}</div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 text-[10px]">
                        {truck.gpsSimIccid}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-mono font-bold text-[9px] rounded-full border border-emerald-200">
                          {truck.gpsStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveConnection(truck)}
                          className="p-1 hover:bg-red-50 text-red-500 hover:text-red-700 border border-slate-100 hover:border-red-100 rounded-md transition-colors cursor-pointer"
                          title="Decouple hardware connection"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {trucks.filter(t => t.gpsDeviceId).length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-400 italic">
                        No stationary GPS connection records built yet. Use the form on the left to provision physical telematics.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Truck tracking & Driver GPS Monitor Telemetry Controller */}
          <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-50 pb-2">
              <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center">
                <Activity className="h-4 w-4 mr-1.5 text-amber-500 animate-pulse" />
                Regional Dispatch & Telemetry tracking Table
              </h5>
              <div className="text-[10px] text-gray-400 font-mono">
                Pinging Satellite Transceivers...
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold">
                    <th className="px-3 py-2 text-left">Truck Details</th>
                    <th className="px-3 py-2 text-center">Live Tracking Mode Choice</th>
                    <th className="px-3 py-2 text-left">Lat / Lng coordinates</th>
                    <th className="px-3 py-2 text-right">Simulator overrides</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {trucks.map(truck => {
                    const isGpsConfigured = !!truck.gpsDeviceId;
                    const isUsingTruckGps = truck.gpsSource === 'truck';
                    const displayLat = isUsingTruckGps ? (truck.gpsLat || 44.6488) : (truck.lat || 'Driver Offline');
                    const displayLng = isUsingTruckGps ? (truck.gpsLng || -63.5752) : (truck.lng || '');

                    return (
                      <tr key={truck.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-3">
                          <div className="font-semibold text-slate-900">{truck.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{truck.driver}</div>
                        </td>
                        
                        <td className="px-3 py-3 text-center">
                          <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleToggleGpsSource(truck, 'mobile')}
                              className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                                !isUsingTruckGps 
                                  ? 'bg-blue-600 text-white shadow-xs' 
                                  : 'text-gray-500 hover:text-gray-900'
                              }`}
                            >
                              Mobile GPS
                            </button>
                            <button
                              type="button"
                              disabled={!isGpsConfigured}
                              onClick={() => handleToggleGpsSource(truck, 'truck')}
                              className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all cursor-pointer flex items-center space-x-0.5 ${
                                isUsingTruckGps 
                                  ? 'bg-amber-500 text-slate-950 shadow-xs' 
                                  : 'text-gray-500 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed'
                              }`}
                              title={!isGpsConfigured ? 'Build a Stationary GPS connection record first' : 'Switch to Stationary Truck GPS'}
                            >
                              <span>Truck GPS</span>
                              {isGpsConfigured && <Check className="h-2.5 w-2.5 ml-0.5" />}
                            </button>
                          </div>
                        </td>

                        <td className="px-3 py-3 font-mono text-[10.5px]">
                          {typeof displayLat === 'number' ? (
                            <div className="text-slate-800 font-semibold space-y-0.5">
                              <div>📍 Lat: {displayLat.toFixed(5)}</div>
                              <div>📍 Lng: {(displayLng as number).toFixed(5)}</div>
                              <div className="text-[9.5px] text-gray-400 font-sans font-medium flex items-center">
                                <span className={`h-1.5 w-1.5 rounded-full mr-1 ${isUsingTruckGps ? 'bg-amber-400 animate-ping' : 'bg-blue-400'}`} />
                                {isUsingTruckGps ? 'Hardware Transceiver' : 'Mobile Geolocation'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic font-sans">{displayLat}</span>
                          )}
                        </td>

                        <td className="px-3 py-3 text-right">
                          {isGpsConfigured && isUsingTruckGps ? (
                            <div className="space-y-1.5 max-w-[150px] ml-auto">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Simulate Ping coords</span>
                              <div className="flex gap-1">
                                <input
                                  type="text"
                                  placeholder="Lat"
                                  defaultValue={truck.gpsLat || 44.6488}
                                  onBlur={(e) => handleSimulatePing(truck, e.target.value, String(truck.gpsLng || -63.5752))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleSimulatePing(truck, (e.target as HTMLInputElement).value, String(truck.gpsLng || -63.5752));
                                    }
                                  }}
                                  className="w-full text-[10px] font-mono border border-slate-200 px-1.5 py-0.5 rounded text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <input
                                  type="text"
                                  placeholder="Lng"
                                  defaultValue={truck.gpsLng || -63.5752}
                                  onBlur={(e) => handleSimulatePing(truck, String(truck.gpsLat || 44.6488), e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleSimulatePing(truck, String(truck.gpsLat || 44.6488), (e.target as HTMLInputElement).value);
                                    }
                                  }}
                                  className="w-full text-[10px] font-mono border border-slate-200 px-1.5 py-0.5 rounded text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                              <div className="flex justify-end gap-1 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleSimulatePing(truck, '44.6835', '-63.6015')}
                                  className="text-[8px] bg-slate-100 hover:bg-slate-200 px-1 py-0.25 text-slate-600 rounded font-semibold cursor-pointer"
                                >
                                  Windmill DC
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSimulatePing(truck, '44.6488', '-63.5752')}
                                  className="text-[8px] bg-slate-100 hover:bg-slate-200 px-1 py-0.25 text-slate-600 rounded font-semibold cursor-pointer"
                                >
                                  Halifax HQ
                                </button>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">Configure / Select Truck GPS to override</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
