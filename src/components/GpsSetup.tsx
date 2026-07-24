import React, { useState } from 'react';
import { Truck, Branch } from '../types';
import { 
  Compass, Plus, Radio, Server, Wifi, Cpu, Settings2, Trash2, Edit2,
  MapPin, Activity, CheckCircle2, ShieldAlert, Navigation2, Check,
  Key, RefreshCw, Lock, User
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
  const [serialNumber, setSerialNumber] = useState('');
  const [deviceName, setDeviceName] = useState('Samsara VG54 Core Gateway');
  const [simIccid, setSimIccid] = useState('Bell Mobility Business IoT');
  
  // Status feedback states
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fleet Complete Live API States
  const [telematicsStatus, setTelematicsStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [updatingCredentials, setUpdatingCredentials] = useState(false);
  
  // Form inputs for Fleet Complete update
  const [configMode, setConfigMode] = useState<'apikey' | 'token'>('apikey');
  const [fcApiKey, setFcApiKey] = useState('');
  const [fcClientId, setFcClientId] = useState('');
  const [fcClientSecret, setFcClientSecret] = useState('');
  const [fcApiUrl, setFcApiUrl] = useState('https://api.fleetcomplete.com/login/token');
  
  
  
  // Feedback specific to Fleet Complete panel
  const [fcSuccessMsg, setFcSuccessMsg] = useState<string | null>(null);
  const [fcErrorMsg, setFcErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    fetchTelematicsStatus();
  }, []);

  const fetchTelematicsStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/telematics/status');
      if (res.ok) {
        const data = await res.json();
        setTelematicsStatus(data);
        if (data.activeConfigMode) {
          if (data.activeConfigMode.toLowerCase().includes('token')) {
            setConfigMode('token');
          } else {
            setConfigMode('apikey');
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch telematics status', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingCredentials(true);
    setFcSuccessMsg(null);
    setFcErrorMsg(null);
    
    const body: any = {
      connection_type: configMode,
      api_url: fcApiUrl
    };
    if (configMode === 'apikey') {
      if (!fcApiKey.trim()) {
        setFcErrorMsg('Please enter a valid API Key / Bearer Token.');
        setUpdatingCredentials(false);
        return;
      }
      body.api_key = fcApiKey.trim();
    } else {
      if (!fcClientId.trim() || !fcClientSecret.trim()) {
        setFcErrorMsg('Please enter both Client ID / Username and Client Secret / Password.');
        setUpdatingCredentials(false);
        return;
      }
      body.client_id = fcClientId.trim();
      body.client_secret = fcClientSecret.trim();
    }

    try {
      const res = await fetch('/api/telematics/update-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        setFcSuccessMsg(data.message || 'Successfully connected!');
        setFcApiKey('');
        setFcClientId('');
        setFcClientSecret('');
        // Refresh status
        await fetchTelematicsStatus();
      } else {
        setFcErrorMsg(data.message || 'Failed to connect. Please verify your credentials.');
      }
    } catch (err: any) {
      setFcErrorMsg(`Network error: ${err.message || err}`);
    } finally {
      setUpdatingCredentials(false);
    }
  };

  // Filter trucks that do NOT have a stationary GPS configured yet, OR are currently selected for editing
  const unconfiguredTrucks = trucks.filter(t => !t.gpsDeviceId || t.id === selectedTruckId);

  // Common pre-configured devices for easy setup
  const DEVICE_MODELS = [
    'Samsara VG54 Core Gateway',
    'Geotab GO9 Telematics',
    'CalAmp LMU-3030 OBD-II',
    'Garmin Fleet 790 Android Pro',
    'Sierra Wireless RV50X LTE',
    'Fleet Complete MGS800 OBD-II',
    'Fleet Complete FT1 Telematics'
  ];

  // Common SIM carrier plans
  const CARRIER_PLANS = [
    'Bell Mobility Business IoT',
    'Rogers Communications Enterprise LTE',
    'Telus IoT Secure Fleet Plan',
    'AT&T Mobility Global IoT (Roaming)',
    'T-Mobile US LTE Fleet Custom'
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

    const updatedTruck: Truck = {
      ...targetTruck,
      gpsSource: 'truck', // Auto-switch to newly configured truck GPS
      gpsDeviceId: deviceId.trim(),
      gpsSerialNumber: serialNumber.trim(),
      gpsDeviceName: deviceName,
      gpsSimIccid: simIccid,
      gpsStatus: 'Connected',
      gpsLastHandshake: new Date().toISOString(),
      // We will now rely on live tracking components instead of initial setup coords
      gpsLat: 44.6488,
      gpsLng: -63.5752
    };

    onUpdateTruck(updatedTruck);
    
    // Reset Form
    setSelectedTruckId('');
    setDeviceId('');
    setSerialNumber('');
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

  const handleEditConnection = (truck: Truck) => {
    setSelectedTruckId(truck.id);
    setDeviceId(truck.gpsDeviceId || '');
    setSerialNumber(truck.gpsSerialNumber || '');
    setDeviceName(truck.gpsDeviceName || 'Samsara VG54 Core Gateway');
    setSimIccid(truck.gpsSimIccid || 'Bell Mobility Business IoT');
    
    // Smooth scroll to top for editing
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

      {/* Fleet Complete Telematics Cloud Sync Card */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
              <Radio className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h5 className="text-sm font-bold text-gray-900 flex items-center">
                <span>Fleet Complete API Gateway Connection</span>
              </h5>
              <p className="text-[11px] text-gray-500">Manage live hardware telematics, update bearer tokens, or input system credentials.</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            {loadingStatus ? (
              <span className="text-xs text-gray-400 flex items-center space-x-1 font-mono">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>Checking gateway...</span>
              </span>
            ) : telematicsStatus?.configured ? (
              <div className="flex items-center space-x-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider rounded-full font-mono">
                  Active Sync ({telematicsStatus.activeConfigMode})
                </span>
                {telematicsStatus.cachedFleetId && (
                  <span className="px-2 py-1 bg-slate-200 text-slate-700 text-[9px] font-bold rounded font-mono">
                    FID: {telematicsStatus.cachedFleetId}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                <span className="px-2.5 py-1 bg-amber-50 border border-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider rounded-full font-mono">
                  Offline / Unconfigured
                </span>
              </div>
            )}
            <button
              onClick={fetchTelematicsStatus}
              type="button"
              className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
              title="Refresh connection status"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {fcSuccessMsg && (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-3 rounded-xl text-xs font-semibold flex items-start space-x-2 animate-fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Connection Verified Successfully!</p>
              <p className="text-[11px] font-medium opacity-90">{fcSuccessMsg}</p>
            </div>
          </div>
        )}

        {fcErrorMsg && (
          <div className="bg-rose-50 border border-rose-100 text-rose-800 p-3 rounded-xl text-xs font-semibold flex items-start space-x-2 animate-fade-in">
            <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Credential Authentication Failed</p>
              <p className="text-[11px] font-medium opacity-90">{fcErrorMsg}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleUpdateCredentials} className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-start gap-4 bg-white p-4 border border-slate-200 rounded-xl">
            <div className="w-full md:w-1/4 space-y-1">
              <label className="text-xs font-bold text-gray-700 block">Authentication Method</label>
              <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setConfigMode('apikey')}
                  className={`py-1 text-[10px] font-bold rounded-md transition-all ${
                    configMode === 'apikey'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  API Key
                </button>
                <button
                  type="button"
                  onClick={() => setConfigMode('token')}
                  className={`py-1 text-[10px] font-bold rounded-md transition-all ${
                    configMode === 'token'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Token
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">API URL</label>
                <input
                  type="text"
                  placeholder="https://api.fleetcomplete.com/login/token"
                  value={fcApiUrl}
                  onChange={(e) => setFcApiUrl(e.target.value)}
                  className="w-full border bg-white border-slate-200 px-3 py-1.5 rounded-lg text-xs font-mono text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
                />
              </div>

              {configMode === 'apikey' ? (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 flex items-center">
                    <Key className="h-3 w-3 mr-1 text-slate-500" />
                    API Key (Bearer Token)
                  </label>
                  <input
                    type="password"
                    placeholder="Paste your FLEET_COMPLETE_API_KEY token here..."
                    value={fcApiKey}
                    onChange={(e) => setFcApiKey(e.target.value)}
                    className="w-full border bg-white border-slate-200 px-3 py-1.5 rounded-lg text-xs font-mono text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 flex items-center">
                      <User className="h-3 w-3 mr-1 text-slate-500" />
                      Client ID / Username
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. tracking@prospaces.ca"
                      value={fcClientId}
                      onChange={(e) => setFcClientId(e.target.value)}
                      className="w-full border bg-white border-slate-200 px-3 py-1.5 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-400 font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 flex items-center">
                      <Lock className="h-3 w-3 mr-1 text-slate-500" />
                      Client Secret / Password
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={fcClientSecret}
                      onChange={(e) => setFcClientSecret(e.target.value)}
                      className="w-full border bg-white border-slate-200 px-3 py-1.5 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-400 font-medium"
                    />
                  </div>
                </div>
              )}
              
              {telematicsStatus?.tokenExpiresInMin > 0 && configMode === 'token' && (
                <div className="text-[10px] text-gray-500 font-mono">
                  Current Token Expires In: {telematicsStatus.tokenExpiresInMin} mins 
                  <span className="text-emerald-600 font-bold ml-1">(Auto-renews before expiry)</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={updatingCredentials}
              className="w-full md:w-auto mt-6 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer disabled:opacity-60"
            >
              {updatingCredentials ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Key className="h-3.5 w-3.5" />
                  <span>Update Settings</span>
                </>
              )}
            </button>
          </div>
          <p className="text-[10px] text-slate-500 italic mt-1 font-mono">
            &bull; Database-backed secure storage. Tokens are encrypted at rest and automatically renewed by the background Connection Service.
          </p>
        </form>
      </div>

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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">GPS Serial Number</label>
                <input
                  type="text"
                  placeholder="e.g. SN-12345678"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="w-full border bg-white border-slate-200 px-3 py-2 rounded-lg text-xs font-mono text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
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
                        {truck.gpsSerialNumber && <div className="text-[10px] text-gray-500 font-mono mt-0.5">SN: {truck.gpsSerialNumber}</div>}
                        <div className="text-[9px] text-gray-400 font-sans mt-0.5">{truck.gpsDeviceName}</div>
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
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => handleEditConnection(truck)}
                            className="p-1 hover:bg-blue-50 text-blue-500 hover:text-blue-700 border border-slate-100 hover:border-blue-100 rounded-md transition-colors cursor-pointer"
                            title="Edit hardware connection"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveConnection(truck)}
                            className="p-1 hover:bg-red-50 text-red-500 hover:text-red-700 border border-slate-100 hover:border-red-100 rounded-md transition-colors cursor-pointer"
                            title="Decouple hardware connection"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
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
