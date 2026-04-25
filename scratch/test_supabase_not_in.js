
import { createClient } from '@supabase/supabase-js';

// Initialize a dummy client just to see how it builds the URL
const supabaseUrl = 'https://xyzcompany.supabase.co';
const supabaseKey = 'public-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

const STATUS_CANCELADOS = ["Cancelado", "Estornado"];

let query1 = supabase.from('pedido_itens').select('*').not('pedidos.status_pedido', 'in', `(${STATUS_CANCELADOS.map(s => `"${s}"`).join(',')})`);
console.log(query1.url.toString());

let query2 = supabase.from('pedido_itens').select('*').not('pedidos.status_pedido', 'in', `(${STATUS_CANCELADOS.join(',')})`);
console.log(query2.url.toString());

let query3 = supabase.from('pedido_itens').select('*').not('pedidos.status_pedido', 'in', STATUS_CANCELADOS);
console.log(query3.url.toString());
