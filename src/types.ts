export enum DeliveryStatus {
  REGISTERED = 'REGISTERED',
  PICKED_AND_LOADED = 'PICKED_AND_LOADED',
  DELIVERED = 'DELIVERED',
  RETURNED = 'RETURNED'
}

export interface DeliveryRecord {
  id: string; // Barcode ID (e.g., SO-10293-A)
  invoiceNumber: string;
  epicorSalesOrder: string;
  customerName: string;
  deliveryAddress: string;
  phone: string;
  originBranch: string; // WINDMILL_DC or specific Store
  weight?: string;
  orderTotal?: string;
  destinationNotes?: string;
  status: DeliveryStatus;
  registeredAt: string;
  pickedAt?: string;
  deliveredAt?: string;
  returnedAt?: string;
  returnReason?: string;
  assignedTruck?: string;
  assignedDriver?: string;
  customerSignature?: string; // Base64 or mock SVG
  deliveryPhoto?: string; // Mock image description or actual mock URL
  pdfUrl?: string; // Link to the uploaded physical invoice/receipt PDF
  history: HistoryEvent[];
  tenantId?: string;
}

export interface HistoryEvent {
  status: DeliveryStatus;
  timestamp: string;
  location: string;
  operator: string;
  notes?: string;
}

export interface Branch {
  id: string;
  name: string;
  type: 'STORE' | 'DC';
  address: string;
  tenantId?: string;
}

export interface Truck {
  id: string;
  name: string;
  type: string;
  driver: string;
  branchId: string; // Associated branch/DC (e.g. WINDMILL_DC or 01075_TANTALLON)
  registrationDueDate?: string;
  lat?: number;
  lng?: number;
  tenantId?: string;
}

export type UserRole = 'Driver' | 'Dispatcher' | 'User' | 'Admin' | 'SUPER_ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  associatedStoreId?: string; // Links user to a dynamic store/branch
  password?: string;
  status?: 'Active' | 'Inactive';
  driverLicenseExpire?: string;
  tenantId?: string;
}

export interface Tenant {
  id: string;
  name: string;
  code: string;
  description: string;
  logoBadge: string;
  regionalFocus: string;
  primaryColor: 'blue' | 'emerald' | 'indigo' | 'slate';
}


