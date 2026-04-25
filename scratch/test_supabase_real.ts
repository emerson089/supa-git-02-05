
import { createClient } from '@supabase/supabase-js';

// Get keys from .env.local
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const STATUS_CANCELADOS = ["CANCELADO", "GOLPE CANCELADO", "GOLPE"];

async function test() {
  console.log("Testing query 1 (with quotes)...");
  const q1 = await supabase.from('pedido_itens').select('pedido_id').not('pedidos.status_pedido', 'in', `(${STATUS_CANCELADOS.map(s => `"${s}"`).join(',')})`).limit(1);
  console.log("Q1 Error:", q1.error?.message);

  console.log("Testing query 2 (without quotes)...");
  const q2 = await supabase.from('pedido_itens').select('pedido_id').not('pedidos.status_pedido', 'in', `(${STATUS_CANCELADOS.join(',')})`).limit(1);
  console.log("Q2 Error:", q2.error?.message);

  console.log("Testing query 3 (array)...");
  const q3 = await supabase.from('pedido_itens').select('pedido_id').not('pedidos.status_pedido', 'in', STATUS_CANCELADOS).limit(1);
  console.log("Q3 Error:", q3.error?.message);
}

test();
