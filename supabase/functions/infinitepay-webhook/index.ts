import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('InfinitePay webhook received:', JSON.stringify(body));

    const { order_nsu, paid_amount, capture_method, transaction_nsu, receipt_url } = body;

    if (!order_nsu) {
      console.error('Webhook missing order_nsu');
      return new Response(JSON.stringify({ error: 'order_nsu required' }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if order exists and isn't already paid (idempotency)
    const { data: pedido, error: fetchError } = await supabase
      .from('pedidos')
      .select('id, status_pagamento')
      .eq('id', order_nsu)
      .maybeSingle();

    if (fetchError || !pedido) {
      console.error('Order not found:', order_nsu, fetchError);
      return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: corsHeaders });
    }

    if (pedido.status_pagamento === 'PAGO') {
      console.log('Order already paid, skipping:', order_nsu);
      return new Response(JSON.stringify({ ok: true, message: 'Already paid' }), { status: 200, headers: corsHeaders });
    }

    // Update payment status
    const updateData: Record<string, unknown> = {
      status_pagamento: 'PAGO',
      forma_pagamento: capture_method === 'pix' ? 'PIX' : capture_method === 'credit' ? 'CARTÃO CRÉDITO' : capture_method === 'debit' ? 'CARTÃO DÉBITO' : (capture_method || 'INFINITEPAY').toUpperCase(),
    };

    if (transaction_nsu) {
      updateData.infinitepay_nsu = transaction_nsu;
    }

    const { error: updateError } = await supabase
      .from('pedidos')
      .update(updateData)
      .eq('id', order_nsu);

    if (updateError) {
      console.error('Error updating order:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update order' }), { status: 500, headers: corsHeaders });
    }

    console.log('Order updated successfully:', order_nsu, 'capture_method:', capture_method);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: corsHeaders });
  }
});
