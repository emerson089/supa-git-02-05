/**
 * Utilitários para padronização de nomes e referências de produtos
 */

export interface ProductInfo {
  nomeBase: string;
  refBase: string;
  tamanho: string | null;
  refCurta: string;
  nomeExibicao: string;
}

/**
 * Analisa o nome e a referência de um produto para extrair informações padronizadas
 */
export const parseProductName = (nome: string, referencia: string): ProductInfo => {
  const currentRef = (referencia || "").trim();
  const currentName = (nome || "").trim();

  // 1. Extrair o código do modelo da referência
  // Usa o último grupo de 3+ dígitos (antes de sufixo de tamanho opcional como "-34", "-36")
  // Ex: "SA2604-540" → "540", "SH2604-481-34" → "481", "481-34" → "481"
  let numeros = "";
  const match3PlusRef = currentRef.match(/(\d{3,})(?:[-—–:/]\d{1,2})?$/);
  const match3PlusName = currentName.match(/(\d{3,})(?:[-—–:/]\d{1,2})?$/);

  if (match3PlusRef) {
    numeros = match3PlusRef[1];
  } else if (match3PlusName) {
    numeros = match3PlusName[1];
  } else {
    // Fallback: se não houver 3 dígitos, tenta o último grupo numérico disponível
    const numMatchRef = currentRef.match(/(\d+)$/);
    const numMatchName = currentName.match(/(\d+)$/);
    numeros = numMatchRef ? numMatchRef[1] : (numMatchName ? numMatchName[1] : "");
  }

  // 2. Tentar extrair o tamanho (P, M, G, etc ou 2 dígitos no final)
  const sizeMatch = currentRef.match(/[-—–:/]\s*(P|M|G|GG|G1|G2|G3|XGG|PEÇAS|\d{2})$/i);
  let tamanho = sizeMatch ? sizeMatch[1].toUpperCase() : null;

  // Ajuste: Se pegamos um tamanho de 2 dígitos como "número de referência", 
  // e existe uma referência de 3 dígitos antes, corrigimos.
  if (tamanho && numeros === tamanho && numeros.length <= 2) {
    const betterNumMatch = currentRef.replace(new RegExp(`[-—–:/\\s]*${tamanho}$`), "").match(/(\d{3,})/);
    if (betterNumMatch) {
      numeros = betterNumMatch[1];
    }
  }

  // 3. Limpar o nome base
  let nomeBase = currentName;

  // Se a referência técnica estiver no nome, removemos ela primeiro (mais específico)
  if (currentRef && currentRef.length > 2 && currentRef !== currentName) {
    const escapedRef = currentRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const refRegex = new RegExp(`\\s*[-—–:/\\\\|]?\\s*${escapedRef}\\s*`, 'i');
    nomeBase = nomeBase.replace(refRegex, '').trim();
  }

  // Se ainda sobraram os números identificados no final, removemos
  // Melhoria: Capturar também prefixos de 1 ou 2 letras que costumam vir antes da ref (ex: SH, CA, CJ)
  if (numeros) {
    // Regex que aceita separadores + opcionalmente 1-2 letras + os números
    const cleanupRegex = new RegExp(`\\s*[-—–:/\\\\|\\s]+\\s*[A-Z]{0,2}${numeros}$`, 'i');
    nomeBase = nomeBase.replace(cleanupRegex, "").trim();
  }

  // Limpeza recursiva de tamanhos e outros sufixos para garantir nome limpo
  let prevNome;
  let iterations = 0;
  do {
    prevNome = nomeBase;
    
    // Remove tamanhos no final (P, M, G, GG, G1, G2, G3, PEÇAS, 34, 36...)
    nomeBase = nomeBase.replace(/\s*[-—–:/\\\\|]\s*(P|M|G|GG|G1|G2|G3|G4|G5|XG|XGG|PEÇAS|\d{2})$/i, "").trim();
    
    // Remove números repetidos ou referências curtas no final
    if (numeros) {
       const repeatRegex = new RegExp(`\\s*[-—–:/\\\\|\\s]+\\s*[A-Z]{0,2}${numeros}$`, 'i');
       nomeBase = nomeBase.replace(repeatRegex, "").trim();
    }
    
    // Remove separadores residuais no final
    nomeBase = nomeBase.replace(/\s*[-—–:/\\\\|]+\s*$/, "").trim();

    iterations++;
  } while (nomeBase !== prevNome && iterations < 5);


  // 4. Formatação Final: "Nome - REF"
  // Se a referência tem formato MODELO-TAMANHO (ex: "481-34"), usa o código do modelo para exibição
  let numDisplay = numeros ? numeros.slice(-3).padStart(3, '0') : '';
  
  // Tentar encontrar o número do modelo ignorando o tamanho no final da referência
  if (sizeMatch && currentRef) {
    const modelPart = currentRef.replace(sizeMatch[0], '');
    const modelMatch = modelPart.match(/(\d+)$/);
    if (modelMatch) {
      numDisplay = modelMatch[1].slice(-3).padStart(3, '0');
    }
  }

  let nomeExibicao: string;
  if (nomeBase && nomeBase !== numDisplay) {
    nomeExibicao = numDisplay ? `${nomeBase} - ${numDisplay}` : nomeBase;
  } else {
    const fallbackNome = currentName.trim() || currentRef.trim();
    nomeExibicao = numDisplay && !fallbackNome.includes(numDisplay)
      ? `${fallbackNome} - ${numDisplay}`.trim()
      : fallbackNome || numDisplay || 'Sem nome';
  }

  return {
    nomeBase,
    refBase: numDisplay || numeros || currentRef,
    tamanho,
    refCurta: numDisplay ? `REF ${numDisplay}` : "",
    nomeExibicao,
  };
};


/**
 * Agrupa itens por modelo (refBase) e preço
 */
export const groupItensByModel = <T extends any>(
  items: T[],
  config: {
    getItemId: (item: T) => string;
    getItemNome: (item: T) => string;
    getItemPreco: (item: T) => number;
    getItemQtd: (item: T) => number;
    getItemImagem?: (item: T) => string | null;
    getItemReferencia?: (item: T) => string;
    getItemModeloId?: (item: T) => string | null;
  }
) => {
  const groups: Record<string, any> = {};

  items.forEach(item => {
    const referencia = config.getItemReferencia
      ? config.getItemReferencia(item)
      : config.getItemId(item);
    const info = parseProductName(config.getItemNome(item), referencia);
    const preco = config.getItemPreco(item);
    const qtd = config.getItemQtd(item);
    const modeloId = config.getItemModeloId ? config.getItemModeloId(item) : null;
    
    // Chave de agrupamento: ModeloId (se houver) OU RefBase + Preço
    const groupKey = modeloId ? `${modeloId}-${preco}` : `${info.refBase}-${preco}`;

    if (!groups[groupKey]) {
      groups[groupKey] = {
        refBase: info.refBase,
        nomeBase: info.nomeBase,
        nomeExibicao: info.nomeExibicao,
        tamanhos: [],
        tamanhosComQtd: {} as Record<string, number>,
        quantidadeTotal: 0,
        valorUnitario: preco,
        subtotal: 0,
        imagemUrl: config.getItemImagem ? config.getItemImagem(item) : null,
        ids: [],
        itens: [] // Itens originais no grupo
      };
    }

    if (info.tamanho && !groups[groupKey].tamanhos.includes(info.tamanho)) {
      groups[groupKey].tamanhos.push(info.tamanho);
    }
    if (info.tamanho) {
      groups[groupKey].tamanhosComQtd[info.tamanho] = (groups[groupKey].tamanhosComQtd[info.tamanho] || 0) + qtd;
    }

    groups[groupKey].quantidadeTotal += qtd;
    groups[groupKey].subtotal += qtd * preco;
    groups[groupKey].ids.push(config.getItemId(item));
    groups[groupKey].itens.push(item);
  });

  return Object.values(groups);
};
