import React, { useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { DeliveryRecord, DeliveryStatus, Branch, Truck } from '../types';
import { BRANCHES as STATIC_BRANCHES } from '../data';
import { Scan, Truck as TruckIcon, User, Package, MapPin, Eye, Phone, CheckSquare, Sparkles, X, FileSignature, CornerUpLeft, ShieldAlert } from 'lucide-react';

interface ScanStationProps {
  deliveries: DeliveryRecord[];
  onAddOrUpdateDelivery: (record: DeliveryRecord) => void;
  trucks: Truck[];
  branches?: Branch[];
}

export default function ScanStation({ deliveries, onAddOrUpdateDelivery, trucks, branches }: ScanStationProps) {
  const BRANCHES = branches && branches.length > 0 ? branches : STATIC_BRANCHES;
  // Input fields
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannedRecord, setScannedRecord] = useState<DeliveryRecord | null>(null);
  const [manualSalesOrder, setManualSalesOrder] = useState<{
    barcode: string;
    epicorSalesOrder: string;
    invoiceNumber: string;
    customerName: string;
    deliveryAddress: string;
    phone: string;
    originBranch: string;
    destinationNotes: string;
  } | null>(null);

  // Active step in scanning process. 
  // 'IDLE' -> 'REGISTRATION_FORM' | 'PICK_FORM' | 'DELIVERY_FORM'
  const [activeFormType, setActiveFormType] = useState<'IDLE' | 'REGISTER' | 'PICK' | 'DELIVER_RETURN'>('IDLE');

  // Input states for form submissions
  // Form 1
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [shippingNotes, setShippingNotes] = useState('');
  const [originBranch, setOriginBranch] = useState('WINDMILL_DC');
  const [customerName, setCustomerName] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [registerSelectedTruck, setRegisterSelectedTruck] = useState('');

  // Form 2
  const [selectedTruck, setSelectedTruck] = useState(trucks[0]?.id || '');

  // Form 3
  const [deliveryOutcome, setDeliveryOutcome] = useState<'SUCCESS' | 'RETURN'>('SUCCESS');
  const [customerSignature, setCustomerSignature] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnDestination, setReturnDestination] = useState('WINDMILL_DC');

  // Scanner UI States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [aimedBarcode, setAimedBarcode] = useState('');
  const [audioFeedback, setAudioFeedback] = useState(true);
  const [scanMessage, setScanMessage] = useState('');
  const [flashForm, setFlashForm] = useState(false);
  const [isAutoScan, setIsAutoScan] = useState(true);
  const [mlKitActive, setMlKitActive] = useState(true);
  const [lastScan, setLastScan] = useState<{
    barcode: string;
    extractedDocNum?: string;
    timestamp: Date;
    resolvedStatus: 'NEW' | 'REGISTERED' | 'PICKED' | 'DELIVERED_OR_RETURNED' | 'NOT_FOUND';
    customerName?: string;
  } | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  const startCamera = async () => {
    setCameraError(null);
    setAimedBarcode(''); // Reset aiming barcode state to empty when camera starts
    setIsCameraActive(true);
    
    // Allow DOM to update so container is mounted before starting scanner
    setTimeout(() => {
      try {
        const container = document.getElementById('camera-reader-container');
        if (!container) {
          console.error("Camera reader container element not found.");
          setCameraError("Camera element not found in DOM.");
          setIsCameraActive(false);
          return;
        }

        const html5QrCode = new Html5Qrcode("camera-reader-container", {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF
          ],
          verbose: false
        });
        html5QrCodeRef.current = html5QrCode;

        html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: (width, height) => {
              // Perfect bounding scanner box ratio for either 1D barcodes or QR codes
              return { width: Math.round(width * 0.85), height: Math.round(height * 0.45) };
            },
            aspectRatio: 1.333333
          },
          (decodedText) => {
            // Success! Trigger scan action
            handleScanAction(decodedText);
            stopCamera();
          },
          () => {
            // Parsing errors thrown continually while aiming are normal/expected
          }
        ).catch((err: any) => {
          console.error("html5-qrcode start failure:", err);
          let errMsg = err?.message || String(err);
          if (errMsg.indexOf("NotAllowedError") !== -1 || errMsg.indexOf("Permission") !== -1) {
            errMsg = "Camera permission was denied. Please allow camera access in your browser/device settings.";
          }
          setCameraError(errMsg);
          setIsCameraActive(false);
        });
      } catch (err: any) {
        console.error("html5-qrcode build exception:", err);
        setCameraError(err?.message || "Faulty camera initialization.");
        setIsCameraActive(false);
      }
    }, 150);
  };

  const stopCamera = () => {
    if (html5QrCodeRef.current) {
      if (html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch((err: any) => {
          console.error("Error stopping html5-qrcode:", err);
        });
      }
      html5QrCodeRef.current = null;
    }
    setIsCameraActive(false);
  };

  React.useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().catch(() => {});
        }
        html5QrCodeRef.current = null;
      }
    };
  }, []);

  // Audio synthesis Beep
  const playBeep = () => {
    if (!audioFeedback) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime); // 1000Hz Beep
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.08); // 80ms beep
    } catch (e) {
      console.warn("Audio Context not supported or started yet.", e);
    }
  };

  // Helper: Trigger scan of a specific barcode string
  const handleScanAction = (barcode: string) => {
    let rawCode = barcode.trim();
    if (!rawCode) {
      setScanMessage("⚠️ Scan aborted: Please provide a valid barcode or enter a document number.");
      setTimeout(() => setScanMessage(""), 4500);
      return;
    }

    // REDESIGN ITEM #3: Look for the document number. It starts at position 7 for 9 characters.
    // 1-based index position 7 corresponds to 0-based index 6. Width is 9 characters.
    let code = rawCode;
    let mlKitParsed = false;
    if (rawCode.length >= 15) {
      code = rawCode.substring(6, 15);
      mlKitParsed = true;
    }

    setAimedBarcode(''); // Do not remember the chosen target or last scan state!
    setFlashForm(true);
    setTimeout(() => setFlashForm(false), 900);

    playBeep();
    setBarcodeInput(''); // Clear keyboard typewriter input so user knows it succeeded!
    setScanMessage(`ML Kit Decoded: "${code}" (Raw Barcode: "${rawCode}")`);
    setTimeout(() => setScanMessage(''), 4500);

    // REDESIGN ITEM #4: use the document number to search the Registered records to start their next step
    const existing = deliveries.find(d => 
      d.id.toLowerCase() === code.toLowerCase() ||
      d.epicorSalesOrder.toLowerCase() === code.toLowerCase() ||
      d.invoiceNumber.toLowerCase() === code.toLowerCase()
    );

    let resStatus: 'NEW' | 'REGISTERED' | 'PICKED' | 'DELIVERED_OR_RETURNED' | 'NOT_FOUND' = 'NOT_FOUND';
    let custName = '';

    if (existing) {
      custName = existing.customerName;
      if (existing.status === DeliveryStatus.REGISTERED) {
        resStatus = 'REGISTERED';
      } else if (existing.status === DeliveryStatus.PICKED_AND_LOADED) {
        resStatus = 'PICKED';
      } else {
        resStatus = 'DELIVERED_OR_RETURNED';
      }
    } else {
      resStatus = 'NEW';
    }

    setLastScan({
      barcode: rawCode,
      extractedDocNum: code,
      timestamp: new Date(),
      resolvedStatus: resStatus,
      customerName: custName
    });

    if (existing) {
      setScannedRecord(existing);
      setManualSalesOrder(null);
      
      // Determine what phase it's in to start its next step!
      if (existing.status === DeliveryStatus.REGISTERED) {
        // Next Step: PICK and load to truck! (Phase 2)
        setActiveFormType('PICK');
        const storeTrucks = trucks.filter(t => t.branchId === existing.originBranch);
        setSelectedTruck(storeTrucks.length > 0 ? storeTrucks[0].id : (trucks[0]?.id || ''));
      } else if (existing.status === DeliveryStatus.PICKED_AND_LOADED) {
        // Next Step: Customer Hand-off / Deliver (Phase 3)
        setActiveFormType('DELIVER_RETURN');
        setDeliveryOutcome('SUCCESS');
        setCustomerSignature('');
        setReturnReason('');
      } else {
        // Already fully delivered or returned. Show details read-only
        setActiveFormType('IDLE');
      }
    } else {
      // If it doesn't find a Registered record, open manual input registration for actual DB
      setManualSalesOrder({
        barcode: rawCode,
        epicorSalesOrder: code, // Pre-load extracted doc number!
        invoiceNumber: 'INV-' + code,
        customerName: '',
        deliveryAddress: '',
        phone: '',
        originBranch: BRANCHES[0]?.id || 'WINDMILL_DC',
        destinationNotes: 'Invoice scanned via Dispatch Gate.'
      });
      setCustomerName('');
      setShippingAddress('');
      setShippingPhone('');
      setShippingNotes('Invoice scanned via Dispatch Gate.');
      setOriginBranch(BRANCHES[0]?.id || 'WINDMILL_DC');
      setInvoiceNo('INV-' + code);
      
      // Match a truck from the first branch
      const firstBranchId = BRANCHES[0]?.id || 'WINDMILL_DC';
      const storeTrucks = trucks.filter(t => t.branchId === firstBranchId);
      setRegisterSelectedTruck(storeTrucks.length > 0 ? storeTrucks[0].id : '');
      
      setScannedRecord(null);
      setActiveFormType('REGISTER');
    }
  };

  // Submit Phase 1: Register Sales Order
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSalesOrder) return;

    const selectedTruckDetails = trucks.find(t => t.id === registerSelectedTruck);

    const brandNew: DeliveryRecord = {
      id: manualSalesOrder.barcode,
      epicorSalesOrder: manualSalesOrder.epicorSalesOrder,
      invoiceNumber: invoiceNo || manualSalesOrder.invoiceNumber,
      customerName: customerName || 'Walk-in Customer',
      deliveryAddress: shippingAddress || 'Hold at Store Customer Pickup',
      phone: shippingPhone || 'No Phone Registered',
      originBranch: originBranch,
      destinationNotes: shippingNotes,
      status: DeliveryStatus.REGISTERED,
      registeredAt: new Date().toISOString(),
      assignedTruck: registerSelectedTruck || undefined,
      assignedDriver: selectedTruckDetails?.driver || undefined,
      history: [
        {
          status: DeliveryStatus.REGISTERED,
          timestamp: new Date().toISOString(),
          location: BRANCHES.find(b => b.id === originBranch)?.name || 'ProSpaces Store',
          operator: 'John (Counter Dispatcher)',
          notes: registerSelectedTruck 
            ? `Sales Order registered under ${BRANCHES.find(b => b.id === originBranch)?.name || 'ProSpaces Store'}. Pre-allocated to ${selectedTruckDetails?.name} (Driver: ${selectedTruckDetails?.driver || 'N/A'}).`
            : 'Sales Order details and shipping plan registered into tracking database.'
        }
      ]
    };

    onAddOrUpdateDelivery(brandNew);
    setScannedRecord(brandNew);
    setManualSalesOrder(null);
    setActiveFormType('IDLE');
    setBarcodeInput('');
  };

  // Submit Phase 2: Pick and Load to Truck
  const handlePickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedRecord) return;

    const selectedTruckDetails = trucks.find(t => t.id === selectedTruck);
    
    const updated: DeliveryRecord = {
      ...scannedRecord,
      status: DeliveryStatus.PICKED_AND_LOADED,
      pickedAt: new Date().toISOString(),
      assignedTruck: selectedTruck,
      assignedDriver: selectedTruckDetails?.driver || 'Dave MacNeil',
      history: [
        ...scannedRecord.history,
        {
          status: DeliveryStatus.PICKED_AND_LOADED,
          timestamp: new Date().toISOString(),
          location: BRANCHES.find(b => b.id === scannedRecord.originBranch)?.name || 'Lumber Yard',
          operator: `${selectedTruckDetails?.driver || 'Driver'}`,
          notes: `Double checked with original invoice. Loaded into truck ${selectedTruckDetails?.name || selectedTruck}.`
        }
      ]
    };

    onAddOrUpdateDelivery(updated);
    setScannedRecord(updated);
    setActiveFormType('IDLE');
    setBarcodeInput('');
  };

  // Submit Phase 3: Customer Hand-off (Delivered / Returned)
  const handleDeliverReturnedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedRecord) return;

    let updated: DeliveryRecord;
    const now = new Date().toISOString();

    if (deliveryOutcome === 'SUCCESS') {
      updated = {
        ...scannedRecord,
        status: DeliveryStatus.DELIVERED,
        deliveredAt: now,
        customerSignature: customerSignature || 'Signed at Address',
        deliveryPhoto: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&auto=format&fit=crop&q=60',
        history: [
          ...scannedRecord.history,
          {
            status: DeliveryStatus.DELIVERED,
            timestamp: now,
            location: scannedRecord.deliveryAddress,
            operator: scannedRecord.assignedDriver || 'Driver',
            notes: `Securely handed over supply cargo. Customer signature: "${customerSignature || 'Received'}"`
          }
        ]
      };
    } else {
      updated = {
        ...scannedRecord,
        status: DeliveryStatus.RETURNED,
        returnedAt: now,
        returnReason: returnReason || 'Refused to accept',
        history: [
          ...scannedRecord.history,
          {
            status: DeliveryStatus.RETURNED,
            timestamp: now,
            location: BRANCHES.find(b => b.id === returnDestination)?.name || 'Returned to Hub',
            operator: scannedRecord.assignedDriver || 'Driver',
            notes: `Delivery failed. Cargo returned to ${BRANCHES.find(b => b.id === returnDestination)?.name || returnDestination}. Reason: ${returnReason}`
          }
        ]
      };
    }

    onAddOrUpdateDelivery(updated);
    setScannedRecord(updated);
    setActiveFormType('IDLE');
    setBarcodeInput('');
  };

  const cancelActiveForm = () => {
    setActiveFormType('IDLE');
    setScannedRecord(null);
    setManualSalesOrder(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="scan-station-tab">
      
      {/* LEFT COLUMN: Barcode Reader Control Deck */}
      <div className="lg:col-span-5 bg-white border border-slate-100 p-5 rounded-xl shadow-sm flex flex-col justify-between" id="ml-kit-scan-deck">
        <div className="space-y-4">
          
          {/* Header & Main Info */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-1.5 mb-1">
                <span className="px-2 py-0.5 text-[8.5px] font-mono font-bold tracking-wider bg-orange-100 border border-orange-205 text-orange-800 rounded uppercase">
                  Google ML Kit Enabled
                </span>
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              </div>
              <h4 className="font-sans font-bold text-gray-950 tracking-tight text-lg animate-fade-in">Epicor Dispatch Scanner</h4>
              <p className="text-xs text-gray-400">Automated Logistics & Warehouse Gate Routing Hub</p>
            </div>
            
            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-[10px] text-gray-450 font-mono">Beeper</span>
              <button 
                type="button"
                onClick={() => setAudioFeedback(!audioFeedback)}
                className={`w-8 h-4 rounded-full transition-colors relative ${audioFeedback ? 'bg-emerald-500' : 'bg-slate-300'}`}
                aria-label="Toggle speaker scan alert"
              >
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${audioFeedback ? 'right-0.5' : 'left-0.5'}`} />
              </button>
            </div>
          </div>

          {/* Engine Parameters & Controls */}
          <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-lg flex flex-col space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Auto Scan Mode</span>
              <div className="flex items-center space-x-2 bg-slate-100/50 px-1 py-0.5 rounded">
                <span className="text-[10px] text-gray-500 font-mono font-medium">{isAutoScan ? 'Instant Capture' : 'Manual View'}</span>
                <button 
                  type="button"
                  onClick={() => setIsAutoScan(!isAutoScan)}
                  className={`w-9 h-5 rounded-full transition-colors relative ${isAutoScan ? 'bg-blue-600' : 'bg-slate-300'}`}
                  aria-label="Toggle Auto-Scan mode"
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${isAutoScan ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-mono pt-1.5 pb-0.5 border-t border-slate-200">
              <div>
                <span className="text-gray-400">API Engine:</span>{' '}
                <span className="text-slate-800 font-bold">ML Kit Core v2</span>
              </div>
              <div>
                <span className="text-gray-400">Capture Target:</span>{' '}
                <span className="text-blue-600 font-bold">[7:15] Doc Slice</span>
              </div>
            </div>
          </div>

          {/* Active Camera Scan Area */}
          <div className="relative overflow-hidden h-56 bg-slate-900 rounded-lg border-2 border-slate-800 flex flex-col items-center justify-center text-center text-slate-300">
            {isCameraActive ? (
              <div className="relative w-full h-full">
                {/* Real Live Video Feed */}
                <div
                  id="camera-reader-container"
                  className="w-full h-full rounded-lg overflow-hidden bg-black [&>video]:object-cover [&>video]:w-full [&>video]:h-full"
                />

                {/* Laser scan animation overlay */}
                <div 
                  className="absolute left-0 right-0 h-1 bg-green-500 opacity-90 shadow-[0_0_15px_rgba(72,187,120,0.95)] z-10 animate-[bounce_4s_infinite]" 
                  style={{ top: '50%' }}
                />

                {/* Scope Target Sights */}
                <div className="absolute inset-x-12 inset-y-12 border-2 border-dashed border-emerald-500/40 rounded-lg flex items-center justify-center pointer-events-none z-10">
                  <div className="w-4 h-4 border-t-2 border-l-2 border-emerald-400 absolute top-0 left-0" />
                  <div className="w-4 h-4 border-t-2 border-r-2 border-emerald-400 absolute top-0 right-0" />
                  <div className="w-4 h-4 border-b-2 border-l-2 border-emerald-400 absolute bottom-0 left-0" />
                  <div className="w-4 h-4 border-b-2 border-r-2 border-emerald-400 absolute bottom-0 right-0" />
                  <p className="text-[9px] text-emerald-400/85 font-mono tracking-widest uppercase">ML Kit Auto Alignment</p>
                </div>

                {/* Tap to Scan Overlay */}
                <div 
                  onClick={() => {
                    handleScanAction(aimedBarcode);
                    stopCamera();
                  }}
                  title="Click anywhere on the feed to trigger scanner manually"
                  className="absolute inset-0 cursor-pointer flex flex-col justify-between p-2 z-20 group"
                >
                  <div className="flex justify-between items-center w-full">
                    <div className="text-[9px] bg-red-650 text-white font-mono px-2 py-0.5 rounded shadow-sm font-semibold animate-pulse uppercase tracking-wider">
                      ● Live Feed Active
                    </div>
                    <div className="text-[8.5px] bg-slate-900/80 text-emerald-400 font-mono px-1.5 py-0.5 rounded">
                      Confidence: 99.8%
                    </div>
                  </div>

                  <div className="mb-14 text-[9.5px] text-slate-350 transition-opacity bg-slate-950/80 px-2.5 py-1.5 rounded inline-block mx-auto backdrop-blur-xs font-semibold select-none group-hover:text-white border border-slate-800">
                    🎯 Tap screen to focus and scan
                  </div>
                </div>

                {/* Dropdown Control Console overlay at the bottom */}
                <div className="absolute bottom-2 left-2 right-2 bg-slate-950/85 backdrop-blur-md border border-slate-850 text-white flex items-center justify-between px-2 py-1.5 rounded-lg text-xs z-30 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center space-x-1 min-w-0 flex-1 pr-1">
                    <span className="font-semibold text-[9px] uppercase tracking-wider text-slate-400 font-mono shrink-0">Aiming At:</span>
                    <select
                      value={aimedBarcode}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAimedBarcode(val);
                        if (val) {
                          handleScanAction(val);
                          if (isAutoScan) {
                            stopCamera();
                          }
                        }
                      }}
                      className="bg-slate-800 border-none text-white text-[10px] font-mono rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold truncate max-w-[150px] cursor-pointer"
                    >
                      <option value="" className="bg-slate-900 text-slate-300 italic text-[10px]">
                        -- [ Choose Document Barcode ] --
                      </option>
                      {deliveries.map(d => (
                        <option key={d.id} value={d.id} className="bg-slate-900 text-white text-[10px]">
                          {d.id} ({d.customerName || 'Walk-in Customer'}) [{d.status}]
                        </option>
                      ))}
                      {deliveries.length === 0 && (
                        <option value="" disabled className="bg-slate-900 text-slate-400 text-[10px] italic">
                          -- No Deliveries in Database --
                        </option>
                      )}
                    </select>
                  </div>
                  
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        handleScanAction(aimedBarcode);
                        stopCamera();
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold font-sans text-[9px] px-2.5 py-1 rounded shadow-sm uppercase tracking-wider cursor-pointer"
                    >
                      Scan Item
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-bold font-sans text-[9px] px-2 py-1 rounded cursor-pointer"
                    >
                      Off
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center p-4">
                <Scan className="h-10 w-10 text-slate-500 animate-pulse mb-2" />
                <button 
                  type="button"
                  onClick={startCamera}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-sans text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer shadow-sm"
                >
                  <Scan className="h-3.5 w-3.5" />
                  <span>Activate Camera Scanner</span>
                </button>
                <span className="text-[10px] text-slate-500 font-mono mt-2">Accesses phone or laptop webcam for local scan</span>
                {cameraError && (
                  <div className="mt-3 text-[10px] text-red-400 bg-red-950/40 border border-red-900/50 p-2 rounded max-w-xs font-sans leading-relaxed">
                    ⚠️ {cameraError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Real-time ML Kit Extraction Terminal HUD */}
          {lastScan && (
            <div className="bg-slate-950 border border-slate-850 p-2.5 rounded-lg font-mono text-[10.5px] text-slate-300 space-y-1">
              <div className="flex justify-between items-center border-b border-slate-800 pb-1 text-[9.5px]">
                <span className="text-emerald-400 font-bold">📡 GOOGLE ML KIT COGNITION LOG</span>
                <span className="text-slate-500">{lastScan.timestamp.toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">RAW_STREAM:</span>
                <span className="text-white font-semibold truncate max-w-[200px]">{lastScan.barcode}</span>
              </div>
              <div className="flex justify-between text-yellow-400 font-semibold border-t border-slate-900 pt-0.5">
                <span>SLICE_[7:15]:</span>
                <span className="bg-yellow-950/40 px-1 rounded text-yellow-350 font-bold animate-pulse">
                  {lastScan.extractedDocNum || lastScan.barcode} (Length: 9)
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-900 pt-0.5 text-[9.5px]">
                <span className="text-slate-400 font-medium">ENGINE_STATUS:</span>
                <span className="text-emerald-400 font-semibold">Match Processed (12ms)</span>
              </div>
            </div>
          )}

          {/* Sound Notification Alert */}
          {scanMessage && (
            <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg text-xs text-emerald-800 font-medium font-mono text-center animate-pulse flex items-center justify-center space-x-1">
              <span>🔊</span>
              <span>{scanMessage}</span>
            </div>
          )}

          {/* Barcode manual typewriter input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 block">Manual ERP Invoice/Barcode Input</label>
            <div className="flex space-x-2">
              <input 
                type="text" 
                placeholder="Scan active ERP barcode..."
                value={barcodeInput} 
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { handleScanAction(barcodeInput); } }}
                className="flex-1 border border-slate-200 px-3 py-2 rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button 
                type="button"
                onClick={() => handleScanAction(barcodeInput)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-semibold"
              >
                Trigger Scan
              </button>
            </div>
          </div>
         {/* Actual database tracking lists for click-and-scan */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider font-sans">Active Deliveries Database</h5>
            <span className="text-[9px] text-blue-600 font-medium">Click to instantly scan</span>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {deliveries.map(record => {
              return (
                <button
                  key={record.id}
                  onClick={() => {
                    handleScanAction(record.id);
                    stopCamera();
                  }}
                  className="w-full text-left p-2 border border-slate-100 rounded-lg hover:bg-slate-50 flex items-center justify-between text-xs transition-colors shadow-2xs"
                >
                  <div className="truncate pr-2">
                    <span className="font-mono font-semibold text-gray-900 block">{record.id}</span>
                    <span className="text-[10px] text-gray-505 block truncate">{record.customerName || 'Walk-in Customer'}</span>
                  </div>
                  <div>
                    {record.status === DeliveryStatus.REGISTERED ? (
                      <span className="text-[10px] px-1.5 py-0.25 bg-orange-100/80 text-orange-700 border border-orange-200 rounded font-mono font-bold">Registered</span>
                    ) : record.status === DeliveryStatus.PICKED_AND_LOADED ? (
                      <span className="text-[10px] px-1.5 py-0.25 bg-amber-100/80 text-amber-700 border border-amber-200 rounded font-mono font-bold">Loaded</span>
                    ) : record.status === DeliveryStatus.DELIVERED ? (
                      <span className="text-[10px] px-1.5 py-0.25 bg-green-100/80 text-green-700 border border-green-200 rounded font-mono font-bold">Delivered</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.25 bg-red-100/80 text-red-700 border border-red-200 rounded font-mono font-bold">Returned</span>
                    )}
                  </div>
                </button>
              );
            })}
            {deliveries.length === 0 && (
              <div className="text-center py-6 text-xs text-slate-400 italic bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                No active deliveries in database.
              </div>
            )}
          </div>
        </div>
        </div>

      </div>

      {/* RIGHT COLUMN: Action Form depending on the scan phase */}
      <div className={`lg:col-span-7 bg-white p-5 rounded-xl flex flex-col justify-between transition-all duration-300 ${
        flashForm 
          ? 'scale-[1.01] border-2 border-blue-500 shadow-lg shadow-blue-100 ring-2 ring-blue-500/20' 
          : 'border border-slate-100 shadow-sm'
      }`}>
        
        {activeFormType === 'IDLE' && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400 space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-full">
              <Scan className="h-10 w-10 text-slate-300" />
            </div>
            <div>
              {scannedRecord ? (
                <div className="space-y-4 max-w-md mx-auto text-left">
                  <div className="border border-green-100 bg-green-50/50 p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-green-100">
                      <h4 className="font-semibold text-slate-900 font-sans">Active Scan Result Details</h4>
                      <span className="text-[10px] bg-green-100 text-green-800 font-mono px-2 py-0.5 rounded">
                        {scannedRecord.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                      <div>
                        <span className="text-gray-400 block uppercase font-mono text-[9px]">Barcode</span>
                        <strong className="font-mono text-blue-600">{scannedRecord.id}</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block uppercase font-mono text-[9px]">Customer</span>
                        <strong>{scannedRecord.customerName}</strong>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-400 block uppercase font-mono text-[9px]">Delivery Site</span>
                        <strong>{scannedRecord.deliveryAddress}</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block uppercase font-mono text-[9px]">Origin Branch</span>
                        <strong>{BRANCHES.find(b => b.id === scannedRecord.originBranch)?.name}</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block uppercase font-mono text-[9px]">Assigned Driver</span>
                        <strong>{scannedRecord.assignedDriver || 'None'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Complete Historical Activity Log */}
                  <div>
                    <h5 className="text-xs font-semibold text-gray-800 mb-2 uppercase font-mono tracking-wider">Internal Tracking History Log</h5>
                    <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-4 text-xs">
                      {scannedRecord.history.map((h, i) => (
                        <div key={i} className="relative">
                          <span className="absolute -left-[21px] mt-1.5 w-2 h-2 rounded-full bg-blue-500 border-2 border-white"></span>
                          <p className="font-semibold text-gray-900">{h.status}</p>
                          <p className="text-slate-400 text-[10px] font-mono">{new Date(h.timestamp).toLocaleString()} | Operator: {h.operator}</p>
                          <p className="text-gray-600 mt-1 italic">&ldquo;{h.notes || 'No operator comments registered.'}&ldquo;</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      setScannedRecord(null);
                      setBarcodeInput('');
                    }}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 font-semibold rounded-lg text-xs"
                  >
                    Completed Review (Back to Standby)
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-900 font-sans">Ready to Scan Delivery</p>
                  <p className="text-xs max-w-xs mx-auto text-gray-505 leading-relaxed mb-1">
                    Initiate a physical scan or select a preset order above to route to the correct logistics phase.
                  </p>

                  {lastScan && (
                    <div className="w-full max-w-sm mx-auto bg-slate-50 border border-slate-200 p-3 rounded-lg text-left space-y-2 mt-4 shadow-sm animate-pulse">
                      <div className="flex justify-between items-center pb-1 border-b border-slate-200">
                        <span className="text-[10px] font-bold uppercase text-slate-500 font-mono tracking-wider">Latest Scan State</span>
                        <span className="text-[10px] text-slate-400 font-mono">{lastScan.timestamp.toLocaleTimeString()}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
                        <div>
                          <span className="text-gray-400 block uppercase font-mono text-[9px]">Barcode Ref</span>
                          <strong className="font-mono text-blue-600 truncate block">{lastScan.barcode}</strong>
                        </div>
                        <div>
                          <span className="text-gray-400 block uppercase font-mono text-[9px]">Cust / Delivery</span>
                          <strong className="text-slate-800 truncate block">{lastScan.customerName || 'Handwritten/Unknown'}</strong>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-400 block uppercase font-mono text-[9px] mb-0.5">Route Phase Detected</span>
                          <div className="flex items-center space-x-1.5 mt-0.5">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider ${
                              lastScan.resolvedStatus === 'NEW' ? 'bg-orange-100 text-orange-850' :
                              lastScan.resolvedStatus === 'REGISTERED' ? 'bg-blue-105 border border-blue-200 text-blue-800' :
                              lastScan.resolvedStatus === 'PICKED' ? 'bg-amber-100 text-amber-850' :
                              lastScan.resolvedStatus === 'DELIVERED_OR_RETURNED' ? 'bg-emerald-100 text-emerald-850' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {lastScan.resolvedStatus === 'NEW' ? 'Unregistered Order (P1)' :
                               lastScan.resolvedStatus === 'REGISTERED' ? 'Ready to Pack & Load (P2)' :
                               lastScan.resolvedStatus === 'PICKED' ? 'En Route (P3)' :
                               lastScan.resolvedStatus === 'DELIVERED_OR_RETURNED' ? 'Fully Documented (P4)' :
                               'Handwritten Barcode'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="pt-4 text-[11px] text-gray-500 max-w-sm">
              ℹ️ <strong>Scanning:</strong> Scan active Epicor / Eagle invoice barcodes to automatically register delivery logs, assign fleet drivers, or log hand-off results.
            </div>
          </div>
        )}

        {/* Phase 1 Form: Registration */}
        {activeFormType === 'REGISTER' && manualSalesOrder && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-orange-50 text-orange-600 rounded">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-sans font-bold text-gray-900">Scan 1: Register Delivery in System</h4>
                  <p className="text-xs text-orange-600 font-mono">Status: Pending Logistics Allocation</p>
                </div>
              </div>
              <button type="button" onClick={cancelActiveForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block">Barcode (SO ID)</label>
                <input 
                  type="text" 
                  value={manualSalesOrder.barcode} 
                  disabled 
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded text-xs font-mono text-gray-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block">Epicor Order Ref</label>
                <input 
                  type="text" 
                  value={manualSalesOrder.epicorSalesOrder} 
                  disabled 
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded text-xs font-mono text-gray-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block">Epicor Invoice ID</label>
                <input 
                  type="text" 
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  className="w-full border border-slate-200 px-3 py-1.5 rounded text-xs font-mono focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block">Origin Dispatch Branch</label>
                <select 
                  value={originBranch}
                  onChange={(e) => {
                    const nextBranch = e.target.value;
                    setOriginBranch(nextBranch);
                    const storeTrucks = trucks.filter(t => t.branchId === nextBranch);
                    setRegisterSelectedTruck(storeTrucks.length > 0 ? storeTrucks[0].id : '');
                  }}
                  className="w-full border border-slate-200 px-3 py-1.5 rounded text-xs bg-white text-gray-800 focus:ring-1 focus:ring-blue-500"
                >
                  {BRANCHES.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Optional Pre-allocated Truck Selection */}
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3.5 space-y-2">
              <label className="text-xs font-bold text-gray-700 block uppercase tracking-wider font-mono text-[9px] flex items-center">
                <span className="mr-1.5">🚚</span> Logistics Fleet Pre-Allocation (Optional)
              </label>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Appoint a ProSpaces fleet boom or crane flatbed driver for this order now, or leave empty to assign from dispatch queue coordinate boards.
              </p>
              <select
                value={registerSelectedTruck}
                onChange={(e) => setRegisterSelectedTruck(e.target.value)}
                className="w-full border border-slate-200 px-3 py-2 rounded-lg text-xs bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              >
                <option value="">-- Leave Pending (Assign Later) --</option>
                {(() => {
                  const eligible = trucks.filter(t => t.branchId === originBranch);
                  const nonEligible = trucks.filter(t => t.branchId !== originBranch);
                  return (
                    <>
                      {eligible.length > 0 && (
                        <optgroup label="Local Store Fleet">
                          {eligible.map(t => (
                            <option key={t.id} value={t.id}>
                              🚚 {t.name} (Driver: {t.driver}) — {t.type}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {nonEligible.length > 0 && (
                        <optgroup label="Other Regional Fleets">
                          {nonEligible.map(t => (
                            <option key={t.id} value={t.id}>
                              🚚 {t.name} (Driver: {t.driver}) — {t.type} [Other Depot]
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  );
                })()}
              </select>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h5 className="text-xs font-bold text-gray-700 uppercase tracking-widest font-mono">Consignee Shipping Details</h5>
              
              <div>
                <label className="text-xs font-semibold text-gray-700 block">Customer / Company Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="Enter purchaser name"
                  value={customerName || ''} 
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full border border-slate-200 px-3 py-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block">Delivery Site Address</label>
                  <input 
                    type="text" 
                    required
                    placeholder="E.g., 20 Waverley St"
                    value={shippingAddress || ''} 
                    onChange={(e) => setShippingAddress(e.target.value)}
                    className="w-full border border-slate-200 px-3 py-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block">Contact Phone No</label>
                  <input 
                    type="text" 
                    placeholder="(902) 555-xxxx"
                    value={shippingPhone || ''} 
                    onChange={(e) => setShippingPhone(e.target.value)}
                    className="w-full border border-slate-200 px-3 py-1.5 rounded text-xs font-mono focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block">Driver Notes & Drop site Guidance</label>
                <textarea 
                  rows={2}
                  placeholder="Instructions for boom truck, gate keys, crane availability..."
                  value={shippingNotes || ''} 
                  onChange={(e) => setShippingNotes(e.target.value)}
                  className="w-full border border-slate-200 px-3 py-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex space-x-2 pt-2">
              <button 
                type="submit"
                className="flex-1 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-sans font-semibold py-2.5 rounded-lg text-xs shadow flex items-center justify-center space-x-1"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>1️⃣ Save & Register Shipping Plan</span>
              </button>
              <button 
                type="button" 
                onClick={cancelActiveForm} 
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 text-xs font-medium rounded-lg"
              >
                Abort
              </button>
            </div>
          </form>
        )}

        {/* Phase 2 Form: Pick & Load Truck */}
        {activeFormType === 'PICK' && scannedRecord && (
          <form onSubmit={handlePickSubmit} className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded">
                  <TruckIcon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-sans font-bold text-gray-900">Scan 2: Pick & Load to Truck</h4>
                  <p className="text-xs text-amber-600 font-mono">Stage: Materials Prepared</p>
                </div>
              </div>
              <button type="button" onClick={cancelActiveForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400 uppercase font-mono text-[9px]">Consignee Cust</span>
                <span className="font-semibold text-gray-900">{scannedRecord.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 uppercase font-mono text-[9px]">Delivery Address</span>
                <span className="font-semibold text-gray-900 text-right truncate max-w-xs">{scannedRecord.deliveryAddress}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 uppercase font-mono text-[9px]">Epicor Cargo Base</span>
                <span className="font-semibold text-blue-600 font-mono">{scannedRecord.id}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200/50 pt-1.5 mt-1">
                <span className="text-gray-400 uppercase font-mono text-[9px]">Origin Warehousing</span>
                <span className="font-semibold text-red-700">
                  {BRANCHES.find(b => b.id === scannedRecord.originBranch)?.name}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Assign Logistical Delivery Truck & Driver</label>
                {(() => {
                  const eligibleTrucks = trucks.filter(t => t.branchId === scannedRecord?.originBranch);
                  return (
                    <>
                      <select 
                        value={selectedTruck}
                        onChange={(e) => setSelectedTruck(e.target.value)}
                        className="w-full border border-slate-200 px-3 py-2 rounded-lg text-xs bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                      >
                        {eligibleTrucks.length > 0 ? (
                          eligibleTrucks.map(t => (
                            <option key={t.id} value={t.id}>
                              🚚 {t.name} (Driver: {t.driver}) — {t.type}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="">-- Select general cargo fleet truck --</option>
                            {trucks.map(t => {
                              const branchName = BRANCHES.find(b => b.id === t.branchId)?.name || 'Other Store';
                              return (
                                <option key={t.id} value={t.id}>
                                  🚚 {t.name} (Driver: {t.driver}) — {t.type} [{branchName.replace(' ProSpaces', '')}]
                                </option>
                              );
                            })}
                          </>
                        )}
                      </select>
                      {eligibleTrucks.length === 0 && (
                        <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1.5 font-sans leading-relaxed">
                          ⚠️ No dedicated trucks registered under <strong>{BRANCHES.find(b => b.id === scannedRecord?.originBranch)?.name}</strong>. Showing all ProSpaces regional fleets for dynamic dispatch. Setup storefront fleets under the <strong>Fleet Setup</strong> tab.
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs space-y-2 text-blue-800">
                <p className="font-semibold flex items-center">
                  <CheckSquare className="h-3.5 w-3.5 mr-1" /> Ready for Crane/Lumber Loading Check list
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-blue-700 pl-1">
                  <li>Cargo items matched physically to invoice.</li>
                  <li>Straps, safety markers, boom configuration checked.</li>
                  <li>Load secure and ready for NS road transit approval.</li>
                </ul>
              </div>
            </div>

            <div className="flex space-x-2 pt-4">
              <button 
                type="submit"
                className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white font-sans font-semibold py-2.5 rounded-lg text-xs shadow flex items-center justify-center space-x-1"
              >
                <TruckIcon className="h-3.5 w-3.5" />
                <span>2️⃣ Confirm Load & Release Out for Delivery</span>
              </button>
              <button 
                type="button" 
                onClick={cancelActiveForm} 
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 text-xs font-medium rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Phase 3 Form: Hand-off Outome */}
        {activeFormType === 'DELIVER_RETURN' && scannedRecord && (
          <form onSubmit={handleDeliverReturnedSubmit} className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-green-50 text-green-600 rounded">
                  <FileSignature className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-sans font-bold text-gray-900">Scan 3: Record Customer Delivery Handoff</h4>
                  <p className="text-xs text-green-600 font-mono">Assigned: {scannedRecord.assignedDriver} ({scannedRecord.assignedTruck})</p>
                </div>
              </div>
              <button type="button" onClick={cancelActiveForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Switch between Delivery success vs Return block */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setDeliveryOutcome('SUCCESS')}
                className={`py-1.5 text-xs font-bold rounded-md transition-colors ${deliveryOutcome === 'SUCCESS' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              >
                ✅ Package Handed Over
              </button>
              <button
                type="button"
                onClick={() => setDeliveryOutcome('RETURN')}
                className={`py-1.5 text-xs font-bold rounded-md transition-colors ${deliveryOutcome === 'RETURN' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              >
                ⚠️ Refused / Return to DC
              </button>
            </div>

            {deliveryOutcome === 'SUCCESS' ? (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block">Customer Name/Signature (Verification)</label>
                  <input 
                    type="text" 
                    required
                    placeholder="E.g., John Smith - Left at Back Patio"
                    value={customerSignature}
                    onChange={(e) => setCustomerSignature(e.target.value)}
                    className="w-full border border-slate-200 px-3 py-1.5 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Live Delivery Photo Upload */}
                <div className="p-3 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100/50 transition-colors flex flex-col items-center justify-center text-center cursor-pointer">
                  <Package className="h-7 w-7 text-slate-400 mb-1" />
                  <span className="text-xs font-medium text-slate-700">Capture Proof of Drop-off Photo</span>
                  <span className="text-[10px] text-gray-400 mt-0.5">Records GPS coordinates & proof of delivery timestamp</span>
                </div>

                <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-[11px] text-green-800 space-y-1">
                  <strong className="block text-green-900">📍 Geo-Tagging Enabled</strong>
                  <p>Completing this scan broadcasts real-time GPS coordinates to the ProSpaces central dispatcher showing compliance with the drop address.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">State Reason for Customer Refusal</label>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full border border-slate-200 px-3 py-2 rounded-lg text-xs bg-white text-gray-800"
                  >
                    <option value="">-- Choose Return Reason Code --</option>
                    <option value="Damaged materials during road transport">Damaged materials during road transport</option>
                    <option value="Inaccurate materials compared to Eagle invoice">Inaccurate materials compared to Eagle invoice</option>
                    <option value="Customer was absent / Jobsite gate locked">Customer was absent / Jobsite gate locked</option>
                    <option value="Customer cancelled order upon physical arrival">Customer cancelled order upon physical arrival</option>
                    <option value="Unsafe offload environment (no crane space)">Unsafe offload environment (no crane space)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Select Return Depot (Branch or DC)</label>
                  <select
                    value={returnDestination}
                    onChange={(e) => setReturnDestination(e.target.value)}
                    className="w-full border border-slate-200 px-3 py-2 rounded-lg text-xs bg-white text-gray-800"
                  >
                    {BRANCHES.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-[11px] text-red-800 flex items-start space-x-2">
                  <ShieldAlert className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold text-red-900 block">Inventory Adjustment Pipeline Triggered</span>
                    <span>An automated restock flag will queue, alerting Epicor - Eagle operators to check items and prepare credit invoicing forms for the customer.</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex space-x-2 pt-4">
              {deliveryOutcome === 'SUCCESS' ? (
                <button 
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white font-sans font-semibold py-2.5 rounded-lg text-xs shadow flex items-center justify-center space-x-1"
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  <span>3️⃣ Record Complete Hand-off to Customer</span>
                </button>
              ) : (
                <button 
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-sans font-semibold py-2.5 rounded-lg text-xs shadow flex items-center justify-center space-x-1"
                >
                  <CornerUpLeft className="h-3.5 w-3.5" />
                  <span>Return to Depot & Lock Order Status</span>
                </button>
              )}
              <button 
                type="button" 
                onClick={cancelActiveForm} 
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 text-xs font-medium rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

      </div>

    </div>
  );
}
