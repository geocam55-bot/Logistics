import { createClient } from "@supabase/supabase-js";

// Serialization and Deserialization helpers matching the backend implementation
export function serializeToPhone(phone: string | undefined, password: string | undefined, status: string | undefined, driverLicenseExpire?: string | undefined): string {
  const basePhone = (phone || "").trim();
  let res = basePhone;
  if (password) {
    res += ` ||pw:${password}`;
  }
  if (status) {
    res += ` ||status:${status}`;
  }
  if (driverLicenseExpire) {
    res += ` ||licexp:${driverLicenseExpire}`;
  }
  return res;
}

export function deserializeFromPhone(user: any): any {
  if (!user) return user;
  const phone = user.phone || "";
  let cleanPhone = phone;
  let password = user.password || "123456";
  let status = user.status || "Active";
  let driverLicenseExpire = user.driverLicenseExpire || "";

  const pwMatch = phone.match(/\|\|pw:([^\s|]+)/);
  if (pwMatch) {
    password = pwMatch[1];
    cleanPhone = cleanPhone.replace(/\|\|pw:[^\s|]+/, "");
  }
  const statusMatch = phone.match(/\|\|status:([^\s|]+)/);
  if (statusMatch) {
    status = statusMatch[1];
    cleanPhone = cleanPhone.replace(/\|\|status:[^\s|]+/, "");
  }
  const licexpMatch = phone.match(/\|\|licexp:([^\s|]+)/);
  if (licexpMatch) {
    driverLicenseExpire = licexpMatch[1];
    cleanPhone = cleanPhone.replace(/\|\|licexp:[^\s|]+/, "");
  }

  return {
    ...user,
    phone: cleanPhone.trim(),
    password,
    status,
    driverLicenseExpire
  };
}

export function serializeToType(type: string | undefined, registrationDueDate: string | undefined, lat?: number, lng?: number): string {
  const baseType = (type || "").trim();
  let res = baseType;
  if (registrationDueDate) {
    res += ` ||regdue:${registrationDueDate}`;
  }
  if (lat !== undefined && lat !== null) {
    res += ` ||lat:${lat}`;
  }
  if (lng !== undefined && lng !== null) {
    res += ` ||lng:${lng}`;
  }
  return res;
}

export function deserializeType(truck: any): any {
  if (!truck) return truck;
  const type = truck.type || "";
  let cleanType = type;
  let registrationDueDate = truck.registrationDueDate || "";
  let lat: number | undefined;
  let lng: number | undefined;

  const regdueMatch = type.match(/\|\|regdue:([^\s|]+)/);
  if (regdueMatch) {
    registrationDueDate = regdueMatch[1];
    cleanType = cleanType.replace(/\|\|regdue:[^\s|]+/, "");
  }

  const latMatch = type.match(/\|\|lat:([^\s|]+)/);
  if (latMatch) {
    lat = parseFloat(latMatch[1]);
    cleanType = cleanType.replace(/\|\|lat:[^\s|]+/, "");
  }

  const lngMatch = type.match(/\|\|lng:([^\s|]+)/);
  if (lngMatch) {
    lng = parseFloat(lngMatch[1]);
    cleanType = cleanType.replace(/\|\|lng:[^\s|]+/, "");
  }

  return {
    ...truck,
    type: cleanType.trim(),
    registrationDueDate,
    ...(lat !== undefined && !isNaN(lat) ? { lat } : {}),
    ...(lng !== undefined && !isNaN(lng) ? { lng } : {})
  };
}

let cachedClient: any = null;
let currentUrl = "";
let currentKey = "";

export function initializeFrontendSupabase(url: string, key: string) {
  if (!url || !key) return null;

  // Trim and strip surrounding quotes
  const cleanUrl = url.trim().replace(/^['"\\\'\\\"]+|['"\\\'\\\"]+$/g, '').replace(/\/rest\/v1\/?$/i, '').replace(/\/rest\/?$/i, '').replace(/\/+$/, '');
  const cleanKey = key.trim().replace(/^['"\\\'\\\"]+|['"\\\'\\\"]+$/g, '');

  if (
    cleanUrl === "" || 
    cleanKey === "" || 
    cleanUrl === "undefined" || 
    cleanKey === "undefined" || 
    cleanUrl === "null" || 
    cleanKey === "null" || 
    cleanUrl.includes("PLACEHOLDER") || 
    cleanKey.includes("PLACEHOLDER")
  ) {
    return null;
  }

  if (cleanUrl !== currentUrl || cleanKey !== currentKey) {
    cachedClient = null;
  }

  if (!cachedClient) {
    try {
      cachedClient = createClient(cleanUrl, cleanKey, {
        auth: {
          persistSession: false
        }
      });
      currentUrl = cleanUrl;
      currentKey = cleanKey;
    } catch (e) {
      console.error("Failed to initialize dynamic frontend Supabase:", e);
    }
  }
  return cachedClient;
}

export function getFrontendSupabase() {
  if (cachedClient) return cachedClient;

  let url = currentUrl || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  let key = currentKey || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

  if (!url || !key) {
    return null;
  }

  // Trim and strip surrounding quotes
  url = url.trim().replace(/^['"\\\'\\\"]+|['"\\\'\\\"]+$/g, '');
  key = key.trim().replace(/^['"\\\'\\\"]+|['"\\\'\\\"]+$/g, '');

  url = url.replace(/\/rest\/v1\/?$/i, '').replace(/\/rest\/?$/i, '').replace(/\/+$/, '');

  if (
    url === "" || 
    key === "" || 
    url === "undefined" || 
    key === "undefined" || 
    url === "null" || 
    key === "null" || 
    url.includes("PLACEHOLDER") || 
    key.includes("PLACEHOLDER")
  ) {
    return null;
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return null;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: false
      }
    });
    currentUrl = url;
    currentKey = key;
    return cachedClient;
  } catch (e) {
    console.error("Failed to initialize frontend Supabase client:", e);
    return null;
  }
}

// Check database diagnostics
export async function checkSupabaseStatusDirect(): Promise<any> {
  const supabase = getFrontendSupabase();
  if (!supabase) {
    return { active: false, details: "Client-side configuration missing/empty environ variables." };
  }
  try {
    const { data, error } = await supabase.from("tenants").select("id").limit(1);
    if (error) {
      return { active: true, error: error.message, details: "Connected to endpoint but received querying error. Schema might need to be created." };
    }
    return { active: true, success: true, details: "Directly connected to Supabase and queried successfully." };
  } catch (err: any) {
    return { active: false, details: err.message || String(err) };
  }
}

// Fetch all tenants directly
export async function fetchTenantsDirect(): Promise<any[]> {
  const supabase = getFrontendSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from("tenants").select("*");
  if (error) throw error;
  return data || [];
}

// Add/Save tenant directly
export async function saveTenantDirect(tenant: any): Promise<void> {
  const supabase = getFrontendSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("tenants").upsert(tenant);
  if (error) throw error;
}

// Delete tenant directly
export async function deleteTenantDirect(tenantId: string): Promise<void> {
  const supabase = getFrontendSupabase();
  if (!supabase) return;
  
  // Clean related tables as cascade failsafe
  await Promise.all([
    supabase.from("deliveries").delete().eq("tenantId", tenantId),
    supabase.from("users").delete().eq("tenantId", tenantId),
    supabase.from("trucks").delete().eq("tenantId", tenantId),
    supabase.from("branches").delete().eq("tenantId", tenantId),
  ]);

  const { error } = await supabase.from("tenants").delete().eq("id", tenantId);
  if (error) throw error;
}

// Hydrate state for a specific tenant directly
export async function fetchTenantStateDirect(tenantId: string) {
  const supabase = getFrontendSupabase();
  if (!supabase) {
    return { supabaseActive: false };
  }

  const [rBranches, rTrucks, rUsers, rDeliveries] = await Promise.all([
    supabase.from("branches").select("*").eq("tenantId", tenantId),
    supabase.from("trucks").select("*").eq("tenantId", tenantId),
    supabase.from("users").select("*").eq("tenantId", tenantId),
    supabase.from("deliveries").select("*").eq("tenantId", tenantId)
  ]);

  if (rBranches.error || rTrucks.error || rUsers.error || rDeliveries.error) {
    const primaryError = rBranches.error || rTrucks.error || rUsers.error || rDeliveries.error;
    throw new Error(primaryError?.message || "Failed to query tables directly from Supabase.");
  }

  const deserializedUsers = (rUsers.data || []).map((u: any) => deserializeFromPhone(u));
  const deserializedTrucks = (rTrucks.data || []).map((t: any) => deserializeType(t));

  return {
    supabaseActive: true,
    branches: rBranches.data || [],
    trucks: deserializedTrucks,
    users: deserializedUsers,
    deliveries: rDeliveries.data || []
  };
}

// Upsert state directly
export async function saveTenantStateDirect(
  tenantId: string,
  deliveries: any[],
  trucks: any[],
  branches: any[],
  users: any[]
) {
  const supabase = getFrontendSupabase();
  if (!supabase) return { supabaseActive: false };

  // Prepare and serialize
  const serializedUsers = users.map(u => ({
    id: u.id,
    tenantId,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: serializeToPhone(u.phone, u.password, u.status, u.driverLicenseExpire),
    associatedStoreId: u.associatedStoreId
  }));

  const serializedTrucks = trucks.map(t => ({
    id: t.id,
    tenantId,
    name: t.name,
    type: serializeToType(t.type, t.registrationDueDate, t.lat, t.lng),
    driver: t.driver,
    branchId: t.branchId
  }));

  const mappedBranches = branches.map(b => ({
    id: b.id,
    tenantId,
    name: b.name,
    type: b.type,
    address: b.address
  }));

  const mappedDeliveries = deliveries.map(d => ({
    id: d.id,
    tenantId,
    invoiceNumber: d.invoiceNumber,
    epicorSalesOrder: d.epicorSalesOrder,
    customerName: d.customerName,
    deliveryAddress: d.deliveryAddress,
    phone: d.phone,
    originBranch: d.originBranch,
    weight: d.weight,
    orderTotal: d.orderTotal,
    pdfUrl: d.pdfUrl,
    destinationNotes: d.destinationNotes,
    status: d.status,
    registeredAt: d.registeredAt,
    pickedAt: d.pickedAt,
    deliveredAt: d.deliveredAt,
    returnedAt: d.returnedAt,
    returnReason: d.returnReason,
    assignedTruck: d.assignedTruck,
    assignedDriver: d.assignedDriver,
    customerSignature: d.customerSignature,
    deliveryPhoto: d.deliveryPhoto,
    history: d.history ? (typeof d.history === 'string' ? JSON.parse(d.history) : d.history) : []
  }));

  // Perform parallel upserts
  await Promise.all([
    supabase.from("branches").upsert(mappedBranches),
    supabase.from("trucks").upsert(serializedTrucks),
    supabase.from("users").upsert(serializedUsers),
    supabase.from("deliveries").upsert(mappedDeliveries),
  ]);

  return { supabaseActive: true };
}

// Delete record directly
export async function deleteRecordDirect(table: string, id: string, tenantId: string) {
  const supabase = getFrontendSupabase();
  if (!supabase) return;
  const { error } = await supabase.from(table).delete().eq("id", id).eq("tenantId", tenantId);
  if (error) throw error;
}

// Clear all records for a tenant
export async function clearAllDirect(tenantId: string) {
  const supabase = getFrontendSupabase();
  if (!supabase) return;
  await Promise.all([
    supabase.from("deliveries").delete().eq("tenantId", tenantId),
    supabase.from("users").delete().eq("tenantId", tenantId),
    supabase.from("trucks").delete().eq("tenantId", tenantId),
    supabase.from("branches").delete().eq("tenantId", tenantId),
  ]);
}
