import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse and validate body
    const body = await req.json();
    const { phone, message, type = 'text', documentUrl, fileName, caption } = body;

    if (!phone || typeof phone !== "string" || phone.length < 12 || phone.length > 13) {
      return new Response(JSON.stringify({ error: "Telefone inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === 'text') {
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return new Response(JSON.stringify({ error: "Mensagem não pode estar vazia" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (type === 'document') {
      if (!documentUrl || typeof documentUrl !== "string" || documentUrl.trim().length === 0) {
        return new Response(JSON.stringify({ error: "URL do documento não informada" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "Tipo de mensagem inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Z-API
    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const zapiToken = Deno.env.get("ZAPI_TOKEN");
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

    if (!instanceId || !zapiToken || !clientToken) {
      console.error("Missing Z-API env vars:", { hasInstanceId: !!instanceId, hasToken: !!zapiToken, hasClientToken: !!clientToken });
      return new Response(JSON.stringify({ error: "Credenciais Z-API não configuradas" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/send-text`;
    let requestBody: any = { phone, message };

    if (type === 'document') {
      zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/send-document/pdf`;
      requestBody = {
        phone,
        document: documentUrl,
        extension: ".pdf",
        fileName: fileName || "catalogo.pdf",
        caption: caption || message || ""
      };
    }

    const zapiResponse = await fetch(zapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify(requestBody),
    });

    const zapiData = await zapiResponse.json();

    if (!zapiResponse.ok) {
      console.error("Z-API error:", zapiData);
      return new Response(
        JSON.stringify({ error: "Erro ao enviar mensagem", details: zapiData }),
        {
          status: zapiResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ success: true, data: zapiData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-whatsapp error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao enviar mensagem" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
