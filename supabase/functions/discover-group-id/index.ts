import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Em webhooks da Z-API, o ID do grupo host ou celular costuma vir no 'phone'
    // E o remetente da mensagem no evento de grupo costuma vir no 'participantPhone'
    const groupHost = body?.phone || "Private/Desconhecido";
    const sender = body?.participantPhone || body?.author || "Desconhecido";

    console.log("=== DESCOBERTA DE GRUPO WHATSAPP ===");
    console.log("ID do Grupo/Conversa (phone):", groupHost);
    console.log("Remetente (participantPhone):", sender);
    console.log("Payload Completo recebido:", JSON.stringify(body, null, 2));
    console.log("====================================");

    return new Response(JSON.stringify({ 
      ok: true, 
      message: "Grupo descoberto! Verifique os logs do Supabase.",
      descobriu_grupo_id: groupHost,
      remetente: sender
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Erro interno Webhook (discover-group-id):", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
