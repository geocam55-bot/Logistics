/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { DeliveryRecord, Truck, Branch, User } from './types';
import { INITIAL_DELIVERIES, TRUCKS, BRANCHES, INITIAL_USERS } from './data';
import Dashboard from './components/Dashboard';
import ScanStation from './components/ScanStation';
import DeliveryQueue from './components/DeliveryQueue';
import ArchitectureView from './components/ArchitectureView';
import FleetSetup from './components/FleetSetup';
import StoresSetup from './components/StoresSetup';
import UsersSetup from './components/UsersSetup';
import { LayoutDashboard, Scan, ClipboardList, Layers3, Store, Shield, Users, ChevronDown, Trash2, Truck as TruckIcon } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isFleetDropdownOpen, setIsFleetDropdownOpen] = useState(false);

  // Hydrate state from localStorage
  useEffect(() => {
    const cached = localStorage.getItem('rona_atlantic_deliveries');
    if (cached) {
      try {
        setDeliveries(JSON.parse(cached));
      } catch (e) {
        setDeliveries(INITIAL_DELIVERIES);
      }
    } else {
      setDeliveries(INITIAL_DELIVERIES);
    }

    const cachedTrucks = localStorage.getItem('rona_atlantic_trucks');
    if (cachedTrucks) {
      try {
        setTrucks(JSON.parse(cachedTrucks));
      } catch (e) {
        setTrucks(TRUCKS);
      }
    } else {
      setTrucks(TRUCKS);
    }

    const cachedBranches = localStorage.getItem('rona_atlantic_branches');
    if (cachedBranches) {
      try {
        setBranches(JSON.parse(cachedBranches));
      } catch (e) {
        setBranches(BRANCHES);
      }
    } else {
      setBranches(BRANCHES);
    }

    const cachedUsers = localStorage.getItem('rona_atlantic_users');
    if (cachedUsers) {
      try {
        setUsers(JSON.parse(cachedUsers));
      } catch (e) {
        setUsers(INITIAL_USERS);
      }
    } else {
      setUsers(INITIAL_USERS);
    }
  }, []);

  // Update localStorage when deliveries change
  const handleAddOrUpdateDelivery = (newRecord: DeliveryRecord) => {
    const updated = [...deliveries];
    const index = updated.findIndex(d => d.id === newRecord.id);
    if (index >= 0) {
      updated[index] = newRecord;
    } else {
      updated.unshift(newRecord);
    }
    setDeliveries(updated);
    localStorage.setItem('rona_atlantic_deliveries', JSON.stringify(updated));
  };

  // Fleet handlers
  const handleAddTruck = (newTruck: Truck) => {
    const updated = [...trucks, newTruck];
    setTrucks(updated);
    localStorage.setItem('rona_atlantic_trucks', JSON.stringify(updated));
  };

  const handleUpdateTruck = (updatedTruck: Truck) => {
    const updated = trucks.map(t => t.id === updatedTruck.id ? updatedTruck : t);
    setTrucks(updated);
    localStorage.setItem('rona_atlantic_trucks', JSON.stringify(updated));
  };

  const handleDeleteTruck = (id: string) => {
    const updated = trucks.filter(t => t.id !== id);
    setTrucks(updated);
    localStorage.setItem('rona_atlantic_trucks', JSON.stringify(updated));
  };

  // Branch / Store handlers
  const handleAddBranch = (newBranch: Branch) => {
    const updated = [...branches, newBranch];
    setBranches(updated);
    localStorage.setItem('rona_atlantic_branches', JSON.stringify(updated));
  };

  const handleUpdateBranch = (updatedBranch: Branch) => {
    const updated = branches.map(b => b.id === updatedBranch.id ? updatedBranch : b);
    setBranches(updated);
    localStorage.setItem('rona_atlantic_branches', JSON.stringify(updated));
  };

  const handleDeleteBranch = (id: string) => {
    const updated = branches.filter(b => b.id !== id);
    setBranches(updated);
    localStorage.setItem('rona_atlantic_branches', JSON.stringify(updated));
  };

  // User handlers
  const handleAddUser = (newUser: User) => {
    const updated = [...users, newUser];
    setUsers(updated);
    localStorage.setItem('rona_atlantic_users', JSON.stringify(updated));
  };

  const handleUpdateUser = (updatedUser: User) => {
    const updated = users.map(u => u.id === updatedUser.id ? updatedUser : u);
    setUsers(updated);
    localStorage.setItem('rona_atlantic_users', JSON.stringify(updated));
  };

  const handleDeleteUser = (id: string) => {
    const updated = users.filter(u => u.id !== id);
    setUsers(updated);
    localStorage.setItem('rona_atlantic_users', JSON.stringify(updated));
  };

  // Reset demo data to initial slate
  const handleResetDemoData = () => {
    if (window.confirm('Do you want to restore the default sample deliveries, stores, fleets, and users?')) {
      setDeliveries(INITIAL_DELIVERIES);
      localStorage.setItem('rona_atlantic_deliveries', JSON.stringify(INITIAL_DELIVERIES));
      setTrucks(TRUCKS);
      localStorage.setItem('rona_atlantic_trucks', JSON.stringify(TRUCKS));
      setBranches(BRANCHES);
      localStorage.setItem('rona_atlantic_branches', JSON.stringify(BRANCHES));
      setUsers(INITIAL_USERS);
      localStorage.setItem('rona_atlantic_users', JSON.stringify(INITIAL_USERS));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-gray-800 antialiased selection:bg-blue-600 selection:text-white" id="main-app-container">
      
      {/* Enterprise Brand Header */}
      <header className="bg-blue-800 text-white shadow-md border-b border-blue-900" id="rona-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo & title context */}
          <div className="flex items-center space-x-3 text-center sm:text-left">
            <div className="bg-white p-1.5 rounded-lg border-2 border-blue-700 shadow-sm shrink-0 flex items-center justify-center">
              {/* Custom styled text RONA-like block */}
              <span className="font-extrabold text-blue-800 tracking-tighter text-sm px-1 font-sans">RONA</span>
            </div>
            <div>
              <div className="flex items-center justify-center sm:justify-start space-x-2">
                <h1 className="font-sans font-extrabold text-lg tracking-tight leading-3">RONA</h1>
                <span className="bg-white/20 text-white text-[9px] uppercase font-mono px-2 py-0.5 rounded font-bold border border-white/10 tracking-widest leading-none">
                  Independent Contractor
                </span>
              </div>
              <p className="text-blue-100 text-[11px] font-medium mt-1 leading-none">
                Dartmouth, NS Logistics Portal &bull; Windmill Road DC
              </p>
            </div>
          </div>

          {/* Quick Stats banner inside header */}
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 bg-blue-900/60 border border-blue-900 px-3 py-1.5 rounded-lg text-xs font-mono">
              <Store className="h-3.5 w-3.5 text-blue-200" />
              <span>3 Stores & 1 Bulk DC Hub</span>
            </div>
            <button 
              onClick={handleResetDemoData}
              className="text-[10px] bg-blue-900 hover:bg-blue-950 px-2.5 py-1.5 rounded border border-blue-700/50 hover:border-blue-700 font-mono text-blue-200 font-medium transition-colors"
            >
              🔄 Reset Board
            </button>
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
                ? 'bg-blue-800 text-white shadow-sm' 
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
                ? 'bg-blue-800 text-white shadow-sm' 
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
                ? 'bg-blue-800 text-white shadow-sm' 
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
                  ? 'bg-blue-800 text-white shadow-sm' 
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
                      activeTab === 'stores' ? 'bg-blue-50 text-blue-800' : 'text-gray-700 hover:bg-slate-50'
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
                      activeTab === 'trucks' ? 'bg-blue-50 text-blue-800' : 'text-gray-700 hover:bg-slate-50'
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
                      activeTab === 'users' ? 'bg-blue-50 text-blue-800' : 'text-gray-700 hover:bg-slate-50'
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
                      activeTab === 'architecture' ? 'bg-blue-50 text-blue-800' : 'text-gray-700 hover:bg-slate-50'
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
            />
          )}
        </div>

      </main>

      {/* Corporate Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6 border-t border-slate-800 text-center text-xs mt-12" id="rona-footer">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-medium text-slate-300">RONA Logistics Tracking System Mock-up Portal</p>
          <p className="text-[10px] text-slate-500 font-mono">
            Drafted for presentation regarding independent mobile routing platforms &bull; Affiliated with RONA.ca
          </p>
          <div className="flex items-center justify-center space-x-4 pt-1 text-[10px] text-slate-500">
            <span className="flex items-center"><Shield className="h-3 w-3 mr-1 text-slate-600" /> Active Session Secure</span>
            <span>&bull;</span>
            <span>Local Database Persistent (Active)</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
