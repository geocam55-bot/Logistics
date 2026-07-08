import { createClient } from "@supabase/supabase-js";
import { deserializeType } from "./src/lib/supabaseClient.ts";
const FALLBACK_SUPABASE_URL = "https://anqyjkjlzniruisqwthl.supabase.co";
const FALLBACK_SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFucXlqa2psem5pcnVpc3F3dGhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTM0MDcxOCwiZXhwIjoyMDk2OTE2NzE4fQ.AyJCnr4DR4_5XRxUpxwFN1cdcFm1XLe7jYE2bom1fLw";
const supabase = createClient(FALLBACK_SUPABASE_URL, FALLBACK_SUPABASE_SERVICE_ROLE_KEY);
async function check() {
  const { data } = await supabase.from('trucks').select('*');
  const d = data.map(deserializeType);
  console.log(d.map(t => ({ id: t.name, lat: t.gpsLat, lng: t.gpsLng, source: t.gpsSource })));
}
check();
