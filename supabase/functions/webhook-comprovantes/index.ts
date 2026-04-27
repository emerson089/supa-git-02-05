import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from 'https://esm.sh/unpdf@0.10.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Categoria = "jeans" | "alfaiataria" | "nao_classificado";

interface GrupoConfig {
  id: string;
  user_id: string;
  group_whatsapp_id: string;
  nome: string;
  emoji: string;
  cor: string;
  categoria_padrao: Categoria;
  pedir_legenda_ja: boolean;
  aceita_pdf: boolean;
  ativo: boolean;
}

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

// Detecta categoria a partir da legenda da imagem
function detectarCategoriaPorLegenda(caption: string | null | undefined): Categoria {
  if (!caption) return "nao_classificado";
  const norm = caption
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (!norm) return "nao_classificado";
  if (/\bjeans?\b/.test(norm)) return "jeans";
  if (/\balfaiat\w*\b/.test(norm)) return "alfaiataria";

  if (norm.length <= 3) {
    if (/^j\b/.test(norm)) return "jeans";
    if (/^a\b/.test(norm)) return "alfaiataria";
  }

  return "nao_classificado";
}

const valFormat = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function limparNomePagador(nome: string | null): string | null {
  if (!nome) return null;
  const nomeNorm = nome.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  const nomesProibidos = ["daniel silva chagas", "delooki jeans", "delookii confeccoes"];

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
  grupoConfig: GrupoConfig,
  caption: string | null,
  fullBody: any,
  isDocument: boolean = false
) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Determinar categoria
    const categoria: Categoria = grupoConfig.pedir_legenda_ja
      ? detectarCategoriaPorLegenda(caption)
      : grupoConfig.categoria_padrao;

    // 1. Baixar imagem/PDF
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Falha ao baixar arquivo: ${imageResponse.statusText}`);
    }
    const contentType = imageResponse.headers.get("content-type") || (isDocument ? "application/pdf" : "image/jpeg");
    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64Content = arrayBufferToBase64(arrayBuffer);

    // 2. OpenAI Vision / Text
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) throw new Error("OPENAI_API_KEY não configurada");

    let pdfText = "";
    if (isDocument) {
      try {
        console.log("[PDF] Iniciando extração de texto...");
        const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
        const { text } = await extractText(pdf, { mergePages: true });
        pdfText = text;
        console.log("[PDF] Texto extraído com sucesso. Tamanho:", pdfText.length);
      } catch (e) {
        console.error("[PDF] Falha na extração de texto:", e);
        // Fallback: Tentamos enviar os primeiros bytes como string caso seja um PDF simples
        pdfText = new TextDecoder().decode(arrayBuffer.slice(0, 2000));
      }
    }

    const promptText = `
Analise este ${isDocument ? 'conteúdo de texto extraído de um PDF' : 'imagem de comprovante'} de pagamento bancário brasileiro. Extraia as seguintes informações e retorne APENAS um JSON válido sem markdown:
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
3. Os nomes "Daniel Silva Chagas", "Delooki jeans" e "DELOOKII CONFECCOES LTDA" são RECEBEDORES. NUNCA coloque estes nomes no campo "nome_pagador".
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
                ? { type: "text", text: `[CONTEÚDO DO PDF]:\n${pdfText}` }
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
    } catch (e) {
      throw new Error(`Falha ao fazer parse do JSON retornado pela IA`);
    }

    // 3. Verificação de Duplicidade
    if (extrato.id_transacao) {
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

    // 4. Inserção
    let statusFinal: 'confirmado' | 'pendente_revisao' = 'confirmado';
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
      grupo_whatsapp: grupoConfig.group_whatsapp_id,
      numero_remetente: remetente,
      observacoes: extrato.observacoes || null
    });

    if (insertError) throw insertError;

    // 5. Resposta
    if (statusFinal === 'pendente_revisao') {
      await enviarMensagemZApi(
        fullBody.phone,
        `⚠️ *Não consegui ler este comprovante com clareza.*\nFoi salvo para revisão manual em *${grupoConfig.emoji} ${grupoConfig.nome}*.`
      );
    } else {
      const startOfDayDate = new Date();
      startOfDayDate.setHours(0, 0, 0, 0);

      const { data: somaData } = await supabase
        .from('comprovantes')
        .select('valor, categoria, nome_pagador, created_at, data_pagamento')
        .eq('status', 'confirmado')
        .eq('grupo_whatsapp', grupoConfig.group_whatsapp_id)
        .gte('created_at', startOfDayDate.toISOString())
        .order('created_at', { ascending: true });

      let totalJeans = 0;
      let totalAlfaiataria = 0;
      let totalGeral = 0;
      const listaPagamentos: string[] = [];

      if (somaData) {
        for (const row of somaData) {
          const v = Number(row.valor) || 0;
          totalGeral += v;
          if (row.categoria === 'jeans') totalJeans += v;
          else if (row.categoria === 'alfaiataria') totalAlfaiataria += v;

          // Formatação para o novo grupo (Pagamentos)
          const dataRef = row.data_pagamento ? new Date(row.data_pagamento) : new Date(row.created_at);
          const horaFmt = dataRef.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          const dataFmt = dataRef.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          
          listaPagamentos.push(
            `Pagador: *${row.nome_pagador || 'Não identificado'}* | valor R$: *${valFormat(v)}* | data/ hora: *${dataFmt} às ${horaFmt}*`
          );
        }
      }

      const dataFmt = extrato.data_pagamento
        ? new Date(extrato.data_pagamento).toLocaleDateString('pt-BR')
        : 'Não lida';

      let msg = "";
      
      if (grupoConfig.pedir_legenda_ja) {
        // Formato para o grupo da Feira (Jeans/Alfaiataria)
        msg = `✅ *Comprovante registrado em ${grupoConfig.emoji} ${grupoConfig.nome}*\n\n` +
          `💰 Valor: ${valFormat(extrato.valor)}\n` +
          `👤 Pagador: ${extrato.nome_pagador || 'Não lido'}\n` +
          `🏦 Banco: ${extrato.banco_origem || 'Não lido'}\n` +
          `📅 Data: ${dataFmt}\n\n` +
          `Total jeans: ${valFormat(totalJeans)}\n` +
          `Total alfaiataria: ${valFormat(totalAlfaiataria)}\n` +
          `📊 *Total do dia neste grupo: ${valFormat(totalGeral)}*`;
      } else {
        // Formato solicitado para o grupo de Confirmação de Pagamento
        msg = `✅ *Confirmação de Pagamento*\n\n` +
          listaPagamentos.join('\n') +
          `\n\n📊 *Total: ${valFormat(totalGeral)}*`;
      }

      await enviarMensagemZApi(fullBody.phone, msg);
    }
  } catch (err: unknown) {
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
    console.error("ZAPI envs missing");
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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();

    const isDocument = !!(body?.document?.documentUrl || body?.document?.url);
    const imageUrl = body?.image?.imageUrl || body?.url || body?.document?.documentUrl || body?.document?.url;

    const caption: string | null =
      body?.image?.caption ||
      body?.caption ||
      body?.document?.fileName ||
      body?.text?.message ||
      null;

    const groupHost = body?.phone || null;
    const sender = body?.participantPhone || body?.author || "Desconhecido";
    const chatName = body?.chatName || body?.senderName || null;
    const isGroup = !!body?.isGroup;

    let messageType = "text";
    if (body?.image) messageType = "image";
    else if (body?.document) messageType = "document";
    else if (body?.audio) messageType = "audio";
    else if (body?.video) messageType = "video";

    // ── Sempre registrar evento bruto (descoberta/diagnóstico) ──
    if (groupHost) {
      try {
        await supabase.from('webhook_eventos_brutos').insert({
          group_whatsapp_id: groupHost,
          sender,
          chat_name: chatName,
          message_type: messageType,
          caption,
          payload: body,
        });

        // Limpeza: mantém só últimos 7 dias
        const seteDiasAtras = new Date();
        seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
        await supabase
          .from('webhook_eventos_brutos')
          .delete()
          .lt('created_at', seteDiasAtras.toISOString());
      } catch (e) {
        console.error("Falha ao registrar evento bruto:", e);
      }
    }

    // Sem URL de mídia → registramos e saímos
    if (!imageUrl) {
      return new Response(
        JSON.stringify({ ok: true, message: "Sem mídia para processar" }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Mensagens privadas (não-grupo): não processamos
    if (!isGroup || !groupHost) {
      return new Response(
        JSON.stringify({ ok: true, message: "Mensagem fora de grupo, ignorada" }),
        { status: 200, headers: corsHeaders }
      );
    }

    // ── Buscar configuração do grupo no banco ──
    const { data: grupoConfig, error: grupoErr } = await supabase
      .from('grupos_comprovantes')
      .select('*')
      .eq('group_whatsapp_id', groupHost)
      .eq('ativo', true)
      .limit(1)
      .maybeSingle();

    if (grupoErr) {
      console.error("Erro ao buscar grupo:", grupoErr);
    }

    if (!grupoConfig) {
      console.log(`[Auth] Grupo não cadastrado/ativo: ${groupHost} (${chatName || 'sem nome'})`);
      return new Response(
        JSON.stringify({ ok: true, grupo_nao_cadastrado: true, group_id: groupHost }),
        { status: 200, headers: corsHeaders }
      );
    }

    // PDF só processado se grupo aceita
    if (isDocument && !grupoConfig.aceita_pdf) {
      return new Response(
        JSON.stringify({ ok: true, message: "PDF não habilitado para este grupo" }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Processamento assíncrono
    processComprovante(imageUrl, sender, grupoConfig as GrupoConfig, caption, body, isDocument)
      .catch(e => console.error("Erro async:", e));

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Webhook error:", message);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
