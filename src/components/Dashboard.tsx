import React from 'react';
import { DeliveryRecord, DeliveryStatus, Branch, Truck as TruckType } from '../types';
import { BRANCHES } from '../data';
import { 
  Truck as TruckIcon, 
  CheckCircle2, 
  RefreshCw, 
  FileCheck, 
  Package
} from 'lucide-react';

interface DashboardProps {
  deliveries: DeliveryRecord[];
  onSelectTab: (tab: string) => void;
  trucks: TruckType[];
  onAddOrUpdateDelivery?: (newRecord: DeliveryRecord) => void;
  branches?: Branch[];
}

export default function Dashboard({ deliveries, onSelectTab, trucks, branches }: DashboardProps) {
  const activeBranches = branches && branches.length > 0 ? branches : BRANCHES;
  
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
