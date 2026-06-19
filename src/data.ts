import { DeliveryStatus, DeliveryRecord, Tenant, Branch, Truck, User } from './types';

export const TENANTS: Tenant[] = [
  {
    id: 'atlantic-logistics',
    name: 'Atlantic Shipping & Logistics',
    code: 'ATL',
    description: 'Serving Nova Scotia regional stores & main Windmill Road DC hub.',
    logoBadge: '⚓',
    regionalFocus: 'Nova Scotia (Dartmouth, Tantallon, Halifax)',
    primaryColor: 'blue'
  },
  {
    id: 'bay-of-fundy',
    name: 'Bay of Fundy Transport Ltd',
    code: 'BOF',
    description: 'Serving Annapolis Valley and New Brunswick logistics gateways.',
    logoBadge: '🌊',
    regionalFocus: 'New Brunswick & Annapolis Valley (Kentville, Truro, Moncton)',
    primaryColor: 'emerald'
  },
  {
    id: 'cabot-trail',
    name: 'Cabot Trail Cargo & Hauling',
    code: 'CTC',
    description: 'Providing Cape Breton heavy industrial bulk distribution services.',
    logoBadge: '⛰️',
    regionalFocus: 'Cape Breton (Sydney, Port Hawkesbury)',
    primaryColor: 'indigo'
  },
  {
    id: 'ronaatlantic',
    name: 'RONA Atlantic',
    code: 'RA',
    description: 'Corporate logistics tracking for RONA franchise dealer stores.',
    logoBadge: '🏢',
    regionalFocus: 'Atlantic Canada (Dartmouth, Tantallon, Halifax)',
    primaryColor: 'blue'
  }
];

export const BRANCHES: Branch[] = [
  {
    id: 'WINDMILL_DC',
    name: 'Windmill Regional DC',
    type: 'DC',
    address: '551 Windmill Road, Dartmouth, NS B3B 1B2'
  },
  {
    id: '01075_TANTALLON',
    name: 'RONA Tantallon Depot',
    type: 'STORE',
    address: '3683 St Margarets Bay Rd, Hubley, NS B3Z 1C2'
  },
  {
    id: '01076_HALIFAX',
    name: 'RONA Bayers Lake Store',
    type: 'STORE',
    address: '208 Chain Lake Dr, Halifax, NS B3S 1C5'
  }
];

export const TRUCKS: Truck[] = [
  {
    id: 'TRK-RA-01',
    name: 'Lumber Flatbed #01',
    type: 'Heavy Duty Flatbed Loader',
    driver: 'Frank Milligan',
    branchId: 'WINDMILL_DC'
  },
  {
    id: 'TRK-RA-02',
    name: 'Vessel Box Truck #02',
    type: '26ft Hard-side Box Truck',
    driver: 'Sarah Jenkins',
    branchId: '01075_TANTALLON'
  },
  {
    id: 'TRK-RA-03',
    name: 'Boom Picker Truck #03',
    type: 'Hiab Crane Boom Truck',
    driver: 'Davey Crocket',
    branchId: '01076_HALIFAX'
  }
];

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

export const INITIAL_DELIVERIES: DeliveryRecord[] = [
  {
    id: 'EPICOR102934185-SO',
    invoiceNumber: 'INV-102934185',
    epicorSalesOrder: '102934185',
    customerName: 'Atlantic Lumber Supplies',
    deliveryAddress: '551 Windmill Road, Dartmouth, NS B3B 1B2',
    phone: '902-555-0143',
    originBranch: 'WINDMILL_DC',
    weight: '4,800 lbs',
    orderTotal: '$3,450.00',
    destinationNotes: 'Forklift required for unloading heavy framing timbers.',
    status: DeliveryStatus.REGISTERED,
    registeredAt: '2026-06-18 08:30:00',
    assignedTruck: 'TRK-RA-01',
    assignedDriver: 'Frank Milligan',
    history: [
      {
        status: DeliveryStatus.REGISTERED,
        timestamp: '2026-06-18 08:30:00',
        location: 'Windmill Regional DC',
        operator: 'George Campbell',
        notes: 'Documented invoice successfully created'
      }
    ]
  },
  {
    id: 'EPICOR263890123-SO',
    invoiceNumber: 'INV-263890123',
    epicorSalesOrder: '263890123',
    customerName: 'Halifax Drywall Constructors',
    deliveryAddress: '2288 Gottingen St, Halifax, NS B3K 3B6',
    phone: '902-555-8821',
    originBranch: '01075_TANTALLON',
    weight: '2,200 lbs',
    orderTotal: '$1,890.00',
    destinationNotes: 'Leave materials in the ground level covered warehouse zone.',
    status: DeliveryStatus.PICKED_AND_LOADED,
    registeredAt: '2026-06-18 09:15:00',
    pickedAt: '2026-06-18 10:00:00',
    assignedTruck: 'TRK-RA-02',
    assignedDriver: 'Sarah Jenkins',
    history: [
      {
        status: DeliveryStatus.REGISTERED,
        timestamp: '2026-06-18 09:15:00',
        location: 'RONA Tantallon Depot',
        operator: 'Sarah Jenkins',
        notes: 'Order scheduled for morning delivery run'
      },
      {
        status: DeliveryStatus.PICKED_AND_LOADED,
        timestamp: '2026-06-18 10:00:00',
        location: 'RONA Tantallon Depot',
        operator: 'Sarah Jenkins',
        notes: 'Lumber picked, strapped, and loaded on vessel box truck'
      }
    ]
  },
  {
    id: 'EPICOR581902345-SO',
    invoiceNumber: 'INV-581902345',
    epicorSalesOrder: '581902345',
    customerName: 'Cape Breton General Builders',
    deliveryAddress: '475 Kings Road, Sydney, NS B1S 1A3',
    phone: '902-555-9012',
    originBranch: 'WINDMILL_DC',
    weight: '5,200 lbs',
    orderTotal: '$4,120.00',
    destinationNotes: 'Call site manager 15 minutes prior to arrival.',
    status: DeliveryStatus.DELIVERED,
    registeredAt: '2026-06-17 14:00:00',
    pickedAt: '2026-06-17 15:30:00',
    deliveredAt: '2026-06-17 17:45:00',
    assignedTruck: 'TRK-RA-01',
    assignedDriver: 'Frank Milligan',
    history: [
      {
        status: DeliveryStatus.REGISTERED,
        timestamp: '2026-06-17 14:00:00',
        location: 'Windmill Regional DC',
        operator: 'George Campbell',
        notes: 'Invoice received and scheduled'
      },
      {
        status: DeliveryStatus.PICKED_AND_LOADED,
        timestamp: '2026-06-17 15:30:00',
        location: 'Windmill Regional DC',
        operator: 'Frank Milligan',
        notes: 'Flatbed loaded and certified'
      },
      {
        status: DeliveryStatus.DELIVERED,
        timestamp: '2026-06-17 17:45:00',
        location: 'Sydney Site',
        operator: 'Frank Milligan',
        notes: 'Delivered successfully with client confirmation and signed receipt'
      }
    ]
  }
];

export const INITIAL_USERS: User[] = [
  {
    id: 'USR-RA-01',
    name: 'George Campbell',
    email: 'george.campbell@ronaatlantic.ca',
    role: 'Admin',
    phone: '(902) 555-0199',
    associatedStoreId: 'WINDMILL_DC',
    status: 'Active'
  },
  {
    id: 'USR-RA-02',
    name: 'George Ronaatlantic',
    email: 'george.ronaatlantic@gmail.com',
    role: 'Dispatcher',
    phone: '(902) 555-0211',
    associatedStoreId: 'WINDMILL_DC',
    status: 'Active'
  },
  {
    id: 'USR-RA-03',
    name: 'Frank Milligan',
    email: 'frank.milligan@ronaatlantic.ca',
    role: 'Driver',
    phone: '(902) 555-2201',
    associatedStoreId: 'WINDMILL_DC',
    status: 'Active',
    driverLicenseExpire: '2028-11-14'
  },
  {
    id: 'USR-RA-04',
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@ronaatlantic.ca',
    role: 'Driver',
    phone: '(902) 555-2202',
    associatedStoreId: '01075_TANTALLON',
    status: 'Active',
    driverLicenseExpire: '2026-03-31'
  }
];

// --- tenant 2: Bay of Fundy Transport (BOF) Seed Data ---
export const BRANCHES_BOF: Branch[] = [
  {
    id: 'BOF_KENTVILLE_DC',
    name: 'Kentville Operations DC',
    type: 'DC',
    address: '9 Annapolis Valley Industrial Park, Kentville, NS B4N 3V7'
  },
  {
    id: 'BOF_MONCTON_DEPOT',
    name: 'Moncton Intermodal Station',
    type: 'DC',
    address: '100 Terminal St, Moncton, NB E1C 8R2'
  }
];

export const TRUCKS_BOF: Truck[] = [
  {
    id: 'TRK-BOF-01',
    name: 'Valley Cruiser',
    type: 'Three-axle Flatbed',
    driver: 'Bob Comeau',
    branchId: 'BOF_KENTVILLE_DC'
  },
  {
    id: 'TRK-BOF-02',
    name: 'Moncton Shuttle',
    type: 'Dry Van Trailer',
    driver: 'John Peterson',
    branchId: 'BOF_MONCTON_DEPOT'
  }
];

export const INITIAL_USERS_BOF: User[] = [
  {
    id: 'USR-BOF-01',
    name: 'Bob Comeau',
    email: 'bob.comeau@bof.ca',
    role: 'Driver',
    phone: '(506) 555-0101',
    associatedStoreId: 'BOF_KENTVILLE_DC',
    status: 'Active',
    driverLicenseExpire: '2029-05-18'
  },
  {
    id: 'USR-BOF-02',
    name: 'John Peterson',
    email: 'john.peterson@bof.ca',
    role: 'Driver',
    phone: '(506) 555-0102',
    associatedStoreId: 'BOF_MONCTON_DEPOT',
    status: 'Active',
    driverLicenseExpire: '2028-12-08'
  }
];

export const INITIAL_DELIVERIES_BOF: DeliveryRecord[] = [
  {
    id: 'EPICOR984712390-SO',
    invoiceNumber: 'INV-984712390',
    epicorSalesOrder: '984712390',
    customerName: 'Fundy Crane Operations',
    deliveryAddress: '101 Research Dr, Truro, NS B2N 6N2',
    phone: '902-555-4475',
    originBranch: 'BOF_KENTVILLE_DC',
    weight: '3,100 lbs',
    orderTotal: '$2,150.00',
    destinationNotes: 'Gate code #4488. Keep boom cranes clear of active power arcs.',
    status: DeliveryStatus.REGISTERED,
    registeredAt: '2026-06-18 10:10:00',
    assignedTruck: 'TRK-BOF-01',
    assignedDriver: 'Bob Comeau',
    history: [
      {
        status: DeliveryStatus.REGISTERED,
        timestamp: '2026-06-18 10:10:00',
        location: 'Kentville Operations DC',
        operator: 'Leah Gentry',
        notes: 'Order designated to Fundy fleet logistics pool'
      }
    ]
  }
];

// --- tenant 3: Cabot Trail Cargo (CTC) Seed Data ---
export const BRANCHES_CTC: Branch[] = [
  {
    id: 'CTC_SYDNEY_DC',
    name: 'Sydney Grand Lake DC',
    type: 'DC',
    address: '400 Grand Lake Rd, Sydney, NS B1P 5T3'
  },
  {
    id: 'CTC_HAWKESBURY_DC',
    name: 'Port Hawkesbury Depot',
    type: 'STORE',
    address: '15 Paint St, Port Hawkesbury, NS B9A 3J9'
  }
];

export const TRUCKS_CTC: Truck[] = [
  {
    id: 'TRK-CTC-01',
    name: 'Cabot Titan',
    type: 'Super-B Hauler Flatbed',
    driver: 'Donald McDonald',
    branchId: 'CTC_SYDNEY_DC'
  }
];

export const INITIAL_USERS_CTC: User[] = [
  {
    id: 'USR-CTC-01',
    name: 'Donald McDonald',
    email: 'donald.mcdonald@ctc.ca',
    role: 'Driver',
    phone: '(902) 555-8801',
    associatedStoreId: 'CTC_SYDNEY_DC',
    status: 'Active',
    driverLicenseExpire: '2027-10-15'
  }
];

export const INITIAL_DELIVERIES_CTC: DeliveryRecord[] = [];
