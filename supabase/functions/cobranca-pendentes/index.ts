import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Templates padrão (fallback se não houver template salvo no banco)
const TEMPLATES_PADRAO: Record<number, string> = {
  1: `Oi, [Nome]! 😊

Passando para avisar que seu pedido na *Delooki Jeans* está aguardando o pagamento no valor de *R$ [Valor]*.

O pagamento é necessário para separar seu pedido e garantir que tudo fique reservado pra você! 🥰

O prazo é até amanhã *(quinta-feira)*. Qualquer dúvida é só chamar!`,

  2: `Olá, [Nome]! 😊

Lembrando que *hoje é o último dia* para confirmar o pagamento do seu pedido de *R$ [Valor]*.

Precisamos do pagamento para separar tudo certinho pra você! 🥰

Qualquer dúvida, estamos aqui!`,

  3: `Oi, [Nome]! 🥰

Ainda não identificamos o pagamento do seu pedido de *R$ [Valor]*. O prazo encerra *hoje*!

Confirme o pagamento para garantirmos a separação do seu pedido — não queremos que você perca 😊

Qualquer dúvida, é só falar com a gente!`,
};

function normalizarTelefone(telefone: string): string | null {
  const digits = telefone.replace(/\D/g, "");
  if (digits.length === 13) return digits; // 55 + DDD + 9 dígitos
  if (digits.length === 12) return digits; // 55 + DDD + 8 dígitos
  if (digits.length === 11) return "55" + digits; // DDD + 9 dígitos
  if (digits.length === 10) return "55" + digits; // DDD + 8 dígitos
  return null;
}

function formatarValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function inicioSemanaAtual(): string {
  // Retorna segunda-feira desta semana às 00:00 UTC-3 (BRT)
  const agora = new Date();
  // Ajusta para BRT (UTC-3)
  const brt = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  const diaSemana = brt.getUTCDay(); // 0=dom, 1=seg, ..., 6=sab
  const diasDesdeSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
  const segunda = new Date(brt);
  segunda.setUTCDate(brt.getUTCDate() - diasDesdeSegunda);
  segunda.setUTCHours(3, 0, 0, 0); // 00:00 BRT = 03:00 UTC
  return segunda.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const zapiInstanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const zapiToken = Deno.env.get("ZAPI_TOKEN");
    const zapiClientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

    if (!zapiInstanceId || !zapiToken || !zapiClientToken) {
      return new Response(JSON.stringify({ error: "Credenciais Z-API não configuradas" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const tentativa = Number(body?.tentativa);

    if (![1, 2, 3].includes(tentativa)) {
      return new Response(JSON.stringify({ error: "tentativa deve ser 1, 2 ou 3" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Buscar template personalizado (qualquer user_id — único por instância Z-API)
    const { data: templateRow } = await db
      .from("templates_cobranca")
      .select("mensagem")
      .eq("tentativa", tentativa)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();

    const templateBase = templateRow?.mensagem ?? TEMPLATES_PADRAO[tentativa];
    const inicioDaSemana = inicioSemanaAtual();

    // Buscar pedidos PENDENTE desta semana que não foram excluídos e ainda não receberam esta tentativa
    const { data: pedidos, error: pedidosError } = await db
      .from("pedidos")
      .select(`
        id,
        cliente_nome,
        telefone,
        valor_total,
        excluir_cobranca_automatica,
        cliente_id,
        clientes!left(excluir_cobranca_automatica)
      `)
      .eq("status_pagamento", "PENDENTE")
      .gte("created_at", inicioDaSemana)
      .eq("excluir_cobranca_automatica", false)
      .neq("telefone", "")
      .not("telefone", "is", null);

    if (pedidosError) {
      console.error("Erro ao buscar pedidos:", pedidosError);
      return new Response(JSON.stringify({ error: "Erro ao buscar pedidos", details: pedidosError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pedidos || pedidos.length === 0) {
      return new Response(JSON.stringify({ total: 0, enviados: 0, falhas: 0, mensagem: "Nenhum pedido pendente encontrado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filtrar clientes com exclusão ativa
    const pedidosFiltrados = pedidos.filter((p: any) => {
      const clienteExcluido = p.clientes?.excluir_cobranca_automatica === true;
      return !clienteExcluido;
    });

    // Buscar quais pedidos já receberam esta tentativa
    const pedidoIds = pedidosFiltrados.map((p: any) => p.id);
    const { data: jaEnviados } = await db
      .from("cobrancas_enviadas")
      .select("pedido_id")
      .in("pedido_id", pedidoIds)
      .eq("tentativa", tentativa);

    const idsJaEnviados = new Set((jaEnviados ?? []).map((r: any) => r.pedido_id));
    const pedidosParaEnviar = pedidosFiltrados.filter((p: any) => !idsJaEnviados.has(p.id));

    let enviados = 0;
    let falhas = 0;

    for (const pedido of pedidosParaEnviar) {
      const telefone = normalizarTelefone(pedido.telefone ?? "");
      if (!telefone) {
        falhas++;
        await db.from("cobrancas_enviadas").insert({
          pedido_id: pedido.id,
          cliente_nome: pedido.cliente_nome,
          telefone: pedido.telefone ?? "",
          tentativa,
          valor_total: pedido.valor_total ?? 0,
          mensagem: "",
          status: "falhou",
          erro: "Telefone inválido",
        });
        continue;
      }

      const primeiroNome = (pedido.cliente_nome ?? "").split(" ")[0];
      const valorFormatado = formatarValor(Number(pedido.valor_total ?? 0));
      const mensagem = templateBase
        .replace(/\[Nome\]/g, primeiroNome)
        .replace(/\[Valor\]/g, valorFormatado);

      // Enviar via Z-API
      let sucesso = false;
      let erroMsg = "";

      try {
        const zapiRes = await fetch(
          `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Client-Token": zapiClientToken,
            },
            body: JSON.stringify({ phone: telefone, message: mensagem }),
          }
        );

        if (zapiRes.ok) {
          sucesso = true;
          enviados++;
        } else {
          const errData = await zapiRes.json().catch(() => ({}));
          erroMsg = JSON.stringify(errData);
          falhas++;
        }
      } catch (e: any) {
        erroMsg = e?.message ?? "Erro desconhecido";
        falhas++;
      }

      // Registrar na tabela de histórico
      await db.from("cobrancas_enviadas").insert({
        pedido_id: pedido.id,
        cliente_nome: pedido.cliente_nome,
        telefone,
        tentativa,
        valor_total: pedido.valor_total ?? 0,
        mensagem,
        status: sucesso ? "enviado" : "falhou",
        erro: sucesso ? null : erroMsg,
      });

      // Pausa de 2s entre envios para não sobrecarregar o Z-API
      if (pedidosParaEnviar.indexOf(pedido) < pedidosParaEnviar.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    console.log(`Cobrança tentativa ${tentativa}: ${enviados} enviados, ${falhas} falhas, ${idsJaEnviados.size} já enviados anteriormente`);

    return new Response(
      JSON.stringify({
        tentativa,
        total: pedidosParaEnviar.length,
        enviados,
        falhas,
        ja_enviados_anteriormente: idsJaEnviados.size,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("cobranca-pendentes error:", error);
    return new Response(JSON.stringify({ error: "Erro interno", details: error?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
