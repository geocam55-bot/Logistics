import { useState } from 'react';
import { DeliveryRecord, DeliveryStatus, Branch, Truck } from '../types';
import { BRANCHES as STATIC_BRANCHES } from '../data';
import { Search, MapPin, Eye, Clock, User, Phone, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, FileText, Truck as TruckIcon } from 'lucide-react';

interface DeliveryQueueProps {
  deliveries: DeliveryRecord[];
  trucks: Truck[];
  onAddOrUpdateDelivery: (record: DeliveryRecord) => void;
  branches?: Branch[];
}

export default function DeliveryQueue({ deliveries, trucks, onAddOrUpdateDelivery, branches }: DeliveryQueueProps) {
  const BRANCHES = branches && branches.length > 0 ? branches : STATIC_BRANCHES;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('ALL');
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | DeliveryStatus>('ALL');

  const handleAssignTruck = (deliveryId: string, truckId: string) => {
    const delivery = deliveries.find(d => d.id === deliveryId);
    if (!delivery) return;

    const newTruck = trucks.find(t => t.id === truckId);
    if (!newTruck) return;

    const originStoreName = BRANCHES.find(b => b.id === delivery.originBranch)?.name || 'Local Store';
    const originalStatus = delivery.status;
    const oldTruck = trucks.find(t => t.id === delivery.assignedTruck);
    
    // Maintain the current status exactly to allow flexible pre-allocation of trucks
    // without automatically switching status from "REGISTERED" to "LOADED".
    const updatedStatus = originalStatus;

    let notes = '';
    if (delivery.assignedTruck && delivery.assignedTruck !== truckId) {
      // This is a SWAP / BREAKDOWN / RE-ROUTING scenario
      notes = `Truck swap performed (Potential Breakdown / Logistics Re-route). Transferred cargo from ${oldTruck?.name || delivery.assignedTruck} to ${newTruck.name} (Driver: ${newTruck.driver}).`;
    } else {
      notes = `Allocated truck to delivery path: ${newTruck.name} (Driver: ${newTruck.driver}).`;
    }

    const updatedHistory = [
      ...delivery.history,
      {
        status: updatedStatus,
        timestamp: new Date().toISOString(),
        location: originStoreName,
        operator: 'Logistics Board Coordinator',
        notes: notes
      }
    ];

    const updatedRecord: DeliveryRecord = {
      ...delivery,
      assignedTruck: newTruck.id,
      assignedDriver: newTruck.driver,
      status: updatedStatus,
      history: updatedHistory
    };

    onAddOrUpdateDelivery(updatedRecord);
  };

  const handleLoadCargo = (deliveryId: string) => {
    const delivery = deliveries.find(d => d.id === deliveryId);
    if (!delivery) return;

    const originStoreName = BRANCHES.find(b => b.id === delivery.originBranch)?.name || 'Local Store';
    
    const updatedHistory = [
      ...delivery.history,
      {
        status: DeliveryStatus.PICKED_AND_LOADED,
        timestamp: new Date().toISOString(),
        location: originStoreName,
        operator: 'Logistics Board Coordinator',
        notes: `Cargo confirmed physically loaded onto assigned truck.`
      }
    ];

    const updatedRecord: DeliveryRecord = {
      ...delivery,
      status: DeliveryStatus.PICKED_AND_LOADED,
      history: updatedHistory
    };

    onAddOrUpdateDelivery(updatedRecord);
  };

  // Toggle record expanded state
  const toggleExpand = (id: string) => {
    if (expandedRecord === id) {
      setExpandedRecord(null);
    } else {
      setExpandedRecord(id);
    }
  };

  // Filter logic
  const filtered = deliveries.filter(record => {
    // 1. Status Tab Filter
    if (activeTab !== 'ALL' && record.status !== activeTab) {
      return false;
    }

    // 2. Branch Filter
    if (selectedBranchFilter !== 'ALL' && record.originBranch !== selectedBranchFilter) {
      return false;
    }

    // 3. Text Search Filter (Barcode or Customer or invoice)
    const text = searchQuery.toLowerCase();
    if (text) {
      return (
        record.id.toLowerCase().includes(text) ||
        record.customerName.toLowerCase().includes(text) ||
        record.invoiceNumber.toLowerCase().includes(text) ||
        record.epicorSalesOrder.toLowerCase().includes(text) ||
        record.deliveryAddress.toLowerCase().includes(text)
      );
    }

    return true;
  });

  return (
    <div className="space-y-6" id="delivery-queue-tab">
      
      {/* Top action row */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h4 className="font-sans font-bold text-gray-900 tracking-tight text-xl">Lumber & Freight Logistics Board</h4>
          <p className="text-xs text-gray-500">Search and track live status profiles of active customer deliveries across regional hubs</p>
        </div>

        {/* Filter selections */}
        <div className="flex flex-col sm:flex-row gap-2 max-w-xl w-full md:w-auto">
          {/* Search box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search Customer, Barcode, Inv..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 pl-9 pr-3 py-2 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
          </div>

          {/* Branch selector */}
          <select
            value={selectedBranchFilter}
            onChange={(e) => setSelectedBranchFilter(e.target.value)}
            className="border border-slate-200 px-3 py-2 text-xs rounded-lg bg-white text-gray-800"
          >
            <option value="ALL">All Depot Stations</option>
            {BRANCHES.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-100 flex overflow-x-auto space-x-6 pb-px">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`pb-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'ALL' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          🗂️ All Deliveries ({deliveries.length})
        </button>
        <button
          onClick={() => setActiveTab(DeliveryStatus.REGISTERED)}
          className={`pb-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === DeliveryStatus.REGISTERED ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          1️⃣ Registered ({deliveries.filter(d => d.status === DeliveryStatus.REGISTERED).length})
        </button>
        <button
          onClick={() => setActiveTab(DeliveryStatus.PICKED_AND_LOADED)}
          className={`pb-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === DeliveryStatus.PICKED_AND_LOADED ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          2️⃣ Loaded on Truck ({deliveries.filter(d => d.status === DeliveryStatus.PICKED_AND_LOADED).length})
        </button>
        <button
          onClick={() => setActiveTab(DeliveryStatus.DELIVERED)}
          className={`pb-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === DeliveryStatus.DELIVERED ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          3️⃣ Completed ({deliveries.filter(d => d.status === DeliveryStatus.DELIVERED).length})
        </button>
        <button
          onClick={() => setActiveTab(DeliveryStatus.RETURNED)}
          className={`pb-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === DeliveryStatus.RETURNED ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          ⚠️ Returns / Blocked ({deliveries.filter(d => d.status === DeliveryStatus.RETURNED).length})
        </button>
      </div>

      {/* Main Board queue */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-200 text-center py-12 text-gray-500 rounded-xl">
            <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold">No records match the current filter criteria</p>
            <p className="text-xs">Try adjusting your branch selection, state tab, or search string.</p>
          </div>
        ) : (
          filtered.map(delivery => {
            const isExpanded = expandedRecord === delivery.id;
            return (
              <div 
                key={delivery.id} 
                className={`bg-white border rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md ${
                  delivery.status === DeliveryStatus.REGISTERED ? 'border-orange-100 hover:border-orange-200' :
                  delivery.status === DeliveryStatus.PICKED_AND_LOADED ? 'border-amber-100 hover:border-amber-200' :
                  delivery.status === DeliveryStatus.DELIVERED ? 'border-green-100 hover:border-green-200' :
                  'border-red-100 hover:border-red-200'
                }`}
              >
                
                {/* Header Header Summary */}
                <div 
                  onClick={() => toggleExpand(delivery.id)}
                  className="p-4 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 select-none"
                >
                  
                  {/* Left Column: Barcode & Origin */}
                  <div className="flex items-start space-x-3">
                    <div className="p-2.5 bg-slate-50 rounded-lg hidden sm:block font-mono text-center">
                      <span className="text-[9px] text-gray-400 block uppercase font-bold">SO Ref</span>
                      <strong className="text-slate-700 text-xs font-bold">{delivery.epicorSalesOrder}</strong>
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-extrabold text-blue-600 text-sm tracking-tight">{delivery.id}</span>
                        <span className="text-xs text-gray-400">|</span>
                        <span className="text-[10px] font-mono text-slate-500 font-semibold uppercase">Inv: {delivery.invoiceNumber}</span>
                      </div>

                      <div className="flex items-center space-x-2 mt-1">
                        <MapPin className="h-3 w-3 text-red-500" />
                        <span className="text-xs font-semibold text-gray-800">{delivery.customerName}</span>
                        <span className="text-gray-300">&bull;</span>
                        <span className="text-xs text-gray-500 truncate max-w-xs">{delivery.deliveryAddress}</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Column: Logistics Driver & Origin Store */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="flex items-center space-x-1 py-1 px-2.5 bg-slate-50 rounded text-slate-700">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-mono text-[11px]">{new Date(delivery.registeredAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </div>

                    <div className="py-1 px-2.5 bg-slate-50 border border-slate-100 rounded text-[11px] text-slate-600">
                      Depot: <strong className="text-slate-800">{BRANCHES.find(b => b.id === delivery.originBranch)?.name.replace('ProSpaces ', '')}</strong>
                    </div>

                    {(() => {
                      const matchedTruck = trucks.find(t => t.id === delivery.assignedTruck);
                      if (matchedTruck) {
                        return (
                          <div className="py-1 px-2.5 bg-blue-50 border border-blue-100 text-blue-900 font-semibold rounded-lg text-[11px] flex items-center space-x-1 shadow-sm font-sans">
                            <span className="text-xs">🚚</span>
                            <span>{matchedTruck.name}</span>
                            <span className="text-slate-300">&bull;</span>
                            <span className="text-gray-600 font-medium font-mono">({matchedTruck.driver})</span>
                          </div>
                        );
                      } else if (delivery.assignedDriver) {
                        return (
                          <div className="py-1 px-2.5 bg-slate-100 text-slate-800 font-medium rounded text-[11px] flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mr-1.5"></span>
                            {delivery.assignedDriver}
                          </div>
                        );
                      } else {
                        return (
                          <span className="text-slate-400 text-[10px] font-mono italic">No fleet assigned</span>
                        );
                      }
                    })()}
                  </div>

                  {/* Right Column: Status Banner */}
                  <div className="flex items-center space-x-3 self-end md:self-auto">
                    {delivery.status === DeliveryStatus.REGISTERED && (
                      <span className="px-3 py-1 bg-orange-50 border border-orange-100 text-orange-700 rounded-full text-xs font-bold font-sans">
                        1️⃣ Registered
                      </span>
                    )}
                    {delivery.status === DeliveryStatus.PICKED_AND_LOADED && (
                      <span className="px-3 py-1 bg-amber-50 border border-amber-100 text-amber-700 rounded-full text-xs font-bold font-sans animate-pulse">
                        2️⃣ Loaded
                      </span>
                    )}
                    {delivery.status === DeliveryStatus.DELIVERED && (
                      <span className="px-3 py-1 bg-green-50 border border-green-100 text-green-700 rounded-full text-xs font-bold font-sans flex items-center">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        3️⃣ Delivered
                      </span>
                    )}
                    {delivery.status === DeliveryStatus.RETURNED && (
                      <span className="px-3 py-1 bg-red-50 border border-red-100 text-red-600 rounded-full text-xs font-bold font-sans flex items-center">
                        <AlertTriangle className="h-3.5 w-3.5 mr-1 text-red-500" />
                        ⚠️ Returned
                      </span>
                    )}

                    <div>
                      {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                    </div>
                  </div>

                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div className="border-t border-dashed border-slate-100 p-5 bg-slate-50/50 grid grid-cols-1 md:grid-cols-12 gap-6 text-xs text-gray-700">
                    
                    {/* Left details (Columns 1-6) */}
                    <div className="md:col-span-6 space-y-4">
                      
                      {/* Shipping detail cards */}
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <h5 className="font-bold text-gray-900 mb-1 uppercase tracking-wider font-mono text-[10px]">Recipient Instructions</h5>
                          <div className="bg-white border border-slate-100 rounded-xl p-3 space-y-1.5 shadow-sm">
                            <p><span className="text-gray-400">Customer Address:</span> <strong>{delivery.deliveryAddress}</strong></p>
                            <p><span className="text-gray-400">Phone Contact:</span> <strong className="font-mono">{delivery.phone}</strong></p>
                            {delivery.destinationNotes && (
                              <p className="mt-1 pt-1.5 border-t border-slate-50 text-gray-600 italic">
                                &ldquo;{delivery.destinationNotes}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Interactive Truck Selection & Confirmation Desk */}
                        {delivery.status !== DeliveryStatus.DELIVERED && (
                          <div className="bg-white border border-slate-100 rounded-xl p-3.5 space-y-3 shadow-sm">
                            <div className="flex items-center justify-between">
                              <h5 className="font-bold text-gray-900 uppercase tracking-wider font-mono text-[10px] flex items-center">
                                <TruckIcon className="h-3.5 w-3.5 text-blue-600 mr-1.5" />
                                Allocate Depot Delivery Truck
                              </h5>
                              {delivery.assignedTruck ? (
                                <span className="text-[9px] bg-blue-100 text-blue-800 border border-blue-200 font-bold px-2 py-0.5 rounded-full uppercase">
                                  {delivery.status === DeliveryStatus.PICKED_AND_LOADED ? '🚚 Loaded' : '👍 Assigned'}
                                </span>
                              ) : (
                                <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 font-bold px-2 py-0.5 rounded-full uppercase font-mono">
                                  Pending Truck
                                </span>
                              )}
                            </div>
                            
                            <div className="space-y-2">
                              <p className="text-[10px] text-gray-500 font-sans leading-relaxed">
                                Assign or re-route a flatbed truck crane under ProSpaces fleet for this delivery ticket:
                              </p>
                              
                              <select
                                value={delivery.assignedTruck || ''}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAssignTruck(delivery.id, e.target.value);
                                  }
                                }}
                                className="w-full border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                              >
                                <option value="">-- Choose fleet transport truck --</option>
                                {(() => {
                                  const localDepotTrucks = trucks.filter(t => t.branchId === delivery.originBranch);
                                  const otherDepotTrucks = trucks.filter(t => t.branchId !== delivery.originBranch);
                                  return (
                                    <>
                                      {localDepotTrucks.length > 0 && (
                                        <optgroup label={`Local Store Fleet (${BRANCHES.find(b => b.id === delivery.originBranch)?.name.replace(' ProSpaces', '')})`}>
                                          {localDepotTrucks.map(t => (
                                            <option key={t.id} value={t.id}>
                                              🚚 {t.name} (Driver: {t.driver}) — {t.type}
                                            </option>
                                          ))}
                                        </optgroup>
                                      )}
                                      {otherDepotTrucks.length > 0 && (
                                        <optgroup label="Other Regional Store Fleets">
                                          {otherDepotTrucks.map(t => {
                                            const branchName = BRANCHES.find(b => b.id === t.branchId)?.name.replace(' ProSpaces', '') || 'Other';
                                            return (
                                              <option key={t.id} value={t.id}>
                                                🚚 {t.name} (Driver: {t.driver}) — [{branchName}]
                                              </option>
                                            );
                                          })}
                                        </optgroup>
                                      )}
                                    </>
                                  );
                                })()}
                              </select>
                              
                              {/* Option to load truck directly on the board */}
                              {delivery.status === DeliveryStatus.REGISTERED && delivery.assignedTruck && (
                                <button
                                  onClick={() => handleLoadCargo(delivery.id)}
                                  className="w-full mt-1 bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-800 hover:to-blue-900 text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center space-x-1 px-3 shadow-xs transition-colors"
                                >
                                  <span>📦 Confirm Cargo Loaded on Truck</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Hardware outcome validation */}
                      {delivery.status === DeliveryStatus.DELIVERED && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 space-y-2 text-emerald-800">
                          <h6 className="font-bold flex items-center">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mr-1.5" /> 
                            Proof of Delivery Sign-off
                          </h6>
                          <p className="font-mono text-[11px]">Signature Handoff File: <strong>&ldquo;{delivery.customerSignature}&rdquo;</strong></p>
                          {delivery.deliveryPhoto && (
                            <div className="rounded-lg overflow-hidden border border-emerald-200 mt-1 max-w-sm">
                              <img src={delivery.deliveryPhoto} alt="Lumber placement dropoff check" className="h-32 w-full object-cover" />
                              <div className="bg-emerald-100/90 py-1 text-center font-mono text-[9px] text-emerald-900 border-t border-emerald-200">
                                🛡️ Timestamped and Location coordinates Verified
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {delivery.status === DeliveryStatus.RETURNED && (
                        <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-2 text-red-800">
                          <h6 className="font-bold flex items-center">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-600 mr-1.5" /> 
                            Driver Exception Report
                          </h6>
                          <p>Reason: <strong className="text-red-900 italic">&ldquo;{delivery.returnReason}&rdquo;</strong></p>
                          <p className="text-[10px] text-red-600">
                            * Cargo is checked back into local inventory. ERP Sales order marked with tracking error.
                          </p>
                        </div>
                      )}

                    </div>

                    {/* Right event audit trail history (Columns 7-12) */}
                    <div className="md:col-span-6 space-y-3">
                      <h5 className="font-bold text-gray-900 uppercase tracking-wider font-mono text-[10px]">Real-time Event Audit Trail</h5>
                      
                      <div className="relative border-l border-slate-300 pl-4 py-1.5 ml-2 space-y-4">
                        {delivery.history.map((h, i) => (
                          <div key={i} className="relative">
                            <span className="absolute -left-[21px] mt-1.5 w-2 h-2 rounded-full bg-blue-600 border-2 border-white"></span>
                            <div className="flex items-center justify-between font-mono text-[10px] text-gray-400">
                              <span>{new Date(h.timestamp).toLocaleString()}</span>
                              <span className="font-bold text-slate-500 bg-slate-100 px-1 py-0.25 rounded">{h.operator}</span>
                            </div>
                            <p className="font-bold font-sans text-gray-800 text-[11px] mt-0.5">{h.status}</p>
                            <p className="text-gray-500 text-[11px] mt-0.5 italic">{h.notes}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
