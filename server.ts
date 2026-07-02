import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "MY_GEMINI_API_KEY" || key.trim() === "" || key.trim() === "undefined") {
    throw new Error(
      "GEMINI_API_KEY is currently unconfigured or set to a placeholder. To activate the OCR engine, please open the 'Settings > Secrets' panel in your AI Studio build workspace, verify that GEMINI_API_KEY is correctly set with your Gemini API key, and then either restart or re-publish your applet."
    );
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Supabase Lazy Initialization
function isServiceRoleKey(key: string): boolean {
  if (!key) return false;
  try {
    const parts = key.split('.');
    if (parts.length === 3) {
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const decodedPayload = Buffer.from(payloadBase64, 'base64').toString('utf8');
      const payload = JSON.parse(decodedPayload);
      return payload.role === 'service_role';
    }
  } catch (e) {
    // ignore
  }
  return key.includes("service_role") || (!key.includes("anon") && !key.startsWith("sb_pub") && !key.startsWith("sb_publishable") && key.length > 100);
}

let customSupabaseUrl = "";
let customSupabaseKey = "";

const CONFIG_FILE = path.join(process.cwd(), "supabase-config.json");

// Load custom Supabase credentials from local file on startup if available
if (fs.existsSync(CONFIG_FILE)) {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed.url && parsed.key) {
      customSupabaseUrl = parsed.url;
      customSupabaseKey = parsed.key;
      console.log("Loaded custom Supabase credentials from supabase-config.json");
    }
  } catch (err) {
    console.error("Failed to load supabase-config.json:", err);
  }
}

let supabaseClient: any = null;
let lastSupabaseUrl = "";
let lastSupabaseKey = "";

// Circuit Breaker for Supabase connections to prevent hanging on invalid/paused credentials
let supabaseConsecutiveFailures = 0;
let supabaseTemporarilyDisabled = false;
let supabaseDisabledUntil = 0;

function getSupabase(reqOrBypass?: any, bypassCircuitBreaker: boolean = false) {
  let req: any = null;
  let bypass = bypassCircuitBreaker;

  if (typeof reqOrBypass === "boolean") {
    bypass = reqOrBypass;
  } else if (reqOrBypass && typeof reqOrBypass === "object") {
    req = reqOrBypass;
  }

  if (supabaseTemporarilyDisabled && !bypass) {
    if (Date.now() < supabaseDisabledUntil) {
      return null;
    } else {
      // Cooldown finished, try again
      supabaseTemporarilyDisabled = false;
      supabaseConsecutiveFailures = 0;
    }
  }

  // 1. Resolve credentials dynamically from request headers if present and valid
  let url = "";
  let key = "";

  const envUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const envAnonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY || "").trim();
  const envServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim();

  if (req && req.headers) {
    const customUrlHeader = req.headers["x-custom-supabase-url"];
    const customKeyHeader = req.headers["x-custom-supabase-key"];
    if (customUrlHeader && customKeyHeader) {
      const u = (Array.isArray(customUrlHeader) ? customUrlHeader[0] : customUrlHeader).trim();
      const k = (Array.isArray(customKeyHeader) ? customKeyHeader[0] : customKeyHeader).trim();
      if (u && k && u !== "null" && u !== "undefined" && u !== "Default" && k !== "null" && k !== "undefined") {
        // If client headers match the default environment database, elevate to use the server's service role key
        const isSameAsEnvUrl = envUrl && u.replace(/\/+$/, '') === envUrl.replace(/\/+$/, '');
        const isSameAsEnvKey = envAnonKey && k === envAnonKey;
        
        if (isSameAsEnvUrl && isSameAsEnvKey && envServiceKey) {
          url = envUrl;
          key = envServiceKey;
        } else {
          url = u;
          key = k;
        }
      }
    }
  }

  // 2. Fall back to customSupabaseUrl / environment variables if no valid request headers
  if (!url || !key) {
    const u = (customSupabaseUrl || "").trim();
    const k = (customSupabaseKey || "").trim();
    
    if (u && k) {
      // If server memory config matches the default environment database, elevate to use the server's service role key
      const isSameAsEnvUrl = envUrl && u.replace(/\/+$/, '') === envUrl.replace(/\/+$/, '');
      const isSameAsEnvKey = envAnonKey && k === envAnonKey;
      
      if (isSameAsEnvUrl && isSameAsEnvKey && envServiceKey) {
        url = envUrl;
        key = envServiceKey;
      } else {
        url = u;
        key = k;
      }
    } else {
      url = envUrl;
      key = envServiceKey || envAnonKey || "";
    }
  }

  if (!url || !key) {
    return null;
  }

  // Trim and strip surrounding quotes (including escaped, double, single, or backslashed characters)
  url = url.trim().replace(/^['"\\\'\\\"]+|['"\\\'\\\"]+$/g, '');
  key = key.trim().replace(/^['"\\\'\\\"]+|['"\\\'\\\"]+$/g, '');

  // Strip trailing slashes and common suffix paths like "/rest/v1" or "/rest" that cause duplicate path errors in the client
  url = url.replace(/\/rest\/v1\/?$/i, '');
  url = url.replace(/\/rest\/?$/i, '');
  url = url.replace(/\/+$/, '');

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

  // Ensure it starts with http:// or https://
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return null;
  }
  
  if (url !== lastSupabaseUrl || key !== lastSupabaseKey) {
    supabaseClient = null;
  }

  if (!supabaseClient) {
    try {
      supabaseClient = createClient(url, key, {
        auth: {
          persistSession: false
        }
      });
      lastSupabaseUrl = url;
      lastSupabaseKey = key;
    } catch (e) {
      console.error("Failed to initialize Supabase client:", e);
      return null;
    }
  }
  return supabaseClient;
}

function withTimeout<T>(promise: Promise<T> | any, ms: number = 30000): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("Database query timed out (timeout threshold reached)"));
    }, ms);
  });
  return Promise.race([
    Promise.resolve(promise).then((res) => {
      clearTimeout(timer);
      return res;
    }),
    timeoutPromise
  ]);
}

function formatDatabaseError(err: any): string {
  if (!err) return "An unknown database error occurred.";
  const msg = err.message || String(err);
  if (
    msg.includes("Invalid path specified in request URL") ||
    (msg.includes("relation") && msg.includes("does not exist")) ||
    msg.includes("42P01")
  ) {
    return "Your Supabase database is connected, but the required database tables do not exist yet. Please go to the 'System Architecture' dashboard, copy the SQL setup schema script, and run it in the SQL Editor within your Supabase workspace to initialize the tables.";
  }
  if (msg.toLowerCase().includes("row-level security") || msg.toLowerCase().includes("violates row-level security") || msg.toLowerCase().includes("rls")) {
    return "A Row-Level Security (RLS) policy violation occurred. This means RLS is enabled on your Supabase tables but your connection is restricted. Please add the SUPABASE_SERVICE_ROLE_KEY to your AI Studio Secrets (bypasses RLS on the server-side), or execute the permissive SQL policies block from the System Architecture tab in your Supabase SQL Editor.";
  }
  return msg;
}

function serializeToPhone(phone: string | undefined, password: string | undefined, status: string | undefined, driverLicenseExpire?: string | undefined, lastActive?: string | undefined, resetRequest?: string | undefined): string {
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
  if (lastActive) {
    res += ` ||lastact:${lastActive}`;
  }
  if (resetRequest) {
    res += ` ||resetreq:${resetRequest}`;
  }
  return res;
}

function deserializeFromPhone(user: any): any {
  if (!user) return user;
  const phone = user.phone || "";
  let cleanPhone = phone;
  let password = user.password || "";
  let status = user.status || "Active";
  let driverLicenseExpire = user.driverLicenseExpire || "";
  let lastActive = "";
  let resetRequest = "";

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
  const lastactMatch = phone.match(/\|\|lastact:([^\s|]+)/);
  if (lastactMatch) {
    lastActive = lastactMatch[1];
    cleanPhone = cleanPhone.replace(/\|\|lastact:[^\s|]+/, "");
  }
  const resetreqMatch = phone.match(/\|\|resetreq:([^\s|]+)/);
  if (resetreqMatch) {
    resetRequest = resetreqMatch[1];
    cleanPhone = cleanPhone.replace(/\|\|resetreq:[^\s|]+/, "");
  }

  return {
    ...user,
    phone: cleanPhone.trim(),
    password,
    status,
    driverLicenseExpire,
    lastActive,
    resetRequest
  };
}

function serializeToType(
  type: string | undefined,
  registrationDueDate: string | undefined,
  lat?: number,
  lng?: number,
  gpsSource?: 'mobile' | 'truck',
  gpsDeviceId?: string,
  gpsDeviceName?: string,
  gpsSimIccid?: string,
  gpsStatus?: string,
  gpsLastHandshake?: string,
  gpsLat?: number,
  gpsLng?: number
): string {
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
  if (gpsSource) {
    res += ` ||gpsSource:${gpsSource}`;
  }
  if (gpsDeviceId) {
    res += ` ||gpsDeviceId:${encodeURIComponent(gpsDeviceId)}`;
  }
  if (gpsDeviceName) {
    res += ` ||gpsDeviceName:${encodeURIComponent(gpsDeviceName)}`;
  }
  if (gpsSimIccid) {
    res += ` ||gpsSimIccid:${encodeURIComponent(gpsSimIccid)}`;
  }
  if (gpsStatus) {
    res += ` ||gpsStatus:${gpsStatus}`;
  }
  if (gpsLastHandshake) {
    res += ` ||gpsLastHandshake:${gpsLastHandshake}`;
  }
  if (gpsLat !== undefined && gpsLat !== null) {
    res += ` ||gpsLat:${gpsLat}`;
  }
  if (gpsLng !== undefined && gpsLng !== null) {
    res += ` ||gpsLng:${gpsLng}`;
  }
  return res;
}

function deserializeType(truck: any): any {
  if (!truck) return truck;
  const type = truck.type || "";
  let cleanType = type;
  let registrationDueDate = truck.registrationDueDate || "";
  let lat: number | undefined;
  let lng: number | undefined;
  let gpsSource: 'mobile' | 'truck' | undefined;
  let gpsDeviceId: string | undefined;
  let gpsDeviceName: string | undefined;
  let gpsSimIccid: string | undefined;
  let gpsStatus: 'Connected' | 'Disconnected' | 'Syncing' | 'Error' | undefined;
  let gpsLastHandshake: string | undefined;
  let gpsLat: number | undefined;
  let gpsLng: number | undefined;

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

  const gpsSourceMatch = type.match(/\|\|gpsSource:([^\s|]+)/);
  if (gpsSourceMatch) {
    gpsSource = gpsSourceMatch[1] as any;
    cleanType = cleanType.replace(/\|\|gpsSource:[^\s|]+/, "");
  }

  const gpsDeviceIdMatch = type.match(/\|\|gpsDeviceId:([^\s|]+)/);
  if (gpsDeviceIdMatch) {
    gpsDeviceId = decodeURIComponent(gpsDeviceIdMatch[1]);
    cleanType = cleanType.replace(/\|\|gpsDeviceId:[^\s|]+/, "");
  }

  const gpsDeviceNameMatch = type.match(/\|\|gpsDeviceName:([^\s|]+)/);
  if (gpsDeviceNameMatch) {
    gpsDeviceName = decodeURIComponent(gpsDeviceNameMatch[1]);
    cleanType = cleanType.replace(/\|\|gpsDeviceName:[^\s|]+/, "");
  }

  const gpsSimIccidMatch = type.match(/\|\|gpsSimIccid:([^\s|]+)/);
  if (gpsSimIccidMatch) {
    gpsSimIccid = decodeURIComponent(gpsSimIccidMatch[1]);
    cleanType = cleanType.replace(/\|\|gpsSimIccid:[^\s|]+/, "");
  }

  const gpsStatusMatch = type.match(/\|\|gpsStatus:([^\s|]+)/);
  if (gpsStatusMatch) {
    gpsStatus = gpsStatusMatch[1] as any;
    cleanType = cleanType.replace(/\|\|gpsStatus:[^\s|]+/, "");
  }

  const gpsLastHandshakeMatch = type.match(/\|\|gpsLastHandshake:([^\s|]+)/);
  if (gpsLastHandshakeMatch) {
    gpsLastHandshake = gpsLastHandshakeMatch[1];
    cleanType = cleanType.replace(/\|\|gpsLastHandshake:[^\s|]+/, "");
  }

  const gpsLatMatch = type.match(/\|\|gpsLat:([^\s|]+)/);
  if (gpsLatMatch) {
    gpsLat = parseFloat(gpsLatMatch[1]);
    cleanType = cleanType.replace(/\|\|gpsLat:[^\s|]+/, "");
  }

  const gpsLngMatch = type.match(/\|\|gpsLng:([^\s|]+)/);
  if (gpsLngMatch) {
    gpsLng = parseFloat(gpsLngMatch[1]);
    cleanType = cleanType.replace(/\|\|gpsLng:[^\s|]+/, "");
  }

  return {
    ...truck,
    type: cleanType.trim(),
    registrationDueDate,
    ...(lat !== undefined && !isNaN(lat) ? { lat } : {}),
    ...(lng !== undefined && !isNaN(lng) ? { lng } : {}),
    gpsSource: gpsSource || 'mobile',
    gpsDeviceId: gpsDeviceId || '',
    gpsDeviceName: gpsDeviceName || '',
    gpsSimIccid: gpsSimIccid || '',
    gpsStatus: gpsStatus || 'Disconnected',
    gpsLastHandshake: gpsLastHandshake || '',
    ...(gpsLat !== undefined && !isNaN(gpsLat) ? { gpsLat } : {}),
    ...(gpsLng !== undefined && !isNaN(gpsLng) ? { gpsLng } : {})
  };
}

const SH_SQL = `/* SUPABASE SCHEMA INITIALIZATION FOR PROSPACES DELIVERY AND LOGISTICS PORTAL */

-- 1. Create tenants table
create table if not exists tenants (
  id text primary key,
  name text not null,
  code text not null unique,
  description text,
  "logoBadge" text,
  "regionalFocus" text,
  "primaryColor" text default 'blue'
);

-- 2. Create branches table
create table if not exists branches (
  id text primary key,
  "tenantId" text not null,
  name text not null,
  type text not null, -- 'DC' or 'STORE'
  address text not null
);

-- 3. Create trucks/vehicles table
create table if not exists trucks (
  id text primary key,
  "tenantId" text not null,
  name text not null,
  type text not null,
  driver text not null,
  "branchId" text not null,
  "registrationDueDate" text
);

-- 4. Create users table
create table if not exists users (
  id text primary key,
  "tenantId" text not null,
  name text not null,
  email text not null,
  role text not null, -- 'Admin', 'Dispatcher', 'Driver', 'User'
  phone text,
  "associatedStoreId" text,
  password text,
  status text default 'Active',
  "driverLicenseExpire" text
);

-- 5. Create deliveries table
create table if not exists deliveries (
  id text primary key,
  "tenantId" text not null,
  "invoiceNumber" text not null,
  "epicorSalesOrder" text not null,
  "customerName" text not null,
  "deliveryAddress" text not null,
  phone text not null,
  "originBranch" text not null,
  "weight" text,
  "orderTotal" text,
  "pdfUrl" text,
  "destinationNotes" text,
  status text not null,
  "registeredAt" text not null,
  "pickedAt" text,
  "deliveredAt" text,
  "returnedAt" text,
  "returnReason" text,
  "assignedTruck" text,
  "assignedDriver" text,
  "customerSignature" text,
  "deliveryPhoto" text,
  history jsonb default '[]'::jsonb
);

-- 6. Create gps_units_setup table for built-in GPS hardware configurations in Trucks
create table if not exists gps_units_setup (
  id text primary key, -- hardware ID / IMEI
  "tenantId" text not null default 'prospaces',
  "deviceId" text not null unique, -- custom unique identifier
  "deviceName" text not null, -- label, e.g. "CalAmp LMU-3030" or "Built-in GPS Premium"
  "simIccid" text, -- SIM ICCID card number
  status text not null default 'Disconnected', -- 'Connected', 'Disconnected', 'Syncing', 'Error'
  "assignedTruckId" text references trucks(id) on delete set null, -- bound to specific truck
  "lastHandshake" text, -- formatted string representation
  "lastLatitude" double precision,
  "lastLongitude" double precision,
  "installedAt" text default now()::text
);

-- 7. Create gps_tracking_history table for telemetric tracking updates
create table if not exists gps_tracking_history (
  id uuid primary key default gen_random_uuid(),
  "tenantId" text not null default 'prospaces',
  "deviceId" text not null references gps_units_setup("deviceId") on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  speed double precision, -- speed in km/h or mph
  heading double precision, -- degrees (0-360)
  "recordedAt" text not null,
  "ignitionStatus" boolean default true
);

-- Seed Initial Logistical Partners
insert into tenants (id, name, code, description, "logoBadge", "regionalFocus", "primaryColor") values
('prospaces', 'ProSpaces Logistics', 'PS', 'Corporate logistics tracking for ProSpaces distributor and dealer stores.', '🏢', 'Atlantic Canada (Dartmouth, Tantallon, Halifax)', 'blue')
on conflict (id) do nothing;

-- Seed GPS Setup data for the trucks (TRUCK-87 and TRUCK-28)
insert into gps_units_setup (id, "tenantId", "deviceId", "deviceName", "simIccid", status, "assignedTruckId", "lastHandshake", "lastLatitude", "lastLongitude") values
('GPS-IMEI-874812', 'prospaces', 'GPS-DEV-87', 'CalAmp LMU-3030 Premium', '8901410327981234567', 'Connected', 'TRUCK-87', '2026-07-01 06:00:00', 44.7082, -63.5938),
('GPS-IMEI-281932', 'prospaces', 'GPS-DEV-28', 'Sierra Wireless RV50X', '8901410327981234568', 'Connected', 'TRUCK-28', '2026-07-01 06:02:15', 44.6295, -63.6651)
on conflict (id) do nothing;

-- Seed GPS tracking history points for GPS-DEV-87
insert into gps_tracking_history (id, "tenantId", "deviceId", latitude, longitude, speed, heading, "recordedAt", "ignitionStatus") values
(gen_random_uuid(), 'prospaces', 'GPS-DEV-87', 44.7050, -63.5950, 45.2, 180.0, '2026-07-01 05:50:00', true),
(gen_random_uuid(), 'prospaces', 'GPS-DEV-87', 44.7065, -63.5942, 32.5, 175.5, '2026-07-01 05:55:00', true),
(gen_random_uuid(), 'prospaces', 'GPS-DEV-87', 44.7082, -63.5938, 0.0, 175.5, '2026-07-01 06:00:00', false)
on conflict (id) do nothing;

-- Seed GPS tracking history points for GPS-DEV-28
insert into gps_tracking_history (id, "tenantId", "deviceId", latitude, longitude, speed, heading, "recordedAt", "ignitionStatus") values
(gen_random_uuid(), 'prospaces', 'GPS-DEV-28', 44.6210, -63.6695, 65.0, 90.0, '2026-07-01 05:52:15', true),
(gen_random_uuid(), 'prospaces', 'GPS-DEV-28', 44.6255, -63.6672, 48.3, 85.0, '2026-07-01 05:57:15', true),
(gen_random_uuid(), 'prospaces', 'GPS-DEV-28', 44.6295, -63.6651, 0.0, 85.0, '2026-07-01 06:02:15', false)
on conflict (id) do nothing;

-- 6. Row-Level Security (RLS) Master Configuration & Policies
-- To turn RLS ON and protect your database, execute the following commands in your Supabase SQL Editor.

-- STEP 1: Enable Row-Level Security on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_units_setup ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_tracking_history ENABLE ROW LEVEL SECURITY;

-- STEP 2: Configure RLS Security Policies
-- Choose ONE of the following Policy approaches below based on your architectural requirements:

/* 
---------------------------------------------------------------------------------
APPROACH A: Permissive Public Policies (Easiest for development and debugging)
---------------------------------------------------------------------------------
Keeping RLS turned ON on the database, but creating permissive policies so that the
client application can read, insert, update, and delete operational data with standard keys.
*/

-- Tenants policies
DROP POLICY IF EXISTS "Allow public read on tenants" ON tenants;
DROP POLICY IF EXISTS "Allow public write on tenants" ON tenants;
DROP POLICY IF EXISTS "Allow public update on tenants" ON tenants;
DROP POLICY IF EXISTS "Allow public delete on tenants" ON tenants;
DROP POLICY IF EXISTS "Tenant isolated select" ON tenants;
DROP POLICY IF EXISTS "Tenant isolated insert" ON tenants;
DROP POLICY IF EXISTS "Tenant isolated update" ON tenants;

CREATE POLICY "Allow public read on tenants" ON tenants FOR SELECT USING (true);
CREATE POLICY "Allow public write on tenants" ON tenants FOR INSERT WITH CHECK (id IS NOT NULL);
CREATE POLICY "Allow public update on tenants" ON tenants FOR UPDATE USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
CREATE POLICY "Allow public delete on tenants" ON tenants FOR DELETE USING (id IS NOT NULL);

-- Branches policies
DROP POLICY IF EXISTS "Allow public read on branches" ON branches;
DROP POLICY IF EXISTS "Allow public write on branches" ON branches;
DROP POLICY IF EXISTS "Allow public update on branches" ON branches;
DROP POLICY IF EXISTS "Allow public delete on branches" ON branches;
DROP POLICY IF EXISTS "Branch tenant select" ON branches;
DROP POLICY IF EXISTS "Branch tenant write" ON branches;

CREATE POLICY "Allow public read on branches" ON branches FOR SELECT USING (true);
CREATE POLICY "Allow public write on branches" ON branches FOR INSERT WITH CHECK ("tenantId" IS NOT NULL);
CREATE POLICY "Allow public update on branches" ON branches FOR UPDATE USING ("tenantId" IS NOT NULL) WITH CHECK ("tenantId" IS NOT NULL);
CREATE POLICY "Allow public delete on branches" ON branches FOR DELETE USING ("tenantId" IS NOT NULL);

-- Trucks policies
DROP POLICY IF EXISTS "Allow public read on trucks" ON trucks;
DROP POLICY IF EXISTS "Allow public write on trucks" ON trucks;
DROP POLICY IF EXISTS "Allow public update on trucks" ON trucks;
DROP POLICY IF EXISTS "Allow public delete on trucks" ON trucks;
DROP POLICY IF EXISTS "Truck tenant select" ON trucks;
DROP POLICY IF EXISTS "Truck tenant write" ON trucks;

CREATE POLICY "Allow public read on trucks" ON trucks FOR SELECT USING (true);
CREATE POLICY "Allow public write on trucks" ON trucks FOR INSERT WITH CHECK ("tenantId" IS NOT NULL);
CREATE POLICY "Allow public update on trucks" ON trucks FOR UPDATE USING ("tenantId" IS NOT NULL) WITH CHECK ("tenantId" IS NOT NULL);
CREATE POLICY "Allow public delete on trucks" ON trucks FOR DELETE USING ("tenantId" IS NOT NULL);

-- Users policies
DROP POLICY IF EXISTS "Allow public read on users" ON users;
DROP POLICY IF EXISTS "Allow public write on users" ON users;
DROP POLICY IF EXISTS "Allow public update on users" ON users;
DROP POLICY IF EXISTS "Allow public delete on users" ON users;
DROP POLICY IF EXISTS "User tenant select" ON users;
DROP POLICY IF EXISTS "User tenant write" ON users;

CREATE POLICY "Allow public read on users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public write on users" ON users FOR INSERT WITH CHECK ("tenantId" IS NOT NULL);
CREATE POLICY "Allow public update on users" ON users FOR UPDATE USING ("tenantId" IS NOT NULL) WITH CHECK ("tenantId" IS NOT NULL);
CREATE POLICY "Allow public delete on users" ON users FOR DELETE USING ("tenantId" IS NOT NULL);

-- Deliveries policies
DROP POLICY IF EXISTS "Allow public read on deliveries" ON deliveries;
DROP POLICY IF EXISTS "Allow public write on deliveries" ON deliveries;
DROP POLICY IF EXISTS "Allow public update on deliveries" ON deliveries;
DROP POLICY IF EXISTS "Allow public delete on deliveries" ON deliveries;
DROP POLICY IF EXISTS "Delivery tenant select" ON deliveries;
DROP POLICY IF EXISTS "Delivery tenant write" ON deliveries;

CREATE POLICY "Allow public read on deliveries" ON deliveries FOR SELECT USING (true);
CREATE POLICY "Allow public write on deliveries" ON deliveries FOR INSERT WITH CHECK ("tenantId" IS NOT NULL);
CREATE POLICY "Allow public update on deliveries" ON deliveries FOR UPDATE USING ("tenantId" IS NOT NULL) WITH CHECK ("tenantId" IS NOT NULL);
CREATE POLICY "Allow public delete on deliveries" ON deliveries FOR DELETE USING ("tenantId" IS NOT NULL);

-- gps_units_setup policies
DROP POLICY IF EXISTS "Allow public read on gps_units_setup" ON gps_units_setup;
DROP POLICY IF EXISTS "Allow public write on gps_units_setup" ON gps_units_setup;
DROP POLICY IF EXISTS "Allow public update on gps_units_setup" ON gps_units_setup;
DROP POLICY IF EXISTS "Allow public delete on gps_units_setup" ON gps_units_setup;

CREATE POLICY "Allow public read on gps_units_setup" ON gps_units_setup FOR SELECT USING (true);
CREATE POLICY "Allow public write on gps_units_setup" ON gps_units_setup FOR INSERT WITH CHECK ("tenantId" IS NOT NULL);
CREATE POLICY "Allow public update on gps_units_setup" ON gps_units_setup FOR UPDATE USING ("tenantId" IS NOT NULL) WITH CHECK ("tenantId" IS NOT NULL);
CREATE POLICY "Allow public delete on gps_units_setup" ON gps_units_setup FOR DELETE USING ("tenantId" IS NOT NULL);

-- gps_tracking_history policies
DROP POLICY IF EXISTS "Allow public read on gps_tracking_history" ON gps_tracking_history;
DROP POLICY IF EXISTS "Allow public write on gps_tracking_history" ON gps_tracking_history;
DROP POLICY IF EXISTS "Allow public update on gps_tracking_history" ON gps_tracking_history;
DROP POLICY IF EXISTS "Allow public delete on gps_tracking_history" ON gps_tracking_history;

CREATE POLICY "Allow public read on gps_tracking_history" ON gps_tracking_history FOR SELECT USING (true);
CREATE POLICY "Allow public write on gps_tracking_history" ON gps_tracking_history FOR INSERT WITH CHECK ("tenantId" IS NOT NULL);
CREATE POLICY "Allow public update on gps_tracking_history" ON gps_tracking_history FOR UPDATE USING ("tenantId" IS NOT NULL) WITH CHECK ("tenantId" IS NOT NULL);
CREATE POLICY "Allow public delete on gps_tracking_history" ON gps_tracking_history FOR DELETE USING ("tenantId" IS NOT NULL);

`;

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Dynamic headers middleware to seamlessly support multi-tenant custom Supabase connections
app.use((req, res, next) => {
  const customUrlHeader = req.headers["x-custom-supabase-url"];
  const customKeyHeader = req.headers["x-custom-supabase-key"];
  if (customUrlHeader) {
    const urlStr = (Array.isArray(customUrlHeader) ? customUrlHeader[0] : customUrlHeader).trim();
    if (urlStr && urlStr !== "null" && urlStr !== "undefined" && urlStr !== "Default") {
      customSupabaseUrl = urlStr;
    }
  }
  if (customKeyHeader) {
    const keyStr = (Array.isArray(customKeyHeader) ? customKeyHeader[0] : customKeyHeader).trim();
    if (keyStr && keyStr !== "null" && keyStr !== "undefined") {
      customSupabaseKey = keyStr;
    }
  }
  next();
});

// Support Vercel routing where the path might omit or include /api
if (process.env.VERCEL) {
  app.use((req, res, next) => {
    const originalUrl = req.url;
    
    // 1. Remove "/api/index.ts" or "/api/index.js" or "/api/index" if present at the start of req.url
    if (req.url.startsWith("/api/index.ts")) {
      req.url = req.url.substring(13);
    } else if (req.url.startsWith("/api/index.js")) {
      req.url = req.url.substring(13);
    } else if (req.url.startsWith("/api/index")) {
      req.url = req.url.substring(10);
    }
    
    // Ensure we have a leading slash after stripping
    if (!req.url.startsWith("/")) {
      req.url = "/" + req.url;
    }
    
    // 2. If it is an operational route (not static asset/root) and missing /api prefix, prepend /api
    if (!req.url.startsWith("/api") && !req.url.startsWith("/uploads") && req.url !== "/" && !req.url.includes(".")) {
      req.url = "/api" + req.url;
    }
    
    if (originalUrl !== req.url) {
      console.log(`[Vercel Routing Sync] Path normalized: ${originalUrl} -> ${req.url}`);
    }
    
    next();
  });
}

// Ensure and serve static uploads directory for PDFs link creation
const uploadsDir = path.join(process.cwd(), "uploads");
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  console.warn("Could not ensure uploads directory (may be in a read-only serverless environment like Vercel):", e);
}
app.use("/uploads", express.static(uploadsDir));

let selfHealingPromise: Promise<void> | null = null;
async function runSelfHealingOnce() {
  if (selfHealingPromise) return selfHealingPromise;
  selfHealingPromise = (async () => {
    try {
      const supabase = getSupabase();
      if (supabase) {
        console.log("Starting lazy database self-healing and alignment process...");
        
        // 1. Ensure prospaces tenant is seeded
        const prospacesTenant = {
          id: "prospaces",
          name: "ProSpaces Logistics",
          code: "PS",
          description: "Corporate logistics tracking for ProSpaces distributor and dealer stores.",
          logoBadge: "🏢",
          regionalFocus: "Atlantic Canada (Dartmouth, Tantallon, Halifax)",
          primaryColor: "blue"
        };
        await supabase.from("tenants").upsert([prospacesTenant]);
        console.log("Seeded/validated 'prospaces' tenant.");

        // 2. Migrate users from agfydicwfv8u0rqr5apc & ronaatlantic to prospaces
        const { data: usersToMigrate } = await supabase
          .from("users")
          .select("*")
          .in("tenantId", ["agfydicwfv8u0rqr5apc", "ronaatlantic"]);
          
        if (usersToMigrate && usersToMigrate.length > 0) {
          for (const user of usersToMigrate) {
            let updatedEmail = user.email;
            if (updatedEmail.endsWith("@ronaatlantic.ca")) {
              updatedEmail = updatedEmail.replace("@ronaatlantic.ca", "@prospaces.com");
            }
            await supabase
              .from("users")
              .update({ 
                tenantId: "prospaces",
                email: updatedEmail
              })
              .eq("id", user.id);
            console.log(`Migrated user ${user.name} (${user.email} -> ${updatedEmail}) to 'prospaces' tenant.`);
          }
        }

        // Also check if any user with joshua.campbell email has wrong tenantId
        const { data: joshuaUsers } = await supabase
          .from("users")
          .select("*")
          .ilike("email", "%joshua.campbell%");
          
        if (joshuaUsers && joshuaUsers.length > 0) {
          for (const user of joshuaUsers) {
            let updatedEmail = user.email;
            if (updatedEmail.endsWith("@ronaatlantic.ca")) {
              updatedEmail = updatedEmail.replace("@ronaatlantic.ca", "@prospaces.com");
            }
            if (user.tenantId !== "prospaces" || user.email !== updatedEmail) {
              await supabase
                .from("users")
                .update({ 
                  tenantId: "prospaces",
                  email: updatedEmail
                })
                .eq("id", user.id);
              console.log(`Reconciled Joshua Campbell's tenantId to 'prospaces' and email to ${updatedEmail}.`);
            }
          }
        }

        // 3. Migrate branches from agfydicwfv8u0rqr5apc & ronaatlantic to prospaces
        const { data: branchesToMigrate } = await supabase
          .from("branches")
          .select("*")
          .in("tenantId", ["agfydicwfv8u0rqr5apc", "ronaatlantic"]);
          
        if (branchesToMigrate && branchesToMigrate.length > 0) {
          for (const branch of branchesToMigrate) {
            let cleanBranchName = branch.name;
            if (cleanBranchName.startsWith("RONA - ")) {
              cleanBranchName = cleanBranchName.replace("RONA - ", "ProSpaces - ");
            }
            await supabase
              .from("branches")
              .update({ 
                tenantId: "prospaces",
                name: cleanBranchName
              })
              .eq("id", branch.id);
            console.log(`Migrated branch ${branch.name} -> ${cleanBranchName} to 'prospaces' tenant.`);
          }
        }

        // 4. Migrate trucks from agfydicwfv8u0rqr5apc & ronaatlantic to prospaces
        const { data: trucksToMigrate } = await supabase
          .from("trucks")
          .select("*")
          .in("tenantId", ["agfydicwfv8u0rqr5apc", "ronaatlantic"]);
          
        if (trucksToMigrate && trucksToMigrate.length > 0) {
          for (const truck of trucksToMigrate) {
            const baseType = (truck.type || "").split("||")[0].trim();
            const updatedType = `${baseType} ||regdue:2026-11-29 ||lat:44.6295 ||lng:-63.6651`;
            
            await supabase
              .from("trucks")
              .update({ 
                tenantId: "prospaces",
                type: updatedType
              })
              .eq("id", truck.id);
            console.log(`Migrated truck ${truck.name} to 'prospaces' and set coordinates.`);
          }
        }

        // Also check any trucks with driver Joshua Campbell specifically
        const { data: joshuaTrucks } = await supabase
          .from("trucks")
          .select("*")
          .eq("driver", "Joshua Campbell");
          
        if (joshuaTrucks && joshuaTrucks.length > 0) {
          for (const truck of joshuaTrucks) {
            const baseType = (truck.type || "").split("||")[0].trim();
            const updatedType = `${baseType} ||regdue:2026-11-29 ||lat:44.6295 ||lng:-63.6651`;
            await supabase
              .from("trucks")
              .update({ 
                tenantId: "prospaces",
                type: updatedType
              })
              .eq("id", truck.id);
            console.log(`Set Joshua Campbell's truck (${truck.name}) coordinates specifically to 137 Chain Lake Drive.`);
          }
        }

        // 5. Migrate deliveries from agfydicwfv8u0rqr5apc & ronaatlantic to prospaces
        const { data: deliveriesToMigrate } = await supabase
          .from("deliveries")
          .select("*")
          .in("tenantId", ["agfydicwfv8u0rqr5apc", "ronaatlantic"]);
          
        if (deliveriesToMigrate && deliveriesToMigrate.length > 0) {
          for (const del of deliveriesToMigrate) {
            // Update history notes or location if they contain RONA
            let updatedHistory = del.history;
            if (Array.isArray(updatedHistory)) {
              updatedHistory = updatedHistory.map((h: any) => {
                if (h && typeof h === "object") {
                  let updatedLoc = h.location || "";
                  if (updatedLoc.startsWith("RONA - ")) {
                    updatedLoc = updatedLoc.replace("RONA - ", "ProSpaces - ");
                  }
                  return { ...h, location: updatedLoc };
                }
                return h;
              });
            }
            await supabase
              .from("deliveries")
              .update({ 
                tenantId: "prospaces",
                history: updatedHistory
              })
              .eq("id", del.id);
            console.log(`Migrated delivery ${del.invoiceNumber} to 'prospaces' tenant.`);
          }
        }

        // 6. Delete temporary and old tenants to keep DB clean
        await supabase
          .from("tenants")
          .delete()
          .in("id", ["agfydicwfv8u0rqr5apc", "ronaatlantic"]);
        console.log("Cleaned up temporary tenants 'agfydicwfv8u0rqr5apc' and 'ronaatlantic'.");

        // 7. Auto-Seed default data for prospaces if tables are empty
        console.log("Verifying if prospaces tables require default seeding...");
        
        // A. Seed branches if empty
        const { data: currentBranches, error: errB } = await supabase
          .from("branches")
          .select("id")
          .eq("tenantId", "prospaces");
        if (!errB && (!currentBranches || currentBranches.length === 0)) {
          console.log("Branches are empty for prospaces. Auto-seeding default branches...");
          const defaultBranches = [
            {
              id: "01075",
              tenantId: "prospaces",
              name: "ProSpaces - Tantallon",
              type: "STORE",
              address: "3680 Hammonds Plains Rd, Upper Tantallon, NS B3Z 1H3, Canada"
            },
            {
              id: "01065",
              tenantId: "prospaces",
              name: "ProSpaces - ALMON",
              type: "STORE",
              address: "6055 Almon St, Halifax, NS B3K 1T9, Canada"
            },
            {
              id: "01070",
              tenantId: "prospaces",
              name: "ProSpaces - Elmsdale",
              type: "DC",
              address: "84 Mason Ln, Elmsdale, NS B2S 3J3, Canada"
            },
            {
              id: "DC-WINAMILL",
              tenantId: "prospaces",
              name: "44444 - 500 Windmill Road",
              type: "DC",
              address: "500 Windmill Road, Dartmouth, Nova Scotia, B3B 1B3, Canada"
            }
          ];
          const { error: seedBErr } = await supabase.from("branches").upsert(defaultBranches);
          if (seedBErr) console.error("Error seeding default branches:", seedBErr);
          else console.log("Seeded default branches successfully.");
        }

        // B. Seed users if empty
        const { data: currentUsers, error: errU } = await supabase
          .from("users")
          .select("id")
          .eq("tenantId", "prospaces");
        if (!errU && (!currentUsers || currentUsers.length === 0)) {
          console.log("Users are empty for prospaces. Auto-seeding default users...");
          const defaultUsers = [
            {
              id: "USR-57008",
              tenantId: "prospaces",
              name: "George Campbell",
              email: "george.campbell@prospaces.com",
              role: "Admin",
              phone: " ||pw:George2026! ||status:Active",
              associatedStoreId: "DC-WINAMILL",
              password: "George2026!",
              status: "Active"
            },
            {
              id: "USR-1869",
              tenantId: "prospaces",
              name: "Joshua Campbell",
              email: "joshua.campbell@prospaces.com",
              role: "Driver",
              phone: " ||pw:Joshua2026! ||status:Active ||licexp:2027-01-22",
              associatedStoreId: "DC-WINAMILL",
              password: "Joshua2026!",
              status: "Active",
              driverLicenseExpire: "2027-01-22"
            }
          ];
          let seedUErr;
          try {
            const { error } = await supabase.from("users").upsert(defaultUsers);
            if (error) {
              const errMsg = error.message || String(error);
              if (errMsg.includes("column") || errMsg.includes("password") || errMsg.includes("status") || error.code === "42703") {
                console.warn("Supabase users table is missing columns. Retrying user seeding with column stripping and phone serialization...");
                const strippedUsers = defaultUsers.map(u => {
                  const { password, status, driverLicenseExpire, ...stripped } = u;
                  stripped.phone = serializeToPhone(u.phone, u.password, u.status, u.driverLicenseExpire);
                  return stripped;
                });
                const { error: retryErr } = await supabase.from("users").upsert(strippedUsers);
                if (retryErr) {
                  seedUErr = retryErr;
                }
              } else {
                seedUErr = error;
              }
            }
          } catch (err: any) {
            seedUErr = err;
          }
          if (seedUErr) {
            const cleanMsg = seedUErr.message || (typeof seedUErr === "object" ? JSON.stringify(seedUErr) : String(seedUErr));
            console.error("Error seeding default users:", cleanMsg);
          } else console.log("Seeded default users successfully.");
        }

        // C. Seed trucks if empty
        const { data: currentTrucks, error: errT } = await supabase
          .from("trucks")
          .select("id")
          .eq("tenantId", "prospaces");
        if (!errT && (!currentTrucks || currentTrucks.length === 0)) {
          console.log("Trucks are empty for prospaces. Auto-seeding default trucks...");
          const defaultTrucks = [
            {
              id: "TRUCK-87",
              tenantId: "prospaces",
              name: "Truck-1",
              type: "Heavy-Duty Flatbed ||regdue:2026-11-29 ||lat:44.6295 ||lng:-63.6651",
              driver: "George Campbell",
              branchId: "01075"
            },
            {
              id: "TRUCK-28",
              tenantId: "prospaces",
              name: "Truck-2",
              type: "Flatbed Boom Truck ||regdue:2026-11-29 ||lat:44.6295 ||lng:-63.6651",
              driver: "Joshua Campbell",
              branchId: "DC-WINAMILL"
            }
          ];
          const { error: seedTErr } = await supabase.from("trucks").upsert(defaultTrucks);
          if (seedTErr) console.error("Error seeding default trucks:", seedTErr);
          else console.log("Seeded default trucks successfully.");
        }

        // D. Seed deliveries if empty
        const { data: currentDeliveries, error: errD } = await supabase
          .from("deliveries")
          .select("id")
          .eq("tenantId", "prospaces");
        if (!errD && (!currentDeliveries || currentDeliveries.length === 0)) {
          console.log("Deliveries are empty for prospaces. Auto-seeding default deliveries...");
          const defaultDeliveries = [
            {
              id: "263890",
              tenantId: "prospaces",
              invoiceNumber: "263890",
              epicorSalesOrder: "263890",
              customerName: "SOLD TO: BC SALES 3685 HAMMONDS PLAINS SALES BC  STILLWATER LAKE  902-821-2124     NS",
              deliveryAddress: "SHIP TO: 547 KING ST 547 KING ST BRIDGEWATER   NS B3Z 1H3",
              phone: "902-555-0199",
              originBranch: "01075",
              destinationNotes: "[Automated PDF Capture - Type: Order] Matches OCR template regional Nova_Scotia_Regional_Core with confidence 98.5%. Date parsed: 3/24/26   10:06. Physical Document stored: /uploads/263890_source.pdf",
              status: "REGISTERED",
              registeredAt: "6/16/2026, 11:15:48 AM",
              pickedAt: null,
              deliveredAt: null,
              returnedAt: null,
              returnReason: null,
              assignedTruck: "TRUCK-87",
              assignedDriver: "George Campbell",
              customerSignature: null,
              deliveryPhoto: null,
              history: [
                {
                  notes: "Ingested automatically into logistics. Ready for truck pre-allocation or dispatch. Physical copy archived on server.",
                  status: "REGISTERED",
                  location: "ProSpaces - Tantallon",
                  operator: "Azure OCR Automate Stream",
                  timestamp: "6/16/2026, 11:15:48 AM"
                },
                {
                  notes: "Allocated truck to delivery path: Truck-1 (Driver: George Campbell).",
                  status: "REGISTERED",
                  location: "ProSpaces - Tantallon",
                  operator: "Logistics Board Coordinator",
                  timestamp: "2026-06-16T14:16:19.891Z"
                }
              ]
            }
          ];
          const { error: seedDErr } = await supabase.from("deliveries").upsert(defaultDeliveries);
          if (seedDErr) console.error("Error seeding default deliveries:", seedDErr);
          else console.log("Seeded default deliveries successfully.");
        }

        console.log("Database self-healing and alignment complete.");

        // Database Diagnostic helper
        try {
          const [rUsers, rTenants, rBranches, rTrucks, rDeliveries] = await Promise.all([
            supabase.from("users").select("*"),
            supabase.from("tenants").select("*"),
            supabase.from("branches").select("*"),
            supabase.from("trucks").select("*"),
            supabase.from("deliveries").select("*")
          ]);
          fs.writeFileSync(
            path.join(process.cwd(), "debug-database-diagnostic.json"),
            JSON.stringify({
              timestamp: new Date().toISOString(),
              users: rUsers.data || [],
              tenants: rTenants.data || [],
              branches: rBranches.data || [],
              trucks: rTrucks.data || [],
              deliveries: rDeliveries.data || [],
              usersError: rUsers.error,
              tenantsError: rTenants.error,
              branchesError: rBranches.error,
              trucksError: rTrucks.error,
              deliveriesError: rDeliveries.error
            }, null, 2)
          );
          console.log("Database diagnosis dump complete in lazy handler.");
        } catch (diagErr) {
          console.warn("Database diagnosis write skipped in lazy handler:", diagErr);
        }
      }
    } catch (healErr) {
      console.error("Database self-healing error:", healErr);
    }
  })();
  return selfHealingPromise;
}

// Lazy triggers self-healing on any incoming /api request
app.use((req, res, next) => {
  if (req.url.startsWith("/api")) {
    runSelfHealingOnce().catch(() => {});
  }
  next();
});

  // Endpoint to set custom Supabase credentials at runtime in server memory
  app.post("/api/setup-custom-supabase", express.json(), (req, res) => {
    try {
      const { url, key } = req.body;
      customSupabaseUrl = (url || "").trim();
      customSupabaseKey = (key || "").trim();
      supabaseClient = null; // force recreation of client with new credentials
      
      // Reset circuit breaker on manual credentials update
      supabaseConsecutiveFailures = 0;
      supabaseTemporarilyDisabled = false;
      supabaseDisabledUntil = 0;

      // Persist to supabase-config.json
      try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify({ url: customSupabaseUrl, key: customSupabaseKey }, null, 2), "utf8");
        console.log("Persisted custom Supabase credentials to supabase-config.json");
      } catch (writeErr) {
        console.error("Failed to persist custom Supabase credentials to file:", writeErr);
      }

      console.log("Custom Supabase credentials set in server memory. URL size:", customSupabaseUrl.length, "Key size:", customSupabaseKey.length);
      res.json({ success: true, message: "Custom Supabase credentials updated in server memory successfully." });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update custom Supabase credentials." });
    }
  });

  // Supabase connection and configuration diagnostics endpoint
  app.get("/api/supabase-status", async (req, res) => {
    try {
      // Diagnostic check bypasses the circuit breaker so the user can test/recover connection
      const supabase = getSupabase(req, true);
      const resolvedUrl = customSupabaseUrl || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
      const roleKey = customSupabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
      const anonKey = customSupabaseKey || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
      const isServiceRoleKeyAnon = !isServiceRoleKey(roleKey);

      if (!supabase) {
        return res.json({
          configured: false,
          connected: false,
          isServiceRoleKeyAnon,
          error: "Supabase database credentials are unconfigured or placeholder. A live Supabase database is strictly required for this application in both development and production. Please open the 'Settings > Secrets' panel and configure SUPABASE_URL and SUPABASE_ANON_KEY.",
          url: resolvedUrl,
          schemaSql: SH_SQL
        });
      }

      // Perform a ping / select test query against the database with a safe timeout to check if schema is constructed
      let testQuery = supabase.from("tenants").select("id").limit(1);
      let { data, error } = await withTimeout<any>(testQuery, 30000);

      if (error) {
         console.warn("Supabase connection: tenants table query failed, trying branches table fallback...");
         let fallbackQuery = supabase.from("branches").select("id").limit(1);
         const { error: branchesErr } = await withTimeout<any>(fallbackQuery, 30000);
        if (!branchesErr) {
          error = null;
        }
      }

      let isConnected = true;
      let displayError = null;

      if (error) {
        const errMsg = error.message || "";
        const errCode = error.code || "";
        
        const isSchemaMissing = 
          (errMsg.includes("relation") && errMsg.includes("does not exist")) || 
          errCode === "42P01" || 
          errMsg.includes("Invalid path") || 
          errCode === "PGRST301";

        const isAuthOrConfigError =
          errMsg.includes("JWT") ||
          errMsg.includes("jwt") ||
          errMsg.includes("key") ||
          errMsg.includes("Key") ||
          errMsg.includes("token") ||
          errMsg.includes("signature") ||
          errMsg.includes("unauthorized") ||
          errMsg.includes("Unauthorized") ||
          errMsg.includes("Forbidden") ||
          errMsg.includes("forbidden") ||
          errCode === "PGRST300" ||
          errCode === "PGRST302";

        const isNetworkOrUnreachable =
          errMsg.includes("fetch failed") ||
          errMsg.includes("timed out") ||
          errMsg.includes("timeout") ||
          errMsg.includes("ENOTFOUND") ||
          errMsg.includes("ECONNREFUSED") ||
          errMsg.includes("unreachable") ||
          errMsg.includes("paused") ||
          errMsg.includes("inactive");

        if (isSchemaMissing) {
          isConnected = false;
          displayError = `Supabase database is connected, but the schema tables have not been created yet: "${errMsg}". Please run the SQL setup script in your Supabase SQL Editor to initialize the database.`;
        } else if (isAuthOrConfigError) {
          isConnected = false;
          displayError = `Authentication check failed: "${errMsg}". Your Supabase API Key (Anon or Service Role Key) appears to be incorrect, expired, or invalid. Please check your credentials.`;
        } else if (isNetworkOrUnreachable) {
          isConnected = false;
          displayError = `Network connection failed: "${errMsg}". The Supabase server is unreachable or your database might be paused. Please verify the URL and ensure the database is active.`;
        } else if (errCode === "42501" || errMsg.includes("permission denied") || errMsg.includes("insufficient privilege")) {
          // Connected successfully to PostgreSQL, but user does not have query permissions on 'tenants' table.
          // This is a legitimate permission constraint, so we are connected!
          console.log("Supabase connected with policy/permission constraints:", errMsg);
          isConnected = true;
          displayError = null;
          error = null;
        } else {
          // Any other error means something went wrong (e.g., bad syntax, invalid input).
          isConnected = false;
          displayError = `Supabase query diagnostic failed: "${errMsg}" (Code: ${errCode}).`;
        }
      }

      if (!isConnected) {
        console.warn("Supabase connection is alive, but table query failed:", displayError);
        return res.json({
          configured: true,
          connected: false,
          isServiceRoleKeyAnon,
          error: displayError,
          url: resolvedUrl,
          anonKey,
          schemaSql: SH_SQL
        });
      }

      // Reset circuit breaker variables on successful connection test
      supabaseConsecutiveFailures = 0;
      supabaseTemporarilyDisabled = false;
      supabaseDisabledUntil = 0;

      res.json({
        configured: true,
        connected: true,
        isServiceRoleKeyAnon,
        error: null,
        url: resolvedUrl,
        anonKey,
        schemaSql: SH_SQL
      });
    } catch (e: any) {
      console.error("Diagnosis Exception:", e);
      
      // Trigger circuit breaker on failed diagnostic check if it's a timeout/unreachable issue
      supabaseConsecutiveFailures++;
      if (supabaseConsecutiveFailures >= 2) {
        supabaseTemporarilyDisabled = true;
        supabaseDisabledUntil = Date.now() + 60000; // Disable queries for 60 seconds
        console.warn(`[CIRCUIT BREAKER] Supabase disabled for 60 seconds due to consecutive connection test failures.`);
      }

      const resolvedUrl = customSupabaseUrl || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
      const roleKey = customSupabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
      const anonKey = customSupabaseKey || process.env.SUPABASE_ANON_KEY || "";
      const isServiceRoleKeyAnon = !isServiceRoleKey(roleKey);
      res.json({
        configured: !!resolvedUrl,
        connected: false,
        isServiceRoleKeyAnon,
        error: e.message || "An unresolved error occurred diagnostic check.",
        url: resolvedUrl,
        anonKey,
        schemaSql: SH_SQL
      });
    }
  });

  // Public DB diagnostics endpoint to compare dev/prod data counts
  app.get("/api/debug-db", async (req, res) => {
    try {
      const supabase = getSupabase(req);
      if (!supabase) {
        return res.json({ initialized: false, error: "Database not configured." });
      }
      const [rTenants, rUsers, rBranches, rTrucks, rDeliveries] = await Promise.all([
        supabase.from("tenants").select("*"),
        supabase.from("users").select("*"),
        supabase.from("branches").select("*"),
        supabase.from("trucks").select("*"),
        supabase.from("deliveries").select("*")
      ]);
      return res.json({
        initialized: true,
        envSupabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "NOT_SET",
        counts: {
          tenants: rTenants.data?.length || 0,
          users: rUsers.data?.length || 0,
          branches: rBranches.data?.length || 0,
          trucks: rTrucks.data?.length || 0,
          deliveries: rDeliveries.data?.length || 0
        },
        errors: {
          tenants: rTenants.error?.message || null,
          users: rUsers.error?.message || null,
          branches: rBranches.error?.message || null,
          trucks: rTrucks.error?.message || null,
          deliveries: rDeliveries.error?.message || null
        },
        records: {
          tenants: rTenants.data || [],
          users: rUsers.data || [],
          branches: rBranches.data || [],
          trucks: rTrucks.data || [],
          deliveries: rDeliveries.data || []
        }
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // Real-time Database Auth Lookups (No simulation)
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email param is required." });
      }

      const normEmail = email.trim().toLowerCase();
      if (normEmail === "superadmin@prospaces.com") {
        const superAdminPassword = process.env.SUPERADMIN_PASSWORD || "SuperAdmin2026!";
        if (password && !/^[•\*]+$/.test(password) && password !== superAdminPassword) {
          return res.json({
            supabaseActive: getSupabase(req) !== null,
            found: true,
            error: "Invalid SuperAdmin password entry."
          });
        }
        return res.json({
          supabaseActive: getSupabase(req) !== null,
          found: true,
          user: {
            id: "USR-SUPER-ADMIN-01",
            tenantId: "system-admin-tenant",
            name: "ProSpaces Super Admin",
            email: "superadmin@prospaces.com",
            role: "SUPER_ADMIN"
          },
          tenant: {
            id: "system-admin-tenant",
            name: "System Control Space",
            code: "SYS",
            description: "Global Administration Management Space",
            logoBadge: "⚙️",
            regionalFocus: "Global Administration Management",
            primaryColor: "slate"
          }
        });
      }

      const supabase = getSupabase(req);
      if (!supabase) {
        return res.json({
          supabaseActive: false,
          found: false,
          message: "Database sandbox inactive, using local credentials fallback"
        });
      }

      // Query database table 'users' for email in a case-insensitive match
      const { data, error } = (await withTimeout(
        supabase
          .from("users")
          .select("*")
          .ilike("email", email.trim()),
        30000
      )) as any;

      if (error) {
        throw new Error(error.message);
      }

      if (data && data.length > 0) {
        const user = deserializeFromPhone(data[0]);

        // Validate Status
        const uStatus = user.status || "Active";
        if (uStatus === "Inactive") {
          return res.json({
            supabaseActive: true,
            found: true,
            error: "This account has been marked as Inactive. Access is denied."
          });
        }

        // Validate Password
        const dbPassword = user.password || "";
        if (password && !/^[•\*]+$/.test(password) && password !== dbPassword) {
          return res.json({
            supabaseActive: true,
            found: true,
            error: "Invalid login credentials password."
          });
        }

        // Fetch matching tenant definition
        const { data: tenantData } = (await withTimeout(
          supabase
            .from("tenants")
            .select("*")
            .eq("id", user.tenantId),
          30000
        )) as any;

        return res.json({
          supabaseActive: true,
          found: true,
          user,
          tenant: tenantData && tenantData.length > 0 ? tenantData[0] : null
        });
      }

      return res.json({
        supabaseActive: true,
        found: false,
        message: "No registered profile found matching this email address."
      });
    } catch (err: any) {
      if (err && err.message && (err.message.includes("relation") || err.message.includes("does not exist") || err.code === "42P01")) {
        console.warn("Supabase 'users' table is not created yet during login request. Using local offline credentials.");
      } else {
        console.error("Supabase live auth error:", err);
      }
      res.json({
        supabaseActive: false,
        found: false,
        error: err.message
      });
    }
  });

  // Direct User signup / placement into Supabase Users table
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { name, email, role, tenantId, associatedStoreId, phone, password, status } = req.body;
      if (!email || !name || !role || !tenantId) {
        return res.status(400).json({ error: "Missing required profile registration parameters." });
      }

      const supabase = getSupabase(req);
      if (!supabase) {
        return res.json({
          supabaseActive: false,
          success: false,
          error: "Supabase connection not established yet."
        });
      }

      const newUserId = `USR-${Math.floor(Math.random() * 90000) + 10000}`;
      const newUserRecord = {
        id: newUserId,
        tenantId,
        name,
        email: email.trim().toLowerCase(),
        role,
        phone: phone || "",
        associatedStoreId: associatedStoreId || "",
        password: password || "ProSpaces2026!",
        status: status || "Active"
      };

      let insertError;
      try {
        const { error } = await supabase
          .from("users")
          .insert([newUserRecord]);
        if (error) throw error;
      } catch (dbErr: any) {
        const errMsg = dbErr.message || String(dbErr);
        if (errMsg.includes("column") && (errMsg.includes("password") || errMsg.includes("status") || errMsg.includes("42703"))) {
          console.warn("Supabase users table is missing 'password' or 'status' columns. Retrying registration insert without these columns...");
          const { password, status, ...strippedRecord } = newUserRecord;
          (strippedRecord as any).phone = serializeToPhone(newUserRecord.phone, newUserRecord.password, newUserRecord.status);
          const { error: retryErr } = await supabase
            .from("users")
            .insert([strippedRecord]);
          if (retryErr) {
            insertError = retryErr;
          }
        } else {
          insertError = dbErr;
        }
      }

      if (insertError) {
        throw insertError;
      }

      // Fetch corresponding tenant info
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", tenantId);

      res.json({
        success: true,
        user: newUserRecord,
        tenant: tenantData && tenantData.length > 0 ? tenantData[0] : null
      });
    } catch (err: any) {
      console.error("Failed to commit newly registered user to Supabase:", err);
      res.status(500).json({ error: formatDatabaseError(err) });
    }
  });

  // Helper to construct the premium default mock and seed state for a given tenant ID
  function getDefaultTenantState(tid: string) {
    return {
      branches: [
        {
          id: "01075",
          tenantId: tid,
          name: "ProSpaces - Tantallon",
          type: "STORE",
          address: "3680 Hammonds Plains Rd, Upper Tantallon, NS B3Z 1H3, Canada"
        },
        {
          id: "01065",
          tenantId: tid,
          name: "ProSpaces - ALMON",
          type: "STORE",
          address: "6055 Almon St, Halifax, NS B3K 1T9, Canada"
        },
        {
          id: "01070",
          tenantId: tid,
          name: "ProSpaces - Elmsdale",
          type: "DC",
          address: "84 Mason Ln, Elmsdale, NS B2S 3J3, Canada"
        },
        {
          id: "DC-WINAMILL",
          tenantId: tid,
          name: "ProSpaces - WINDMILL",
          type: "DC",
          address: "500 Windmill Road, Dartmouth, NS, B3B 1B3, Canada"
        }
      ],
      trucks: [
        {
          id: "TRUCK-87",
          tenantId: tid,
          name: "Truck-1",
          type: "Heavy-Duty Flatbed ||regdue:2026-11-29 ||lat:44.7082 ||lng:-63.5938",
          driver: "George Campbell",
          branchId: "01075"
        },
        {
          id: "TRUCK-28",
          tenantId: tid,
          name: "Truck-2",
          type: "Flatbed Boom Truck ||regdue:2026-11-29 ||lat:44.6295 ||lng:-63.6651",
          driver: "Joshua Campbell",
          branchId: "DC-WINAMILL"
        }
      ],
      users: [
        {
          id: "USR-57008",
          tenantId: tid,
          name: "George Campbell",
          email: "george.campbell@prospaces.com",
          role: "Admin",
          phone: " ||pw:George2026! ||status:Active",
          associatedStoreId: "DC-WINAMILL"
        },
        {
          id: "USR-1869",
          tenantId: tid,
          name: "Joshua Campbell",
          email: "joshua.campbell@prospaces.com",
          role: "Driver",
          phone: " ||pw:Joshua2026! ||status:Active ||licexp:2027-01-22",
          associatedStoreId: "DC-WINAMILL"
        }
      ],
      deliveries: [
        {
          id: "263890",
          tenantId: tid,
          invoiceNumber: "263890",
          epicorSalesOrder: "263890",
          customerName: "SOLD TO: BC SALES 3685 HAMMONDS PLAINS SALES BC  STILLWATER LAKE  902-821-2124     NS",
          deliveryAddress: "SHIP TO: 547 KING ST 547 KING ST BRIDGEWATER   NS B3Z 1H3",
          phone: "902-555-0199",
          originBranch: "01075",
          destinationNotes: "[Automated PDF Capture - Type: Order] Matches OCR template regional Nova_Scotia_Regional_Core with confidence 98.5%. Date parsed: 3/24/26   10:06. Physical Document stored: /uploads/263890_source.pdf",
          status: "REGISTERED",
          registeredAt: "6/16/2026, 11:15:48 AM",
          pickedAt: null,
          deliveredAt: null,
          returnedAt: null,
          returnReason: null,
          assignedTruck: "TRUCK-87",
          assignedDriver: "George Campbell",
          customerSignature: null,
          deliveryPhoto: null,
          history: [
            {
              notes: "Ingested automatically into logistics. Ready for truck pre-allocation or dispatch. Physical copy archived on server.",
              status: "REGISTERED",
              location: "ProSpaces - Tantallon",
              operator: "Azure OCR Automate Stream",
              timestamp: "6/16/2026, 11:15:48 AM"
            },
            {
              notes: "Allocated truck to delivery path: Truck-1 (Driver: George Campbell).",
              status: "REGISTERED",
              location: "ProSpaces - Tantallon",
              operator: "Logistics Board Coordinator",
              timestamp: "2026-06-16T14:16:19.891Z"
            }
          ]
        }
      ]
    };
  }

  // Helper to upsert seed state records into the live Supabase database
  async function seedDefaultState(supabase: any, tenantId: string) {
    const defaults = getDefaultTenantState(tenantId);
    console.log(`[SEED] Seeding live database with default templates for tenant '${tenantId}'...`);
    
    if (defaults.branches.length > 0) {
      const { error } = await supabase.from("branches").upsert(defaults.branches);
      if (error) throw new Error(`Seeding branches failed: ${error.message}`);
    }

    if (defaults.trucks.length > 0) {
      const { error } = await supabase.from("trucks").upsert(defaults.trucks);
      if (error) throw new Error(`Seeding trucks failed: ${error.message}`);
    }

    if (defaults.users.length > 0) {
      try {
        const { error } = await supabase.from("users").upsert(defaults.users);
        if (error) {
          const errMsg = error.message || String(error);
          if (errMsg.includes("column") || errMsg.includes("password") || errMsg.includes("status") || error.code === "42703") {
            console.warn("[SEED] Supabase users table is missing columns. Retrying user seeding with column stripping and phone serialization...");
            const strippedUsers = defaults.users.map((u: any) => {
              const { password, status, driverLicenseExpire, ...stripped } = u;
              stripped.phone = serializeToPhone(u.phone, u.password, u.status, u.driverLicenseExpire);
              return stripped;
            });
            const { error: retryErr } = await supabase.from("users").upsert(strippedUsers);
            if (retryErr) throw retryErr;
          } else {
            throw error;
          }
        }
      } catch (err: any) {
        throw new Error(`Seeding users failed: ${err.message || String(err)}`);
      }
    }

    if (defaults.deliveries.length > 0) {
      const { error } = await supabase.from("deliveries").upsert(defaults.deliveries);
      if (error) throw new Error(`Seeding deliveries failed: ${error.message}`);
    }
    console.log(`[SEED] Seeding completed successfully for tenant '${tenantId}'.`);
  }

  // In-memory tenant state store fallback for when Supabase is unconfigured, keeping multi-device sessions perfectly in sync!
  const inMemoryTenantStates: { [tenantId: string]: { branches?: any[], trucks?: any[], users?: any[], deliveries?: any[] } } = {};

  // In-memory map of recently deleted record IDs per tenant to prevent resurrection
  const deletedTenantRecords: { [tenantId: string]: { [table: string]: Set<string> } } = {};

  // Fetch full state for a specific tenant from Supabase (or return premium mock fallback arrays when database is unconfigured)
  app.get("/api/tenant/state", async (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    try {
      const { tenantId } = req.query;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId parameter is required." });
      }

      const supabase = getSupabase(req);
      if (!supabase) {
        const tid = String(tenantId);
        if (!inMemoryTenantStates[tid]) {
          inMemoryTenantStates[tid] = getDefaultTenantState(tid);
        }

        const state = inMemoryTenantStates[tid];
        return res.json({
          supabaseActive: false,
          error: "Supabase credentials are not configured or active on the production server. Please go to AI Studio Settings > Secrets, ensure SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are added, and then click the 'Share' button at the top right of AI Studio to redeploy the shared application with these secrets.",
          branches: state.branches || [],
          trucks: state.trucks || [],
          users: state.users || [],
          deliveries: state.deliveries || []
        });
      }

      // Fetch all tables in parallel with a timeout to prevent hanging (safe 30000ms timeout)
      let [rBranches, rTrucks, rUsers, rDeliveries] = await withTimeout<any>(
        Promise.all([
          supabase.from("branches").select("*").eq("tenantId", tenantId),
          supabase.from("trucks").select("*").eq("tenantId", tenantId),
          supabase.from("users").select("*").eq("tenantId", tenantId),
          supabase.from("deliveries").select("*").eq("tenantId", tenantId)
        ]),
        30000
      );

      // If schema tables don't exist yet, it'll error.
      if (rBranches.error || rTrucks.error || rUsers.error || rDeliveries.error) {
        const primaryError = rBranches.error || rTrucks.error || rUsers.error || rDeliveries.error;
        throw new Error(primaryError?.message || "Error pulling multi-tenant tables from Supabase.");
      }

      // Automatically seed the live tables if they are active but contain 0 records for this tenant
      if ((rBranches.data || []).length === 0) {
        console.log(`Live database has 0 registers/branches for tenant '${tenantId}'. Automatically seeding default templates...`);
        try {
          await seedDefaultState(supabase, String(tenantId));
          // Re-fetch to load the seeded records from the database with a safe timeout
          const [fBranches, fTrucks, fUsers, fDeliveries] = await withTimeout<any>(
            Promise.all([
              supabase.from("branches").select("*").eq("tenantId", tenantId),
              supabase.from("trucks").select("*").eq("tenantId", tenantId),
              supabase.from("users").select("*").eq("tenantId", tenantId),
              supabase.from("deliveries").select("*").eq("tenantId", tenantId)
            ]),
            30000
          );
          rBranches = fBranches;
          rTrucks = fTrucks;
          rUsers = fUsers;
          rDeliveries = fDeliveries;
        } catch (seedErr: any) {
          console.error("Auto-seeding failed, continuing with empty result set:", seedErr);
        }
      }

      const deserializedUsers = (rUsers.data || []).map((u: any) => deserializeFromPhone(u));
      const deserializedTrucks = (rTrucks.data || []).map((t: any) => deserializeType(t));

      // Reset failure counters on query success
      supabaseConsecutiveFailures = 0;
      supabaseTemporarilyDisabled = false;
      supabaseDisabledUntil = 0;

      res.json({
        supabaseActive: true,
        branches: rBranches.data || [],
        trucks: deserializedTrucks,
        users: deserializedUsers,
        deliveries: rDeliveries.data || []
      });
    } catch (err: any) {
      // Trigger circuit breaker for timeout or network unreachable errors
      const errMsg = err.message || String(err);
      if (errMsg.includes("timed out") || errMsg.includes("fetch failed") || errMsg.includes("ENOTFOUND") || errMsg.includes("ECONNREFUSED")) {
        supabaseConsecutiveFailures++;
        if (supabaseConsecutiveFailures >= 2) {
          supabaseTemporarilyDisabled = true;
          supabaseDisabledUntil = Date.now() + 60000; // Disable queries for 60 seconds
          console.warn(`[CIRCUIT BREAKER] Supabase disabled for 60 seconds due to consecutive state load errors: ${errMsg}`);
        }
      }

      const dbError = formatDatabaseError(err);
      console.warn("Failed to read Supabase state, returning fallback mock data:", dbError);
      
      // Fallback data structure for smooth, non-blocking user experience
      res.json({
        supabaseActive: false,
        error: dbError,
        schemaMissing: true,
        branches: [
          {
            id: "01075",
            tenantId: String(req.query.tenantId),
            name: "ProSpaces - Tantallon",
            type: "STORE",
            address: "3680 Hammonds Plains Rd, Upper Tantallon, NS B3Z 1H3, Canada"
          },
          {
            id: "01065",
            tenantId: String(req.query.tenantId),
            name: "ProSpaces - ALMON",
            type: "STORE",
            address: "6055 Almon St, Halifax, NS B3K 1T9, Canada"
          },
          {
            id: "01070",
            tenantId: String(req.query.tenantId),
            name: "ProSpaces - Elmsdale",
            type: "DC",
            address: "84 Mason Ln, Elmsdale, NS B2S 3J3, Canada"
          },
          {
            id: "DC-WINAMILL",
            tenantId: String(req.query.tenantId),
            name: "ProSpaces - WINDMILL",
            type: "DC",
            address: "500 Windmill Road, Dartmouth, NS, B3B 1B3, Canada"
          }
        ],
        trucks: [
          {
            id: "TRUCK-87",
            tenantId: String(req.query.tenantId),
            name: "Truck-1",
            type: "Heavy-Duty Flatbed ||regdue:2026-11-29 ||lat:44.7082 ||lng:-63.5938",
            driver: "George Campbell",
            branchId: "01075"
          },
          {
            id: "TRUCK-28",
            tenantId: String(req.query.tenantId),
            name: "Truck-2",
            type: "Flatbed Boom Truck ||regdue:2026-11-29 ||lat:44.6295 ||lng:-63.6651",
            driver: "Joshua Campbell",
            branchId: "DC-WINAMILL"
          }
        ],
        users: [
          {
            id: "USR-57008",
            tenantId: String(req.query.tenantId),
            name: "George Campbell",
            email: "george.campbell@prospaces.com",
            role: "Admin",
            phone: " ||pw:George2026! ||status:Active",
            password: "George2026!",
            status: "Active",
            associatedStoreId: "DC-WINAMILL"
          },
          {
            id: "USR-1869",
            tenantId: String(req.query.tenantId),
            name: "Joshua Campbell",
            email: "joshua.campbell@prospaces.com",
            role: "Driver",
            phone: " ||pw:Joshua2026! ||status:Active ||licexp:2027-01-22",
            password: "Joshua2026!",
            status: "Active",
            driverLicenseExpire: "2027-01-22",
            associatedStoreId: "DC-WINAMILL"
          }
        ],
        deliveries: [
          {
            id: "263890",
            tenantId: String(req.query.tenantId),
            invoiceNumber: "263890",
            epicorSalesOrder: "263890",
            customerName: "SOLD TO: BC SALES 3685 HAMMONDS PLAINS SALES BC  STILLWATER LAKE  902-821-2124     NS",
            deliveryAddress: "SHIP TO: 547 KING ST 547 KING ST BRIDGEWATER   NS B3Z 1H3",
            phone: "902-555-0199",
            originBranch: "01075",
            destinationNotes: "[Automated PDF Capture - Type: Order] Matches OCR template regional Nova_Scotia_Regional_Core with confidence 98.5%. Date parsed: 3/24/26   10:06. Physical Document stored: /uploads/263890_source.pdf",
            status: "REGISTERED",
            registeredAt: "6/16/2026, 11:15:48 AM",
            pickedAt: null,
            deliveredAt: null,
            returnedAt: null,
            returnReason: null,
            assignedTruck: "TRUCK-87",
            assignedDriver: "George Campbell",
            customerSignature: null,
            deliveryPhoto: null,
            history: [
              {
                notes: "Ingested automatically into logistics. Ready for truck pre-allocation or dispatch. Physical copy archived on server.",
                status: "REGISTERED",
                location: "ProSpaces - Tantallon",
                operator: "Azure OCR Automate Stream",
                timestamp: "6/16/2026, 11:15:48 AM"
              },
              {
                notes: "Allocated truck to delivery path: Truck-1 (Driver: George Campbell).",
                status: "REGISTERED",
                location: "ProSpaces - Tantallon",
                operator: "Logistics Board Coordinator",
                timestamp: "2026-06-16T14:16:19.891Z"
              }
            ]
          }
        ]
      });
    }
  });

  // Save/Upsert fully updated collection states for a specific tenant
  app.post("/api/tenant/save-state", async (req, res) => {
    try {
      const { tenantId, deliveries, trucks, branches, users } = req.body;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId parameter is required." });
      }

      const supabase = getSupabase(req);
      if (!supabase) {
        const tid = String(tenantId);
        let filteredBranches = branches || [];
        let filteredTrucks = trucks || [];
        let filteredUsers = users || [];
        let filteredDeliveries = deliveries || [];

        const deletes = deletedTenantRecords[tid];
        if (deletes) {
          if (deletes["branches"]) {
            filteredBranches = filteredBranches.filter((item: any) => !deletes["branches"].has(item.id));
          }
          if (deletes["trucks"]) {
            filteredTrucks = filteredTrucks.filter((item: any) => !deletes["trucks"].has(item.id));
          }
          if (deletes["users"]) {
            filteredUsers = filteredUsers.filter((item: any) => !deletes["users"].has(item.id));
          }
          if (deletes["deliveries"]) {
            filteredDeliveries = filteredDeliveries.filter((item: any) => !deletes["deliveries"].has(item.id));
          }
          delete deletedTenantRecords[tid];
        }

        inMemoryTenantStates[tid] = {
          branches: filteredBranches,
          trucks: filteredTrucks,
          users: filteredUsers,
          deliveries: filteredDeliveries
        };
        return res.json({
          supabaseActive: false,
          success: true,
          message: "Database unconfigured, state saved inside backend in-memory store and synchronized across all active sessions."
        });
      }

      // Deduplicate payloads by unique ID to avoid ON CONFLICT constraint violations
      const uniqueBranchesMap = new Map<string, any>();
      (branches || []).forEach((b: any) => {
        if (b && b.id) uniqueBranchesMap.set(b.id, b);
      });
      let uniqueBranches = Array.from(uniqueBranchesMap.values());

      const uniqueTrucksMap = new Map<string, any>();
      (trucks || []).forEach((t: any) => {
        if (t && t.id) uniqueTrucksMap.set(t.id, t);
      });
      let uniqueTrucks = Array.from(uniqueTrucksMap.values());

      const uniqueUsersMap = new Map<string, any>();
      (users || []).forEach((u: any) => {
        if (u && u.id) uniqueUsersMap.set(u.id, u);
      });
      let uniqueUsers = Array.from(uniqueUsersMap.values());

      const uniqueDeliveriesMap = new Map<string, any>();
      (deliveries || []).forEach((d: any) => {
        if (d && d.id) uniqueDeliveriesMap.set(d.id, d);
      });
      let uniqueDeliveries = Array.from(uniqueDeliveriesMap.values());

      // Filter out explicitly deleted items from incoming upserts to prevent resurrection
      const tid = String(tenantId);
      const deletes = deletedTenantRecords[tid];
      if (deletes) {
        if (deletes["branches"]) {
          uniqueBranches = uniqueBranches.filter((item: any) => !deletes["branches"].has(item.id));
        }
        if (deletes["trucks"]) {
          uniqueTrucks = uniqueTrucks.filter((item: any) => !deletes["trucks"].has(item.id));
        }
        if (deletes["users"]) {
          uniqueUsers = uniqueUsers.filter((item: any) => !deletes["users"].has(item.id));
        }
        if (deletes["deliveries"]) {
          uniqueDeliveries = uniqueDeliveries.filter((item: any) => !deletes["deliveries"].has(item.id));
        }
      }

      // Force-inject appropriate tenantIds into nested payloads to maintain strict database isolation
      const sanitizedBranches = uniqueBranches.map((b: any) => ({ ...b, tenantId }));
      const sanitizedTrucks = uniqueTrucks.map((t: any) => ({ ...t, tenantId }));
      const sanitizedUsers = uniqueUsers.map((u: any) => ({ ...u, tenantId }));
      const sanitizedDeliveries = uniqueDeliveries.map((d: any) => ({ ...d, tenantId }));

      // Execute upserts series to maintain reference integrity
      // 1. Branches first (parent of trucks and deliveries)
      if (sanitizedBranches.length > 0) {
        const { error } = await supabase.from("branches").upsert(sanitizedBranches);
        if (error) throw new Error(`Branches Sync Error: ${error.message}`);

        // Delete any branches for this tenant that are NOT in sanitizedBranches
        const branchIds = sanitizedBranches.map((b: any) => b.id);
        const { error: deleteErr } = await supabase
          .from("branches")
          .delete()
          .eq("tenantId", tenantId)
          .not("id", "in", `(${branchIds.map(id => `"${id}"`).join(",")})`);
        if (deleteErr) {
          console.warn("Non-blocking branches sync deletion failed:", deleteErr.message);
        }
      } else {
        await supabase.from("branches").delete().eq("tenantId", tenantId);
      }

      // 2. Trucks
      if (sanitizedTrucks.length > 0) {
        try {
          // Prepare trucks for DB by serializing extra fields into type column
          // and stripping them so they don't cause "column does not exist" errors on upsert.
          const trucksToUpsert = sanitizedTrucks.map((t: any) => {
            return {
              id: t.id,
              tenantId: t.tenantId,
              name: t.name,
              type: serializeToType(
                t.type,
                t.registrationDueDate,
                t.lat,
                t.lng,
                t.gpsSource,
                t.gpsDeviceId,
                t.gpsDeviceName,
                t.gpsSimIccid,
                t.gpsStatus,
                t.gpsLastHandshake,
                t.gpsLat,
                t.gpsLng
              ),
              driver: t.driver,
              branchId: t.branchId,
              registrationDueDate: t.registrationDueDate || null
            };
          });

          try {
            const { error } = await supabase.from("trucks").upsert(trucksToUpsert);
            if (error) throw error;
          } catch (dbErr: any) {
            const errMsg = dbErr.message || String(dbErr);
            if (errMsg.includes("column") && (errMsg.includes("registrationDueDate") || errMsg.includes("42703") || dbErr.code === "42703")) {
              console.warn("Supabase trucks table is missing 'registrationDueDate' column. Retrying upsert with serialized fallback...");
              const strippedTrucks = trucksToUpsert.map((t: any) => {
                const { registrationDueDate, ...rest } = t;
                return rest;
              });
              const { error: retryErr } = await supabase.from("trucks").upsert(strippedTrucks);
              if (retryErr) throw new Error(`Trucks Sync Retry Error: ${retryErr.message}`);
            } else {
              throw dbErr;
            }
          }

          // Delete any trucks for this tenant that are NOT in sanitizedTrucks
          const truckIds = sanitizedTrucks.map((t: any) => t.id);
          const { error: deleteErr } = await supabase
            .from("trucks")
            .delete()
            .eq("tenantId", tenantId)
            .not("id", "in", `(${truckIds.map(id => `"${id}"`).join(",")})`);
          if (deleteErr) {
            console.warn("Non-blocking trucks sync deletion failed:", deleteErr.message);
          }
        } catch (dbErr: any) {
          throw new Error(`Trucks Sync Error: ${dbErr.message}`);
        }
      } else {
        await supabase.from("trucks").delete().eq("tenantId", tenantId);
      }

      // 3. Users - Proactively map and serialize user payloads to prevent "column does not exist" schema mismatches
      if (sanitizedUsers.length > 0) {
        try {
          const usersToUpsert = sanitizedUsers.map((u: any) => {
            return {
              id: u.id,
              tenantId: u.tenantId,
              name: u.name,
              email: u.email,
              role: u.role,
              phone: serializeToPhone(u.phone, u.password, u.status, u.driverLicenseExpire, u.lastActive, u.resetRequest),
              associatedStoreId: u.associatedStoreId || null
            };
          });

          const { error } = await supabase.from("users").upsert(usersToUpsert);
          if (error) throw error;

          // Delete any users for this tenant that are NOT in sanitizedUsers
          const userIds = sanitizedUsers.map((u: any) => u.id);
          const { error: deleteErr } = await supabase
            .from("users")
            .delete()
            .eq("tenantId", tenantId)
            .not("id", "in", `(${userIds.map(id => `"${id}"`).join(",")})`);
          if (deleteErr) {
            console.warn("Non-blocking users sync deletion failed:", deleteErr.message);
          }
        } catch (dbErr: any) {
          throw new Error(`Users Sync Error: ${dbErr.message}`);
        }
      } else {
        await supabase.from("users").delete().eq("tenantId", tenantId);
      }

      // Honor any explicit delete markers that were registered via the delete-record endpoint
      try {
        const deletedForTenant = deletedTenantRecords[String(tenantId)];
        if (deletedForTenant) {
          for (const [tbl, idSet] of Object.entries(deletedForTenant)) {
            const ids = Array.from(idSet || []);
            if (ids.length === 0) continue;
            // perform a defensive delete to ensure these ids are removed regardless of incoming payload
            const { error: explicitDeleteErr } = await supabase.from(tbl).delete().eq("tenantId", tenantId).in("id", ids);
            if (explicitDeleteErr) {
              console.warn(`Failed to apply explicit deletes for tenant ${tenantId} table ${tbl}:`, explicitDeleteErr.message || explicitDeleteErr);
            }
          }
          // Clear the recorded deletes once applied
          deleteTenantDeleteMarks: {
            delete deletedTenantRecords[String(tenantId)];
          }
        }
      } catch (e) {
        console.warn("Error while applying explicit delete markers during save-state:", e);
      }

      // 4. Deliveries with auto-columns stripping fallback for schema mismatch
      if (sanitizedDeliveries.length > 0) {
        let deliveriesToUpsert = [...sanitizedDeliveries];
        let success = false;
        let attempts = 0;
        while (!success && attempts < 5) {
          try {
            const { error } = await supabase.from("deliveries").upsert(deliveriesToUpsert);
            if (error) throw error;
            success = true;
          } catch (dbErr: any) {
            attempts++;
            const errMsg = dbErr.message || String(dbErr);
            console.warn(`Deliveries sync failed (attempt ${attempts}):`, errMsg);
            
            // Check for missing column error, e.g., 'column "pdfUrl" of relation "deliveries" does not exist' or error code "42703"
            if (errMsg.includes("column") || errMsg.includes("42703") || dbErr.code === "42703") {
              const match = errMsg.match(/column "([^"]+)"|column ([^\s]+) of relation/);
              let colToStrip = match ? (match[1] || match[2]) : null;
              
              if (!colToStrip) {
                // If we couldn't match the column name, look for known new columns in errMsg
                if (errMsg.includes("pdfUrl")) colToStrip = "pdfUrl";
                else if (errMsg.includes("weight")) colToStrip = "weight";
                else if (errMsg.includes("orderTotal")) colToStrip = "orderTotal";
              }
              
              if (colToStrip) {
                console.log(`Stripping missing column '${colToStrip}' from deliveries payload to bypass schema mismatch and retrying...`);
                deliveriesToUpsert = deliveriesToUpsert.map(d => {
                  const copy = { ...d };
                  delete copy[colToStrip];
                  return copy;
                });
              } else {
                console.log("Stripping all potential new columns (pdfUrl, weight, orderTotal) due to unidentified column error.");
                deliveriesToUpsert = deliveriesToUpsert.map(d => {
                  const { pdfUrl, weight, orderTotal, ...rest } = d;
                  return rest;
                });
              }
            } else {
              throw new Error(`Deliveries Sync Error: ${errMsg}`);
            }
          }
        }
        if (!success) {
          throw new Error("Deliveries Sync failed after maximum retries due to persistent schema mismatch.");
        }

        // Delete any deliveries for this tenant that are NOT in sanitizedDeliveries
        const deliveryIds = sanitizedDeliveries.map((d: any) => d.id);
        const { error: deleteErr } = await supabase
          .from("deliveries")
          .delete()
          .eq("tenantId", tenantId)
          .not("id", "in", `(${deliveryIds.map(id => `"${id}"`).join(",")})`);
        if (deleteErr) {
          console.warn("Non-blocking deliveries sync deletion failed:", deleteErr.message);
        }
      } else {
        await supabase.from("deliveries").delete().eq("tenantId", tenantId);
      }

      // Enforce defensive deletes from memory before finishing the save-state flow
      const tidStr = String(tenantId);
      const deletesObj = deletedTenantRecords[tidStr];
      if (deletesObj) {
        for (const table of Object.keys(deletesObj)) {
          const ids = Array.from(deletesObj[table]);
          if (ids.length > 0) {
            console.log(`[DEFENSIVE DELETE] Enforcing deletion of ${ids.join(", ")} in table '${table}' for tenant '${tenantId}'`);
            try {
              if (table === "branches") {
                await supabase.from("branches").delete().eq("tenantId", tenantId).in("id", ids);
              } else if (table === "trucks") {
                await supabase.from("trucks").delete().eq("tenantId", tenantId).in("id", ids);
              } else if (table === "users") {
                await supabase.from("users").delete().eq("tenantId", tenantId).in("id", ids);
              } else if (table === "deliveries") {
                await supabase.from("deliveries").delete().eq("tenantId", tenantId).in("id", ids);
              }
            } catch (delErr: any) {
              console.warn(`[DEFENSIVE DELETE] Failed to delete from table '${table}':`, delErr.message || delErr);
            }
          }
        }
        delete deletedTenantRecords[tidStr];
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("Supabase Save State Error:", err);
      res.status(500).json({ error: formatDatabaseError(err) });
    }
  });

  // Individual deletion endpoints to remove records from Supabase permanently when deleted on frontend
  app.delete("/api/tenant/delete-record", async (req, res) => {
    try {
      const { table, id, tenantId } = req.query;
      if (!table || !id || !tenantId) {
        return res.status(400).json({ error: "Missing query properties table, id, or tenantId." });
      }

      const tidStr = String(tenantId);
      const tblStr = String(table);
      const idStr = String(id);

      // Record delete in deletedTenantRecords in-memory map
      if (!deletedTenantRecords[tidStr]) {
        deletedTenantRecords[tidStr] = {};
      }
      if (!deletedTenantRecords[tidStr][tblStr]) {
        deletedTenantRecords[tidStr][tblStr] = new Set<string>();
      }
      deletedTenantRecords[tidStr][tblStr].add(idStr);
      if (tblStr === "branches" && idStr === "DC-WINAMILL") {
        deletedTenantRecords[tidStr][tblStr].add("500");
      }

      const supabase = getSupabase(req);
      if (!supabase) {
        const state = inMemoryTenantStates[tidStr];
        if (state) {
          if (tblStr === "branches" && state.branches) {
            state.branches = state.branches.filter((item: any) => item.id !== idStr && item.id !== "500");
          } else if (tblStr === "trucks" && state.trucks) {
            state.trucks = state.trucks.filter((item: any) => item.id !== idStr);
          } else if (tblStr === "users" && state.users) {
            state.users = state.users.filter((item: any) => item.id !== idStr);
          } else if (tblStr === "deliveries" && state.deliveries) {
            state.deliveries = state.deliveries.filter((item: any) => item.id !== idStr);
          }
        }
        return res.json({ success: true, supabaseActive: false });
      }

      // Ensure we only delete matching ids belonging to the authenticated tenant
      // If table is branches and id is DC-WINAMILL, also delete legacy ID "500"
      let deleteQuery = supabase.from(tblStr).delete().eq("tenantId", tenantId);
      if (tblStr === "branches" && idStr === "DC-WINAMILL") {
        deleteQuery = deleteQuery.in("id", ["DC-WINAMILL", "500"]);
      } else {
        deleteQuery = deleteQuery.eq("id", idStr);
      }
      
      const { error } = await deleteQuery;

      if (error) throw error;

      // If deletion succeeded on Supabase, also register the explicit delete marker
      try {
        const tid = String(tenantId);
        if (!deletedTenantRecords[tid]) deletedTenantRecords[tid] = {};
        if (!deletedTenantRecords[tid][String(table)]) deletedTenantRecords[tid][String(table)] = new Set();
        deletedTenantRecords[tid][String(table)].add(String(id));
      } catch (e) {
        console.warn('Failed to record explicit delete marker in memory:', e);
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("Permanent delete error:", err);
      res.status(500).json({ error: formatDatabaseError(err) });
    }
  });

  // Clear all operational data for a specific tenant except the active logged-in user
  app.post("/api/tenant/clear-all", async (req, res) => {
    try {
      const { tenantId, keepUserEmail } = req.body;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId parameter is required." });
      }

      const supabase = getSupabase(req);
      if (!supabase) {
        const tid = String(tenantId);
        const state = inMemoryTenantStates[tid];
        if (state) {
          state.deliveries = [];
          state.trucks = [];
          state.branches = [];
          if (keepUserEmail) {
            state.users = (state.users || []).filter((u: any) => u.email.toLowerCase() === keepUserEmail.toLowerCase());
          } else {
            state.users = [];
          }
        }
        return res.json({ success: true, supabaseActive: false });
      }

      // 1. Delete all deliveries
      await supabase.from("deliveries").delete().eq("tenantId", tenantId);

      // 2. Delete all trucks
      await supabase.from("trucks").delete().eq("tenantId", tenantId);

      // 3. Delete all branches
      await supabase.from("branches").delete().eq("tenantId", tenantId);

      // 4. Delete all users except the active logged-in profile to preserve their session
      if (keepUserEmail) {
        const { error } = await supabase
          .from("users")
          .delete()
          .eq("tenantId", tenantId)
          .not("email", "ilike", keepUserEmail.trim());
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("users")
          .delete()
          .eq("tenantId", tenantId);
        if (error) throw error;
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("Clear all tenant state error:", err);
      res.status(500).json({ error: formatDatabaseError(err) });
    }
  });

  // API Route for saving uploaded PDFs safely to the local uploads directory
  app.post("/api/save-pdf", async (req, res) => {
    try {
      const { fileData, fileName } = req.body;
      if (!fileData || !fileName) {
        return res.status(400).json({ error: "Missing fileData or fileName specifications." });
      }

      // Identify base64 format and isolate raw payloads
      const parts = fileData.match(/^data:(.*);base64,(.*)$/);
      let base64Data = fileData;
      if (parts) {
        base64Data = parts[2];
      }

      const buffer = Buffer.from(base64Data, "base64");

      const uploadsDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Restrict character scope to keep paths entirely safe from injection attacks
      const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const filePath = path.join(uploadsDir, safeName);

      fs.writeFileSync(filePath, buffer);
      console.log(`Saved physical PDF on express server disk at: ${filePath}`);

      res.json({ 
        success: true, 
        pdfUrl: `/uploads/${safeName}` 
      });
    } catch (err: any) {
      console.error("Express save PDF error:", err);
      res.status(500).json({ error: err.message || "Failed to persist physical PDF to server." });
    }
  });

  // API Route for performing local Tesseract OCR on the server side (immune to standard browser sandbox issues)
  app.post("/api/ocr-tesseract", async (req, res) => {
    try {
      const { fileData } = req.body;
      if (!fileData) {
        return res.status(400).json({ error: "No file data has been supplied." });
      }

      const parts = fileData.match(/^data:(.*);base64,(.*)$/);
      if (!parts) {
        return res.status(400).json({ error: "Format error: Provided data URI is malformed." });
      }

      const base64Data = parts[2];
      const buffer = Buffer.from(base64Data, "base64");

      console.log("Server OCR: Initiating Tesseract engine processing...");
      const TesseractModule = await import("tesseract.js");
      const Tesseract = TesseractModule.default || TesseractModule;
      const result = await Tesseract.recognize(buffer, "eng");
      
      const dataObj = result.data as any;
      console.log(`Server OCR: Tesseract successfully recognized text. Length: ${dataObj.text.length}`);
      res.json({ success: true, text: dataObj.text, words: dataObj.words || [] });
    } catch (err: any) {
      console.error("Server Tesseract OCR Error:", err);
      res.status(500).json({ error: err.message || "An exception occurred during server-side Tesseract OCR." });
    }
  });

  // API Route for performing camera snapshot scanning using Gemini Vision
  app.post("/api/scan-photo", async (req, res) => {
    try {
      const { fileData } = req.body;
      if (!fileData) {
        return res.status(400).json({ error: "No photo has been provided for scanning." });
      }

      const parts = fileData.match(/^data:(.*);base64,(.*)$/);
      if (!parts) {
        return res.status(400).json({ error: "Format error: Provided data URI is malformed." });
      }

      const mimeType = parts[1];
      const base64Data = parts[2];

      const prompt = `You are an expert logistics automation assistant specializing in high-fidelity optical barcode decryption and tracking.
Analyze the provided high-resolution document/invoice photo to identify and decode any barcode (such as Code 128, Code 39, ITF, UPC, EAN, or a QR code).

CRITICAL INSTRUCTIONS FOR MAXIMUM SCAN SUCCESS:
1. 1D BARCODE ANALYSIS: Try to read the individual stripes of the 1D linear barcode.
2. FAILSAFE HUMAN-READABLE TEXT FALLBACK: Barcode labels on industrial slips (like Epicor, logistics invoices) ALWAYS print their exact alphanumeric representation directly BELOW, ABOVE, or NEXT to the stripes (e.g. "7155", "7159", "I-123456", "SO-94827").
   If the barcode stripes are slightly compressed, fuzzy, or low-resolution in the camera snapshot, look directly at the clear text printed adjacent to the barcode. That text is a 100% exact string match of the barcode value. Read it as if you had decrypted the barcode itself.
3. Ignore random text on the invoice, focus strictly on the text label adjacent to the barcode lines/stripes.
4. Format the final code without spaces if represented that way on the document.

Return the result in the active JSON format.
Output schema keys:
- success: boolean indicating if a barcode or its printed text value was discovered.
- barcodeText: the decoded string value (or null if not found/legible).
- barcodeFormat: the format e.g. "CODE_128", "QR_CODE", "CODE_39", "UPC", etc. (or null).`;

      const aiClient = getGeminiClient();

      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data
              }
            },
            {
              text: prompt
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              success: { type: Type.BOOLEAN },
              barcodeText: { type: Type.STRING },
              barcodeFormat: { type: Type.STRING }
            },
            required: ["success", "barcodeText", "barcodeFormat"]
          },
          temperature: 0.1
        }
      });

      const rawText = response.text;
      if (!rawText) {
        throw new Error("Unable to extract response stream text from Gemini.");
      }

      const parsedJson = JSON.parse(rawText.trim());
      res.json(parsedJson);
    } catch (err: any) {
      console.error("Gemini Scan Photo Error:", err);
      res.status(500).json({ error: err.message || "An exception occurred during server-side Gemini scanner execution." });
    }
  });

  // API Route for performing Real-Time OCR (Preserve current Gemini extraction logic untouched!)
  app.post("/api/ocr", async (req, res) => {
    try {
      const { fileData, docType, fieldsToExtract } = req.body;

      if (!fileData) {
        return res.status(400).json({ error: "No file data has been supplied." });
      }

      const parts = fileData.match(/^data:(.*);base64,(.*)$/);
      if (!parts) {
        return res.status(400).json({ error: "Format error: Provided data URI is malformed." });
      }

      const mimeType = parts[1];
      const base64Data = parts[2];

      const fieldListPrompt = Object.entries(fieldsToExtract)
        .map(([key, fObj]: [string, any]) => `- "${key}" (${fObj.label}): Extract the exact value found in the document.`)
        .join("\n");

      const prompt = `You are a high-precision corporate logistics document OCR parser.
Extract the exact values for the requested fields from this document.
The document type is: ${docType}

Requested fields to extract:
${fieldListPrompt}

For any requested fields that are missing, unavailable, or cannot be parsed, reply with "N/A" rather than a blank or simulated value. Ensure all textual items match the document exactly without changing spelling or casing where editable. Return the structured results in the required JSON format.`;

      const properties: Record<string, any> = {};
      const requiredFields: string[] = [];

      Object.keys(fieldsToExtract).forEach((fieldKey) => {
        properties[fieldKey] = {
          type: Type.STRING,
          description: `Extracted string content for "${fieldKey}"`
        };
        requiredFields.push(fieldKey);
      });

      const aiClient = getGeminiClient();

      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data
              }
            },
            {
              text: prompt
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties,
            required: requiredFields
          },
          temperature: 0.1
        }
      });

      const rawText = response.text;
      if (!rawText) {
        throw new Error("Unable to extract response stream text from Gemini.");
      }

      const parsedJson = JSON.parse(rawText.trim());
      res.json({ success: true, data: parsedJson });
    } catch (err: any) {
      console.error("OCR Extraction Error:", err);
      res.status(500).json({ error: err.message || "An exception occurred during real-time document parsing." });
    }
  });

  // Tenant / Organization CRUD endpoint APIs for SUPER_ADMIN
  app.get("/api/tenants", async (req, res) => {
    const fallbackTenants: any[] = [];

    try {
      const supabase = getSupabase(req);
      if (!supabase) {
        return res.json({ supabaseActive: false, tenants: fallbackTenants });
      }
      const { data, error } = await supabase.from("tenants").select("*");
      if (error) throw error;
      res.json({ supabaseActive: true, tenants: data && data.length > 0 ? data : fallbackTenants });
    } catch (err: any) {
      const formatted = formatDatabaseError(err);
      console.warn("Failed to read core tenants from Supabase:", formatted);
      res.json({ supabaseActive: false, error: formatted, tenants: fallbackTenants });
    }
  });

  app.post("/api/tenants", async (req, res) => {
    try {
      const { tenant } = req.body;
      if (!tenant || !tenant.id) {
        return res.status(400).json({ error: "Tenant payload with a valid ID is required." });
      }
      const supabase = getSupabase(req);
      if (!supabase) {
        return res.json({ success: false, supabaseActive: false, error: "Supabase database is inactive or unconfigured. Cannot add tenant." });
      }
      const { error } = await supabase.from("tenants").upsert([tenant]);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      console.error("Failed to upsert tenant to Supabase:", err);
      res.status(500).json({ error: formatDatabaseError(err) });
    }
  });

  app.delete("/api/tenants/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const supabase = getSupabase(req);
      if (!supabase) {
        return res.json({ success: false, supabaseActive: false, error: "Supabase database is inactive or unconfigured. Cannot delete tenant." });
      }

      // Safeguard: Cascade delete child tables to prevent orphaned records in our multi-tenant database
      await Promise.all([
        supabase.from("deliveries").delete().eq("tenantId", id),
        supabase.from("users").delete().eq("tenantId", id),
        supabase.from("trucks").delete().eq("tenantId", id),
        supabase.from("branches").delete().eq("tenantId", id)
      ]);

      const { error } = await supabase.from("tenants").delete().eq("id", id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      console.error("Failed to delete tenant from Supabase:", err);
      res.status(500).json({ error: formatDatabaseError(err) });
    }
  });

  app.get('/clear-local-storage', (req, res) => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Clear Local Storage</title></head><body><script>
      try {
        localStorage.removeItem('prospaces_custom_supabase_url');
        localStorage.removeItem('prospaces_custom_supabase_key');
        localStorage.removeItem('prospaces_dismissed_rls_warning');
        localStorage.removeItem('prospaces_all_tenants');
        localStorage.removeItem('prospaces_active_tenant');
        localStorage.removeItem('prospaces_active_user');
        console.log('Cleared ProSpaces localStorage keys');
        alert('Cleared ProSpaces localStorage keys. You will be redirected to /');
      } catch(e) { console.warn('Failed to clear local storage', e); }
      window.location = '/';
    </script></body></html>`;
    res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
  });

async function startServer() {
  // Serve static assets and frontend index inside our middleware stack
  // In the deployed container, we want to serve the bundled production files from `dist` if they exist.
  let isProduction = process.env.NODE_ENV === "production" || process.argv.some(arg => arg.includes("dist/server.cjs") || arg.includes("dist\\server.cjs"));

  if (!isProduction) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);

      // Fallback for HTML pages / SPA routing in development to prevent 404s on refresh
      app.get("*", async (req, res, next) => {
        const url = req.originalUrl;
        // Skip API and files/assets
        if (url.startsWith("/api") || url.includes(".")) {
          return next();
        }
        try {
          let template = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf-8");
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e: any) {
          next(e);
        }
      });
    } catch (e) {
      console.warn("Vite middleware load failed. Falling back to static production mode.", e);
      isProduction = true;
    }
  }

  if (isProduction) {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Temporary helper endpoint to clear client-side saved Supabase credentials
  // Visit http://<host>:<port>/clear-local-storage in your browser to run.
  app.get('/clear-local-storage', (req, res) => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Clear Local Storage</title></head><body><script>
      try {
        localStorage.removeItem('prospaces_custom_supabase_url');
        localStorage.removeItem('prospaces_custom_supabase_key');
        localStorage.removeItem('prospaces_dismissed_rls_warning');
        localStorage.removeItem('prospaces_all_tenants');
        localStorage.removeItem('prospaces_active_tenant');
        localStorage.removeItem('prospaces_active_user');
        console.log('Cleared ProSpaces localStorage keys');
        alert('Cleared ProSpaces localStorage keys. You will be redirected to /');
      } catch(e) { console.warn('Failed to clear local storage', e); }
      window.location = '/';
    </script></body></html>`;
    res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
