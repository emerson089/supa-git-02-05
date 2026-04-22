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

  // 1. Extrair os números da referência (Modelo)
  // Priorizamos sequências de 3 ou mais dígitos que geralmente representam o modelo
  let numeros = "";
  const match3PlusRef = currentRef.match(/(\d{3,})/);
  const match3PlusName = currentName.match(/(\d{3,})/);
  
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
  // Ex: "Conjunto — CJ2603-610" onde ref é "CJ2603-610"
  if (currentRef && currentRef.length > 2 && currentRef !== currentName) {
    // Escape special chars for regex
    const escapedRef = currentRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const refRegex = new RegExp(`\\s*[-—–:/\\\\|]?\\s*${escapedRef}\\s*`, 'i');
    nomeBase = nomeBase.replace(refRegex, '').trim();
  }

  // Se ainda sobraram os números identificados no final, removemos
  if (numeros) {
    // Regex robusta para remover separadores + números no final do nome
    const cleanupRegex = new RegExp(`\\s*[-—–:/\\\\|\\s]+\\s*${numeros}$`);
    nomeBase = nomeBase.replace(cleanupRegex, "").trim();
  }

  // Limpeza recursiva de tamanhos e outros sufixos para garantir nome limpo
  let prevNome;
  let iterations = 0;
  do {
    prevNome = nomeBase;
    
    // Remove tamanhos no final (P, M, G, GG, G1, G2, G3, PEÇAS, 34, 36...)
    nomeBase = nomeBase.replace(/\s*[-—–:/\\\\|]\s*(P|M|G|GG|G1|G2|G3|G4|G5|XG|XGG|PEÇAS|\d{2})$/i, "").trim();
    
    // Remove números repetidos no final
    if (numeros) {
       const repeatRegex = new RegExp(`\\s*[-—–:/\\\\|\\s]+\\s*${numeros}$`);
       nomeBase = nomeBase.replace(repeatRegex, "").trim();
    }
    
    // Remove separadores residuais no final
    nomeBase = nomeBase.replace(/\s*[-—–:/\\\\|]+\s*$/, "").trim();

    iterations++;
  } while (nomeBase !== prevNome && iterations < 5);


  // 4. Formatação Final: "Nome - REF"
  // Se a referência tem formato MODELO-TAMANHO (ex: "481-34"), usa o código do modelo para exibição
  let numDisplay = numeros ? numeros.slice(-3).padStart(3, '0') : '';
  if (sizeMatch) {
    const sizeStr = sizeMatch[0];
    const sizeIdx = currentRef.lastIndexOf(sizeStr);
    if (sizeIdx > 0) {
      const modelPart = currentRef.substring(0, sizeIdx);
      const modelDigits = modelPart.match(/(\d+)$/)?.[1] || '';
      if (modelDigits) numDisplay = modelDigits;
    }
  }
  // Fallback: se nomeBase ficou vazio (ex: produtos cadastrados manualmente sem nome descritivo),
  // usa o nome original limpo ou a referência completa para evitar exibir " - 130"
  let nomeExibicao: string;
  if (nomeBase) {
    nomeExibicao = numDisplay ? `${nomeBase} - ${numDisplay}` : nomeBase;
  } else {
    // Sem nome base — tenta usar o nome original; se também vazio, usa a referência
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
