import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const groupHost = body?.phone || "Desconhecido";
    
    // Salvando em uma linha de log na tabela de comprovantes para eu conseguir ler daqui
    await supabase.from('comprovantes').insert({
      valor: 0,
      imagem_url: 'LOG_DESCOBERTA',
      status: 'pendente_revisao',
      grupo_whatsapp: groupHost,
      observacoes: `ID_DESCOBERTO: ${groupHost}`,
      numero_remetente: body?.participantPhone || body?.author || 'system'
    });

    console.log("ID descoberto e salvo:", groupHost);

    return new Response(JSON.stringify({ ok: true, id: groupHost }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
