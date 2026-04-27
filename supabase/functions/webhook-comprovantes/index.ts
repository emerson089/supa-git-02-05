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
  isDocument: boolean = false
) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const pagamentosGroupId = Deno.env.get("WHATSAPP_GROUP_ID_PAGAMENTOS");
  const isPagamentosGroup = grupo === pagamentosGroupId;

  try {
    const categoria = detectarCategoria(caption);

    // 1. Baixar imagem/PDF e converter para base64
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Falha ao baixar arquivo: ${imageResponse.statusText}`);
    }
    const contentType = imageResponse.headers.get("content-type") || (isDocument ? "application/pdf" : "image/jpeg");
    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64Content = arrayBufferToBase64(arrayBuffer);
    
    // 2. Chamar OpenAI GPT-4o Vision
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) throw new Error("OPENAI_API_KEY não configurada");

    const promptText = `
Analise este ${isDocument ? 'documento PDF' : 'imagem de comprovante'} de pagamento bancário brasileiro. Extraia as seguintes informações e retorne APENAS um JSON válido sem markdown:
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
              isDocument 
                ? { type: "text", text: `[Arquivo PDF Base64]: ${base64Content.substring(0, 1000)}... (Nota: GPT-4o Vision processa melhor imagens, se possível extraia do contexto textual)` }
                : { type: "image_url", image_url: { url: `data:${contentType};base64,${base64Content}` } }
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

    // 4. Inserção no Supabase
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
      categoria: isPagamentosGroup ? 'nao_classificado' : categoria,
      grupo_whatsapp: grupo,
      numero_remetente: remetente,
      observacoes: extrato.observacoes || null
    });

    if (insertError) throw insertError;

    // 5. Responder com resumo
    if (statusFinal === 'pendente_revisao') {
      const aviso = "⚠️ *Não consegui ler este comprovante com clareza.* Foi salvo para revisão manual.";
      await enviarMensagemZApi(fullBody.phone, aviso);
    } else {
      const startOfDayDate = new Date();
      startOfDayDate.setHours(0,0,0,0);
      
      // Totais do dia apenas para o grupo específico
      const { data: somaData } = await supabase
        .from('comprovantes')
        .select('valor, categoria')
        .eq('status', 'confirmado')
        .eq('grupo_whatsapp', grupo)
        .gte('created_at', startOfDayDate.toISOString());

      let totalJeans = 0;
      let totalAlfaiataria = 0;
      let totalGeral = 0;
      
      if (somaData) {
        for (const row of somaData as Array<{ valor: number | null; categoria: string }>) {
          const v = Number(row.valor) || 0;
          totalGeral += v;
          if (row.categoria === 'jeans') totalJeans += v;
          else if (row.categoria === 'alfaiataria') totalAlfaiataria += v;
        }
      }

      const dataFmt = extrato.data_pagamento
        ? new Date(extrato.data_pagamento).toLocaleDateString('pt-BR')
        : 'Não lida';

      let msg = `✅ *Comprovante registrado!*\n\n` +
                `💰 Valor: ${valFormat(extrato.valor)}\n` +
                `👤 Pagador: ${extrato.nome_pagador || 'Não lido'}\n` +
                `🏦 Banco: ${extrato.banco_origem || 'Não lido'}\n` +
                `📅 Data: ${dataFmt}\n\n`;

      if (isPagamentosGroup) {
        msg += `📊 *Total recebido hoje (neste grupo): ${valFormat(totalGeral)}*`;
      } else {
        msg += `Total jeans : ${valFormat(totalJeans)}\n` +
               `Total alfaiataria : ${valFormat(totalAlfaiataria)}\n` +
               `📊 *Total do dia: ${valFormat(totalGeral)}*`;
      }

      await enviarMensagemZApi(fullBody.phone, msg);
    }
  } catch (err: any) {
    console.error("Erro processamento:", err);
    await enviarMensagemZApi(fullBody.phone, `⚠️ Erro ao processar comprovante: ${err.message}`);
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

    const isDocument = !!(body?.document?.documentUrl || body?.document?.url);
    const imageUrl = body?.image?.imageUrl || body?.url || body?.document?.documentUrl || body?.document?.url;

    if (!imageUrl) {
      return new Response(JSON.stringify({ ok: true, message: "Tipo de mensagem não suportado ou sem URL" }), { status: 200 });
    }

    // Extrai a legenda da imagem ou nome do documento
    const caption: string | null =
      body?.image?.caption ||
      body?.caption ||
      body?.document?.fileName ||
      body?.text?.message ||
      null;

    const groupHost = body?.phone || "Private"; 
    const sender = body?.participantPhone || body?.author || "Desconhecido";

    // ── Filtro de Grupos e Autorização ────────────────────────
    const feiraGroupId = Deno.env.get("WHATSAPP_GROUP_ID");
    const pagamentosGroupId = Deno.env.get("WHATSAPP_GROUP_ID_PAGAMENTOS");
    
    const authorizedIds = [feiraGroupId, pagamentosGroupId].filter(Boolean);
    
    if (groupHost !== "Private" && !authorizedIds.includes(groupHost)) {
      console.log(`[Auth] Grupo não autorizado: ${groupHost}`);
      return new Response(JSON.stringify({ error: "Grupo não autorizado" }), { status: 401 });
    }

    // Regra: PDF só é aceito no grupo de Pagamentos
    if (isDocument && groupHost !== pagamentosGroupId) {
       return new Response(JSON.stringify({ ok: true, message: "PDF não autorizado para este grupo" }), { status: 200 });
    }

    // Processamento assíncrono
    processComprovante(imageUrl, sender, groupHost, caption, body, isDocument).catch(e => console.error(e));

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
