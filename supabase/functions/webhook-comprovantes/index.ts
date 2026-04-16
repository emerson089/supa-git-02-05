import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Converte ArrayBuffer para string base64
function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Background Task Principal
async function processComprovante(imageUrl: string, remetente: string, grupo: string, fullBody: any) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // 1. Fazer o download da imagem da Z-API para poder enviar como Base64 (evita problemas de OpenAI bloqueada na Z-API)
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Falha ao baixar imagem: ${imageResponse.statusText}`);
    }
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64Image = arrayBufferToBase64(arrayBuffer);
    
    // 2. Chamar OpenAI GPT-4o
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) throw new Error("OPENAI_API_KEY não configurada");

    const promptText = `
Analise esta imagem de comprovante de pagamento bancário brasileiro. Extraia as seguintes informações e retorne APENAS um JSON válido sem markdown:
{
  "valor": (número decimal, ex: 150.50),
  "data_pagamento": (formato ISO 8601, ex: 2025-04-16T14:30:00),
  "nome_pagador": (nome completo de quem pagou),
  "banco_origem": (nome do banco),
  "tipo_pagamento": (PIX, TED, DOC, boleto ou outro),
  "chave_pix": (chave pix se visível, senão null),
  "observacoes": (qualquer informação relevante adicional),
  "id_transacao": (ID/codigo da transacao/autenticacao se houver, caso contraio null)
}
Se não conseguir identificar algum campo, use null.
    `;

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: promptText },
              { type: "image_url", image_url: { url: `data:${contentType};base64,${base64Image}` } }
            ]
          }
        ],
        max_tokens: 500
      })
    });

    if (!openAiResponse.ok) {
        throw new Error(`OpenAI Error: ${await openAiResponse.text()}`);
    }

    const aiData = await openAiResponse.json();
    let extrato;
    try {
      extrato = JSON.parse(aiData.choices[0].message.content);
    } catch(e) {
      throw new Error(`Falha ao fazer parse do JSON retornado pela IA`);
    }

    // 3. Verificação de Duplicidade (pela URL base ou ID da transação)
    // Extraindo da imagem_url um hash ou usando id_transacao da IA.
    const hasTransacaoId = !!extrato.id_transacao;
    if (hasTransacaoId) {
      // Checar ultimos 2 dias
      const dozeDiasAtras = new Date();
      dozeDiasAtras.setHours(dozeDiasAtras.getHours() - 48);

      const { data: duplicate } = await supabase
        .from('comprovantes')
        .select('id')
        .eq('dados_brutos->>id_transacao', extrato.id_transacao)
        .gte('created_at', dozeDiasAtras.toISOString())
        .limit(1)
        .maybeSingle();

      if (duplicate) {
        await enviarMensagemZApi(fullBody.phone, "⚠️ *Este comprovante já foi registrado anteriormente.*");
        return; // Puxamos o freio, comprovante ignorado
      }
    }

    // Verificar via URL duplicada (fallback de segurança)
    const urlHash = imageUrl.split('?')[0]; // Ignora tokens se existirem
    const { data: duplicateUrl } = await supabase
        .from('comprovantes')
        .select('id')
        .ilike('imagem_url', `${urlHash}%`)
        .limit(1)
        .maybeSingle();

    if (duplicateUrl) {
      await enviarMensagemZApi(fullBody.phone, "⚠️ *A imagem deste comprovante já consta no sistema.*");
      return; 
    }

    // 4. Inserção no Supabase
    // Regra da quarentena: se o "valor" for nulo ou invalido, marcamos como "pendente_revisao".
    let statusFinal = 'confirmado';
    if (!extrato.valor || typeof extrato.valor !== 'number' || extrato.valor === 0) {
      statusFinal = 'pendente_revisao';
    }

    const { error: insertError } = await supabase.from('comprovantes').insert({
      valor: extrato.valor || null,
      data_pagamento: extrato.data_pagamento || null,
      nome_pagador: extrato.nome_pagador || null,
      banco_origem: extrato.banco_origem || null,
      tipo_pagamento: extrato.tipo_pagamento || null,
      chave_pix: extrato.chave_pix || null,
      imagem_url: imageUrl,
      dados_brutos: extrato,
      status: statusFinal,
      grupo_whatsapp: grupo,
      numero_remetente: remetente,
      observacoes: extrato.observacoes || null
    });

    if (insertError) {
      console.error("Insert Error", insertError);
      throw new Error("Erro ao salvar comprovante no banco");
    }

    // 5. Calcula Totais e Responde
    if (statusFinal === 'pendente_revisao') {
      await enviarMensagemZApi(fullBody.phone, "⚠️ *Não consegui ler este comprovante com clareza.* Ele foi salvo para revisão manual. Por favor, confira na tela de Comprovantes.");
    } else {
      // Calcular Total do dia!
      const startOfDay = new Date();
      startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date();
      endOfDay.setHours(23,59,59,999);

      const { data: somaData, error: somaError } = await supabase
        .from('comprovantes')
        .select('valor')
        .eq('status', 'confirmado')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());

      let totalDia = 0;
      if (!somaError && somaData) {
        totalDia = somaData.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
      }

      const valFormat = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

      const msg = `✅ *Comprovante registrado!*\n💰 Valor: ${valFormat(extrato.valor)}\n👤 Pagador: ${extrato.nome_pagador || 'Não lido'}\n🏦 Banco: ${extrato.banco_origem || 'Não lido'}\n📅 Data: ${extrato.data_pagamento ? new Date(extrato.data_pagamento).toLocaleDateString('pt-BR') : 'Não lida'}\n\n📊 *Total do dia: ${valFormat(totalDia)}*`;
      await enviarMensagemZApi(fullBody.phone, msg);
    }
    
  } catch (err: any) {
    console.error("Erro processamento comprovante:", err);
    await enviarMensagemZApi(fullBody.phone, `⚠️ Olá, ocorreu um erro sistêmico ao tentar ler o comprovante: ${err.message}`);
  }
}

async function enviarMensagemZApi(phoneDestino: string, mensagem: string) {
    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const zapiToken = Deno.env.get("ZAPI_TOKEN");
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");
    const baseUrl = Deno.env.get("ZAPI_API_URL") || `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}`;

    if (!instanceId || !zapiToken) return console.log("Missing ZAPI vars to send message");

    const zapiUrl = `${baseUrl}/send-text`;
    
    await fetch(zapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(clientToken ? { "Client-Token": clientToken } : {})
      },
      body: JSON.stringify({ phone: phoneDestino, message: mensagem }),
    }).catch(e => console.error("ZAPI Env error", e));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Em webhooks do Z-API a imagem geralmente vem como payload type: 'image'
    // ou event: 'onMessage' etc.
    const imageUrl = body?.image?.imageUrl || body?.document?.documentUrl || body?.imageUrl || body?.url;
    
    if (!imageUrl) {
      return new Response(JSON.stringify({ ok: true, message: "Ignorado - não contém imagem." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Identificação de quem enviou (ajustado para Z-API standard)
    const groupHost = body?.phone || "Private"; 
    const sender = body?.participantPhone || body?.author || "Desconhecido";

    // Validação de segurança: apenas aceitar do grupo autorizado
    const authorizedGroupId = Deno.env.get("WHATSAPP_GROUP_ID");
    if (authorizedGroupId && groupHost !== authorizedGroupId) {
      console.log(`Ignorando mensagem de [${groupHost}]. Grupo autorizado é: [${authorizedGroupId}]`);
      return new Response(JSON.stringify({ ok: true, message: "Ignorado - não é o grupo autorizado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200, // respondendo 200 para a zapi não ficar tentando reenviar
      });
    }

    // O processamento pesado roda em background na mesma isolate
    processComprovante(imageUrl, sender, groupHost, body).catch((err) => {
      console.error("Erro fatal Background:", err);
    });

    // Retorna 200 OK IMEDIATAMENTE!
    return new Response(JSON.stringify({ ok: true, message: "Webhook Aceito" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Erro interno Webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
