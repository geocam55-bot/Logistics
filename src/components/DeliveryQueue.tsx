import { formatPhoneNumber } from '../lib/formatters';
import { useState, FormEvent } from 'react';
import { DeliveryRecord, DeliveryStatus, Branch, Truck, User as AppUser } from '../types';
import { 
  Search, MapPin, Eye, Clock, User, Phone, CheckCircle2, 
  AlertTriangle, ChevronDown, ChevronUp, FileText, 
  Truck as TruckIcon, MoreVertical, Edit, Trash2, Plus, X 
} from 'lucide-react';

interface DeliveryQueueProps {
  deliveries: DeliveryRecord[];
  trucks: Truck[];
  onAddOrUpdateDelivery: (record: DeliveryRecord) => void;
  onDeleteDelivery: (id: string) => void;
  branches?: Branch[];
  users: AppUser[];
}

export default function DeliveryQueue({ deliveries, trucks, onAddOrUpdateDelivery, onDeleteDelivery, branches, users }: DeliveryQueueProps) {
  const BRANCHES = branches || [];
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | DeliveryStatus>('ALL');

  // Action Menu & Modal States
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DeliveryRecord | null>(null);
  const [showDeleteConfirmId, setShowDeleteConfirmId] = useState<string | null>(null);

  // Form Field States
  const [formId, setFormId] = useState('');
  const [formInvoiceNumber, setFormInvoiceNumber] = useState('');
  const [formSalesOrder, setFormSalesOrder] = useState('');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formOriginBranch, setFormOriginBranch] = useState('');
  const [formWeight, setFormWeight] = useState('');
  const [formOrderTotal, setFormOrderTotal] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<DeliveryStatus>(DeliveryStatus.REGISTERED);
  const [formAssignedTruck, setFormAssignedTruck] = useState('');
  const [formReturnReason, setFormReturnReason] = useState('');
  const [formSignature, setFormSignature] = useState('');
  const [formPhoto, setFormPhoto] = useState('');
  const [formPdfUrl, setFormPdfUrl] = useState('');
  const [formPicker, setFormPicker] = useState('');
  const [formDeliveredAt, setFormDeliveredAt] = useState('');
  const [formRegisteredAt, setFormRegisteredAt] = useState('');

  // Picker selection quick popup state
  const [pickerModalDeliveryId, setPickerModalDeliveryId] = useState<string | null>(null);
  const [quickSelectedPicker, setQuickSelectedPicker] = useState('');

  const handleOpenAddModal = () => {
    const randomTicketNum = Math.floor(10000 + Math.random() * 90000);
    const randomSalesOrder = Math.floor(1000000 + Math.random() * 9000000);
    const randomInvoiceNum = Math.floor(4000 + Math.random() * 5999);
    
    setEditingRecord(null);
    setFormId(`SO-${randomTicketNum}-A`);
    setFormInvoiceNumber(`INV-${randomInvoiceNum}-B`);
    setFormSalesOrder(String(randomSalesOrder));
    setFormCustomerName('');
    setFormAddress('');
    setFormPhone('');
    setFormOriginBranch(BRANCHES[0]?.id || 'WINDMILL_DC');
    setFormWeight('');
    setFormOrderTotal('');
    setFormNotes('');
    setFormStatus(DeliveryStatus.REGISTERED);
    setFormAssignedTruck('');
    setFormReturnReason('');
    setFormSignature('');
    setFormPhoto('');
    setFormPdfUrl('');
    setFormPicker('');
    setFormRegisteredAt(new Date().toISOString().substring(0, 10));
    setFormDeliveredAt('');
    
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (record: DeliveryRecord) => {
    setEditingRecord(record);
    setFormId(record.id);
    setFormInvoiceNumber(record.invoiceNumber || '');
    setFormSalesOrder(record.epicorSalesOrder || '');
    setFormCustomerName(record.customerName || '');
    setFormAddress(record.deliveryAddress || '');
    setFormPhone(record.phone || '');
    setFormOriginBranch(record.originBranch || BRANCHES[0]?.id || 'WINDMILL_DC');
    setFormWeight(record.weight || '');
    setFormOrderTotal(record.orderTotal || '');
    setFormNotes(record.destinationNotes || '');
    setFormStatus(record.status || DeliveryStatus.REGISTERED);
    setFormAssignedTruck(record.assignedTruck || '');
    setFormReturnReason(record.returnReason || '');
    setFormSignature(record.customerSignature || '');
    setFormPhoto(record.deliveryPhoto || '');
    setFormPdfUrl(record.pdfUrl || '');
    setFormPicker(record.assignedPicker || '');
    setFormRegisteredAt(record.registeredAt ? record.registeredAt.substring(0, 10) : new Date().toISOString().substring(0, 10));
    setFormDeliveredAt(record.deliveredAt ? record.deliveredAt.substring(0, 10) : '');
    
    setIsModalOpen(true);
  };

  const handleSaveDelivery = (e: FormEvent) => {
    e.preventDefault();
    if (!formId.trim() || !formCustomerName.trim() || !formAddress.trim()) {
      alert("Please enter a valid ticket reference ID, customer name, and customer address.");
      return;
    }

    if (formStatus === DeliveryStatus.PICKED_AND_LOADED && !formPicker) {
      alert("A picker must be chosen and cannot be left blank when moving to Loaded on Truck.");
      return;
    }

    const matchedTruck = trucks.find(t => t.id === formAssignedTruck);
    const originStoreName = BRANCHES.find(b => b.id === formOriginBranch)?.name || 'Local Store';
    
    const pickerUser = users.find(u => u.id === formPicker) || users.find(u => u.name === formPicker);
    const pickerName = pickerUser ? pickerUser.name : formPicker;

    if (editingRecord) {
      // Edit Mode
      const isStatusChanged = editingRecord.status !== formStatus;
      const isTruckChanged = editingRecord.assignedTruck !== formAssignedTruck;
      
      let newHistory = [...editingRecord.history];
      
      if (isStatusChanged) {
        let historyNotes = `Status manually updated from ${editingRecord.status} to ${formStatus} via Action form.`;
        if (formStatus === DeliveryStatus.PICKED_AND_LOADED && pickerName) {
          historyNotes = `Cargo manually moved to Loaded on Truck stage. Picker assigned: ${pickerName}.`;
        }
        newHistory.push({
          status: formStatus,
          timestamp: new Date().toISOString(),
          location: originStoreName,
          operator: 'Logistics Board Coordinator',
          notes: historyNotes
        });
      }
      
      if (isTruckChanged && formAssignedTruck) {
        newHistory.push({
          status: formStatus,
          timestamp: new Date().toISOString(),
          location: originStoreName,
          operator: 'Logistics Board Coordinator',
          notes: `Manually re-allocated delivery path to flatbed: ${matchedTruck?.name || formAssignedTruck} (Driver: ${matchedTruck?.driver || 'N/A'}).`
        });
      } else if (isTruckChanged && !formAssignedTruck) {
        newHistory.push({
          status: formStatus,
          timestamp: new Date().toISOString(),
          location: originStoreName,
          operator: 'Logistics Board Coordinator',
          notes: `Deallocated truck assignments.`
        });
      }

      const updatedRecord: DeliveryRecord = {
        ...editingRecord,
        id: formId,
        invoiceNumber: formInvoiceNumber,
        epicorSalesOrder: formSalesOrder,
        customerName: formCustomerName,
        deliveryAddress: formAddress,
        phone: formPhone,
        originBranch: formOriginBranch,
        weight: formWeight || undefined,
        orderTotal: formOrderTotal || undefined,
        destinationNotes: formNotes || undefined,
        status: formStatus,
        registeredAt: formRegisteredAt ? new Date(formRegisteredAt).toISOString() : (editingRecord?.registeredAt || new Date().toISOString()),
        deliveredAt: formStatus === DeliveryStatus.DELIVERED 
          ? (formDeliveredAt ? new Date(formDeliveredAt).toISOString() : (editingRecord?.deliveredAt || new Date().toISOString())) 
          : undefined,
        assignedTruck: formAssignedTruck || undefined,
        assignedDriver: matchedTruck?.driver || undefined,
        assignedPicker: formStatus === DeliveryStatus.PICKED_AND_LOADED ? pickerName : (editingRecord?.assignedPicker || undefined),
        returnReason: formStatus === DeliveryStatus.RETURNED ? (formReturnReason || undefined) : undefined,
        customerSignature: formStatus === DeliveryStatus.DELIVERED ? (formSignature || editingRecord.customerSignature || 'Physical Signoff Done') : undefined,
        deliveryPhoto: formStatus === DeliveryStatus.DELIVERED ? (formPhoto || editingRecord.deliveryPhoto || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=80') : undefined,
        pdfUrl: formPdfUrl || undefined,
        history: newHistory
      };

      onAddOrUpdateDelivery(updatedRecord);
    } else {
      // Add Mode
      const newHistory = [
        {
          status: formStatus,
          timestamp: new Date().toISOString(),
          location: originStoreName,
          operator: 'Logistics Board Coordinator',
          notes: 'Ticket manually registered to Lumber depot freight ledger.'
        }
      ];

      if (formAssignedTruck) {
        newHistory.push({
          status: formStatus,
          timestamp: new Date().toISOString(),
          location: originStoreName,
          operator: 'Logistics Board Coordinator',
          notes: `Allocated truck to delivery path on creation: ${matchedTruck?.name || formAssignedTruck} (Driver: ${matchedTruck?.driver || 'N/A'}).`
        });
      }

      const newRecord: DeliveryRecord = {
        id: formId,
        invoiceNumber: formInvoiceNumber,
        epicorSalesOrder: formSalesOrder,
        customerName: formCustomerName,
        deliveryAddress: formAddress,
        phone: formPhone,
        originBranch: formOriginBranch,
        weight: formWeight || undefined,
        orderTotal: formOrderTotal || undefined,
        destinationNotes: formNotes || undefined,
        status: formStatus,
        registeredAt: formRegisteredAt ? new Date(formRegisteredAt).toISOString() : new Date().toISOString(),
        deliveredAt: formStatus === DeliveryStatus.DELIVERED 
          ? (formDeliveredAt ? new Date(formDeliveredAt).toISOString() : new Date().toISOString()) 
          : undefined,
        assignedTruck: formAssignedTruck || undefined,
        assignedDriver: matchedTruck?.driver || undefined,
        assignedPicker: formStatus === DeliveryStatus.PICKED_AND_LOADED ? pickerName : undefined,
        returnReason: formStatus === DeliveryStatus.RETURNED ? (formReturnReason || undefined) : undefined,
        customerSignature: formStatus === DeliveryStatus.DELIVERED ? (formSignature || 'Physical Handoff Validated') : undefined,
        deliveryPhoto: formStatus === DeliveryStatus.DELIVERED ? (formPhoto || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=80') : undefined,
        pdfUrl: formPdfUrl || undefined,
        history: newHistory
      };

      onAddOrUpdateDelivery(newRecord);
    }

    setIsModalOpen(false);
  };

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
    setPickerModalDeliveryId(deliveryId);
    setQuickSelectedPicker('');
  };

  const handleConfirmQuickPickerLoad = () => {
    if (!pickerModalDeliveryId) return;
    if (!quickSelectedPicker) {
      alert("A picker must be chosen and cannot be left blank.");
      return;
    }

    const delivery = deliveries.find(d => d.id === pickerModalDeliveryId);
    if (!delivery) return;

    const pickerUser = users.find(u => u.id === quickSelectedPicker) || users.find(u => u.name === quickSelectedPicker);
    const pickerName = pickerUser ? pickerUser.name : quickSelectedPicker;

    const originStoreName = BRANCHES.find(b => b.id === delivery.originBranch)?.name || 'Local Store';
    
    const updatedHistory = [
      ...delivery.history,
      {
        status: DeliveryStatus.PICKED_AND_LOADED,
        timestamp: new Date().toISOString(),
        location: originStoreName,
        operator: `Picker: ${pickerName} / Board Coordinator`,
        notes: `Cargo manually confirmed loaded onto truck. Picker assigned: ${pickerName}.`
      }
    ];

    const updatedRecord: DeliveryRecord = {
      ...delivery,
      status: DeliveryStatus.PICKED_AND_LOADED,
      assignedPicker: pickerName,
      history: updatedHistory
    };

    onAddOrUpdateDelivery(updatedRecord);
    setPickerModalDeliveryId(null);
    setQuickSelectedPicker('');
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
      if (!(
        record.id.toLowerCase().includes(text) ||
        record.customerName.toLowerCase().includes(text) ||
        record.invoiceNumber.toLowerCase().includes(text) ||
        record.epicorSalesOrder.toLowerCase().includes(text) ||
        record.deliveryAddress.toLowerCase().includes(text)
      )) {
        return false;
      }
    }

    // 4. Date Filter (track by deliveredAt if delivered, or registeredAt if not yet delivered)
    if (selectedDateFilter) {
      const recordDate = record.deliveredAt 
        ? record.deliveredAt.substring(0, 10) 
        : record.registeredAt?.substring(0, 10);
      if (recordDate !== selectedDateFilter) {
        return false;
      }
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
        <div className="flex flex-col sm:flex-row gap-2 max-w-xl w-full md:w-auto items-stretch sm:items-center">
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center justify-center space-x-1 bg-blue-850 hover:bg-blue-900 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors shadow-sm cursor-pointer shrink-0"
            id="add-delivery-ticket-btn"
          >
            <Plus className="h-4 w-4" />
            <span>Add Delivery</span>
          </button>

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

          {/* Datepicker Filter */}
          <div className="relative">
            <input 
              type="date"
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="border border-slate-200 px-3 py-2 text-xs rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono w-full sm:w-auto"
              title="Filter deliveries by date (Delivered Date for completed, or Registration Date for pending)"
            />
            {selectedDateFilter && (
              <button
                type="button"
                onClick={() => setSelectedDateFilter('')}
                className="absolute right-7 top-2 text-[10px] font-bold text-red-500 hover:text-red-700 bg-white px-1 rounded"
              >
                Clear
              </button>
            )}
          </div>

          {/* Branch selector */}
          <select
            value={selectedBranchFilter}
            onChange={(e) => setSelectedBranchFilter(e.target.value)}
            className="border border-slate-200 px-3 py-2 text-xs rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                className={`relative bg-white border rounded-xl shadow-sm transition-all hover:shadow-md ${
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
                        {delivery.pdfUrl && (
                          <>
                            <span className="text-xs text-slate-300">|</span>
                            <a
                              href={delivery.pdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-sans font-extrabold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors"
                              title="View server archived PDF document source"
                            >
                              <FileText className="h-3 w-3 mr-1 text-indigo-600 animate-pulse" />
                              PDF Source
                            </a>
                          </>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 mt-1">
                        <MapPin className="h-3 w-3 text-red-500" />
                        <span className="text-xs font-semibold text-gray-800">{delivery.customerName}</span>
                        <span className="text-gray-300">&bull;</span>
                        <span className="text-xs text-gray-500 truncate max-w-xs">{delivery.deliveryAddress}</span>
                      </div>

                      {(delivery.weight || delivery.orderTotal) && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {delivery.weight && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              ⚖️ Weight: <span className="text-slate-800 ml-1">{delivery.weight}</span>
                            </span>
                          )}
                          {delivery.orderTotal && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              💰 Total: <span className="text-emerald-900 ml-1 font-extrabold">{delivery.orderTotal}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle Column: Logistics Driver & Origin Store */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center space-x-1.5 py-1 px-2.5 bg-slate-50 rounded text-slate-700 text-[10px]" title="Registration / Staging Date">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span className="font-mono font-semibold">Reg: {new Date(delivery.registeredAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      {delivery.deliveredAt && (
                        <div className="flex items-center space-x-1.5 py-1 px-2.5 bg-green-50 border border-green-100 rounded text-green-800 text-[10px]" title="Actual Delivery Date">
                          <CheckCircle2 className="h-3 w-3 text-green-500 animate-pulse" />
                          <span className="font-mono font-bold">Delivered: {new Date(delivery.deliveredAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      )}
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

                    {delivery.assignedPicker && (
                      <div className="py-1 px-2.5 bg-emerald-50 border border-emerald-100 text-emerald-900 font-semibold rounded-lg text-[11px] flex items-center space-x-1 shadow-sm font-sans">
                        <span className="text-xs">👤</span>
                        <span className="text-gray-500 font-medium">Picker:</span>
                        <span className="text-emerald-800 font-semibold">{delivery.assignedPicker}</span>
                      </div>
                    )}
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

                    <div className="flex items-center space-x-2 relative" onClick={(e) => e.stopPropagation()}>
                      {/* Action Menu dropdown trigger */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdownId(activeDropdownId === delivery.id ? null : delivery.id);
                        }}
                        className="p-1 px-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors focus:outline-none"
                        title="Delivery Actions Menu"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      
                      {/* Dropdown element */}
                      {activeDropdownId === delivery.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdownId(null);
                            }}
                          />
                          <div 
                            className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden py-1"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                handleOpenEditModal(delivery);
                                setActiveDropdownId(null);
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center space-x-2 font-semibold transition-colors border-b border-slate-50"
                            >
                              <Edit className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Edit Ticket</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowDeleteConfirmId(delivery.id);
                                setActiveDropdownId(null);
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center space-x-2 font-semibold transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-600" />
                              <span>Delete Ticket</span>
                            </button>
                          </div>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleExpand(delivery.id)}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </button>
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
                        {delivery.pdfUrl && (
                          <div>
                            <h5 className="font-bold text-gray-900 mb-1 uppercase tracking-wider font-mono text-[10px]">Physical Document Archive</h5>
                            <div className="bg-gradient-to-br from-indigo-50/50 to-blue-50/50 border border-indigo-100 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
                              <div className="flex items-center space-x-2.5">
                                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                                  <FileText className="h-4 w-4" />
                                </div>
                                <div className="text-[11px]">
                                  <p className="font-bold text-slate-800 font-mono">{delivery.id}_physical.pdf</p>
                                  <p className="text-slate-500">Inbound OCR digitized physical copy archived on server</p>
                                </div>
                              </div>
                              <a
                                href={delivery.pdfUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold shadow-xs hover:shadow-sm transition-all flex items-center space-x-1 cursor-pointer"
                              >
                                <span>Open PDF</span>
                              </a>
                            </div>
                          </div>
                        )}

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

                        {(delivery.weight || delivery.orderTotal) && (
                          <div>
                            <h5 className="font-bold text-gray-900 mb-1 uppercase tracking-wider font-mono text-[10px]">Document-Mapped Balances</h5>
                            <div className="bg-white border border-slate-100 rounded-xl p-3 grid grid-cols-2 gap-4 shadow-sm">
                              {delivery.weight && (
                                <div>
                                  <p className="text-gray-400 text-[9px] font-mono uppercase font-bold">Gross Freight Weight</p>
                                  <p className="text-sm font-black text-slate-800 font-mono mt-0.5">⚖️ {delivery.weight}</p>
                                </div>
                              )}
                              {delivery.orderTotal && (
                                <div>
                                  <p className="text-gray-400 text-[9px] font-mono uppercase font-bold">Total Mapped Value</p>
                                  <p className="text-sm font-black text-emerald-700 font-mono mt-0.5">💰 {delivery.orderTotal}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

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

      {/* Add / Edit Delivery Ticket Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-55 backdrop-blur-xs overflow-y-auto">
          <div 
            className="fixed inset-0" 
            onClick={() => setIsModalOpen(false)}
          />
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative z-10 animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div>
                <h4 className="font-sans font-extrabold text-slate-900 text-lg animate-fade-in">
                  {editingRecord ? '📝 Edit Delivery Ticket' : '➕ Register New Delivery'}
                </h4>
                <p className="text-xs text-gray-500">
                  {editingRecord ? `Modify tracking profiles for order ${editingRecord.id}` : 'Create a fresh customer freight ticket manual entry'}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 px-2 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Close Modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSaveDelivery} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* ID Barcode Reference */}
                <div>
                  <label className="block text-slate-600 font-bold mb-1 font-mono uppercase text-[10px]">Barcode / Ticket ID *</label>
                  <input 
                    type="text"
                    required
                    disabled={!!editingRecord}
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-lg disabled:text-gray-500 disabled:bg-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="SO-83941-A"
                  />
                  {!editingRecord && (
                    <span className="text-[10px] text-gray-400 mt-0.5 block">Autogenerated reference pattern</span>
                  )}
                </div>

                {/* Enterprise Sales Order Ref */}
                <div>
                  <label className="block text-slate-600 font-bold mb-1 font-mono uppercase text-[10px]">Sales Order Ref *</label>
                  <input 
                    type="text"
                    required
                    value={formSalesOrder}
                    onChange={(e) => setFormSalesOrder(e.target.value)}
                    className="w-full bg-white border border-slate-200 p-2 text-xs rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="7284910"
                  />
                </div>

                {/* Invoice Reference Number */}
                <div>
                  <label className="block text-slate-600 font-bold mb-1 font-mono uppercase text-[10px]">Invoice Number *</label>
                  <input 
                    type="text"
                    required
                    value={formInvoiceNumber}
                    onChange={(e) => setFormInvoiceNumber(e.target.value)}
                    className="w-full bg-white border border-slate-200 p-2 text-xs rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="INV-3920-B"
                  />
                </div>

                {/* Store Depot Station Selection */}
                <div>
                  <label className="block text-slate-600 font-bold mb-1 font-mono uppercase text-[10px]">Lumber Depot Origin Station *</label>
                  <select
                    value={formOriginBranch}
                    onChange={(e) => setFormOriginBranch(e.target.value)}
                    className="w-full bg-white border border-slate-200 p-2 text-xs rounded-lg text-gray-800 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {BRANCHES.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* Customer Contact Name */}
                <div className="sm:col-span-2">
                  <label className="block text-slate-600 font-bold mb-1 font-mono uppercase text-[10px]">Customer Recipient Name *</label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input 
                      type="text"
                      required
                      value={formCustomerName}
                      onChange={(e) => setFormCustomerName(e.target.value)}
                      className="w-full bg-white border border-slate-200 pl-8 p-2 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Builders Alliance Inc."
                    />
                  </div>
                </div>

                {/* Recipient Address */}
                <div className="sm:col-span-2">
                  <label className="block text-slate-600 font-bold mb-1 font-mono uppercase text-[10px]">Delivery Project Site Address *</label>
                  <div className="relative">
                    <MapPin className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input 
                      type="text"
                      required
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      className="w-full bg-white border border-slate-200 pl-8 p-2 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="1820 NW 54th Ave, Vancouver, WA"
                    />
                  </div>
                </div>

                {/* Customer Phone Contact */}
                <div>
                  <label className="block text-slate-600 font-bold mb-1 font-mono uppercase text-[10px]">Contact Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input 
                      type="text"
                      value={formPhone}
                      onChange={(e) => setFormPhone(formatPhoneNumber(e.target.value))}
                      className="w-full bg-white border border-slate-200 pl-8 p-2 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      placeholder="360-555-0144"
                    />
                  </div>
                </div>

                {/* Transport truck assignment */}
                <div>
                  <label className="block text-slate-600 font-bold mb-1 font-mono uppercase text-[10px]">Allocate Truck & Driver</label>
                  <select
                    value={formAssignedTruck}
                    onChange={(e) => setFormAssignedTruck(e.target.value)}
                    className="w-full bg-white border border-slate-200 p-2 text-xs rounded-lg text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- No flatbed assigned --</option>
                    {trucks.map(t => {
                      const dynamicBranch = BRANCHES.find(b => b.id === t.branchId)?.name.replace(' ProSpaces', '') || 'Other';
                      return (
                        <option key={t.id} value={t.id}>
                          🚚 {t.name} ({t.driver}) — [{dynamicBranch}]
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Freight weight */}
                <div>
                  <label className="block text-slate-600 font-bold mb-1 font-mono uppercase text-[10px]">Freight Cargo Gross Weight</label>
                  <input 
                    type="text"
                    value={formWeight}
                    onChange={(e) => setFormWeight(e.target.value)}
                    className="w-full bg-white border border-slate-200 p-2 text-xs rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="3,150 lbs"
                  />
                </div>

                {/* Value amount order total */}
                <div>
                  <label className="block text-slate-600 font-bold mb-1 font-mono uppercase text-[10px]">Order Value Total</label>
                  <input 
                    type="text"
                    value={formOrderTotal}
                    onChange={(e) => setFormOrderTotal(e.target.value)}
                    className="w-full bg-white border border-slate-200 p-2 text-xs rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="$1,450.00"
                  />
                </div>

                {/* Route sequence simulation state */}
                <div>
                  <label className="block text-slate-600 font-bold mb-1 font-mono uppercase text-[10px]">Tracking Lifecycle Stage *</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as DeliveryStatus)}
                    className="w-full bg-white border border-slate-200 p-2 text-xs rounded-lg font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value={DeliveryStatus.REGISTERED}>1️⃣ Registered / Queued</option>
                    <option value={DeliveryStatus.PICKED_AND_LOADED}>2️⃣ Picked & Loaded on Flatbed</option>
                    <option value={DeliveryStatus.DELIVERED}>3️⃣ Completed & Delivered</option>
                    <option value={DeliveryStatus.RETURNED}>⚠️ Blocked / Returned Exception</option>
                  </select>
                </div>

                {/* Staging / Registration Date */}
                <div>
                  <label className="block text-slate-600 font-bold mb-1 font-mono uppercase text-[10px]">Staging / Registration Date *</label>
                  <input 
                    type="date"
                    required
                    value={formRegisteredAt}
                    onChange={(e) => setFormRegisteredAt(e.target.value)}
                    className="w-full bg-white border border-slate-200 p-2 text-xs rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Picker selection if Picked & Loaded is chosen */}
                {formStatus === DeliveryStatus.PICKED_AND_LOADED && (
                  <div>
                    <label className="block text-slate-600 font-bold mb-1 font-mono uppercase text-[10px]">Assign Warehouse Picker *</label>
                    <select
                      required
                      value={formPicker}
                      onChange={(e) => setFormPicker(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-2 text-xs rounded-lg font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">-- Select Registered Picker (Required) --</option>
                      {users.filter(u => u.role === 'Picker').map(u => (
                        <option key={u.id} value={u.id}>
                          👤 {u.name} ({u.email})
                        </option>
                      ))}
                    </select>
                    {users.filter(u => u.role === 'Picker').length === 0 && (
                      <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1 font-sans leading-relaxed">
                        ⚠️ No users with <strong>Picker</strong> role are currently registered in the database. Setup an operational Picker profile in <strong>Fleet Setup &gt; Users Setup</strong> or via login screen registration.
                      </div>
                    )}
                  </div>
                )}

                {/* Return reason if exception is chosen */}
                {formStatus === DeliveryStatus.RETURNED && (
                  <div>
                    <label className="block text-red-600 font-bold mb-1 font-mono uppercase text-[10px]">Driver Exception Note/Reason *</label>
                    <input 
                      type="text"
                      required
                      value={formReturnReason}
                      onChange={(e) => setFormReturnReason(e.target.value)}
                      className="w-full bg-red-50 border border-red-200 p-2 text-xs rounded-lg text-red-900 font-medium focus:outline-none focus:ring-1 focus:ring-red-500"
                      placeholder="Customer refused, wrong size framing studs ordered"
                    />
                  </div>
                )}

                {/* Sign-off properties if Delivered */}
                {formStatus === DeliveryStatus.DELIVERED && (
                  <>
                    <div>
                      <label className="block text-green-600 font-bold mb-1 font-mono uppercase text-[10px]">Actual Date Delivered *</label>
                      <input 
                        type="date"
                        required
                        value={formDeliveredAt || new Date().toISOString().substring(0, 10)}
                        onChange={(e) => setFormDeliveredAt(e.target.value)}
                        className="w-full bg-green-50 border border-green-200 p-2 text-xs rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-indigo-600 font-bold mb-1 font-mono uppercase text-[10px]">Recipient Handover File Signature</label>
                      <input 
                        type="text"
                        value={formSignature}
                        onChange={(e) => setFormSignature(e.target.value)}
                        className="w-full bg-indigo-50/50 border border-indigo-100 p-2 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="John Doe (Verified via Handoff Pin)"
                      />
                    </div>
                    <div>
                      <label className="block text-indigo-600 font-bold mb-1 font-mono uppercase text-[10px]">Dropoff Proof Photo URL</label>
                      <input 
                        type="text"
                        value={formPhoto}
                        onChange={(e) => setFormPhoto(e.target.value)}
                        className="w-full bg-indigo-50/50 border border-indigo-100 p-2 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="https://images.unsplash.com/..."
                      />
                    </div>
                  </>
                )}

                {/* Server-side PDF archive path */}
                <div className="sm:col-span-2">
                  <label className="block text-indigo-600 font-bold mb-1 font-mono uppercase text-[10px]">Server Archived PDF/Image Source URL</label>
                  <input 
                    type="text"
                    value={formPdfUrl}
                    onChange={(e) => setFormPdfUrl(e.target.value)}
                    className="w-full bg-indigo-50/30 border border-indigo-100 p-2 text-xs rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="/uploads/SO-98471-A_source.pdf"
                  />
                </div>

                {/* Destination notes */}
                <div className="sm:col-span-2">
                  <label className="block text-slate-600 font-bold mb-1 font-mono uppercase text-[10px]">Recipient Instructions & Driver Dispatch Notes</label>
                  <textarea 
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    rows={2}
                    className="w-full bg-white border border-slate-200 p-2 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Unload by crane on NW gravel side pathway. Avoid wet front grass area."
                  />
                </div>

              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 rounded-lg text-gray-700 hover:bg-slate-200 transition-colors font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-900 shadow-sm transition-colors font-bold cursor-pointer"
                >
                  Confirm and Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                Confirm Deletion
              </h4>
            </div>
            
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              Are you sure you want to permanently delete delivery ticket <strong className="text-slate-900 font-semibold">{showDeleteConfirmId}</strong>? This action cannot be undone and will remove the item from all dashboards.
            </p>

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmId(null)}
                className="px-4 py-2 bg-slate-100 rounded-lg text-slate-700 hover:bg-slate-200 transition-colors font-semibold cursor-pointer text-xs"
              >
                Cancel, Keep Ticket
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteDelivery(showDeleteConfirmId);
                  setShowDeleteConfirmId(null);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm transition-colors font-bold cursor-pointer text-xs flex items-center space-x-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Picker Assignment Modal (Manual "Loaded on Truck" confirmation flow) */}
      {pickerModalDeliveryId && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-55 backdrop-blur-xs">
          <div 
            className="fixed inset-0" 
            onClick={() => setPickerModalDeliveryId(null)}
          />
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 max-w-md w-full relative z-10 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-2 text-blue-700 mb-4">
              <User className="h-5 w-5" />
              <h4 className="font-sans font-bold text-slate-900 text-lg">
                Assign Warehouse Picker
              </h4>
            </div>
            
            <p className="text-slate-600 text-sm mb-4 leading-relaxed">
              Moving manual ticket <strong className="text-slate-900 font-semibold">{pickerModalDeliveryId}</strong> to the <strong>Loaded on Truck</strong> stage requires identifying the picker responsible for staging the cargo.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-slate-500 font-bold mb-1 font-mono uppercase text-[10px]">Select Registered Picker *</label>
                <select
                  required
                  value={quickSelectedPicker}
                  onChange={(e) => setQuickSelectedPicker(e.target.value)}
                  className="w-full bg-white border border-slate-200 p-2.5 text-xs rounded-lg font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Choose Picker (Required) --</option>
                  {users.filter(u => u.role === 'Picker').map(u => (
                    <option key={u.id} value={u.id}>
                      👤 {u.name} ({u.email})
                    </option>
                  ))}
                </select>
                {users.filter(u => u.role === 'Picker').length === 0 && (
                  <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mt-2 font-sans leading-relaxed">
                    ⚠️ No users with the <strong>Picker</strong> role are registered. Please create a Picker in <strong>Fleet Setup &gt; Users Setup</strong> first, or register one in the portal registration.
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setPickerModalDeliveryId(null)}
                className="px-4 py-2 bg-slate-100 rounded-lg text-slate-700 hover:bg-slate-200 transition-colors font-semibold cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!quickSelectedPicker}
                onClick={handleConfirmQuickPickerLoad}
                className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 shadow-sm transition-colors font-bold cursor-pointer text-xs flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Confirm &amp; Load Truck</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
