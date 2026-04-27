import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Categoria = "jeans" | "alfaiataria" | "nao_classificado";

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

// Detecta categoria a partir da legenda da imagem (caption do WhatsApp)
function detectarCategoria(caption: string | null | undefined): Categoria {
  if (!caption) return "nao_classificado";
  const norm = caption
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (!norm) return "nao_classificado";

  // Match por palavras inteiras ou abreviações
  // Jeans: "jeans", ou token isolado "j"
  if (/\bjeans?\b/.test(norm)) return "jeans";
  // Alfaiataria: "alfaiataria", "alfaiat", ou token isolado "a"
  if (/\balfaiat\w*\b/.test(norm)) return "alfaiataria";

  // Tokens isolados curtos (J / A) — apenas se a legenda tiver no máximo 3 caracteres
  if (norm.length <= 3) {
    if (/^j\b/.test(norm)) return "jeans";
    if (/^a\b/.test(norm)) return "alfaiataria";
  }

  return "nao_classificado";
}

const valFormat = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function rotuloCategoria(cat: Categoria) {
  if (cat === "jeans") return "👖 Jeans";
  if (cat === "alfaiataria") return "👔 Alfaiataria";
  return "❓ Não classificado";
}

// Filtra nomes de recebedores conhecidos para evitar confusão no campo Pagador
function limparNomePagador(nome: string | null): string | null {
  if (!nome) return null;
  const nomeNorm = nome.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  const nomesProibidos = [
    "daniel silva chagas",
    "delooki jeans"
  ];

  for (const proibido of nomesProibidos) {
    if (nomeNorm.includes(proibido)) {
      console.log(`[Filtro] Nome proibido detectado e removido: ${nome}`);
      return null;
    }
  }

  return nome;
}

// Background Task Principal
async function processComprovante(
  imageUrl: string,
  remetente: string,
  grupo: string,
  caption: string | null,
  fullBody: any,
) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const categoria = detectarCategoria(caption);

    // 1. Baixar imagem e converter para base64
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Falha ao baixar imagem: ${imageResponse.statusText}`);
    }
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64Image = arrayBufferToBase64(arrayBuffer);
    
    // 2. Chamar OpenAI GPT-4o Vision
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) throw new Error("OPENAI_API_KEY não configurada");

    const promptText = `
Analise esta imagem de comprovante de pagamento bancário brasileiro. Extraia as seguintes informações e retorne APENAS um JSON válido sem markdown:
{
  "valor": (número decimal, ex: 150.50),
  "data_pagamento": (formato ISO 8601, ex: 2025-04-16T14:30:00),
  "nome_pagador": (nome completo de quem pagou/origem),
  "banco_origem": (nome do banco),
  "tipo_pagamento": (PIX, TED, DOC, boleto ou outro),
  "chave_pix": (chave pix se visível, senão null),
  "observacoes": (qualquer informação relevante adicional),
  "id_transacao": (ID/codigo da transacao/autenticacao se houver, caso contraio null)
}

IMPORTANTE SOBRE O CAMPO "nome_pagador":
1. Identifique quem está ENVIANDO o dinheiro.
2. NÃO confunda com o Beneficiário/Recebedor (quem recebe).
3. Os nomes "Daniel Silva Chagas" e "Delooki jeans" são os RECEBEDORES. NUNCA coloque estes nomes no campo "nome_pagador".
4. Se o nome do pagador não estiver claro ou for idêntico ao do beneficiário, use null.
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
      // Aplicar limpeza no nome do pagador retornado pela IA
      extrato.nome_pagador = limparNomePagador(extrato.nome_pagador);
    } catch(e) {
      throw new Error(`Falha ao fazer parse do JSON retornado pela IA`);
    }

    // 3. Verificação de Duplicidade
    const hasTransacaoId = !!extrato.id_transacao;
    if (hasTransacaoId) {
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
        return;
      }
    }

    // Fallback URL Hash
    const urlHash = imageUrl.split('?')[0];
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

    // 4. Inserção no Supabase com regra de quarentena
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
      categoria,
      grupo_whatsapp: grupo,
      numero_remetente: remetente,
      observacoes: extrato.observacoes || null
    });

    if (insertError) throw insertError;

    // 5. Responder com resumo e totais segmentados do dia
    if (statusFinal === 'pendente_revisao') {
      const aviso = categoria === 'nao_classificado'
        ? "⚠️ *Não consegui ler este comprovante com clareza* e a *categoria não foi informada* (envie a foto com a legenda *J* para Jeans ou *A* para Alfaiataria). Foi salvo para revisão manual."
        : `⚠️ *Não consegui ler este comprovante com clareza.* Categoria: *${rotuloCategoria(categoria)}*. Foi salvo para revisão manual.`;
      await enviarMensagemZApi(fullBody.phone, aviso);
    } else {
      const startOfDayDate = new Date();
      startOfDayDate.setHours(0,0,0,0);
      const { data: somaData } = await supabase
        .from('comprovantes')
        .select('valor, categoria')
        .eq('status', 'confirmado')
        .gte('created_at', startOfDayDate.toISOString());

      let totalJeans = 0;
      let totalAlfaiataria = 0;
      let totalNaoClass = 0;
      if (somaData) {
        for (const row of somaData as Array<{ valor: number | null; categoria: Categoria }>) {
          const v = Number(row.valor) || 0;
          if (row.categoria === 'jeans') totalJeans += v;
          else if (row.categoria === 'alfaiataria') totalAlfaiataria += v;
          else totalNaoClass += v;
        }
      }
      const totalDia = totalJeans + totalAlfaiataria + totalNaoClass;

      const dataFmt = extrato.data_pagamento
        ? new Date(extrato.data_pagamento).toLocaleDateString('pt-BR')
        : 'Não lida';

      const linhaNaoClass = totalNaoClass > 0
        ? `\nTotal não classificado : ${valFormat(totalNaoClass)}`
        : '';

      const avisoCategoria = categoria === 'nao_classificado'
        ? `\n\n⚠️ Categoria não informada — envie a próxima foto com a legenda *J* (Jeans) ou *A* (Alfaiataria), ou corrija na tela de Comprovantes.`
        : '';

      const msg =
        `✅ *Comprovante registrado!*\n\n` +
        `💰 Valor: ${valFormat(extrato.valor)}\n` +
        `👤 Pagador: ${extrato.nome_pagador || 'Não lido'}\n` +
        `🏦 Banco: ${extrato.banco_origem || 'Não lido'}\n` +
        `📅 Data: ${dataFmt}\n\n` +
        `Total jeans : ${valFormat(totalJeans)}\n` +
        `Total alfaiataria : ${valFormat(totalAlfaiataria)}${linhaNaoClass}\n` +
        `📊 *Total do dia: ${valFormat(totalDia)}*` +
        avisoCategoria;

      await enviarMensagemZApi(fullBody.phone, msg);
    }
  } catch (err: any) {
    console.error("Erro processamento:", err);
    const message = err instanceof Error ? err.message : String(err);
    await enviarMensagemZApi(fullBody.phone, `⚠️ Erro ao processar comprovante: ${message}`);
  }
}

async function enviarMensagemZApi(phoneDestino: string, mensagem: string) {
    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const zapiToken = Deno.env.get("ZAPI_TOKEN");
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

    if (!instanceId || !zapiToken || !clientToken) {
      console.error("ZAPI envs missing", {
        hasInstanceId: !!instanceId,
        hasToken: !!zapiToken,
        hasClientToken: !!clientToken,
      });
      return;
    }

    const url = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/send-text`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": clientToken,
        },
        body: JSON.stringify({ phone: phoneDestino, message: mensagem }),
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        console.error("ZAPI send-text failed", { status: res.status, body: bodyText });
      }
    } catch (e) {
      console.error("ZAPI fetch error", e);
    }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();

    // [DEBUG TEMP] Log de descoberta de Group ID — remover depois de capturar
    const debugGroupHost = body?.phone || "Private";
    const debugSender = body?.participantPhone || body?.author || "Desconhecido";
    const debugText =
      body?.text?.message ||
      body?.image?.caption ||
      body?.caption ||
      (body?.document ? "[documento]" : null) ||
      (body?.image ? "[imagem sem legenda]" : "[sem texto]");
    console.log("[GROUP-ID-DISCOVERY]", JSON.stringify({
      groupHost: debugGroupHost,
      sender: debugSender,
      text: debugText,
      isGroup: body?.isGroup ?? null,
      chatName: body?.chatName ?? null,
    }));

    // Ignora PDFs e outros documentos — só processa imagens de comprovante
    if (body?.document) {
      return new Response(JSON.stringify({ ok: true, message: "Documento ignorado" }), { status: 200 });
    }

    const imageUrl = body?.image?.imageUrl || body?.url;

    if (!imageUrl) {
      return new Response(JSON.stringify({ ok: true, message: "Ignorado (sem imagem) — groupHost capturado em log" }), { status: 200 });
    }

    // Extrai a legenda da imagem (Z-API: image.caption). Fallback para outros campos comuns.
    const caption: string | null =
      body?.image?.caption ||
      body?.caption ||
      body?.text?.message ||
      null;

    const groupHost = body?.phone || "Private"; 
    const sender = body?.participantPhone || body?.author || "Desconhecido";

    // Filtro de Grupo
    const authorizedGroupId = Deno.env.get("WHATSAPP_GROUP_ID");
    if (authorizedGroupId && groupHost !== authorizedGroupId) {
      return new Response(JSON.stringify({ ok: true, message: "Grupo não autorizado" }), { status: 200 });
    }

    // Processamento assíncrono
    processComprovante(imageUrl, sender, groupHost, caption, body).catch(e => console.error(e));

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
