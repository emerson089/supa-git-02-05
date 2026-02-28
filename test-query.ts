import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');
async function test() {
  const { data, error } = await supabase.from('transferencias').select('*, profiles(nome)').limit(1);
  console.log('Data:', data);
  console.log('Error:', error);
}
test();
