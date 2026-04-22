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
  const currentRef = (referencia || "").toUpperCase().trim();
  const currentName = (nome || "").trim();

  // 1. Extrair a referência base e o tamanho (ex: SH2603-0042-M -> SH2603-0042 e M)
  // Suporta hífens (-), meia-risca (–) e travessão (—)
  // Expandido para suportar códigos de 2 a 4 dígitos como identificadores/tamanhos (ex: 130, 886, 2604)
  const sizeMatch = currentRef.match(/^(.+)[-–—](P|M|G|GG|G1|G2|G3|XGG|PEÇAS|\d{2})$/i);
  const refBase = (sizeMatch ? sizeMatch[1] : currentRef).trim();
  const tamanho = sizeMatch ? sizeMatch[2].toUpperCase() : null;

  // 2. Tentar extrair os últimos 3 números da referência oficial
  const numerosMatch = refBase.match(/(\d+)$/);
  let numeros = numerosMatch ? numerosMatch[1] : "";
  
  // 3. Se não achou na referência, tenta achar no nome (ex: "Produto - 123" ou "Produto 123")
  if (!numeros) {
    const nomeReferenciaMatch = currentName.match(/\s*[—|-]\s*(\d+)$/);
    if (nomeReferenciaMatch) {
      numeros = nomeReferenciaMatch[1];
    } else {
      // Tenta pegar números no final do nome se houver espaço (ex: "Produto 123")
      const finalNumericoMatch = currentName.match(/\s+(\d+)$/);
      if (finalNumericoMatch) {
        numeros = finalNumericoMatch[1];
      }
    }
  }

  const refCurta = numeros ? `REF ${numeros.slice(-3).padStart(3, '0')}` : "";

  // 4. Limpar o nome (remover referências que estejam no campo nome)
  let nomeBase = currentName;
  
  // Se o nome contém a referência técnica completa, removemos ela
  if (refBase && nomeBase.includes(refBase)) {
    nomeBase = nomeBase.replace(refBase, '').trim();
  }
  
  // Se o nome termina com qualquer padrão de referência (ex: " - 123"), removemos
  nomeBase = nomeBase.replace(/\s*[—|-|:]\s*\d{3}$/, "").trim();

  // Limpeza final de qualquer caractere de separação residual no fim
  nomeBase = nomeBase.replace(/\s*[—|-|:]\s*$/, "").trim();

  // 5. Gerar nome de exibição padronizado: "Nome XXX"
  const numDisplay = numeros ? numeros.slice(-3).padStart(3, '0') : '';
  const nomeExibicao = numDisplay ? `${nomeBase} - ${numDisplay}` : nomeBase;

  return {
    nomeBase,
    refBase: refBase || numeros, // Usar numeros se refBase for vazio para agrupamento
    tamanho,
    refCurta,
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
