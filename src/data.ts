import { DeliveryStatus, DeliveryRecord, Tenant, Branch, Truck, User } from './types';

// Central lists are empty initially for custom live partner commissioning
export const TENANTS: Tenant[] = [];

export const BRANCHES: Branch[] = [];

export const TRUCKS: Truck[] = [];

export const PRESET_PENDING_EPICOR_ORDERS: any[] = [
  {
    barcode: 'EPICOR102934185-SO',
    epicorSalesOrder: '102934185',
    invoiceNumber: 'INV-102934185',
    customerName: 'Atlantic Lumber Supplies',
    deliveryAddress: '551 Windmill Road, Dartmouth, NS B3B 1B2',
    phone: '902-555-0143',
    originBranch: 'WINDMILL_DC',
    destinationNotes: 'Forklift required for unloading heavy framing timbers.'
  },
  {
    barcode: 'EPICOR263890123-SO',
    epicorSalesOrder: '263890123',
    invoiceNumber: 'INV-263890123',
    customerName: 'Halifax Drywall Constructors',
    deliveryAddress: '2288 Gottingen St, Halifax, NS B3K 3B6',
    phone: '902-555-8821',
    originBranch: '01075_TANTALLON',
    destinationNotes: 'Leave materials in the ground level covered warehouse zone.'
  },
  {
    barcode: 'EPICOR581902345-SO',
    epicorSalesOrder: '581902345',
    invoiceNumber: 'INV-581902345',
    customerName: 'Cape Breton General Builders',
    deliveryAddress: '475 Kings Road, Sydney, NS B1S 1A3',
    phone: '902-555-9012',
    originBranch: 'WINDMILL_DC',
    destinationNotes: 'Call site manager 15 minutes prior to arrival.'
  },
  {
    barcode: 'EPICOR984712390-SO',
    epicorSalesOrder: '984712390',
    invoiceNumber: 'INV-984712390',
    customerName: 'Fundy Crane Operations',
    deliveryAddress: '101 Research Dr, Truro, NS B2N 6N2',
    phone: '902-555-4475',
    originBranch: '01075_TANTALLON',
    destinationNotes: 'Gate code #4488. Keep boom cranes clear of active power arcs.'
  }
];

export const INITIAL_DELIVERIES: DeliveryRecord[] = [];

export const INITIAL_USERS: User[] = [];

// --- tenant 2: Bay of Fundy Transport (BOF) Seed Data ---
export const BRANCHES_BOF: Branch[] = [];

export const TRUCKS_BOF: Truck[] = [];

export const INITIAL_USERS_BOF: User[] = [];

export const INITIAL_DELIVERIES_BOF: DeliveryRecord[] = [];

// --- tenant 3: Cabot Trail Cargo (CTC) Seed Data ---
export const BRANCHES_CTC: Branch[] = [];

export const TRUCKS_CTC: Truck[] = [];

export const INITIAL_USERS_CTC: User[] = [];

export const INITIAL_DELIVERIES_CTC: DeliveryRecord[] = [];
