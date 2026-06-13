/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { DeliveryRecord, Truck, Branch, User, Tenant } from './types';
import { 
  INITIAL_DELIVERIES, TRUCKS, BRANCHES, INITIAL_USERS, TENANTS,
  BRANCHES_BOF, TRUCKS_BOF, INITIAL_USERS_BOF, INITIAL_DELIVERIES_BOF,
  BRANCHES_CTC, TRUCKS_CTC, INITIAL_USERS_CTC, INITIAL_DELIVERIES_CTC
} from './data';
import Dashboard from './components/Dashboard';
import ScanStation from './components/ScanStation';
import DeliveryQueue from './components/DeliveryQueue';
import ArchitectureView from './components/ArchitectureView';
import FleetSetup from './components/FleetSetup';
import StoresSetup from './components/StoresSetup';
import UsersSetup from './components/UsersSetup';
import LoginScreen from './components/LoginScreen';
import { 
  LayoutDashboard, Scan, ClipboardList, Layers3, Store, Shield, Users, 
  ChevronDown, Trash2, Truck as TruckIcon, LogOut, Landmark, UserCheck,
  Database, RefreshCw
} from 'lucide-react';

const getThemeClasses = (color: string) => {
  // Always return the classic corporate blue styling to match previous design
  return {
    bg: 'bg-blue-800',
    hoverBg: 'hover:bg-blue-900',
    activeBtn: 'bg-blue-800 text-white shadow-sm',
    bannerBg: 'bg-blue-900/60 border-blue-950',
    text: 'text-blue-800',
    border: 'border-blue-900',
    borderLight: 'border-blue-200/60',
    accentBg: 'bg-blue-50 text-blue-800 hover:bg-blue-100',
    accentText: 'text-blue-855',
    pills: 'bg-blue-100 text-blue-800 border-blue-200',
    badge: 'bg-white/20 text-white border-white/10'
  };
};

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(() => {
    const cached = localStorage.getItem('rona_active_tenant');
    return cached ? JSON.parse(cached) : null;
  });
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const cached = localStorage.getItem('rona_active_user');
    return cached ? JSON.parse(cached) : null;
  });

  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isFleetDropdownOpen, setIsFleetDropdownOpen] = useState(false);

  // Trigger login session handlers
  const handleLoginSuccess = (tenant: Tenant, user: User) => {
    setCurrentTenant(tenant);
    setCurrentUser(user);
    localStorage.setItem('rona_active_tenant', JSON.stringify(tenant));
    localStorage.setItem('rona_active_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentTenant(null);
    setCurrentUser(null);
    localStorage.removeItem('rona_active_tenant');
    localStorage.removeItem('rona_active_user');
    setActiveTab('dashboard');
  };

  // Supabase Live Sync and Configuration Diagnostics
  const [supabaseStatus, setSupabaseStatus] = useState<{
    configured: boolean;
    connected: boolean;
    error: string | null;
    url: string;
    schemaSql: string;
  } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'ERROR'>('IDLE');

  const checkSupabaseStatus = async () => {
    try {
      const res = await fetch("/api/supabase-status");
      const data = await res.json();
      setSupabaseStatus(data);
      return data;
    } catch (e) {
      console.warn("Failed checking Supabase connection diagnostics:", e);
      return null;
    }
  };

  const syncStateToSupabase = async (
    tenantId: string,
    d: DeliveryRecord[],
    t: Truck[],
    b: Branch[],
    u: User[]
  ) => {
    setSyncStatus('SYNCING');
    try {
      const res = await fetch('/api/tenant/save-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tenantId,
          deliveries: d,
          trucks: t,
          branches: b,
          users: u
        })
      });
      if (res.ok) {
        setSyncStatus('IDLE');
        setLastSyncTime(new Date().toLocaleTimeString());
      } else {
        setSyncStatus('ERROR');
      }
    } catch (e) {
      console.warn("Offline/Local Sync mode is currently operational:", e);
      setSyncStatus('ERROR');
    }
  };

  // Hydrate state from localStorage or Supabase dynamically on tenant switch
  useEffect(() => {
    if (!currentTenant) return;

    const tenantId = currentTenant.id;
    let defaultDeliveries = INITIAL_DELIVERIES;
    let defaultTrucks = TRUCKS;
    let defaultBranches = BRANCHES;
    let defaultUsers = INITIAL_USERS;

    if (tenantId === 'bay-of-fundy') {
      defaultDeliveries = INITIAL_DELIVERIES_BOF;
      defaultTrucks = TRUCKS_BOF;
      defaultBranches = BRANCHES_BOF;
      defaultUsers = INITIAL_USERS_BOF;
    } else if (tenantId === 'cabot-trail') {
      defaultDeliveries = INITIAL_DELIVERIES_CTC;
      defaultTrucks = TRUCKS_CTC;
      defaultBranches = BRANCHES_CTC;
      defaultUsers = INITIAL_USERS_CTC;
    }

    const loadState = async () => {
      // 1. Diagnose Supabase Status
      const status = await checkSupabaseStatus();

      if (status && status.connected) {
        try {
          const res = await fetch(`/api/tenant/state?tenantId=${tenantId}`);
          const data = await res.json();

          if (data.supabaseActive) {
            if (data.deliveries.length > 0 || data.trucks.length > 0 || data.branches.length > 0 || data.users.length > 0) {
              // Populate React state from live Supabase Tables
              setDeliveries(data.deliveries);
              setTrucks(data.trucks);
              setBranches(data.branches);
              setUsers(data.users);

              localStorage.setItem(`rona_deliveries_tenant_${tenantId}`, JSON.stringify(data.deliveries));
              localStorage.setItem(`rona_trucks_tenant_${tenantId}`, JSON.stringify(data.trucks));
              localStorage.setItem(`rona_branches_tenant_${tenantId}`, JSON.stringify(data.branches));
              localStorage.setItem(`rona_users_tenant_${tenantId}`, JSON.stringify(data.users));
              setLastSyncTime(new Date().toLocaleTimeString());
              return;
            } else {
              // Supabase tables are empty: Seed live database from our local template presets immediately
              console.log("Seeding Supabase with default presets...");
              setDeliveries(defaultDeliveries);
              setTrucks(defaultTrucks);
              setBranches(defaultBranches);
              setUsers(defaultUsers);

              await fetch("/api/tenant/save-state", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  tenantId,
                  deliveries: defaultDeliveries,
                  trucks: defaultTrucks,
                  branches: defaultBranches,
                  users: defaultUsers
                })
              });
              setLastSyncTime(new Date().toLocaleTimeString());
              return;
            }
          }
        } catch (err) {
          console.error("Failed to fetch live Supabase tenant state, using local storage cache:", err);
        }
      }

      // Offline Sandbox Fallback to local storage
      const cachedD = localStorage.getItem(`rona_deliveries_tenant_${tenantId}`);
      if (cachedD) {
        try { setDeliveries(JSON.parse(cachedD)); } catch (e) { setDeliveries(defaultDeliveries); }
      } else {
        setDeliveries(defaultDeliveries);
        localStorage.setItem(`rona_deliveries_tenant_${tenantId}`, JSON.stringify(defaultDeliveries));
      }

      const cachedT = localStorage.getItem(`rona_trucks_tenant_${tenantId}`);
      if (cachedT) {
        try { setTrucks(JSON.parse(cachedT)); } catch (e) { setTrucks(defaultTrucks); }
      } else {
        setTrucks(defaultTrucks);
        localStorage.setItem(`rona_trucks_tenant_${tenantId}`, JSON.stringify(defaultTrucks));
      }

      const cachedB = localStorage.getItem(`rona_branches_tenant_${tenantId}`);
      if (cachedB) {
        try { setBranches(JSON.parse(cachedB)); } catch (e) { setBranches(defaultBranches); }
      } else {
        setBranches(defaultBranches);
        localStorage.setItem(`rona_branches_tenant_${tenantId}`, JSON.stringify(defaultBranches));
      }

      const cachedU = localStorage.getItem(`rona_users_tenant_${tenantId}`);
      if (cachedU) {
        try { setUsers(JSON.parse(cachedU)); } catch (e) { setUsers(defaultUsers); }
      } else {
        setUsers(defaultUsers);
        localStorage.setItem(`rona_users_tenant_${tenantId}`, JSON.stringify(defaultUsers));
      }
    };

    loadState();
  }, [currentTenant]);

  // Update localStorage and sync with Supabase when deliveries change
  const handleAddOrUpdateDelivery = (newRecord: DeliveryRecord) => {
    if (!currentTenant) return;
    const updated = [...deliveries];
    const index = updated.findIndex(d => d.id === newRecord.id);
    if (index >= 0) {
      updated[index] = newRecord;
    } else {
      updated.unshift(newRecord);
    }
    setDeliveries(updated);
    localStorage.setItem(`rona_deliveries_tenant_${currentTenant.id}`, JSON.stringify(updated));
    syncStateToSupabase(currentTenant.id, updated, trucks, branches, users);
  };

  // Fleet handlers
  const handleAddTruck = (newTruck: Truck) => {
    if (!currentTenant) return;
    const updated = [...trucks, newTruck];
    setTrucks(updated);
    localStorage.setItem(`rona_trucks_tenant_${currentTenant.id}`, JSON.stringify(updated));
    syncStateToSupabase(currentTenant.id, deliveries, updated, branches, users);
  };

  const handleUpdateTruck = (updatedTruck: Truck) => {
    if (!currentTenant) return;
    const updated = trucks.map(t => t.id === updatedTruck.id ? updatedTruck : t);
    setTrucks(updated);
    localStorage.setItem(`rona_trucks_tenant_${currentTenant.id}`, JSON.stringify(updated));
    syncStateToSupabase(currentTenant.id, deliveries, updated, branches, users);
  };

  const handleDeleteTruck = (id: string) => {
    if (!currentTenant) return;
    const updated = trucks.filter(t => t.id !== id);
    setTrucks(updated);
    localStorage.setItem(`rona_trucks_tenant_${currentTenant.id}`, JSON.stringify(updated));
    // Trigger remote deletion
    fetch(`/api/tenant/delete-record?table=trucks&id=${id}&tenantId=${currentTenant.id}`, { method: 'DELETE' }).catch(() => {});
    syncStateToSupabase(currentTenant.id, deliveries, updated, branches, users);
  };

  // Branch / Store handlers
  const handleAddBranch = (newBranch: Branch) => {
    if (!currentTenant) return;
    const updated = [...branches, newBranch];
    setBranches(updated);
    localStorage.setItem(`rona_branches_tenant_${currentTenant.id}`, JSON.stringify(updated));
    syncStateToSupabase(currentTenant.id, deliveries, trucks, updated, users);
  };

  const handleUpdateBranch = (updatedBranch: Branch) => {
    if (!currentTenant) return;
    const updated = branches.map(b => b.id === updatedBranch.id ? updatedBranch : b);
    setBranches(updated);
    localStorage.setItem(`rona_branches_tenant_${currentTenant.id}`, JSON.stringify(updated));
    syncStateToSupabase(currentTenant.id, deliveries, trucks, updated, users);
  };

  const handleDeleteBranch = (id: string) => {
    if (!currentTenant) return;
    const updated = branches.filter(b => b.id !== id);
    setBranches(updated);
    localStorage.setItem(`rona_branches_tenant_${currentTenant.id}`, JSON.stringify(updated));
    // Trigger remote deletion
    fetch(`/api/tenant/delete-record?table=branches&id=${id}&tenantId=${currentTenant.id}`, { method: 'DELETE' }).catch(() => {});
    syncStateToSupabase(currentTenant.id, deliveries, trucks, updated, users);
  };

  // User handlers
  const handleAddUser = (newUser: User) => {
    if (!currentTenant) return;
    const updated = [...users, newUser];
    setUsers(updated);
    localStorage.setItem(`rona_users_tenant_${currentTenant.id}`, JSON.stringify(updated));
    syncStateToSupabase(currentTenant.id, deliveries, trucks, branches, updated);
  };

  const handleUpdateUser = (updatedUser: User) => {
    if (!currentTenant) return;
    const updated = users.map(u => u.id === updatedUser.id ? updatedUser : u);
    setUsers(updated);
    localStorage.setItem(`rona_users_tenant_${currentTenant.id}`, JSON.stringify(updated));
    syncStateToSupabase(currentTenant.id, deliveries, trucks, branches, updated);
  };

  const handleDeleteUser = (id: string) => {
    if (!currentTenant) return;
    const updated = users.filter(u => u.id !== id);
    setUsers(updated);
    localStorage.setItem(`rona_users_tenant_${currentTenant.id}`, JSON.stringify(updated));
    // Trigger remote deletion
    fetch(`/api/tenant/delete-record?table=users&id=${id}&tenantId=${currentTenant.id}`, { method: 'DELETE' }).catch(() => {});
    syncStateToSupabase(currentTenant.id, deliveries, trucks, branches, updated);
  };

  // Reset demo data to initial slate
  const handleResetDemoData = () => {
    if (!currentTenant) return;
    if (window.confirm(`Do you want to restore the default sample deliveries, stores, fleets, and users for ${currentTenant.name}?`)) {
      const tenantId = currentTenant.id;
      let defaultDeliveries = INITIAL_DELIVERIES;
      let defaultTrucks = TRUCKS;
      let defaultBranches = BRANCHES;
      let defaultUsers = INITIAL_USERS;

      if (tenantId === 'bay-of-fundy') {
        defaultDeliveries = INITIAL_DELIVERIES_BOF;
        defaultTrucks = TRUCKS_BOF;
        defaultBranches = BRANCHES_BOF;
        defaultUsers = INITIAL_USERS_BOF;
      } else if (tenantId === 'cabot-trail') {
        defaultDeliveries = INITIAL_DELIVERIES_CTC;
        defaultTrucks = TRUCKS_CTC;
        defaultBranches = BRANCHES_CTC;
        defaultUsers = INITIAL_USERS_CTC;
      }

      setDeliveries(defaultDeliveries);
      localStorage.setItem(`rona_deliveries_tenant_${tenantId}`, JSON.stringify(defaultDeliveries));
      
      setTrucks(defaultTrucks);
      localStorage.setItem(`rona_trucks_tenant_${tenantId}`, JSON.stringify(defaultTrucks));
      
      setBranches(defaultBranches);
      localStorage.setItem(`rona_branches_tenant_${tenantId}`, JSON.stringify(defaultBranches));
      
      setUsers(defaultUsers);
      localStorage.setItem(`rona_users_tenant_${tenantId}`, JSON.stringify(defaultUsers));

      // Trigger Database reset
      syncStateToSupabase(tenantId, defaultDeliveries, defaultTrucks, defaultBranches, defaultUsers);
    }
  };


  if (!currentTenant || !currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const theme = getThemeClasses(currentTenant.primaryColor);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-gray-800 antialiased selection:bg-blue-600 selection:text-white" id="main-app-container">
      
      {/* Enterprise Brand Header */}
      <header className={`${theme.bg} text-white shadow-md border-b ${theme.border}`} id="rona-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo & title context */}
          <div className="flex items-center space-x-3 text-center sm:text-left">
            <div className="bg-white p-1.5 rounded-lg border-2 border-slate-100 shadow-sm shrink-0 flex items-center justify-center">
              <span className={`font-extrabold ${theme.text} tracking-tighter text-sm px-1 font-sans`}>RONA</span>
            </div>
            <div>
              <div className="flex items-center justify-center sm:justify-start space-x-2">
                <h1 className="font-sans font-extrabold text-lg tracking-tight leading-3">RONA</h1>
                <span className="bg-white/20 text-white text-[9px] uppercase font-mono px-2 py-0.5 rounded font-bold border border-white/10 tracking-widest leading-none">
                  {currentTenant.code} Workspace
                </span>
                <span className="bg-white/30 text-white text-[9px] font-bold px-1.5 py-0.5 rounded leading-none flex items-center">
                  Tenant Active: {currentTenant.logoBadge}
                </span>
              </div>
              <p className="text-white/80 text-[11px] font-medium mt-1 leading-none">
                {currentTenant.regionalFocus} Logistics Portal &bull; {currentTenant.name}
              </p>
            </div>
          </div>

          {/* Quick Stats & Logged-In User Profile context */}
          <div className="flex items-center space-x-3">
            <div className={`hidden md:flex items-center space-x-2 ${theme.bannerBg} px-3 py-1.5 rounded-lg text-xs font-mono text-white`}>
              <Store className="h-3.5 w-3.5 text-white/80" />
              <span>{branches.length} Registers &bull; {trucks.length} Vehicles</span>
            </div>
            
            {/* Live Supabase Status Badge */}
            <div className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono text-white tracking-tight border transition-all ${
              supabaseStatus?.connected 
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
                : 'bg-amber-950/40 border-amber-500/30 text-amber-300 animate-pulse'
            }`}>
              <Database className="h-3 w-3" />
              <span>{supabaseStatus?.connected ? 'Supabase Live' : 'Local Sandbox'}</span>
              {lastSyncTime && (
                <span className="text-[9px] text-white/50 border-l border-white/10 pl-1.5 ml-1.5 hidden lg:inline">
                  Synced: {lastSyncTime}
                </span>
              )}
            </div>

            <button 
              onClick={handleResetDemoData}
              title="Reset current tenant's database tables to initial values"
              className="text-[10px] bg-black/25 hover:bg-black/45 px-2.5 py-1.5 rounded border border-white/10 font-mono text-white/90 font-medium transition-colors"
            >
              🔄 Reset Board
            </button>

            {/* Authenticated User Badge & Logout Switcher */}
            <div className="flex items-center space-x-2.5 border-l border-white/20 pl-3">
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs font-black leading-none text-white">{currentUser.name}</span>
                <span className="text-[9px] font-mono text-white/70 leading-none mt-1 uppercase font-bold tracking-wider">
                  {currentUser.role}
                </span>
              </div>
              <button 
                onClick={handleLogout}
                title="Logout & Switch Logistical Tenant"
                className="text-white/80 hover:text-white p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all flex items-center justify-center border border-white/10"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Main Core Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col space-y-6" id="rona-body">
        
        {/* Navigation Tabs bar */}
        <div className="bg-white border border-slate-200/60 p-1.5 rounded-xl flex flex-wrap gap-1 shadow-sm w-full" id="rona-nav">
          
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 sm:flex-initial py-2 px-4 text-xs font-bold rounded-lg flex items-center justify-center space-x-2 transition-all ${
              activeTab === 'dashboard' 
                ? theme.activeBtn
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>HQ Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('scanner')}
            className={`flex-1 sm:flex-initial py-2 px-4 text-xs font-bold rounded-lg flex items-center justify-center space-x-2 transition-all ${
              activeTab === 'scanner' 
                ? theme.activeBtn
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Scan className="h-4 w-4" />
            <span>Scanning Station</span>
          </button>

          <button
            onClick={() => setActiveTab('queue')}
            className={`flex-1 sm:flex-initial py-2 px-4 text-xs font-bold rounded-lg flex items-center justify-center space-x-2 transition-all ${
              activeTab === 'queue' 
                ? theme.activeBtn
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            <span>Delivery Freight Board</span>
          </button>

          {/* Interactive Fleet Setup Dropdown trigger */}
          <div className="relative flex-1 sm:flex-initial">
            <button
              onClick={() => setIsFleetDropdownOpen(!isFleetDropdownOpen)}
              className={`w-full py-2 px-4 text-xs font-bold rounded-lg flex items-center justify-center space-x-2 transition-all ${
                ['stores', 'trucks', 'users', 'architecture'].includes(activeTab)
                  ? theme.activeBtn
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <TruckIcon className="h-4 w-4" />
              <span>Fleet Setup</span>
              <ChevronDown className="h-3 w-3 opacity-80" />
            </button>
            {isFleetDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsFleetDropdownOpen(false)}
                />
                <div className="absolute left-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden py-1">
                  <div className="px-3 py-1.5 border-b border-slate-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                    Registries Setup
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('stores');
                      setIsFleetDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center space-x-2.5 transition-colors ${
                      activeTab === 'stores' ? theme.accentBg : 'text-gray-700 hover:bg-slate-50'
                    }`}
                  >
                    <Store className="h-3.5 w-3.5 text-blue-600" />
                    <span>Stores</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('trucks');
                      setIsFleetDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center space-x-2.5 transition-colors ${
                      activeTab === 'trucks' ? theme.accentBg : 'text-gray-700 hover:bg-slate-50'
                    }`}
                  >
                    <TruckIcon className="h-3.5 w-3.5 text-blue-600" />
                    <span>Trucks</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('users');
                      setIsFleetDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center space-x-2.5 transition-colors ${
                      activeTab === 'users' ? theme.accentBg : 'text-gray-700 hover:bg-slate-50'
                    }`}
                  >
                    <Users className="h-3.5 w-3.5 text-blue-600" />
                    <span>Users</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('architecture');
                      setIsFleetDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center space-x-2.5 transition-colors ${
                      activeTab === 'architecture' ? theme.accentBg : 'text-gray-700 hover:bg-slate-50'
                    }`}
                  >
                    <Layers3 className="h-3.5 w-3.5 text-blue-600" />
                    <span>Overall Architecture</span>
                  </button>
                </div>
              </>
            )}
          </div>

        </div>

        {/* Dynamic content area depending on tabs */}
        <div className="flex-1 transition-all duration-300" id="current-tab-view">
          {activeTab === 'dashboard' && (
            <Dashboard 
              deliveries={deliveries} 
              onSelectTab={setActiveTab} 
              trucks={trucks} 
              onAddOrUpdateDelivery={handleAddOrUpdateDelivery}
              branches={branches}
            />
          )}
          {activeTab === 'scanner' && (
            <ScanStation 
              deliveries={deliveries} 
              onAddOrUpdateDelivery={handleAddOrUpdateDelivery} 
              trucks={trucks} 
              branches={branches}
            />
          )}
          {activeTab === 'queue' && (
            <DeliveryQueue 
              deliveries={deliveries} 
              trucks={trucks}
              onAddOrUpdateDelivery={handleAddOrUpdateDelivery}
              branches={branches}
            />
          )}
          {activeTab === 'stores' && (
            <StoresSetup 
              branches={branches}
              onAddBranch={handleAddBranch}
              onUpdateBranch={handleUpdateBranch}
              onDeleteBranch={handleDeleteBranch}
              truckCountByBranch={branches.reduce((acc, b) => {
                acc[b.id] = trucks.filter(t => t.branchId === b.id).length;
                return acc;
              }, {} as Record<string, number>)}
            />
          )}
          {activeTab === 'trucks' && (
            <FleetSetup 
              trucks={trucks} 
              branches={branches}
              onAddTruck={handleAddTruck} 
              onUpdateTruck={handleUpdateTruck} 
              onDeleteTruck={handleDeleteTruck} 
            />
          )}
          {activeTab === 'users' && (
            <UsersSetup 
              users={users}
              branches={branches}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
            />
          )}
          {activeTab === 'architecture' && (
            <ArchitectureView 
              branches={branches}
              onAddOrUpdateDelivery={handleAddOrUpdateDelivery}
              supabaseStatus={supabaseStatus}
              syncStatus={syncStatus}
              lastSyncTime={lastSyncTime}
              onRefreshStatus={checkSupabaseStatus}
            />
          )}
        </div>

      </main>

      {/* Corporate Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6 border-t border-slate-800 text-center text-xs mt-12" id="rona-footer">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-medium text-slate-300">{currentTenant.name} &bull; Mock-up Portal</p>
          <p className="text-[10px] text-slate-500 font-mono">
            Drafted for presentation regarding independent mobile routing platforms &bull; Affiliated with RONA.ca &bull; Workspace tenant: {currentTenant.code}
          </p>
          <div className="flex items-center justify-center space-x-4 pt-1 text-[10px] text-slate-500">
            <span className="flex items-center">
              <Shield className="h-3 w-3 mr-1 text-slate-600" />
              Authenticated Session Secure ({currentUser.role}: {currentUser.email})
            </span>
            <span>&bull;</span>
            <span>Local Database Persistent (Active)</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

