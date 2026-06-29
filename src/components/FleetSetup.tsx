import React, { useState, useEffect } from 'react';
import { Truck, Branch, User } from '../types';
import { Truck as TruckIcon, Plus, Trash2, Edit2, Shield, Info, ChevronRight, FileCheck, AlertTriangle, Calendar } from 'lucide-react';

interface FleetSetupProps {
  trucks: Truck[];
  branches: Branch[];
  users?: User[];
  onAddTruck: (truck: Truck) => void;
  onUpdateTruck: (truck: Truck) => void;
  onDeleteTruck: (id: string) => void;
  readOnly?: boolean;
}

export default function FleetSetup({
  trucks,
  branches,
  users,
  onAddTruck,
  onUpdateTruck,
  onDeleteTruck,
  readOnly
}: FleetSetupProps) {
  // Gracefully default to the first available branch
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  useEffect(() => {
    if (branches.length > 0) {
      if (!selectedBranchId || !branches.some(b => b.id === selectedBranchId)) {
        setSelectedBranchId(branches[0].id);
      }
    }
  }, [branches, selectedBranchId]);

  const [isAdding, setIsAdding] = useState(false);
  const [editingTruckId, setEditingTruckId] = useState<string | null>(null);
  const [showDeleteConfirmId, setShowDeleteConfirmId] = useState<string | null>(null);

  // Form Inputs
  const [truckId, setTruckId] = useState('');
  const [truckName, setTruckName] = useState('');
  const [truckType, setTruckType] = useState('Flatbed Boom Truck');
  const [driverName, setDriverName] = useState('');
  const [targetBranchId, setTargetBranchId] = useState('');
  const [registrationDueDate, setRegistrationDueDate] = useState('');

  // Get trucks assigned to the currently selected branch
  const filteredTrucks = trucks.filter(t => t.branchId === selectedBranchId);
  const selectedBranch = branches.find(b => b.id === selectedBranchId);

  // Filter registered users with Driver role
  const driversList = (users || []).filter(u => u.role === 'Driver');

  // Pre-configured truck models for easy selection
  const TRUCK_TYPES = [
    'Flatbed Boom Truck',
    'Medium-Duty Flatbed',
    'Heavy-Duty Flatbed',
    '24ft Closed Box Truck',
    'Fleet Pickup Truck 4x4',
    'Curtain-side Flatbed'
  ];

  const handleStartAdd = () => {
    const nextNum = Math.floor(10 + Math.random() * 90);
    setTruckId(`TRUCK-${nextNum}`);
    setTruckName(`Truck-${filteredTrucks.length + 1}`);
    setTruckType('Flatbed Boom Truck');
    setDriverName('');
    setRegistrationDueDate('');
    setTargetBranchId(selectedBranchId || (branches[0]?.id || ''));
    setIsAdding(true);
    setEditingTruckId(null);
  };

  const handleStartEdit = (truck: Truck) => {
    setTruckId(truck.id);
    setTruckName(truck.name);
    setTruckType(truck.type);
    setDriverName(truck.driver);
    setTargetBranchId(truck.branchId);
    setRegistrationDueDate(truck.registrationDueDate || '');
    setEditingTruckId(truck.id);
    setIsAdding(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!truckName.trim() || !driverName.trim() || !targetBranchId) {
      alert('Please fill in Truck Name, Driver, and tag it to a Store branch.');
      return;
    }

    const payload: Truck = {
      id: truckId,
      name: truckName.trim(),
      type: truckType,
      driver: driverName.trim(),
      branchId: targetBranchId,
      registrationDueDate: registrationDueDate || undefined
    };

    if (editingTruckId) {
      onUpdateTruck(payload);
      setEditingTruckId(null);
    } else {
      if (trucks.some(t => t.id === truckId)) {
        payload.id = `TRUCK-${Math.floor(100 + Math.random() * 900)}`;
      }
      onAddTruck(payload);
      setIsAdding(false);
    }

    // Reset Form
    setTruckName('');
    setDriverName('');
    setRegistrationDueDate('');
  };

  const handleDelete = (id: string) => {
    setShowDeleteConfirmId(id);
  };

  if (branches.length === 0) {
    return (
      <div className="bg-white border border-slate-100 p-8 rounded-xl shadow-sm text-center space-y-3" id="fleet-setup-view">
        <TruckIcon className="h-10 w-10 text-slate-300 mx-auto" />
        <h4 className="font-sans font-bold text-gray-900 text-base">No Stores Available</h4>
        <p className="text-xs text-gray-500 max-w-sm mx-auto">
          Please add and register a Store first in the Stores tab before setting up delivery vehicle fleets.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" id="fleet-setup-view">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h4 className="font-sans font-bold text-gray-900 tracking-tight text-xl">Fleet Logistics Registry (Trucks)</h4>
          <p className="text-xs text-gray-500">
            Decommission, register, and tag flatbeds, boom cranes, or transport vehicles to specific physical store footprints
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Hand: Branch / Store Selection Deck */}
        <div className="lg:col-span-4 bg-white border border-slate-100 p-4 rounded-xl shadow-sm space-y-4">
          <h5 className="text-xs font-bold text-gray-700 uppercase tracking-widest font-mono">Select Store View</h5>
          <div className="space-y-1.5">
            {branches.map(branch => {
              const count = trucks.filter(t => t.branchId === branch.id).length;
              return (
                <button
                  key={branch.id}
                  onClick={() => {
                    setSelectedBranchId(branch.id);
                    setIsAdding(false);
                    setEditingTruckId(null);
                  }}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all flex items-center justify-between ${
                    selectedBranchId === branch.id
                      ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-semibold shadow-sm'
                      : 'border-slate-100 hover:bg-slate-50 text-gray-700'
                  }`}
                >
                  <div className="truncate pr-2">
                    <span className="block truncate">{branch.name}</span>
                    <span className="text-[10px] text-gray-400 font-mono block truncate mt-0.5">{branch.address}</span>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    <span className={`text-[9px] px-1.5 py-0.25 rounded font-mono font-bold ${
                      count > 0 
                        ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {count} {count === 1 ? 'Truck' : 'Trucks'}
                    </span>
                    <ChevronRight className={`h-3 w-3 ${selectedBranchId === branch.id ? 'text-blue-600' : 'text-slate-400'}`} />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-[11px] text-gray-500 space-y-1.5">
            <p className="font-semibold flex items-center text-gray-800 text-xs">
              <Info className="h-3.5 w-3.5 mr-1 text-blue-500" /> Stores vs DC Routing Rule
            </p>
            <p>
              Each truck must be explicitly tagged to a store. Deleting a store requires re-tagging its vehicles first so that barcodes remain scannable.
            </p>
          </div>
        </div>

        {/* Right Hand: Active Store's Fleet & Setup Form */}
        <div className="lg:col-span-8 bg-white border border-slate-100 p-5 rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            
            {/* Store title & action */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <div>
                <h4 className="font-sans font-bold text-gray-900 tracking-tight text-base">
                  {selectedBranch?.name || 'Loading Store...'} Fleet
                </h4>
                <p className="text-xs text-gray-500">
                  {selectedBranch?.type === 'DC' ? 'Bulk Distribution Hub' : 'Retailer Storefront Logistics'} &bull; NS Region
                </p>
              </div>
              
              {!isAdding && !editingTruckId && !readOnly && (
                <button
                  onClick={handleStartAdd}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2 px-3 rounded-lg flex items-center space-x-1 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Truck</span>
                </button>
              )}
            </div>

            {readOnly && (
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg text-xs text-slate-500 mb-4 flex items-center space-x-2">
                <Info className="h-4 w-4 text-slate-400 shrink-0" />
                <span>As a Dispatcher, you have view-only access to physical transportation models. Registering or altering vehicles is restricted.</span>
              </div>
            )}

            {/* Display Mode: Either Form or Truck Card List */}
            {(isAdding || editingTruckId) ? (
              <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-100 p-4 rounded-xl mb-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-blue-900 uppercase tracking-wider font-sans flex items-center">
                    <TruckIcon className="h-4 w-4 mr-1 text-blue-600" />
                    {editingTruckId ? 'Update Truck Details' : 'Register New Flatbed/Cranes'}
                  </h5>
                  <button 
                    type="button" 
                    onClick={() => { setIsAdding(false); setEditingTruckId(null); }}
                    className="text-gray-400 hover:text-gray-600 text-xs font-medium"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Truck Registry Code</label>
                    <input 
                      type="text" 
                      value={truckId}
                      disabled
                      className="w-full bg-slate-100 border border-slate-200 px-3 py-1.5 rounded text-xs font-mono text-gray-500"
                    />
                    <span className="text-[10px] text-gray-400 font-mono mt-0.5 block">Generated unique vehicle ID</span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Truck Designation Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Truck-1 Boom"
                      value={truckName}
                      onChange={(e) => setTruckName(e.target.value)}
                      className="w-full border bg-white border-slate-200 px-3 py-1.5 rounded text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Truck Model & Hardware</label>
                    <select
                      value={truckType}
                      onChange={(e) => setTruckType(e.target.value)}
                      className="w-full border bg-white border-slate-200 px-3 py-1.5 rounded text-xs text-gray-800 font-medium"
                    >
                      {TRUCK_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Tag/Assign to Store</label>
                    <select
                      value={targetBranchId}
                      onChange={(e) => setTargetBranchId(e.target.value)}
                      className="w-full border bg-white border-slate-200 px-3 py-1.5 rounded text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Assigned Logistics Driver</label>
                    <select
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      required
                      className="w-full border bg-white border-slate-200 px-3 py-1.5 rounded text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                    >
                      <option value="">-- Select a Driver --</option>
                      {driversList.map(u => (
                        <option key={u.id} value={u.name}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                      {driversList.length === 0 && (
                        <>
                          <option value="George Campbell">George Campbell</option>
                          <option value="Dave MacNeil">Dave MacNeil</option>
                          <option value="Joshua Campbell">Joshua Campbell</option>
                          <option value="Robert Landry">Robert Landry</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Registration Due Date</label>
                    <input 
                      type="date" 
                      value={registrationDueDate}
                      onChange={(e) => setRegistrationDueDate(e.target.value)}
                      className="w-full border bg-white border-slate-200 px-3 py-1.5 rounded text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div className="flex space-x-2 pt-1.5 border-t border-slate-200/50">
                  <button 
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 px-4 rounded-lg flex items-center space-x-1 shadow-sm"
                  >
                    <FileCheck className="h-3.5 w-3.5" />
                    <span>Save Vehicle Listing</span>
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setIsAdding(false); setEditingTruckId(null); }}
                    className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-gray-700 text-xs font-medium rounded-lg"
                  >
                    Discard Changes
                  </button>
                </div>
              </form>
            ) : null}

            {/* List of Registered Fleet Trucks */}
            <div className="space-y-2.5">
              {filteredTrucks.length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl py-12 text-center text-gray-400 space-y-2">
                  <TruckIcon className="h-8 w-8 text-slate-300 mx-auto" />
                  <div>
                    <p className="text-xs font-bold text-gray-700">No trucks assigned to this branch storefront</p>
                    <p className="text-[11px]">Deploy flatbeds, boom cranes, or trucks to this storefront to facilitate dispatching.</p>
                  </div>
                  {!readOnly && (
                    <button
                      onClick={handleStartAdd}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center justify-center space-x-0.5 mx-auto"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Deploy first vehicle now</span>
                    </button>
                  )}
                </div>
              ) : (
                filteredTrucks.map(truck => (
                  <div 
                    key={truck.id} 
                    className="border border-slate-100 rounded-xl p-3.5 bg-white flex items-center justify-between gap-4 shadow-sm hover:border-slate-200/80 transition-all"
                  >
                    <div className="flex items-center space-x-3.5">
                      {/* Truck Icon Slate */}
                      <div className="bg-blue-50 text-blue-700 p-2.5 rounded-lg border border-blue-100">
                        <TruckIcon className="h-5 w-5" />
                      </div>

                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-sans font-bold text-gray-900 text-sm">{truck.name}</span>
                          <span className="text-[9px] px-1.5 py-0.25 bg-slate-100 text-slate-600 font-mono font-bold rounded">
                            {truck.id}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 mt-1">
                          <span className="font-semibold text-slate-700">{truck.type}</span>
                          <span className="text-gray-300">&bull;</span>
                          <span className="flex items-center text-[11px]">
                            Driver: <strong className="text-slate-800 ml-1">{truck.driver}</strong>
                          </span>
                          {truck.registrationDueDate && (
                            <>
                              <span className="text-gray-300">&bull;</span>
                              <span className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] border ${
                                (() => {
                                  const expDate = new Date(truck.registrationDueDate);
                                  const now = new Date();
                                  return expDate < now;
                                })() 
                                  ? 'bg-red-50 text-red-700 border-red-200' 
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                              }`}>
                                <Calendar className="h-3 w-3 shrink-0" />
                                <span>Reg Due: <strong className="font-mono">{truck.registrationDueDate}</strong></span>
                                {(() => {
                                  const expDate = new Date(truck.registrationDueDate);
                                  const now = new Date();
                                  return expDate < now;
                                })() && (
                                  <span className="text-red-600 font-extrabold uppercase text-[8px] tracking-wider animate-pulse ml-1">(! OVERDUE)</span>
                                )}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    {!readOnly && (
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => handleStartEdit(truck)}
                          aria-label="Edit truck"
                          className="p-1.5 hover:bg-slate-50 border border-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(truck.id)}
                          aria-label="Delete truck"
                          className="p-1.5 hover:bg-red-50 border border-red-50 rounded-lg text-red-500 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center">
              <Shield className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Active Local Registry persistence
            </span>
            <span>Total Region Fleet: <strong>{trucks.length} Trucks</strong></span>
          </div>

        </div>

      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-55 backdrop-blur-xs">
          <div 
            className="fixed inset-0" 
            onClick={() => setShowDeleteConfirmId(null)}
          />
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full relative z-10 animate-in fade-in zoom-in duration-150 p-6">
            <div className="flex items-center space-x-3 text-red-600 mb-4">
              <div className="p-2 bg-red-50 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h4 className="font-sans font-bold text-slate-900 text-lg">
                Decommission Vehicle
              </h4>
            </div>
            
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              Are you sure you want to permanently decommission vehicle <strong className="text-slate-900 font-semibold">{showDeleteConfirmId}</strong>? This action cannot be undone and will remove the vehicle from active fleets.
            </p>

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmId(null)}
                className="px-4 py-2 bg-slate-100 rounded-lg text-slate-700 hover:bg-slate-200 transition-colors font-semibold cursor-pointer text-xs"
              >
                Cancel, Keep Vehicle
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteTruck(showDeleteConfirmId);
                  setShowDeleteConfirmId(null);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm transition-colors font-bold cursor-pointer text-xs flex items-center space-x-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Decommission</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
