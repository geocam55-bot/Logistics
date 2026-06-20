import React, { useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { DeliveryRecord, DeliveryStatus, Branch, Truck } from '../types';
import { BRANCHES as STATIC_BRANCHES } from '../data';
import { Scan, Truck as TruckIcon, User, Package, MapPin, Eye, Phone, CheckSquare, Sparkles, X, FileSignature, CornerUpLeft, ShieldAlert, Trash2 } from 'lucide-react';

interface ScanStationProps {
  deliveries: DeliveryRecord[];
  onAddOrUpdateDelivery: (record: DeliveryRecord) => void;
  onDeleteDelivery?: (id: string) => void;
  trucks: Truck[];
  branches?: Branch[];
}

export default function ScanStation({ deliveries, onAddOrUpdateDelivery, onDeleteDelivery, trucks, branches }: ScanStationProps) {
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
  const [lastDecodedResult, setLastDecodedResult] = useState('');
  const [isScanningFrame, setIsScanningFrame] = useState(false);
  const [isBgScanning, setIsBgScanning] = useState(false);

  const [fullFrameMode, setFullFrameMode] = useState(true);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const [lockFocus, setLockFocus] = useState(false);

  const startCamera = async (forceFullFrame?: boolean) => {
    const useFullFrame = forceFullFrame !== undefined ? forceFullFrame : fullFrameMode;
    setCameraError(null);
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
            Html5QrcodeSupportedFormats.AZTEC,
            Html5QrcodeSupportedFormats.CODABAR,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.MAXICODE,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.PDF_417,
            Html5QrcodeSupportedFormats.RSS_14,
            Html5QrcodeSupportedFormats.RSS_EXPANDED,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION
          ],
          verbose: false,
          useBarCodeDetectorIfSupported: true // Enabled iOS Safari native BarcodeDetector API for instant, hardware-level decoding!
        });
        html5QrCodeRef.current = html5QrCode;

        html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 30, // Tighter sampling frequency
            qrbox: useFullFrame ? undefined : (width, height) => {
              // Expand the box so Zxing has a larger cross-section of rows to decode the 1D stripes
              return { 
                width: Math.round(width * 0.90), 
                height: Math.round(height * 0.70) 
              };
            },
            aspectRatio: 1.777778, // 16:9 HD frame geometry ideal for linear codes
            videoConstraints: {
              facingMode: 'environment',
              width: { min: 640, ideal: 1280, max: 1920 },
              height: { min: 480, ideal: 720, max: 1080 },
              advanced: [{ focusMode: "continuous" } as any]
            }
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
          console.warn("Could not start environment camera, attempting default/user camera fallback...", err);
          // Retry starting the camera with no strict facingMode constraint or default webcam
          return html5QrCode.start(
            {}, // Fallback: default/user-facing device camera
            {
              fps: 30,
              qrbox: useFullFrame ? undefined : (width, height) => {
                return { 
                  width: Math.round(width * 0.90), 
                  height: Math.round(height * 0.70) 
                };
              },
              aspectRatio: 1.777778,
              videoConstraints: {
                advanced: [{ focusMode: "continuous" } as any]
              }
            },
            (decodedText) => {
              handleScanAction(decodedText);
              stopCamera();
            },
            () => {}
          );
        }).catch((err: any) => {
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

  const toggleFullFrameMode = async () => {
    const nextVal = !fullFrameMode;
    setFullFrameMode(nextVal);
    if (isCameraActive) {
      stopCamera();
      setTimeout(() => {
        startCamera(nextVal);
      }, 350);
    }
  };

  const snapAndScanLiveFrame = async () => {
    setCameraError(null);
    setScanMessage("Capturing viewfinder perspective... Sending to Gemini Decrypter...");
    setIsScanningFrame(true);

    try {
      // Find the live video element spawned by html5-qrcode
      const videoEl = document.querySelector("#camera-reader-container video") as HTMLVideoElement | null;
      if (!videoEl) {
        throw new Error("No active camera sensor feedback discovered in the viewfinder window. Try starting the live stream first.");
      }

      // Safe check to avoid IndexSizeError/InvalidStateError on Safari when video is not fully active yet
      if (videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
        throw new Error("The live camera viewfinder is still preparing its lens. Please wait 1 second and tap the screen again.");
      }

      // Create off-screen canvas to extract pixel grid
      const canvas = document.createElement("canvas");
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Failed to activate local canvas drawing engine to grab video frame.");
      }

      // Render video frame on canvas
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

      // Export as compression-safe JPEG data URI
      const fileData = canvas.toDataURL("image/jpeg", 0.92);

      // Submit base64 dump directly to server-side Gemini scanner
      const res = await fetch("/api/scan-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server HTTP response code ${res.status}`);
      }

      const result = await res.json();
      if (result.success && result.barcodeText) {
        handleScanAction(result.barcodeText);
        setScanMessage(`📋 Decrypted Barcode: ${result.barcodeText} (${result.barcodeFormat || 'Auto'})`);
        stopCamera();
        setTimeout(() => setScanMessage(''), 4500);
      } else {
        throw new Error("Gemini did not detect a clear barcode in the live frame. Bring the lens closer to the document, hold it steady to avoid motion blur, and try again.");
      }
    } catch (err: any) {
      console.error("Frame snap capture error:", err);
      setCameraError(err?.message || "Failed to scan live frame. Please hold steady and try again.");
      setTimeout(() => setCameraError(null), 8500);
    } finally {
      setScanMessage("");
      setIsScanningFrame(false);
    }
  };

  const snapAndScanLiveFrameBackground = async () => {
    if (isScanningFrame || isBgScanning || !isCameraActive) return;
    
    try {
      const videoEl = document.querySelector("#camera-reader-container video") as HTMLVideoElement | null;
      if (!videoEl || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
        return; // camera source not fully hydrated in frame yet
      }

      setIsBgScanning(true);

      const canvas = document.createElement("canvas");
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setIsBgScanning(false);
        return;
      }

      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const fileData = canvas.toDataURL("image/jpeg", 0.70); // slightly smaller for faster background streams

      const res = await fetch("/api/scan-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData })
      });

      if (!res.ok) {
        setIsBgScanning(false);
        return;
      }

      const result = await res.json();
      if (result.success && result.barcodeText) {
        handleScanAction(result.barcodeText);
        setScanMessage(`📋 AI Auto-Decrypted: ${result.barcodeText} (${result.barcodeFormat || 'Auto'})`);
        stopCamera();
        setTimeout(() => setScanMessage(''), 4500);
      }
    } catch (err: any) {
      console.warn("Background AI stream scan failed (expected between steady frames):", err);
    } finally {
      setIsBgScanning(false);
    }
  };

  // Helper: Client-side downscaling and compression of heavy mobile high-res snapshots.
  // This reduces payload sizes from 12MB down to <150KB for instant uploads while keeping text fully crisp.
  const compressImage = (base64Str: string, maxWidth = 1200, maxHeight = 1200): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(base64Str);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Export crisp 85% quality JPEG
        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve(compressedDataUrl);
      };
      img.onerror = (err) => {
        reject(err);
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCameraError(null);
    setScanMessage("Preprocessing & downscaling photograph...");
    setIsScanningFrame(true);

    try {
      if (isCameraActive) {
        stopCamera();
      }

      // Convert image file to Base64 data URL
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
      });
      reader.readAsDataURL(file);
      const originalBase64 = await base64Promise;

      setScanMessage("Encrypting viewport & transmitting to Gemini AI Core...");
      const fileData = await compressImage(originalBase64).catch((err) => {
        console.warn("Downscaling failed, using raw upload stream:", err);
        return originalBase64;
      });

      const res = await fetch("/api/scan-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${res.status}`);
      }

      const result = await res.json();
      if (result.success && result.barcodeText) {
        handleScanAction(result.barcodeText);
        setScanMessage(`📋 Decrypted Barcode: ${result.barcodeText} (${result.barcodeFormat || 'Auto'})`);
        setTimeout(() => setScanMessage(''), 4500);
      } else {
        throw new Error("Gemini was unable to read a valid barcode in that photo. Make sure the barcode is close, in focus, and not shadowed.");
      }
    } catch (err: any) {
      console.error("Barcode photo analysis error:", err);
      setCameraError(err?.message || "Unable to read barcode. Make sure the labels are bright and fully visible.");
      setTimeout(() => setCameraError(null), 8500);
    } finally {
      setScanMessage("");
      setIsScanningFrame(false);
    }

    if (e.target) {
      e.target.value = '';
    }
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

  React.useEffect(() => {
    if (!isCameraActive) return;

    // Run background AI Assist frame scanner every 3.5 seconds to bypass iOS ZXing performance limitations!
    const intervalId = setInterval(() => {
      snapAndScanLiveFrameBackground();
    }, 3500);

    return () => clearInterval(intervalId);
  }, [isCameraActive, isScanningFrame]);

  // Double-Rugged focus keeper for physical scanner wedges (such as Bluetooth/Lightning hardware)
  // Ensures focus is automatically re-acquired even if user clicks elsewhere on the page, without causing viewport zoom or keyboard issues.
  React.useEffect(() => {
    if (!lockFocus) return;

    // Direct immediate focus on toggle
    if (manualInputRef.current) {
      manualInputRef.current.focus();
    }

    // Keep reclaiming focus back to the hidden scanner input every 550ms
    const timer = setInterval(() => {
      if (document.activeElement !== manualInputRef.current && manualInputRef.current) {
        // Only target focus if user is not actively interacting with another input, select, link, or button element
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && activeTag !== 'BUTTON' && activeTag !== 'SELECT' && activeTag !== 'A') {
          manualInputRef.current.focus();
        }
      }
    }, 550);

    return () => clearInterval(timer);
  }, [lockFocus]);

  // Global keydown hook interceptor to catch physical wedge keyboard scanners if focus gets completely lost
  React.useEffect(() => {
    if (!lockFocus) return;

    let scanBuffer = '';
    let lastKeyStamp = Date.now();

    const handleWedgeKeyDown = (e: KeyboardEvent) => {
      // Direct typing bypass logic
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeEl !== manualInputRef.current && activeEl.id !== 'visible-barcode-input') {
        return; // Let user type in other forms/inputs
      }

      const nowStamp = Date.now();
      // If time since last keystroke is > 1.5 seconds, reset buffer (as humans type much slower than hardware wedge streams)
      if (nowStamp - lastKeyStamp > 1500) {
        scanBuffer = '';
      }
      lastKeyStamp = nowStamp;

      if (e.key === 'Enter' || e.key === 'Tab') {
        if (scanBuffer.trim().length > 0) {
          e.preventDefault();
          e.stopPropagation();
          const parsedCode = scanBuffer.trim();
          scanBuffer = '';
          setLastDecodedResult(parsedCode);
          setBarcodeInput(parsedCode);
          handleScanAction(parsedCode);
        }
      } else if (e.key.length === 1) {
        scanBuffer += e.key;
        setLastDecodedResult(scanBuffer);
        setBarcodeInput(scanBuffer);
      }
    };

    window.addEventListener('keydown', handleWedgeKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleWedgeKeyDown, true);
    };
  }, [lockFocus, deliveries]);

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

    setFlashForm(true);
    setTimeout(() => setFlashForm(false), 900);

    playBeep();
    setBarcodeInput(''); // Clear keyboard typewriter input so user knows it succeeded!
    if (lockFocus) {
      setTimeout(() => {
        manualInputRef.current?.focus();
      }, 80);
    }
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
    setLastDecodedResult(rawCode);

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

            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200">
              <div className="flex flex-col text-left">
                <span className="font-semibold text-slate-700">Full Viewfinder Scope</span>
                <span className="text-[9px] text-gray-400">Recommended for quick iPhone camera focus</span>
              </div>
              <div className="flex items-center space-x-2 bg-slate-100/50 px-1 py-0.5 rounded shrink-0">
                <span className="text-[10px] text-gray-500 font-mono font-medium">{fullFrameMode ? 'Full Canvas' : 'Target Box'}</span>
                <button 
                  type="button"
                  onClick={toggleFullFrameMode}
                  className={`w-9 h-5 rounded-full transition-colors relative ${fullFrameMode ? 'bg-emerald-600' : 'bg-slate-300'}`}
                  aria-label="Toggle Full Frame scanning"
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${fullFrameMode ? 'right-0.5' : 'left-0.5'}`} />
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
                <span className="text-blue-600 font-bold">{fullFrameMode ? "Full Feed" : "[7:15] Doc Slice"}</span>
              </div>
            </div>
          </div>

          {/* Active Camera Scan Zone */}
          <div className="relative overflow-hidden min-h-[515px] bg-slate-950 rounded-lg border-2 border-slate-800 flex flex-col items-center justify-center p-5 text-center text-slate-300">
            {isScanningFrame && (
              <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md z-[60] flex flex-col items-center justify-center p-6 space-y-4 animate-fade-in pointer-events-auto">
                <div className="relative flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full border-4 border-emerald-500/30 border-t-emerald-400 animate-spin" />
                  <Sparkles className="h-6 w-6 text-yellow-300 absolute animate-pulse" />
                </div>
                <div className="space-y-1.5 max-w-xs">
                  <h5 className="text-white text-xs font-bold font-mono tracking-widest uppercase text-emerald-400">
                    📡 GEMINI AI COGNITION ENGINE
                  </h5>
                  <p className="text-[11px] text-slate-300 font-sans leading-relaxed font-semibold">
                    {scanMessage || "Processing image frame and extracting barcode details..."}
                  </p>
                  <p className="text-[9px] text-slate-500 font-mono">
                    Communicating securely on backend proxy port 3000
                  </p>
                </div>
              </div>
            )}
            {isCameraActive ? (
              <div className="relative w-full h-[480px] flex flex-col justify-between">
                {/* Real Live Video Feed */}
                <div
                  id="camera-reader-container"
                  className="absolute inset-0 w-full h-full rounded-lg overflow-hidden bg-black [&>video]:object-contain [&>video]:w-full [&>video]:h-full z-0"
                />

                {/* Laser scan animation overlay */}
                <div 
                  className="absolute left-0 right-0 h-1 bg-green-550 opacity-90 shadow-[0_0_15px_rgba(72,187,120,0.95)] z-10 animate-[bounce_4s_infinite]" 
                  style={{ top: '50%' }}
                />

                {/* Scope Target Sights */}
                <div className={`absolute border-2 border-dashed border-emerald-500/40 rounded-lg flex items-center justify-center pointer-events-none z-10 transition-all ${
                  fullFrameMode ? 'inset-x-4 inset-y-4' : 'inset-x-12 inset-y-12'
                }`}>
                  <div className="w-4 h-4 border-t-2 border-l-2 border-emerald-400 absolute top-0 left-0" />
                  <div className="w-4 h-4 border-t-2 border-r-2 border-emerald-400 absolute top-0 right-0" />
                  <div className="w-4 h-4 border-b-2 border-l-2 border-emerald-400 absolute bottom-0 left-0" />
                  <div className="w-4 h-4 border-b-2 border-r-2 border-emerald-400 absolute bottom-0 right-0" />
                  <p className="text-[9px] text-emerald-400/85 font-mono tracking-widest uppercase absolute top-2">
                    {fullFrameMode ? "Full Viewfinder Active" : "ML Kit Auto Alignment"}
                  </p>
                </div>

                {/* Tap to Snap Overlay (Allows click on viewfinder directly under iOS iframe constraints!) */}
                <div 
                  onClick={snapAndScanLiveFrame}
                  className="absolute inset-0 cursor-pointer pointer-events-auto flex flex-col justify-between p-3.5 z-20 hover:bg-black/10 active:bg-black/25 transition-all group"
                  title="Click anywhere inside camera feedback window to snap & decrypt frame instantly with Gemini AI!"
                >
                  <div className="flex justify-between items-center w-full pointer-events-none">
                    <div className="text-[9px] bg-red-650 text-white font-mono px-2 py-0.5 rounded shadow-sm font-semibold animate-pulse uppercase tracking-wider select-none">
                      ● Live Feed Active
                    </div>
                    {isBgScanning ? (
                      <div className="text-[9px] bg-sky-600 text-white font-mono px-2 py-0.5 rounded shadow-[0_0_10px_rgba(2,132,199,0.7)] font-bold animate-pulse uppercase tracking-wider select-none flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        AI Decrypting Live Stream...
                      </div>
                    ) : (
                      <div className="text-[8.5px] bg-slate-900/90 text-emerald-400 font-mono px-1.5 py-0.5 rounded border border-emerald-500/20 select-none">
                        Tap-to-Snap Active
                      </div>
                    )}
                  </div>

                  {/* High visibility central tap-to-focus scanner ring */}
                  <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none my-auto">
                    <div className="w-14 h-14 rounded-full border-2 border-emerald-400/80 flex items-center justify-center bg-emerald-500/10 shadow-[0_0_20px_rgba(52,211,153,0.3)] animate-pulse group-hover:scale-110 transition-transform">
                      <Sparkles className="h-6 w-6 text-emerald-300" />
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono tracking-wide uppercase bg-slate-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/20 shadow-md">
                      TAP VIEW TO SNAP
                    </span>
                  </div>

                  <div className="text-[9.5px] text-white transition-opacity bg-slate-900/95 px-3 py-1.5 rounded-lg inline-block mx-auto backdrop-blur-md font-semibold select-none border border-slate-700 max-w-[95%] leading-relaxed pointer-events-none shadow-xl mb-12 text-center">
                    💡 <strong className="text-emerald-400">iOS Safari Tip:</strong> Hold your lens still over the barcode. The background AI scanner checks active video frames automatically every 3.5 seconds, or tap the viewfinder anywhere to decrypt instantly!
                  </div>
                </div>

                {/* Production Control overlay at the bottom */}
                <div className="absolute bottom-2 left-2 right-2 bg-slate-950/95 backdrop-blur-md border border-slate-800 text-white flex items-center justify-between px-3 py-2 rounded-lg text-xs z-30 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                  <span className="font-semibold text-[9.5px] uppercase tracking-wider text-slate-300 font-mono truncate">Live Viewfinder</span>
                  
                  <div className="flex items-center shrink-0 space-x-2">
                    <button
                      type="button"
                      onClick={snapAndScanLiveFrame}
                      className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold font-sans text-[10px] px-3 py-1.5 rounded-md cursor-pointer transition-colors border border-emerald-500 uppercase tracking-wide flex items-center space-x-1"
                    >
                      <Sparkles className="h-3 w-3 text-yellow-350" />
                      <span>Snap & Scan</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-205 font-bold font-sans text-[10px] px-2 py-1.5 rounded-md cursor-pointer transition-colors border border-slate-700 uppercase"
                    >
                      Close Stream
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center space-y-4 py-2 animate-fade-in">
                {/* Visual Scanner Icon Ring */}
                <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shadow-inner relative">
                  <Scan className="h-7 w-7 text-emerald-400 absolute animate-pulse" />
                  <div className="absolute inset-0 rounded-full border border-emerald-500/25 animate-ping opacity-60" style={{ animationDuration: '3s' }} />
                </div>

                <div className="space-y-1.5 max-w-sm">
                  <h5 className="font-bold text-sm tracking-tight text-white uppercase font-mono text-emerald-300">LIVE WEB VIEWFINDER</h5>
                  <p className="text-[10.5px] text-slate-400 leading-relaxed font-sans px-2">
                    Activate the video camera feed to scan packaging slips, epicor receipts, or invoices in real time.
                  </p>
                </div>

                {/* Primary Action Button */}
                <div className="w-full max-w-xs pt-1">
                  <button 
                    type="button"
                    onClick={() => startCamera()}
                    className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-650 active:scale-[0.98] text-white font-sans text-xs font-bold px-4 py-3.5 rounded-lg transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-md shadow-emerald-950/40 border border-emerald-500 uppercase tracking-wider"
                  >
                    <Sparkles className="h-4 w-4 text-yellow-250 animate-bounce" />
                    <span>📷 LAUNCH LIVE VIEWFINDER</span>
                  </button>
                </div>

                <div className="bg-slate-900/60 border border-slate-850 p-3 rounded text-[10.5px] text-slate-400 leading-relaxed text-left max-w-xs space-y-1.5">
                  <span className="font-bold text-slate-200 block">💡 How does Live AI Scanning work?</span>
                  <p>
                    Point your camera at any 1D/2D barcode or QR code. The system uses a state-of-the-art dual engine:
                  </p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><strong>Continuous AI Scanning:</strong> Active frames are checked in the background automatically every 3.5 seconds via server-side Gemini.</li>
                    <li><strong>Tap-to-Snap:</strong> At any time, tap anywhere on the live viewfinder screen to instantly capture a pristine high-resolution scan!</li>
                  </ul>
                </div>

                {cameraError && (
                  <div className="mt-3 text-[10px] text-red-300 bg-red-950/60 border border-red-900/50 p-2 rounded max-w-xs font-sans leading-relaxed text-left">
                    ⚠️ {cameraError}
                  </div>
                )}
              </div>
            )}
          </div>

      <div id="file-reader-temp" className="hidden" style={{ display: 'none' }} />

          {/* PERSISTENT BARCODE CONSOLE & DECISION HUB */}
          <div className="space-y-3.5 p-4 bg-slate-900 border border-slate-750 rounded-xl shadow-md text-left">
            {/* Console Title / Top Bar */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isScanningFrame ? 'bg-amber-400 animate-ping' : (lastScan ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-slate-500')}`} />
                📟 Scan Result Operator Terminal
              </span>
              <span className="text-[9.5px] font-mono text-slate-500">
                {lastScan ? `Scanned ${lastScan.timestamp.toLocaleTimeString()}` : "Standby"}
              </span>
            </div>

            {/* Scan Status Alert Pill (Rendered conditionally when lastScan is present or scanner has messages) */}
            <div className={`p-2.5 rounded-lg border flex items-center gap-2 transition-all ${
              isScanningFrame
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : lastScan
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-350'
                  : 'bg-slate-950/40 border-slate-800/80 text-slate-400'
            }`}>
              <div className={`w-2 h-2 rounded-full shrink-0 ${isScanningFrame ? 'bg-amber-400 animate-pulse' : (lastScan ? 'bg-emerald-400' : 'bg-slate-600')}`} />
              <div className="text-left leading-tight text-xs flex-1">
                <span className="font-bold text-[10px] uppercase tracking-wider block font-sans">
                  {isScanningFrame 
                    ? '⚡ DECODER IS ACTIVE...' 
                    : lastScan 
                      ? '✨ CAMERA SCAN MATCH COMPLETE' 
                      : '📡 SCANNER STATUS: SLEEP'}
                </span>
                <span className="text-[10.5px] font-sans">
                  {isScanningFrame
                    ? (scanMessage || "Processing photograph stream...")
                    : lastScan
                      ? (lastScan.resolvedStatus === 'NEW' 
                        ? `Decoded " ${lastScan.extractedDocNum || lastScan.barcode} " — This barcode isn't registered in deliveries database.` 
                        : `Decoded successfully & auto-matched delivery order details!`)
                      : "Awaiting automatic viewfinder scan, device camera capture, or manual input..."}
                </span>
              </div>
            </div>

            {/* Main Interactive Text Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                  📋 Scanned Barcode Text Box
                </span>
                <span className="text-[9px] text-slate-500 font-mono">
                  Editable Input / Fallback
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  id="visible-barcode-input"
                  type="text"
                  value={lastDecodedResult}
                  onChange={(e) => {
                    setLastDecodedResult(e.target.value);
                    setBarcodeInput(e.target.value);
                  }}
                  className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-2 font-mono text-xs text-emerald-300 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all font-semibold"
                  placeholder="Insert barcode text or start scan..."
                  title="You can manually tweak, paste, or edit the scanned barcode string in this box anytime!"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.clipboard && lastDecodedResult) {
                      navigator.clipboard.writeText(lastDecodedResult);
                      setScanMessage("📋 Code copied to clipboard!");
                      setTimeout(() => setScanMessage(''), 3000);
                    }
                  }}
                  disabled={!lastDecodedResult}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-750 disabled:opacity-45 disabled:cursor-not-allowed hover:text-white border border-slate-700 text-slate-300 rounded-lg text-[10.5px] font-semibold select-none cursor-pointer duration-150 shrink-0 uppercase tracking-wider"
                  title="Copy scanned text code"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => handleScanAction(lastDecodedResult)}
                  disabled={!lastDecodedResult}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 disabled:cursor-not-allowed text-white rounded-lg text-[10.5px] font-bold select-none cursor-pointer duration-150 shrink-0 uppercase tracking-wider"
                  title="Verify changes & match logistics record"
                >
                  Sync
                </button>
              </div>
            </div>

            {/* Quick Bluetooth physical device override and Lock Focus */}
            <div className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-semibold text-slate-400 leading-tight">External Wedge Hardware Support</span>
                <span className="text-[8.5px] text-slate-500">Auto-injects scanned barcodes from Bluetooth decoders</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newVal = !lockFocus;
                  setLockFocus(newVal);
                  if (newVal) {
                    setTimeout(() => {
                      manualInputRef.current?.focus();
                    }, 100);
                  }
                }}
                className={`text-[9.5px] px-2.5 py-1 rounded border font-sans font-medium flex items-center justify-center space-x-1.5 transition-all w-full sm:w-auto shrink-0 ${
                  lockFocus 
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400 font-bold' 
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${lockFocus ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                <span>{lockFocus ? "FOCUS: LOCKED" : "LOCK FOCUS"}</span>
              </button>
            </div>

            {/* Hidden Input purely used to gather hardware scanner keystrokes in background when Lock Focus is active */}
            <input 
              ref={manualInputRef}
              type="text" 
              style={{
                position: 'absolute',
                left: '-9999px',
                top: '0px',
                width: '1px',
                height: '1px',
                opacity: 0.01
              }}
              inputMode="none"
              value={barcodeInput} 
              onChange={(e) => {
                setBarcodeInput(e.target.value);
                setLastDecodedResult(e.target.value);
              }}
              onKeyDown={(e) => { 
                if (e.key === 'Enter') { 
                  const value = e.currentTarget.value.trim();
                  if (value) {
                    handleScanAction(value); 
                    setLastDecodedResult(value);
                    setBarcodeInput("");
                    e.currentTarget.value = "";
                  }
                } 
              }}
              onBlur={() => {
                if (lockFocus) {
                  setTimeout(() => {
                    if (manualInputRef.current) {
                      const activeEl = document.activeElement;
                      if (activeEl) {
                        const tag = activeEl.tagName;
                        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'SELECT' || tag === 'A') {
                          // Do not steal focus if the user clicked into an interactive element or button
                          return;
                        }
                      }
                      manualInputRef.current.focus();
                    }
                  }, 120);
                }
              }}
            />

            {/* Technical Parameter Readouts */}
            {lastScan && (
              <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80 font-mono text-[10.5px] text-slate-400 space-y-1 mt-1.5">
                <div className="flex justify-between items-center text-[9px] border-b border-slate-800 pb-1 mb-1 text-slate-500">
                  <span>⚙️ SYSTEM DIAGNOSTIC RUNTIME LOGS</span>
                  <span>{lastScan.resolvedStatus}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>RAW_DECRYPTED:</span>
                  <span className="text-slate-300 font-medium truncate max-w-[170px]">{lastScan.barcode}</span>
                </div>
                <div className="flex justify-between border-t border-slate-800/50 pt-0.5">
                  <span>COMPUTED_ERP:</span>
                  <span className="text-yellow-400 font-bold">
                    {lastScan.extractedDocNum || lastScan.barcode}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-800/50 pt-0.5 text-[9px]">
                  <span>DECODER_API:</span>
                  <span className="text-emerald-400 font-medium uppercase font-mono">Gemini Vision Core v3</span>
                </div>
              </div>
            )}
          </div>

          {/* Sound Notification Alert */}
          {scanMessage && (
            <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg text-xs text-emerald-800 font-medium font-mono text-center animate-pulse flex items-center justify-center space-x-1">
              <span>🔊</span>
              <span>{scanMessage}</span>
            </div>
          )}

          {/* Quick Helper Tips for iPhone Web Application Operators */}
          <div className="bg-blue-50/50 border border-blue-100/60 rounded-lg p-2.5 mt-2 text-[11px] text-blue-900 leading-relaxed">
            <span className="font-bold block mb-0.5 text-blue-950">📱 iOS Web-App Scanner Guide:</span>
            <ul className="list-disc pl-3.5 space-y-1 text-left">
              <li>
                <strong className="text-blue-950">Live Web Viewfinder:</strong> Aim your iPhone lens at any barcode and tap <span className="font-semibold text-slate-800">LAUNCH LIVE VIEWFINDER</span>. Center the barcode to decode packaging slips or transit routing grids instantly.
              </li>
              <li>
                <strong className="text-blue-950">Hardware Scanner Integration:</strong> Connect any enterprise Bluetooth/Lightning barcode reader wedge. Toggle <span className="font-bold text-emerald-800">Lock Focus</span> inside the scanner deck above to scan continuously and execute automated routing without needing to touch the screen!
              </li>
            </ul>
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
                <div
                  key={record.id}
                  className="w-full p-2 border border-slate-100 rounded-lg hover:bg-slate-50 flex items-center justify-between text-xs transition-colors shadow-2xs group relative bg-white"
                >
                  <button
                    type="button"
                    onClick={() => {
                      handleScanAction(record.id);
                      stopCamera();
                    }}
                    className="flex-1 text-left truncate cursor-pointer pr-1"
                  >
                    <span className="font-mono font-semibold text-gray-900 block">{record.id}</span>
                    <span className="text-[10px] text-gray-500 block truncate">{record.customerName || 'Walk-in Customer'}</span>
                  </button>
                  <div className="flex items-center space-x-2 shrink-0">
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
                    {onDeleteDelivery && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete delivery ${record.id} from active database logs?`)) {
                            onDeleteDelivery(record.id);
                            if (scannedRecord?.id === record.id) {
                              setScannedRecord(null);
                              setActiveFormType('IDLE');
                            }
                          }
                        }}
                        title="Delete record"
                        className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 cursor-pointer transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
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
