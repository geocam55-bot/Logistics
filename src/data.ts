import { DeliveryStatus, DeliveryRecord, Branch, Truck, User, Tenant } from './types';

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
  }
];

export const BRANCHES: Branch[] = [
  { id: 'WINDMILL_DC', name: 'Windmill Road Delivery Center', type: 'DC', address: '121 Windmill Rd, Dartmouth, NS B3B 1B7' },
  { id: '01075_TANTALLON', name: '01075 - Tantallon RONA', type: 'STORE', address: '5126 St Margarets Bay Rd, Upper Tantallon, NS B3Z 1E3' },
  { id: '01065_ALMON', name: '01065 - Almon RONA', type: 'STORE', address: '6085 Almon St, Halifax, NS B3K 1T9' },
  { id: '01070_ELMSDALE', name: '01070 - Elmsdale RONA', type: 'STORE', address: '269 Hwy 2, Elmsdale, NS B2S 1A6' }
];

export const TRUCKS: Truck[] = [
  { id: 'TRUCK-01', name: 'Truck-1 Crane Boom (NS-F01)', type: 'Flatbed with Crane', driver: 'Dave MacNeil', branchId: 'WINDMILL_DC' },
  { id: 'TRUCK-02', name: 'Truck-2 Flatbed (NS-F02)', type: 'Medium Duty Flatbed', driver: 'Sarah Jenkins', branchId: '01075_TANTALLON' },
  { id: 'TRUCK-03', name: 'Truck-3 Fleet Pickup (NS-P03)', type: 'Light Delivery Duty', driver: 'Marc LeBlanc', branchId: '01065_ALMON' },
  { id: 'TRUCK-04', name: 'Truck-4 Curtain Flatbed (NS-C04)', type: 'Heavy Duty Flatbed', driver: 'Robert Chiasson', branchId: '01070_ELMSDALE' },
  { id: 'TRUCK-05', name: 'Truck-1 Boom Truck (NS-F05)', type: 'Flatbed with Crane', driver: 'John Miller', branchId: '01075_TANTALLON' },
  { id: 'TRUCK-06', name: 'Truck-2 Box Truck (NS-B06)', type: 'Medium Duty Box Truck', driver: 'Clara Smith', branchId: '01070_ELMSDALE' }
];

export const PRESET_PENDING_EPICOR_ORDERS = [
  {
    barcode: 'SO-102934-1',
    epicorSalesOrder: '102934',
    invoiceNumber: 'INV-889012',
    customerName: 'Halifax Carpentry & Builders Inc.',
    deliveryAddress: '142 Albert St, Halifax, NS B3K 3N4',
    phone: '(902) 555-0143',
    originBranch: 'WINDMILL_DC',
    destinationNotes: 'Drop building supplies in driveway, crane requested for framing lumber.'
  },
  {
    barcode: 'SO-102935-2',
    epicorSalesOrder: '102935',
    invoiceNumber: 'INV-889013',
    customerName: 'Eleanor Vance',
    deliveryAddress: '34 Maplewood Dr, Dartmouth, NS B2W 2A9',
    phone: '(902) 555-9012',
    originBranch: 'WINDMILL_DC',
    destinationNotes: 'Deliver 12 bundles of roofing shingles. Back of house.'
  },
  {
    barcode: 'SO-102936-3',
    epicorSalesOrder: '102936',
    invoiceNumber: 'INV-889014',
    customerName: 'East Coast Landscapes',
    deliveryAddress: '887 Waverley Rd, Dartmouth, NS B2X 2V2',
    phone: '(902) 555-4433',
    originBranch: '01065_ALMON',
    destinationNotes: '100 bags of landscaping soil, placement on the side yard.'
  },
  {
    barcode: 'SO-102937-4',
    epicorSalesOrder: '102937',
    invoiceNumber: 'INV-889015',
    customerName: 'Apex Renovations Ltd.',
    deliveryAddress: '43 Bedford Highway, Bedford, NS B3M 2L2',
    phone: '(902) 555-8811',
    originBranch: '01070_ELMSDALE',
    destinationNotes: 'Commercial jobsite. Hand off to superintendent Mike.'
  },
  {
    barcode: 'SO-102938-5',
    epicorSalesOrder: '102938',
    invoiceNumber: 'INV-889016',
    customerName: 'George Robertson',
    deliveryAddress: '15 Ocean Crest, Eastern Passage, NS B3G 1M6',
    phone: '(902) 555-2200',
    originBranch: '01075_TANTALLON',
    destinationNotes: 'High wind prone. Wrap drywall double-tight with plastic.'
  }
];

export const INITIAL_DELIVERIES: DeliveryRecord[] = [
  {
    id: 'SO-102931-X',
    epicorSalesOrder: '102931',
    invoiceNumber: 'INV-889008',
    customerName: 'Atlantic Deck Builders',
    deliveryAddress: '400 Windmill Rd, Dartmouth, NS B3B 1B1',
    phone: '(902) 555-3221',
    originBranch: 'WINDMILL_DC',
    destinationNotes: 'Lumber and deck screws. Call 10 mins before arrival.',
    status: DeliveryStatus.DELIVERED,
    registeredAt: '2026-06-10T07:15:00Z',
    pickedAt: '2026-06-10T08:30:00Z',
    deliveredAt: '2026-06-10T10:45:00Z',
    assignedTruck: 'TRUCK-01',
    assignedDriver: 'Dave MacNeil',
    customerSignature: 'Atlantic Deck - Signed by Roy',
    deliveryPhoto: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&auto=format&fit=crop&q=60',
    history: [
      { status: DeliveryStatus.REGISTERED, timestamp: '2026-06-10T07:15:00Z', location: 'Windmill Road Delivery Center', operator: 'John (Dispatcher)', notes: 'Registered from Epicor Eagle Sales Order CSV Import' },
      { status: DeliveryStatus.PICKED_AND_LOADED, timestamp: '2026-06-10T08:30:00Z', location: 'Windmill Road Delivery Center', operator: 'Dave MacNeil (Driver)', notes: 'Scanned and loaded onto Crane Boom Truck.' },
      { status: DeliveryStatus.DELIVERED, timestamp: '2026-06-10T10:45:00Z', location: '400 Windmill Rd, Dartmouth, NS', operator: 'Dave MacNeil (Driver)', notes: 'Delivered successfully. Left wood neatly on blocks.' }
    ]
  },
  {
    id: 'SO-102932-Y',
    epicorSalesOrder: '102932',
    invoiceNumber: 'INV-889009',
    customerName: 'Thomas Miller',
    deliveryAddress: '23 Pine St, Halifax, NS B3P 1E8',
    phone: '(902) 555-7654',
    originBranch: '01065_ALMON',
    destinationNotes: 'Patio stones. Narrow driveway - request pickup truck delivery if possible.',
    status: DeliveryStatus.PICKED_AND_LOADED,
    registeredAt: '2026-06-10T08:00:00Z',
    pickedAt: '2026-06-10T09:40:00Z',
    assignedTruck: 'TRUCK-03',
    assignedDriver: 'Marc LeBlanc',
    history: [
      { status: DeliveryStatus.REGISTERED, timestamp: '2026-06-10T08:00:00Z', location: '01065 - Almon RONA', operator: 'Marie (Store Dispatch)', notes: 'Registered at Almon Street store' },
      { status: DeliveryStatus.PICKED_AND_LOADED, timestamp: '2026-06-10T09:40:00Z', location: '01065 - Almon RONA', operator: 'Marc LeBlanc (Driver)', notes: 'Picked from lumber yard, loaded into pickup truck bed.' }
    ]
  },
  {
    id: 'SO-102933-Z',
    epicorSalesOrder: '102933',
    invoiceNumber: 'INV-889010',
    customerName: 'Sackville High School Repair',
    deliveryAddress: '40 Horsetooth Lane, Lower Sackville, NS B4E 2H9',
    phone: '(902) 555-1234',
    originBranch: '01070_ELMSDALE',
    destinationNotes: 'Steel studs and insulation packages. Delivery to Maintenance gate.',
    status: DeliveryStatus.RETURNED,
    registeredAt: '2026-06-10T06:00:00Z',
    pickedAt: '2026-06-10T07:00:00Z',
    returnedAt: '2026-06-10T09:15:00Z',
    assignedTruck: 'TRUCK-02',
    assignedDriver: 'Sarah Jenkins',
    returnReason: 'School custodian refused shipment - Wrong size insulation ordered by purchasing.',
    history: [
      { status: DeliveryStatus.REGISTERED, timestamp: '2026-06-10T06:00:00Z', location: '01070 - Elmsdale RONA', operator: 'Ken (Counter)', notes: 'Immediate dispatch request.' },
      { status: DeliveryStatus.PICKED_AND_LOADED, timestamp: '2026-06-10T07:00:00Z', location: '01070 - Elmsdale RONA', operator: 'Sarah Jenkins (Driver)', notes: 'Loaded and marked green.' },
      { status: DeliveryStatus.RETURNED, timestamp: '2026-06-10T09:15:00Z', location: '01070 - Elmsdale RONA', operator: 'Sarah Jenkins (Driver)', notes: 'Custodian refused insulation due to thickness error in buying. Drywall returned to store storage.' }
    ]
  }
];

export const INITIAL_USERS: User[] = [
  { id: 'USR-01', name: 'Dave MacNeil', email: 'dave.macneil@rona.ca', role: 'Driver', phone: '(902) 555-0101', associatedStoreId: 'WINDMILL_DC' },
  { id: 'USR-02', name: 'Sarah Jenkins', email: 'sarah.jenkins@rona.ca', role: 'Driver', phone: '(902) 555-0102', associatedStoreId: '01075_TANTALLON' },
  { id: 'USR-03', name: 'Marc LeBlanc', email: 'marc.leblanc@rona.ca', role: 'Driver', phone: '(902) 555-0103', associatedStoreId: '01065_ALMON' },
  { id: 'USR-04', name: 'Clara Smith', email: 'clara.smith@rona.ca', role: 'Driver', phone: '(902) 555-0104', associatedStoreId: '01070_ELMSDALE' },
  { id: 'USR-05', name: 'John Miller', email: 'john.miller@rona.ca', role: 'Driver', phone: '(902) 555-0105', associatedStoreId: '01075_TANTALLON' },
  { id: 'USR-06', name: 'Allison Collins', email: 'allison.collins@rona.ca', role: 'Dispatcher', phone: '(902) 555-0201', associatedStoreId: 'WINDMILL_DC' },
  { id: 'USR-07', name: 'Bob Thompson', email: 'bob.thompson@rona.ca', role: 'Admin', phone: '(902) 555-0301', associatedStoreId: 'WINDMILL_DC' },
  { id: 'USR-08', name: 'Emily Vance', email: 'emily.vance@rona.ca', role: 'User', phone: '(902) 555-0401', associatedStoreId: '01065_ALMON' }
];

// --- tenant 2: Bay of Fundy Transport (BOF) Seed Data ---
export const BRANCHES_BOF: Branch[] = [
  { id: 'BOF_MONCTON_DC', name: 'Moncton Regional Bulk DC Hub', type: 'DC', address: '450 Salisbury Rd, Moncton, NB E1E 1A2' },
  { id: 'BOF_KENTVILLE', name: '02081 - Kentville Valley RONA', type: 'STORE', address: '9009 Commercial St, Kentville, NS B4N 3V8' },
  { id: 'BOF_TRURO', name: '02095 - Truro Junction RONA', type: 'STORE', address: '124 Robie St, Truro, NS B2N 1L2' }
];

export const TRUCKS_BOF: Truck[] = [
  { id: 'TRUCK-BOF-01', name: 'BOF Truck-1 Crane Boom', type: 'Flatbed with Crane', driver: 'Jim Peterson', branchId: 'BOF_MONCTON_DC' },
  { id: 'TRUCK-BOF-02', name: 'BOF Truck-2 Box Truck', type: 'Medium Duty Box Truck', driver: 'Rita Comeau', branchId: 'BOF_KENTVILLE' },
  { id: 'TRUCK-BOF-03', name: 'BOF Truck-3 Fleet Pickup', type: 'Light Delivery Duty', driver: 'Maurice LeBlanc', branchId: 'BOF_TRURO' }
];

export const INITIAL_USERS_BOF: User[] = [
  { id: 'USR-BOF-01', name: 'Jim Peterson', email: 'jim.peterson@rona.ca', role: 'Driver', phone: '(506) 555-2311', associatedStoreId: 'BOF_MONCTON_DC' },
  { id: 'USR-BOF-02', name: 'Rita Comeau', email: 'rita.comeau@rona.ca', role: 'Driver', phone: '(506) 555-2312', associatedStoreId: 'BOF_KENTVILLE' },
  { id: 'USR-BOF-03', name: 'Maurice LeBlanc', email: 'maurice.leblanc@rona.ca', role: 'Driver', phone: '(506) 555-2313', associatedStoreId: 'BOF_TRURO' },
  { id: 'USR-BOF-04', name: 'Reginald Gentry', email: 'reg.gentry@rona.ca', role: 'Dispatcher', phone: '(506) 555-2314', associatedStoreId: 'BOF_MONCTON_DC' },
  { id: 'USR-BOF-05', name: 'Leah Robichaud', email: 'leah.robin@rona.ca', role: 'Admin', phone: '(506) 555-2315', associatedStoreId: 'BOF_MONCTON_DC' }
];

export const INITIAL_DELIVERIES_BOF: DeliveryRecord[] = [
  {
    id: 'SO-3001-Valley',
    epicorSalesOrder: '3001',
    invoiceNumber: 'INV-101112',
    customerName: 'Wolfville Estate Vineyards',
    deliveryAddress: '350 Ridge Rd, Wolfville, NS B4P 2R1',
    phone: '(902) 555-9001',
    originBranch: 'BOF_KENTVILLE',
    destinationNotes: 'Landscape slabs and patio bricks. Unload near the green tasting barn.',
    status: DeliveryStatus.DELIVERED,
    registeredAt: '2026-06-11T09:00:00Z',
    pickedAt: '2026-06-11T10:30:00Z',
    deliveredAt: '2026-06-11T13:45:00Z',
    assignedTruck: 'TRUCK-BOF-02',
    assignedDriver: 'Rita Comeau',
    customerSignature: 'Signed by Estate Manager Pierre',
    history: [
      { status: DeliveryStatus.REGISTERED, timestamp: '2026-06-11T09:00:00Z', location: '02081 - Kentville Valley RONA', operator: 'Reg Gentry (Dispatcher)', notes: 'Epicor System Uploaded.' },
      { status: DeliveryStatus.PICKED_AND_LOADED, timestamp: '2026-06-11T10:30:00Z', location: '02081 - Kentville Valley RONA', operator: 'Rita Comeau (Driver)', notes: 'Loaded and block-cleared.' },
      { status: DeliveryStatus.DELIVERED, timestamp: '2026-06-11T13:45:00Z', location: 'Wolfville Estate Vineyards', operator: 'Rita Comeau (Driver)', notes: 'Successfully stacked on vineyard gravel.' }
    ]
  },
  {
    id: 'SO-3002-Truro',
    epicorSalesOrder: '3002',
    invoiceNumber: 'INV-101113',
    customerName: 'Truro School Board Depot',
    deliveryAddress: '150 Robie St, Truro, NS B2N 1L2',
    phone: '(902) 555-9002',
    originBranch: 'BOF_TRURO',
    destinationNotes: 'Insulation rolls. Back receiving dock 2.',
    status: DeliveryStatus.PICKED_AND_LOADED,
    registeredAt: '2026-06-11T11:00:00Z',
    pickedAt: '2026-06-11T12:15:00Z',
    assignedTruck: 'TRUCK-BOF-03',
    assignedDriver: 'Maurice LeBlanc',
    history: [
      { status: DeliveryStatus.REGISTERED, timestamp: '2026-06-11T11:00:00Z', location: '02095 - Truro Junction RONA', operator: 'Reg Gentry (Dispatcher)', notes: 'Logged' },
      { status: DeliveryStatus.PICKED_AND_LOADED, timestamp: '2026-06-11T12:15:00Z', location: '02095 - Truro Junction RONA', operator: 'Maurice LeBlanc (Driver)', notes: 'Loaded onto regional shuttle.' }
    ]
  }
];

// --- tenant 3: Cabot Trail Cargo (CTC) Seed Data ---
export const BRANCHES_CTC: Branch[] = [
  { id: 'CTC_SYDNEY_STORE', name: '03055 - Sydney Tar Ponds RONA', type: 'STORE', address: '250 Keltic Dr, Sydney, NS B1S 1P5' },
  { id: 'CTC_HAWKESBURY_DC', name: 'Port Hawkesbury Contractor Hub', type: 'DC', address: '49 Paint St, Port Hawkesbury, NS B9A 3J9' }
];

export const TRUCKS_CTC: Truck[] = [
  { id: 'TRUCK-CTC-01', name: 'CTC Heavy Peterbilt Crane', type: 'Flatbed with Crane', driver: 'Angus McDonald', branchId: 'CTC_HAWKESBURY_DC' },
  { id: 'TRUCK-CTC-02', name: 'CTC Light Duty Flatbed', type: 'Medium Duty Flatbed', driver: 'Liam Beaton', branchId: 'CTC_SYDNEY_STORE' }
];

export const INITIAL_USERS_CTC: User[] = [
  { id: 'USR-CTC-01', name: 'Angus McDonald', email: 'angus.mcd@rona.ca', role: 'Driver', phone: '(902) 555-9081', associatedStoreId: 'CTC_HAWKESBURY_DC' },
  { id: 'USR-CTC-02', name: 'Liam Beaton', email: 'liam.beaton@rona.ca', role: 'Driver', phone: '(902) 555-9082', associatedStoreId: 'CTC_SYDNEY_STORE' },
  { id: 'USR-CTC-03', name: 'Seamus O\'Neil', email: 'seamus.oneil@rona.ca', role: 'Dispatcher', phone: '(902) 555-9083', associatedStoreId: 'CTC_HAWKESBURY_DC' },
  { id: 'USR-CTC-04', name: 'Mairi Chisholm', email: 'mairi.chisholm@rona.ca', role: 'Admin', phone: '(902) 555-9084', associatedStoreId: 'CTC_HAWKESBURY_DC' }
];

export const INITIAL_DELIVERIES_CTC: DeliveryRecord[] = [
  {
    id: 'SO-5001-Sydney',
    epicorSalesOrder: '5001',
    invoiceNumber: 'INV-400812',
    customerName: 'Glace Bay Community Rink',
    deliveryAddress: '200 South St, Glace Bay, NS B1A 1V1',
    phone: '(902) 555-7761',
    originBranch: 'CTC_SYDNEY_STORE',
    destinationNotes: 'High-wind roofing shingles. Place securely behind the lobby entrance construction fence.',
    status: DeliveryStatus.DELIVERED,
    registeredAt: '2026-06-11T08:00:00Z',
    pickedAt: '2026-06-11T09:15:00Z',
    deliveredAt: '2026-06-11T11:50:00Z',
    assignedTruck: 'TRUCK-CTC-02',
    assignedDriver: 'Liam Beaton',
    customerSignature: 'Signed by Arena Foreman Mac',
    history: [
      { status: DeliveryStatus.REGISTERED, timestamp: '2026-06-11T08:00:00Z', location: '03055 - Sydney Tar Ponds RONA', operator: 'Seamus O\'Neil (Dispatcher)', notes: 'Order created' },
      { status: DeliveryStatus.PICKED_AND_LOADED, timestamp: '2026-06-11T09:15:00Z', location: '03055 - Sydney Tar Ponds RONA', operator: 'Liam Beaton (Driver)', notes: 'Loaded and tarped.' },
      { status: DeliveryStatus.DELIVERED, timestamp: '2026-06-11T11:50:00Z', location: 'Glace Bay Community Rink', operator: 'Liam Beaton (Driver)', notes: 'Dry and secured behind gates.' }
    ]
  },
  {
    id: 'SO-5002-Canso',
    epicorSalesOrder: '5002',
    invoiceNumber: 'INV-400813',
    customerName: 'Canso Marine Trawlers Ltd',
    deliveryAddress: '15 Wharf Rd, Port Hawkesbury, NS B9A 2A1',
    phone: '(902) 555-7762',
    originBranch: 'CTC_HAWKESBURY_DC',
    destinationNotes: 'Marine grade treated timber panels. Crane truck drop near dry dock.',
    status: DeliveryStatus.PICKED_AND_LOADED,
    registeredAt: '2026-06-11T10:00:00Z',
    pickedAt: '2026-06-11T11:45:00Z',
    assignedTruck: 'TRUCK-CTC-01',
    assignedDriver: 'Angus McDonald',
    history: [
      { status: DeliveryStatus.REGISTERED, timestamp: '2026-06-11T10:00:00Z', location: 'Port Hawkesbury Contractor Hub', operator: 'Seamus O\'Neil', notes: 'Logged' },
      { status: DeliveryStatus.PICKED_AND_LOADED, timestamp: '2026-06-11T11:45:00Z', location: 'Port Hawkesbury Contractor Hub', operator: 'Angus McDonald (Driver)', notes: 'Picked with heavy yard crane.' }
    ]
  }
];


