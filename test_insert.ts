import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data, error } = await supabase.from('deliveries').upsert({
    id: 'test-123',
    tenantId: 'test-tenant',
    invoiceNumber: '1',
    epicorSalesOrder: '1',
    status: 'PICKED_AND_LOADED',
    assignedPicker: 'George'
  });
  console.log("Error:", error);
}
run();
