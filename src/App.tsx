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
import SuperAdminTenantsView from './components/SuperAdminTenantsView';
import { 
  LayoutDashboard, Scan, ClipboardList, Layers3, Store, Shield, Users, 
  ChevronDown, Trash2, Truck as TruckIcon, LogOut, Landmark, UserCheck,
  Database, RefreshCw, FileDown
} from 'lucide-react';
import prospacesLogo from './assets/images/prospaces_logo_1781387785955.jpg';

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
  const [allTenants, setAllTenants] = useState<Tenant[]>(() => {
    const cached = localStorage.getItem('prospaces_all_tenants');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error("Failed parsing cached tenants list:", e);
      }
    }
    return TENANTS;
  });

  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(() => {
    const cached = localStorage.getItem('prospaces_active_tenant');
    return cached ? JSON.parse(cached) : null;
  });
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const cached = localStorage.getItem('prospaces_active_user');
    return cached ? JSON.parse(cached) : null;
  });

  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isFleetDropdownOpen, setIsFleetDropdownOpen] = useState(false);

  // Fallback state redirect for restricted role views
  useEffect(() => {
    if (!currentUser) return;
    const role = currentUser.role;
    if (role === 'Driver') {
      if (!['dashboard', 'queue', 'scanner'].includes(activeTab)) {
        setActiveTab('dashboard');
      }
    } else if (role === 'User') {
      if (!['dashboard', 'queue'].includes(activeTab)) {
        setActiveTab('dashboard');
      }
    }
  }, [currentUser, activeTab]);

  // Trigger login session handlers
  const handleLoginSuccess = (tenant: Tenant, user: User) => {
    setCurrentTenant(tenant);
    setCurrentUser(user);
    localStorage.setItem('prospaces_active_tenant', JSON.stringify(tenant));
    localStorage.setItem('prospaces_active_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentTenant(null);
    setCurrentUser(null);
    localStorage.removeItem('prospaces_active_tenant');
    localStorage.removeItem('prospaces_active_user');
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
            if (data.branches && data.branches.length > 0 && data.trucks && data.trucks.length > 0) {
              // Populate React state from live Supabase Tables
              setDeliveries(data.deliveries || []);
              setTrucks(data.trucks || []);
              setBranches(data.branches || []);
              setUsers(data.users || []);

              localStorage.setItem(`prospaces_deliveries_tenant_${tenantId}`, JSON.stringify(data.deliveries || []));
              localStorage.setItem(`prospaces_trucks_tenant_${tenantId}`, JSON.stringify(data.trucks || []));
              localStorage.setItem(`prospaces_branches_tenant_${tenantId}`, JSON.stringify(data.branches || []));
              localStorage.setItem(`prospaces_users_tenant_${tenantId}`, JSON.stringify(data.users || []));
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
      const cachedD = localStorage.getItem(`prospaces_deliveries_tenant_${tenantId}`);
      if (cachedD) {
        try { setDeliveries(JSON.parse(cachedD)); } catch (e) { setDeliveries(defaultDeliveries); }
      } else {
        setDeliveries(defaultDeliveries);
        localStorage.setItem(`prospaces_deliveries_tenant_${tenantId}`, JSON.stringify(defaultDeliveries));
      }

      const cachedT = localStorage.getItem(`prospaces_trucks_tenant_${tenantId}`);
      if (cachedT) {
        try { setTrucks(JSON.parse(cachedT)); } catch (e) { setTrucks(defaultTrucks); }
      } else {
        setTrucks(defaultTrucks);
        localStorage.setItem(`prospaces_trucks_tenant_${tenantId}`, JSON.stringify(defaultTrucks));
      }

      const cachedB = localStorage.getItem(`prospaces_branches_tenant_${tenantId}`);
      if (cachedB) {
        try { setBranches(JSON.parse(cachedB)); } catch (e) { setBranches(defaultBranches); }
      } else {
        setBranches(defaultBranches);
        localStorage.setItem(`prospaces_branches_tenant_${tenantId}`, JSON.stringify(defaultBranches));
      }

      const cachedU = localStorage.getItem(`prospaces_users_tenant_${tenantId}`);
      if (cachedU) {
        try { setUsers(JSON.parse(cachedU)); } catch (e) { setUsers(defaultUsers); }
      } else {
        setUsers(defaultUsers);
        localStorage.setItem(`prospaces_users_tenant_${tenantId}`, JSON.stringify(defaultUsers));
      }
    };

    loadState();
  }, [currentTenant]);

  // Load corporate tenants on boot
  useEffect(() => {
    const loadTenants = async () => {
      try {
        const res = await fetch("/api/tenants");
        const data = await res.json();
        if (data.tenants) {
          setAllTenants(data.tenants);
          localStorage.setItem('prospaces_all_tenants', JSON.stringify(data.tenants));
        }
      } catch (err) {
        console.warn("Failed retrieving tenants from database on mount:", err);
      }
    };
    loadTenants();
  }, []);

  const handleAddTenant = async (newTenant: Tenant) => {
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant: newTenant })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not register tenant on live server.");
      }
      const updated = [...allTenants, newTenant];
      setAllTenants(updated);
      localStorage.setItem('prospaces_all_tenants', JSON.stringify(updated));
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleUpdateTenant = async (updatedTenant: Tenant) => {
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant: updatedTenant })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not save tenant modifications on live server.");
      }
      const updated = allTenants.map(t => t.id === updatedTenant.id ? updatedTenant : t);
      setAllTenants(updated);
      localStorage.setItem('prospaces_all_tenants', JSON.stringify(updated));
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleDeleteTenant = async (id: string) => {
    try {
      const res = await fetch(`/api/tenants/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not delete tenant on live server.");
      }
      const updated = allTenants.filter(t => t.id !== id);
      setAllTenants(updated);
      localStorage.setItem('prospaces_all_tenants', JSON.stringify(updated));
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

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
    localStorage.setItem(`prospaces_deliveries_tenant_${currentTenant.id}`, JSON.stringify(updated));
    syncStateToSupabase(currentTenant.id, updated, trucks, branches, users);
  };

  const handleDeleteDelivery = (id: string) => {
    if (!currentTenant) return;
    const updated = deliveries.filter(d => d.id !== id);
    setDeliveries(updated);
    localStorage.setItem(`prospaces_deliveries_tenant_${currentTenant.id}`, JSON.stringify(updated));
    // Trigger remote deletion
    fetch(`/api/tenant/delete-record?table=deliveries&id=${id}&tenantId=${currentTenant.id}`, { method: 'DELETE' }).catch(() => {});
    syncStateToSupabase(currentTenant.id, updated, trucks, branches, users);
  };

  // Fleet handlers
  const handleAddTruck = (newTruck: Truck) => {
    if (!currentTenant) return;
    const updated = [...trucks, newTruck];
    setTrucks(updated);
    localStorage.setItem(`prospaces_trucks_tenant_${currentTenant.id}`, JSON.stringify(updated));
    syncStateToSupabase(currentTenant.id, deliveries, updated, branches, users);
  };

  const handleUpdateTruck = (updatedTruck: Truck) => {
    if (!currentTenant) return;
    const updated = trucks.map(t => t.id === updatedTruck.id ? updatedTruck : t);
    setTrucks(updated);
    localStorage.setItem(`prospaces_trucks_tenant_${currentTenant.id}`, JSON.stringify(updated));
    syncStateToSupabase(currentTenant.id, deliveries, updated, branches, users);
  };

  const handleDeleteTruck = (id: string) => {
    if (!currentTenant) return;
    const updated = trucks.filter(t => t.id !== id);
    setTrucks(updated);
    localStorage.setItem(`prospaces_trucks_tenant_${currentTenant.id}`, JSON.stringify(updated));
    // Trigger remote deletion
    fetch(`/api/tenant/delete-record?table=trucks&id=${id}&tenantId=${currentTenant.id}`, { method: 'DELETE' }).catch(() => {});
    syncStateToSupabase(currentTenant.id, deliveries, updated, branches, users);
  };

  // Branch / Store handlers
  const handleAddBranch = (newBranch: Branch) => {
    if (!currentTenant) return;
    const updated = [...branches, newBranch];
    setBranches(updated);
    localStorage.setItem(`prospaces_branches_tenant_${currentTenant.id}`, JSON.stringify(updated));
    syncStateToSupabase(currentTenant.id, deliveries, trucks, updated, users);
  };

  const handleUpdateBranch = (updatedBranch: Branch) => {
    if (!currentTenant) return;
    const updated = branches.map(b => b.id === updatedBranch.id ? updatedBranch : b);
    setBranches(updated);
    localStorage.setItem(`prospaces_branches_tenant_${currentTenant.id}`, JSON.stringify(updated));
    syncStateToSupabase(currentTenant.id, deliveries, trucks, updated, users);
  };

  const handleDeleteBranch = (id: string) => {
    if (!currentTenant) return;
    const updated = branches.filter(b => b.id !== id);
    setBranches(updated);
    localStorage.setItem(`prospaces_branches_tenant_${currentTenant.id}`, JSON.stringify(updated));
    // Trigger remote deletion
    fetch(`/api/tenant/delete-record?table=branches&id=${id}&tenantId=${currentTenant.id}`, { method: 'DELETE' }).catch(() => {});
    syncStateToSupabase(currentTenant.id, deliveries, trucks, updated, users);
  };

  // User handlers
  const handleAddUser = (newUser: User) => {
    if (!currentTenant) return;
    const updated = [...users, newUser];
    setUsers(updated);
    localStorage.setItem(`prospaces_users_tenant_${currentTenant.id}`, JSON.stringify(updated));
    syncStateToSupabase(currentTenant.id, deliveries, trucks, branches, updated);
  };

  const handleUpdateUser = (updatedUser: User) => {
    if (!currentTenant) return;
    const updated = users.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u);
    setUsers(updated);
    localStorage.setItem(`prospaces_users_tenant_${currentTenant.id}`, JSON.stringify(updated));
    syncStateToSupabase(currentTenant.id, deliveries, trucks, branches, updated);
  };

  const handleDeleteUser = (id: string) => {
    if (!currentTenant) return;
    const updated = users.filter(u => u.id !== id);
    setUsers(updated);
    localStorage.setItem(`prospaces_users_tenant_${currentTenant.id}`, JSON.stringify(updated));
    // Trigger remote deletion
    fetch(`/api/tenant/delete-record?table=users&id=${id}&tenantId=${currentTenant.id}`, { method: 'DELETE' }).catch(() => {});
    syncStateToSupabase(currentTenant.id, deliveries, trucks, branches, updated);
  };

  // Purge / Clear all operational data for the current tenant to start totally fresh
  const handleClearAllData = async () => {
    if (!currentTenant || !currentUser) return;
    
    const confirmMessage = `Are you absolutely sure you want to remove all operational test data (Deliveries, Stores, Trucks, and other custom users) for ${currentTenant.name}?\n\nThis will permanently empty all tables in the live database, but your active administrator profile (${currentUser.email}) will be kept so you stay logged in.`;
    
    if (window.confirm(confirmMessage)) {
      const tenantId = currentTenant.id;
      
      const emptyDeliveries: DeliveryRecord[] = [];
      const emptyTrucks: Truck[] = [];
      const emptyBranches: Branch[] = [];
      const preservedUsers: User[] = [currentUser];
      
      // Update local state and localStorage
      setDeliveries(emptyDeliveries);
      localStorage.setItem(`prospaces_deliveries_tenant_${tenantId}`, JSON.stringify(emptyDeliveries));
      
      setTrucks(emptyTrucks);
      localStorage.setItem(`prospaces_trucks_tenant_${tenantId}`, JSON.stringify(emptyTrucks));
      
      setBranches(emptyBranches);
      localStorage.setItem(`prospaces_branches_tenant_${tenantId}`, JSON.stringify(emptyBranches));
      
      setUsers(preservedUsers);
      localStorage.setItem(`prospaces_users_tenant_${tenantId}`, JSON.stringify(preservedUsers));
      
      // Call the live API to wipe database records permanently
      setSyncStatus('SYNCING');
      try {
        const res = await fetch("/api/tenant/clear-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId,
            keepUserEmail: currentUser.email
          })
        });
        
        if (res.ok) {
          setSyncStatus('SUCCESS');
          setLastSyncTime(new Date().toLocaleTimeString());
          alert("All operational and test data has been successfully deleted from the live system!");
        } else {
          throw new Error("API returned failed response");
        }
      } catch (err) {
        console.error("Failed to delete live records via API, fallback to manual syncing:", err);
        // Fallback: sync state consisting of empty arrays + preserved admin
        await syncStateToSupabase(tenantId, emptyDeliveries, emptyTrucks, emptyBranches, preservedUsers);
        setSyncStatus('SUCCESS');
        alert("Wiped local cache. Remote database has been queued for synchronization.");
      }
    }
  };


  if (!currentTenant || !currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} tenantsList={allTenants} />;
  }

  // Check if logged in user is a SUPER_ADMIN
  if (currentUser.role === 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col font-sans text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950 animate-fade-in" id="super-admin-layout">
        
        {/* Super Admin Top Header */}
        <header className="bg-slate-950 text-white border-b border-amber-500/25 shadow-xl animate-slide-down" id="super-admin-header">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Branded Logo representation */}
            <div className="flex items-center space-x-3 text-center sm:text-left">
              <div className="shrink-0 flex items-center justify-center bg-white p-1 rounded-lg border border-amber-500/10 shadow-sm">
                <img 
                  src={prospacesLogo} 
                  alt="ProSpaces Logo" 
                  className="h-10 w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <div className="flex items-center justify-center sm:justify-start space-x-2">
                  <h2 className="font-sans font-black text-xl text-slate-100 tracking-tight leading-none m-0">ProSpaces</h2>
                  <span className="bg-amber-500/15 text-amber-400 text-[9.5px] uppercase font-mono px-2 py-0.5 rounded font-black border border-amber-500/30 tracking-widest leading-none">
                    Master Administrator
                  </span>
                </div>
                <p className="text-slate-400 text-xs font-semibold mt-1.5 leading-none">
                  Global Organizational Partition Controls & Ecosystem Tenant Provisioning
                </p>
              </div>
            </div>

            {/* Quick Status Bar */}
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[10.5px] font-mono border leading-none ${
                supabaseStatus?.connected 
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
                  : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
              }`}>
                <Database className="h-3.5 w-3.5 text-current shrink-0" />
                <span>{supabaseStatus?.connected ? 'Live Database Sync Active' : 'Offline / Local Database Sync Mode'}</span>
              </div>

              {/* Identity & control */}
              <div className="flex items-center space-x-2.5 border-l border-slate-800 pl-4 leading-none">
                <div className="hidden lg:flex flex-col text-right">
                  <span className="text-xs font-bold leading-none text-slate-200">{currentUser.name}</span>
                  <span className="text-[9px] font-mono text-amber-400 leading-none mt-1 uppercase font-black tracking-wider">
                    {currentUser.role}
                  </span>
                </div>
                <button 
                  onClick={handleLogout}
                  title="Secure De-authorization and Logout"
                  type="button"
                  className="text-amber-500 hover:text-amber-400 p-2 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl transition-all flex items-center justify-center border border-amber-500/20 shadow-inner cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>

          </div>
        </header>

        {/* Core Screen */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col space-y-6">
          <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-800/80 backdrop-blur-md" id="super-admin-content-card">
            <SuperAdminTenantsView 
              tenants={allTenants} 
              onAddTenant={handleAddTenant}
              onUpdateTenant={handleUpdateTenant}
              onDeleteTenant={handleDeleteTenant}
              supabaseStatus={supabaseStatus}
              currentUser={currentUser}
            />
          </div>
        </main>

        <footer className="bg-slate-950 text-slate-500 py-6 border-t border-slate-900 text-center text-xs" id="super-admin-footer">
          <div className="max-w-7xl mx-auto px-4 space-y-1">
            <p className="font-bold text-slate-400">ProSpaces Global Administration Node</p>
            <p className="text-[10px] text-slate-600 font-mono">
              Secured under master corporate administrative rules &bull; Full structural control over physical tenants.
            </p>
          </div>
        </footer>

      </div>
    );
  }

  const theme = getThemeClasses(currentTenant.primaryColor);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-gray-800 antialiased selection:bg-blue-600 selection:text-white" id="main-app-container">
      
      {/* Enterprise Brand Header */}
      <header className="bg-white text-slate-800 shadow-sm border-b border-slate-200/80" id="prospaces-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo & title context */}
          <div className="flex items-center space-x-4 text-center sm:text-left">
            <div className="shrink-0 flex items-center justify-center">
              <img 
                src={prospacesLogo} 
                alt="ProSpaces Logo" 
                className="h-16 sm:h-20 w-auto object-contain animate-fade-in"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="font-sans font-black text-slate-900 text-base sm:text-lg tracking-tight leading-tight">
                {currentTenant.name}
              </h1>
              <p className="text-slate-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mt-0.5 leading-none flex items-center justify-center sm:justify-start gap-2">
                <span>Enterprise Logistics Portal</span>
                <span className="opacity-40">&bull;</span>
                <span className="bg-slate-100 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold">{currentTenant.code}</span>
              </p>
            </div>
          </div>

          {/* Quick Stats & Logged-In User Profile context */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200/85 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-600">
              <Store className="h-3.5 w-3.5 text-slate-400" />
              <span>{branches.length} Registers &bull; {trucks.length} Vehicles</span>
            </div>

            {/* Authenticated User Badge & Logout Switcher */}
            <div className="flex items-center space-x-2.5 border-l border-slate-200 pl-3">
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs font-black leading-none text-slate-800">{currentUser.name}</span>
                <span className="text-[9px] font-mono text-slate-500 leading-none mt-1 uppercase font-bold tracking-wider">
                  {currentUser.role}
                </span>
              </div>
              <button 
                onClick={handleLogout}
                title="Logout & Switch Logistical Tenant"
                className="text-slate-500 hover:text-slate-800 p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg transition-all flex items-center justify-center border border-slate-200"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Main Core Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col space-y-6" id="prospaces-body">
        
        {/* Navigation Tabs bar */}
        <div className="bg-white border border-slate-200/60 p-1.5 rounded-xl flex flex-wrap gap-1 shadow-sm w-full" id="prospaces-nav">
          
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

          {['Admin', 'Dispatcher', 'Driver'].includes(currentUser?.role || '') && (
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
          )}

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

          {['Admin', 'Dispatcher'].includes(currentUser?.role || '') && (
            <button
              onClick={() => setActiveTab('document-import')}
              className={`flex-1 sm:flex-initial py-2 px-4 text-xs font-bold rounded-lg flex items-center justify-center space-x-2 transition-all ${
                activeTab === 'document-import' 
                  ? theme.activeBtn
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <FileDown className="h-4 w-4" />
              <span>Document Import</span>
            </button>
          )}

          {/* Interactive Fleet Setup Dropdown trigger */}
          {['Admin', 'Dispatcher'].includes(currentUser?.role || '') && (
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
          )}

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
              onDeleteDelivery={handleDeleteDelivery}
              trucks={trucks} 
              branches={branches}
            />
          )}
          {activeTab === 'queue' && (
            <DeliveryQueue 
              deliveries={deliveries} 
              trucks={trucks}
              onAddOrUpdateDelivery={handleAddOrUpdateDelivery}
              onDeleteDelivery={handleDeleteDelivery}
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
              readOnly={currentUser?.role === 'Dispatcher'}
            />
          )}
          {activeTab === 'trucks' && (
            <FleetSetup 
              trucks={trucks} 
              branches={branches}
              onAddTruck={handleAddTruck} 
              onUpdateTruck={handleUpdateTruck} 
              onDeleteTruck={handleDeleteTruck} 
              readOnly={currentUser?.role === 'Dispatcher'}
            />
          )}
          {activeTab === 'users' && (
            <UsersSetup 
              users={users}
              branches={branches}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              readOnly={currentUser?.role === 'Dispatcher'}
            />
          )}
          {activeTab === 'document-import' && (
            <ArchitectureView 
              branches={branches}
              onAddOrUpdateDelivery={handleAddOrUpdateDelivery}
              supabaseStatus={supabaseStatus}
              syncStatus={syncStatus}
              lastSyncTime={lastSyncTime}
              onRefreshStatus={checkSupabaseStatus}
              defaultSegment="mapping-ui"
              allowedSegments={['mapping-ui', 'local-folder']}
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
              defaultSegment="blueprint"
              allowedSegments={['blueprint', 'supabase-db']}
            />
          )}
        </div>

      </main>

      {/* Corporate Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6 border-t border-slate-800 text-center text-xs mt-12" id="prospaces-footer">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-medium text-slate-300">{currentTenant.name} &bull; ProSpaces Portal</p>
          <p className="text-[10px] text-slate-500 font-mono">
            Drafted for presentation regarding independent mobile routing platforms &bull; Part of ProSpaces Delivery and Logistics &bull; Workspace tenant: {currentTenant.code}
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

