import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { pedido_id, items, customer } = await req.json();

    if (!pedido_id || !items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'pedido_id and items are required' }), { status: 400, headers: corsHeaders });
    }

    const handle = Deno.env.get('INFINITEPAY_HANDLE');
    if (!handle) {
      return new Response(JSON.stringify({ error: 'INFINITEPAY_HANDLE not configured' }), { status: 500, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const webhookUrl = `${supabaseUrl}/functions/v1/infinitepay-webhook`;

    const payload: Record<string, unknown> = {
      handle,
      order_nsu: pedido_id,
      items: items.map((item: { description: string; quantity: number; price: number }) => ({
        description: item.description,
        quantity: item.quantity,
        price: item.price, // already in cents
      })),
      webhook_url: webhookUrl,
    };

    if (customer) {
      const customerData: Record<string, string> = {};
      if (customer.name) customerData.name = customer.name;
      if (customer.phone_number) customerData.phone_number = customer.phone_number;
      payload.customer = customerData;
    }

    console.log('Creating InfinitePay link with payload:', JSON.stringify(payload));

    const response = await fetch('https://api.infinitepay.io/invoices/public/checkout/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('InfinitePay response status:', response.status, 'body:', responseText);

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Failed to create InfinitePay link', details: responseText }), {
        status: response.status,
        headers: corsHeaders,
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    // Save the link to the pedido using service role
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const link = data.checkout_url || data.url || data.link || '';
    if (link) {
      await serviceClient
        .from('pedidos')
        .update({ infinitepay_link: link })
        .eq('id', pedido_id);
    }

    return new Response(JSON.stringify({ link, data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating InfinitePay link:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
