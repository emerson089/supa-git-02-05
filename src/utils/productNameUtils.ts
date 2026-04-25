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
  const sizePattern = /[-—–:/]\s*(P|M|G|GG|G1|G2|G3|G4|G5|XG|XGG|PEÇAS|\d{2})$/i;
  let sizeMatch = currentRef.match(sizePattern);
  if (!sizeMatch) {
    sizeMatch = currentName.match(sizePattern);
  }
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

  // Se a referência técnica estiver no nome e for diferente dele, removemos primeiro
  if (currentRef && currentRef.length > 2 && currentRef !== currentName) {
    const escapedRef = currentRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const refRegex = new RegExp(`\\s*[-—–:/\\\\|]?\\s*${escapedRef}\\s*`, 'gi');
    nomeBase = nomeBase.replace(refRegex, ' ').trim();
  }

  // Limpeza agressiva: remover todos os padrões que parecem referências ([separador][prefixo][números])
  // Isso limpa casos como "Modelo — SH2604 - 008" -> "Modelo"
  let lastNome;
  do {
    lastNome = nomeBase;
    // Regex: separador comum + 0-2 letras + 3 ou mais dígitos
    const refPattern = /\s*[-—–:/\\|]\s*[A-Z]{0,2}\d{3,}\s*/gi;
    nomeBase = nomeBase.replace(refPattern, ' ').trim();
    
    // Também remove tamanhos comuns no final que podem ter sobrado
    nomeBase = nomeBase.replace(/\s*[-—–:/\\|]\s*(P|M|G|GG|G1|G2|G3|G4|G5|XG|XGG|PEÇAS|\d{2})$/i, "").trim();
  } while (nomeBase !== lastNome);

  // Limpeza final de separadores residuais
  nomeBase = nomeBase.replace(/\s*[-—–:/\\|]+\s*$/, "").trim();

  // 4. Formatação Final: "Nome - REF"
  // numDisplay já foi extraído do final da string original
  let numDisplay = numeros ? numeros.slice(-3).padStart(3, '0') : '';
  
  // Se tínhamos uma referência técnica com tamanho (ex: "481-34"), extrair o modelo puro dela
  if (sizeMatch && currentRef && currentRef !== currentName) {
    const modelPart = currentRef.replace(sizeMatch[0], '');
    const modelMatch = modelPart.match(/(\d+)$/);
    if (modelMatch) {
      numDisplay = modelMatch[1].slice(-3).padStart(3, '0');
    }
  }

  // refBase: Usada para agrupamento. Deve ser o mais limpa possível.
  // Se não tem números, usa a referência original sem o tamanho.
  let refBase = numDisplay || numeros || (sizeMatch ? currentRef.replace(sizeMatch[0], '') : currentRef);
  refBase = refBase.trim().toUpperCase() || 'SEM-REF';

  let nomeExibicao: string;
  if (nomeBase && nomeBase.toUpperCase() !== numDisplay) {
    nomeExibicao = numDisplay ? `${nomeBase} - ${numDisplay}` : nomeBase;
  } else {
    const fallbackNome = currentName.trim() || currentRef.trim();
    nomeExibicao = numDisplay && !fallbackNome.includes(numDisplay)
      ? `${fallbackNome} - ${numDisplay}`.trim()
      : fallbackNome || numDisplay || 'Sem nome';
  }

  return {
    nomeBase,
    refBase,
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
        tamanhosComQtd: [] as { itemId: string; tamanho: string; quantidade: number }[],
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
      groups[groupKey].tamanhosComQtd.push({
        itemId: config.getItemId(item),
        tamanho: info.tamanho,
        quantidade: qtd
      });
    }

    groups[groupKey].quantidadeTotal += qtd;
    groups[groupKey].subtotal += qtd * preco;
    groups[groupKey].ids.push(config.getItemId(item));
    groups[groupKey].itens.push(item);
  });

  return Object.values(groups);
};
