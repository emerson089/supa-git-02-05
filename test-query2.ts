import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');
async function test() {
  const { data, error } = await supabase.from('transferencias').select('*, profiles!user_id(nome)').limit(1);
  console.log('Error with profiles!user_id(nome):', error);

  const { data: d2, error: e2 } = await supabase.from('transferencias').select('*, profiles(nome)').limit(1);
  console.log('Error with profiles(nome):', e2);
}
test();
