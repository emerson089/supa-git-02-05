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
    // Validar autenticação do usuário
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

    // Verificar se é admin
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Apenas admin pode configurar Z-API" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const zapiToken = Deno.env.get("ZAPI_TOKEN");
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

    if (!instanceId || !zapiToken || !clientToken) {
      return new Response(
        JSON.stringify({ error: "Credenciais Z-API não configuradas" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Endpoint Z-API para atualizar configurações do webhook (notifyReceivedGroups)
    const url = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/update-every-webhook`;
    const projectUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${projectUrl}/functions/v1/webhook-comprovantes`;

    const payload = {
      value: webhookUrl,
      enabled: true,
      notifySentByMe: true,
    };

    const zapiResponse = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await zapiResponse.text();
    let zapiData: unknown;
    try {
      zapiData = JSON.parse(responseText);
    } catch {
      zapiData = responseText;
    }

    if (!zapiResponse.ok) {
      console.error("Z-API update-every-webhook failed:", zapiResponse.status, zapiData);
      return new Response(
        JSON.stringify({
          error: "Falha ao configurar Z-API",
          status: zapiResponse.status,
          details: zapiData,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Tentar também o endpoint específico de notificação de grupos (algumas instâncias têm)
    const groupNotifUrl = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/update-webhook-received-group`;
    let groupConfigResult: unknown = null;
    try {
      const groupRes = await fetch(groupNotifUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": clientToken,
        },
        body: JSON.stringify({
          value: webhookUrl,
        }),
      });
      const groupText = await groupRes.text();
      try {
        groupConfigResult = JSON.parse(groupText);
      } catch {
        groupConfigResult = groupText;
      }
    } catch (e) {
      console.warn("Group webhook endpoint failed (pode não existir nessa versão da Z-API)", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        webhook_url: webhookUrl,
        every_webhook_response: zapiData,
        group_webhook_response: groupConfigResult,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("zapi-config-grupos error:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
