import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Supabase Lazy Initialization and shared server-side client
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

// Circuit Breaker for Supabase connections
let supabaseConsecutiveFailures = 0;
let supabaseTemporarilyDisabled = false;
let supabaseDisabledUntil = 0;

export function headerMiddleware(req: any, _res: any, next: any) {
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
}

export function setCustomSupabase(url: string, key: string) {
  customSupabaseUrl = (url || "").trim();
  customSupabaseKey = (key || "").trim();
  supabaseClient = null;
  supabaseConsecutiveFailures = 0;
  supabaseTemporarilyDisabled = false;
  supabaseDisabledUntil = 0;
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ url: customSupabaseUrl, key: customSupabaseKey }, null, 2), "utf8");
    console.log("Persisted custom Supabase credentials to supabase-config.json");
  } catch (writeErr) {
    console.error("Failed to persist custom Supabase credentials to file:", writeErr);
  }
}

export function getResolvedConfig() {
  const resolvedUrl = customSupabaseUrl || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const roleKey = customSupabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  const anonKey = customSupabaseKey || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
  return { resolvedUrl, roleKey, anonKey };
}

export function resetCircuitBreaker() {
  supabaseConsecutiveFailures = 0;
  supabaseTemporarilyDisabled = false;
  supabaseDisabledUntil = 0;
}

export function recordFailureAndMaybeDisable() {
  supabaseConsecutiveFailures++;
  if (supabaseConsecutiveFailures >= 2) {
    supabaseTemporarilyDisabled = true;
    supabaseDisabledUntil = Date.now() + 60000; // disable 60s
    console.warn(`[CIRCUIT BREAKER] Supabase disabled for 60 seconds due to consecutive connection test failures.`);
  }
}

export function getSupabase(reqOrBypass?: any, bypassCircuitBreaker: boolean = false) {
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
      supabaseTemporarilyDisabled = false;
      supabaseConsecutiveFailures = 0;
    }
  }

  // Resolve credentials dynamically from request headers if present and valid
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

  // Fall back to customSupabaseUrl / environment variables if no valid request headers
  if (!url || !key) {
    const u = (customSupabaseUrl || "").trim();
    const k = (customSupabaseKey || "").trim();
    if (u && k) {
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

  // Trim and strip surrounding quotes
  url = url.trim().replace(/^['"\\\'\\\"]+|['"\\\'\\\"]+$/g, '');
  key = key.trim().replace(/^['"\\\'\\\"]+|['"\\\'\\\"]+$/g, '');

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

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return null;
  }

  if (url !== lastSupabaseUrl || key !== (global as any).__LAST_SUPABASE_KEY) {
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
      (global as any).__LAST_SUPABASE_KEY = key;
    } catch (e) {
      console.error("Failed to initialize Supabase client:", e);
      return null;
    }
  }
  return supabaseClient;
}

export { isServiceRoleKey };

export function withTimeout(promise: Promise<any> | any, ms: number = 5000): Promise<any> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Database query timed out (exceeded ${ms}ms threshold)`));
    }, ms);
  });
  return Promise.race([
    Promise.resolve(promise).then((res) => {
      clearTimeout(timer);
      return res;
    }).catch(err => {
      clearTimeout(timer);
      throw err;
    }),
    timeoutPromise
  ]);
}

export function formatDatabaseError(err: any): string {
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
