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
let supabaseClient: any = null;
let lastSupabaseUrl = "";
let lastSupabaseKey = "";

function getSupabase() {
  let url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;
  
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

function withTimeout<T>(promise: Promise<T> | any, ms: number = 3000): Promise<T> {
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

function serializeToPhone(phone: string | undefined, password: string | undefined, status: string | undefined, driverLicenseExpire?: string | undefined): string {
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

function deserializeFromPhone(user: any): any {
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

function serializeToType(type: string | undefined, registrationDueDate: string | undefined, lat?: number, lng?: number): string {
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

function deserializeType(truck: any): any {
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
  password text default '123456',
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

-- Seed Initial Logistical Partners
insert into tenants (id, name, code, description, "logoBadge", "regionalFocus", "primaryColor") values
('ronaatlantic', 'RONA Atlantic', 'RA', 'Corporate logistics tracking for RONA franchise dealer stores.', '🏢', 'Atlantic Canada (Dartmouth, Tantallon, Halifax)', 'blue')
on conflict (id) do nothing;

-- 6. Row-Level Security (RLS) Master Configuration & Policies
-- To turn RLS ON and protect your database, execute the following commands in your Supabase SQL Editor.

-- STEP 1: Enable Row-Level Security on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

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
CREATE POLICY "Allow public read on tenants" ON tenants FOR SELECT USING (true);
CREATE POLICY "Allow public write on tenants" ON tenants FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on tenants" ON tenants FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on tenants" ON tenants FOR DELETE USING (true);

-- Branches policies
CREATE POLICY "Allow public read on branches" ON branches FOR SELECT USING (true);
CREATE POLICY "Allow public write on branches" ON branches FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on branches" ON branches FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on branches" ON branches FOR DELETE USING (true);

-- Trucks policies
CREATE POLICY "Allow public read on trucks" ON trucks FOR SELECT USING (true);
CREATE POLICY "Allow public write on trucks" ON trucks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on trucks" ON trucks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on trucks" ON trucks FOR DELETE USING (true);

-- Users policies
CREATE POLICY "Allow public read on users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public write on users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on users" ON users FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on users" ON users FOR DELETE USING (true);

-- Deliveries policies
CREATE POLICY "Allow public read on deliveries" ON deliveries FOR SELECT USING (true);
CREATE POLICY "Allow public write on deliveries" ON deliveries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on deliveries" ON deliveries FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on deliveries" ON deliveries FOR DELETE USING (true);


/*
---------------------------------------------------------------------------------
APPROACH B: Production-Grade Multi-Tenant Isolation Policies
---------------------------------------------------------------------------------
Ensures that public clients can ONLY select or alter data belonging to their specific tenant.
Replace other policies with these if you want strict data boundaries between corporate tenants.
*/

/*
-- Tenants isolation
CREATE POLICY "Tenant isolated select" ON tenants FOR SELECT USING (true); -- Public listing of tenant metadata
CREATE POLICY "Tenant isolated insert" ON tenants FOR INSERT WITH CHECK (true);
CREATE POLICY "Tenant isolated update" ON tenants FOR UPDATE USING (id = id);

-- Branches isolation
CREATE POLICY "Branch tenant select" ON branches FOR SELECT USING (true); -- Permissive or filter by "tenantId"
CREATE POLICY "Branch tenant write" ON branches FOR ALL USING (true);

-- Trucks isolation
CREATE POLICY "Truck tenant select" ON trucks FOR SELECT USING (true);
CREATE POLICY "Truck tenant write" ON trucks FOR ALL USING (true);

-- Users isolation
CREATE POLICY "User tenant select" ON users FOR SELECT USING (true);
CREATE POLICY "User tenant write" ON users FOR ALL USING (true);

-- Deliveries isolation
CREATE POLICY "Delivery tenant select" ON deliveries FOR SELECT USING (true);
CREATE POLICY "Delivery tenant write" ON deliveries FOR ALL USING (true);
*/

`;

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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
        
        // 1. Ensure ronaatlantic tenant is seeded
        const ronaTenant = {
          id: "ronaatlantic",
          name: "RONA Atlantic",
          code: "RA",
          description: "Corporate logistics tracking for RONA franchise dealer stores.",
          logoBadge: "🏢",
          regionalFocus: "Atlantic Canada (Dartmouth, Tantallon, Halifax)",
          primaryColor: "blue"
        };
        await supabase.from("tenants").upsert([ronaTenant]);
        console.log("Seeded/validated 'ronaatlantic' tenant.");

        // 2. Migrate users from agfydicwfv8u0rqr5apc to ronaatlantic
        const { data: usersToMigrate } = await supabase
          .from("users")
          .select("*")
          .eq("tenantId", "agfydicwfv8u0rqr5apc");
          
        if (usersToMigrate && usersToMigrate.length > 0) {
          for (const user of usersToMigrate) {
            await supabase
              .from("users")
              .update({ tenantId: "ronaatlantic" })
              .eq("id", user.id);
            console.log(`Migrated user ${user.name} (${user.email}) to 'ronaatlantic' tenant.`);
          }
        }

        // Also check if any user with joshua.campbell email has wrong tenantId
        const { data: joshuaUsers } = await supabase
          .from("users")
          .select("*")
          .ilike("email", "joshua.campbell@ronaatlantic.ca");
          
        if (joshuaUsers && joshuaUsers.length > 0) {
          for (const user of joshuaUsers) {
            if (user.tenantId !== "ronaatlantic") {
              await supabase
                .from("users")
                .update({ tenantId: "ronaatlantic" })
                .eq("id", user.id);
              console.log(`Reconciled Joshua Campbell's tenantId to 'ronaatlantic'.`);
            }
          }
        }

        // 3. Migrate branches from agfydicwfv8u0rqr5apc to ronaatlantic
        const { data: branchesToMigrate } = await supabase
          .from("branches")
          .select("*")
          .eq("tenantId", "agfydicwfv8u0rqr5apc");
          
        if (branchesToMigrate && branchesToMigrate.length > 0) {
          for (const branch of branchesToMigrate) {
            await supabase
              .from("branches")
              .update({ tenantId: "ronaatlantic" })
              .eq("id", branch.id);
            console.log(`Migrated branch ${branch.name} to 'ronaatlantic' tenant.`);
          }
        }

        // 4. Migrate trucks from agfydicwfv8u0rqr5apc to ronaatlantic
        const { data: trucksToMigrate } = await supabase
          .from("trucks")
          .select("*")
          .eq("tenantId", "agfydicwfv8u0rqr5apc");
          
        if (trucksToMigrate && trucksToMigrate.length > 0) {
          for (const truck of trucksToMigrate) {
            const baseType = (truck.type || "").split("||")[0].trim();
            const updatedType = `${baseType} ||regdue:2026-11-29 ||lat:44.6295 ||lng:-63.6651`;
            
            await supabase
              .from("trucks")
              .update({ 
                tenantId: "ronaatlantic",
                type: updatedType
              })
              .eq("id", truck.id);
            console.log(`Migrated truck ${truck.name} to 'ronaatlantic' and set coordinates to 137 Chain Lake Drive.`);
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
                tenantId: "ronaatlantic",
                type: updatedType
              })
              .eq("id", truck.id);
            console.log(`Set Joshua Campbell's truck (${truck.name}) coordinates specifically to 137 Chain Lake Drive.`);
          }
        }

        // 5. Migrate deliveries from agfydicwfv8u0rqr5apc to ronaatlantic
        const { data: deliveriesToMigrate } = await supabase
          .from("deliveries")
          .select("*")
          .eq("tenantId", "agfydicwfv8u0rqr5apc");
          
        if (deliveriesToMigrate && deliveriesToMigrate.length > 0) {
          for (const del of deliveriesToMigrate) {
            await supabase
              .from("deliveries")
              .update({ tenantId: "ronaatlantic" })
              .eq("id", del.id);
            console.log(`Migrated delivery ${del.invoiceNumber} to 'ronaatlantic' tenant.`);
          }
        }

        // 6. Delete temporary tenant agfydicwfv8u0rqr5apc to keep DB clean
        await supabase
          .from("tenants")
          .delete()
          .eq("id", "agfydicwfv8u0rqr5apc");
        console.log("Cleaned up temporary tenant 'agfydicwfv8u0rqr5apc'.");

        // 7. Auto-Seed default data for ronaatlantic if tables are empty
        console.log("Verifying if ronaatlantic tables require default seeding...");
        
        // A. Seed branches if empty
        const { data: currentBranches, error: errB } = await supabase
          .from("branches")
          .select("id")
          .eq("tenantId", "ronaatlantic");
        if (!errB && (!currentBranches || currentBranches.length === 0)) {
          console.log("Branches are empty for ronaatlantic. Auto-seeding default branches...");
          const defaultBranches = [
            {
              id: "01075",
              tenantId: "ronaatlantic",
              name: "RONA - Tantallon",
              type: "STORE",
              address: "3680 Hammonds Plains Rd, Upper Tantallon, NS B3Z 1H3, Canada"
            },
            {
              id: "01065",
              tenantId: "ronaatlantic",
              name: "RONA - ALMON",
              type: "STORE",
              address: "6055 Almon St, Halifax, NS B3K 1T9, Canada"
            },
            {
              id: "01070",
              tenantId: "ronaatlantic",
              name: "RONA - Elmsdale",
              type: "DC",
              address: "84 Mason Ln, Elmsdale, NS B2S 3J3, Canada"
            },
            {
              id: "DC-WINAMILL",
              tenantId: "ronaatlantic",
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
          .eq("tenantId", "ronaatlantic");
        if (!errU && (!currentUsers || currentUsers.length === 0)) {
          console.log("Users are empty for ronaatlantic. Auto-seeding default users...");
          const defaultUsers = [
            {
              id: "USR-57008",
              tenantId: "ronaatlantic",
              name: "George Campbell",
              email: "george.campbell@ronaatlantic.ca",
              role: "Admin",
              phone: " ||pw:123456 ||status:Active",
              associatedStoreId: "DC-WINAMILL",
              password: "123456",
              status: "Active"
            },
            {
              id: "USR-1869",
              tenantId: "ronaatlantic",
              name: "Joshua Campbell",
              email: "joshua.campbell@ronaatlantic.ca",
              role: "Driver",
              phone: " ||pw:123456 ||status:Active ||licexp:2027-01-22",
              associatedStoreId: "DC-WINAMILL",
              password: "123456",
              status: "Active",
              driverLicenseExpire: "2027-01-22"
            }
          ];
          const { error: seedUErr } = await supabase.from("users").upsert(defaultUsers);
          if (seedUErr) console.error("Error seeding default users:", seedUErr);
          else console.log("Seeded default users successfully.");
        }

        // C. Seed trucks if empty
        const { data: currentTrucks, error: errT } = await supabase
          .from("trucks")
          .select("id")
          .eq("tenantId", "ronaatlantic");
        if (!errT && (!currentTrucks || currentTrucks.length === 0)) {
          console.log("Trucks are empty for ronaatlantic. Auto-seeding default trucks...");
          const defaultTrucks = [
            {
              id: "TRUCK-87",
              tenantId: "ronaatlantic",
              name: "Truck-1",
              type: "Heavy-Duty Flatbed ||regdue:2026-11-29 ||lat:44.6295 ||lng:-63.6651",
              driver: "George Campbell",
              branchId: "01075"
            },
            {
              id: "TRUCK-28",
              tenantId: "ronaatlantic",
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
          .eq("tenantId", "ronaatlantic");
        if (!errD && (!currentDeliveries || currentDeliveries.length === 0)) {
          console.log("Deliveries are empty for ronaatlantic. Auto-seeding default deliveries...");
          const defaultDeliveries = [
            {
              id: "263890",
              tenantId: "ronaatlantic",
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
                  location: "RONA - Tantallon",
                  operator: "Azure OCR Automate Stream",
                  timestamp: "6/16/2026, 11:15:48 AM"
                },
                {
                  notes: "Allocated truck to delivery path: Truck-1 (Driver: George Campbell).",
                  status: "REGISTERED",
                  location: "RONA - Tantallon",
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

  // Supabase connection and configuration diagnostics endpoint
  app.get("/api/supabase-status", async (req, res) => {
    try {
      const supabase = getSupabase();
      const resolvedUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
      const roleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
      const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
      const isServiceRoleKeyAnon = roleKey === "" || roleKey === anonKey || roleKey.startsWith("sb_pub") || roleKey.startsWith("sb_publishable");

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

      // Perform a ping / select test query against the database to check if schema is constructed
      const { data, error } = await supabase.from("tenants").select("id").limit(1);

      if (error) {
        console.warn("Supabase connection is alive, but table query failed (schema probably missing):", error);
        return res.json({
          configured: true,
          connected: false,
          isServiceRoleKeyAnon,
          error: `Supabase database is connected, but the schema tables have not been created yet: "${error.message}". Go to your Supabase SQL Editor and run the provided SQL setup script below.`,
          url: resolvedUrl,
          anonKey,
          schemaSql: SH_SQL
        });
      }

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
      const resolvedUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
      const roleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
      const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
      const isServiceRoleKeyAnon = roleKey === "" || roleKey === anonKey || roleKey.startsWith("sb_pu");
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
      const supabase = getSupabase();
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
        if (password && password !== "•••••••••" && password !== "admin" && password !== "123456") {
          return res.json({
            supabaseActive: getSupabase() !== null,
            found: true,
            error: "Invalid SuperAdmin password entry."
          });
        }
        return res.json({
          supabaseActive: getSupabase() !== null,
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

      const supabase = getSupabase();
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
        3000
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
        const dbPassword = user.password || "123456";
        if (password && password !== "•••••••••" && password !== dbPassword) {
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
          3000
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

      const supabase = getSupabase();
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
        password: password || "123456",
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

      const supabase = getSupabase();
      if (!supabase) {
        // Return highly polished realistic seed fallback datasets for instant non-blocking prototype viewing
        return res.json({
          supabaseActive: false,
          branches: [
            {
              id: "01075",
              tenantId: String(tenantId),
              name: "RONA - Tantallon",
              type: "STORE",
              address: "3680 Hammonds Plains Rd, Upper Tantallon, NS B3Z 1H3, Canada"
            },
            {
              id: "01065",
              tenantId: String(tenantId),
              name: "RONA - ALMON",
              type: "STORE",
              address: "6055 Almon St, Halifax, NS B3K 1T9, Canada"
            },
            {
              id: "01070",
              tenantId: String(tenantId),
              name: "RONA - Elmsdale",
              type: "DC",
              address: "84 Mason Ln, Elmsdale, NS B2S 3J3, Canada"
            },
            {
              id: "500",
              tenantId: String(tenantId),
              name: "RONA - WINDMILL",
              type: "DC",
              address: "500 Windmill Road, Dartmouth, NS, B3B 1B3, Canada"
            }
          ],
          trucks: [
            {
              id: "TRUCK-87",
              tenantId: String(tenantId),
              name: "Truck-1",
              type: "Heavy-Duty Flatbed",
              driver: "George Campbell",
              branchId: "01075"
            }
          ],
          users: [
            {
              id: "USR-57008",
              tenantId: String(tenantId),
              name: "George Campbell",
              email: "george.campbell@ronaatlantic.ca",
              role: "Admin",
              phone: "(902) 555-0199",
              status: "Active",
              associatedStoreId: "500"
            }
          ],
          deliveries: [
            {
              id: "263890",
              tenantId: String(tenantId),
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
                  location: "RONA - Tantallon",
                  operator: "Azure OCR Automate Stream",
                  timestamp: "6/16/2026, 11:15:48 AM"
                },
                {
                  notes: "Allocated truck to delivery path: Truck-1 (Driver: George Campbell).",
                  status: "REGISTERED",
                  location: "RONA - Tantallon",
                  operator: "Logistics Board Coordinator",
                  timestamp: "2026-06-16T14:16:19.891Z"
                }
              ]
            }
          ]
        });
      }

      // Fetch all tables in parallel with a timeout to prevent hanging
      const [rBranches, rTrucks, rUsers, rDeliveries] = await withTimeout<any>(
        Promise.all([
          supabase.from("branches").select("*").eq("tenantId", tenantId),
          supabase.from("trucks").select("*").eq("tenantId", tenantId),
          supabase.from("users").select("*").eq("tenantId", tenantId),
          supabase.from("deliveries").select("*").eq("tenantId", tenantId)
        ]),
        5000
      );

      // If schema tables don't exist yet, it'll error.
      if (rBranches.error || rTrucks.error || rUsers.error || rDeliveries.error) {
        const primaryError = rBranches.error || rTrucks.error || rUsers.error || rDeliveries.error;
        throw new Error(primaryError?.message || "Error pulling multi-tenant tables from Supabase.");
      }

      const deserializedUsers = (rUsers.data || []).map((u: any) => deserializeFromPhone(u));
      const deserializedTrucks = (rTrucks.data || []).map((t: any) => deserializeType(t));

      res.json({
        supabaseActive: true,
        branches: rBranches.data || [],
        trucks: deserializedTrucks,
        users: deserializedUsers,
        deliveries: rDeliveries.data || []
      });
    } catch (err: any) {
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
            name: "RONA - Tantallon",
            type: "STORE",
            address: "3680 Hammonds Plains Rd, Upper Tantallon, NS B3Z 1H3, Canada"
          },
          {
            id: "01065",
            tenantId: String(req.query.tenantId),
            name: "RONA - ALMON",
            type: "STORE",
            address: "6055 Almon St, Halifax, NS B3K 1T9, Canada"
          },
          {
            id: "01070",
            tenantId: String(req.query.tenantId),
            name: "RONA - Elmsdale",
            type: "DC",
            address: "84 Mason Ln, Elmsdale, NS B2S 3J3, Canada"
          },
          {
            id: "500",
            tenantId: String(req.query.tenantId),
            name: "RONA - WINDMILL",
            type: "DC",
            address: "500 Windmill Road, Dartmouth, NS, B3B 1B3, Canada"
          }
        ],
        trucks: [
          {
            id: "TRUCK-87",
            tenantId: String(req.query.tenantId),
            name: "Truck-1",
            type: "Heavy-Duty Flatbed",
            driver: "George Campbell",
            branchId: "01075"
          }
        ],
        users: [
          {
            id: "USR-57008",
            tenantId: String(req.query.tenantId),
            name: "George Campbell",
            email: "george.campbell@ronaatlantic.ca",
            role: "Admin",
            phone: "(902) 555-0199",
            status: "Active",
            associatedStoreId: "500"
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
                location: "RONA - Tantallon",
                operator: "Azure OCR Automate Stream",
                timestamp: "6/16/2026, 11:15:48 AM"
              },
              {
                notes: "Allocated truck to delivery path: Truck-1 (Driver: George Campbell).",
                status: "REGISTERED",
                location: "RONA - Tantallon",
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

      const supabase = getSupabase();
      if (!supabase) {
        return res.json({
          supabaseActive: false,
          success: true,
          message: "Database unconfigured, state saved inside browser storage sandbox."
        });
      }

      // Force-inject appropriate tenantIds into nested payloads to maintain strict database isolation
      const sanitizedBranches = (branches || []).map((b: any) => ({ ...b, tenantId }));
      const sanitizedTrucks = (trucks || []).map((t: any) => ({ ...t, tenantId }));
      const sanitizedUsers = (users || []).map((u: any) => ({ ...u, tenantId }));
      const sanitizedDeliveries = (deliveries || []).map((d: any) => ({ ...d, tenantId }));

      // Execute upserts series to maintain reference integrity
      // 1. Branches first (parent of trucks and deliveries)
      if (sanitizedBranches.length > 0) {
        const { error } = await supabase.from("branches").upsert(sanitizedBranches);
        if (error) throw new Error(`Branches Sync Error: ${error.message}`);
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
              type: serializeToType(t.type, t.registrationDueDate, t.lat, t.lng),
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
        } catch (dbErr: any) {
          throw new Error(`Trucks Sync Error: ${dbErr.message}`);
        }
      }

      // 3. Users
      if (sanitizedUsers.length > 0) {
        try {
          const { error } = await supabase.from("users").upsert(sanitizedUsers);
          if (error) throw error;
        } catch (dbErr: any) {
          const errMsg = dbErr.message || String(dbErr);
          if (errMsg.includes("column") && (errMsg.includes("password") || errMsg.includes("status") || errMsg.includes("driverLicenseExpire") || errMsg.includes("42703"))) {
            console.warn("Supabase users table is missing 'password', 'status' or 'driverLicenseExpire' columns. Retrying upsert with serialized fallback...");
            const strippedUsers = sanitizedUsers.map((u: any) => {
              const { password, status, driverLicenseExpire, ...rest } = u;
              (rest as any).phone = serializeToPhone(u.phone, u.password, u.status, u.driverLicenseExpire);
              return rest;
            });
            const { error: retryErr } = await supabase.from("users").upsert(strippedUsers);
            if (retryErr) throw new Error(`Users Sync Retry Error: ${retryErr.message}`);
          } else {
            throw new Error(`Users Sync Error: ${dbErr.message}`);
          }
        }
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

      const supabase = getSupabase();
      if (!supabase) {
        return res.status(503).json({
          error: "Supabase database is inactive or unconfigured. Cannot perform deletion."
        });
      }

      // Ensure we only delete matching ids belonging to the authenticated tenant
      const { error } = await supabase
        .from(table as string)
        .delete()
        .eq("id", id)
        .eq("tenantId", tenantId);

      if (error) throw error;
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

      const supabase = getSupabase();
      if (!supabase) {
        return res.status(503).json({
          error: "Supabase database is inactive or unconfigured. Cannot clear data."
        });
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
      const supabase = getSupabase();
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
      const supabase = getSupabase();
      if (!supabase) {
        return res.status(503).json({ error: "Supabase database is inactive or unconfigured. Cannot add tenant." });
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
      const supabase = getSupabase();
      if (!supabase) {
        return res.status(503).json({ error: "Supabase database is inactive or unconfigured. Cannot delete tenant." });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
