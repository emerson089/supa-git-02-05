
const parseProductName = (nome, referencia) => {
  const currentRef = (referencia || "").trim();
  const currentName = (nome || "").trim();

  // 1. Extrair os números da referência (os últimos 3 ou mais dígitos)
  let numeros = "";
  
  // Tenta extrair da referência técnica primeiro
  const numMatchRef = currentRef.match(/(\d+)$/);
  if (numMatchRef) {
    numeros = numMatchRef[1];
  } else {
    // Senão tenta no nome
    const numMatchName = currentName.match(/(\d+)$/);
    if (numMatchName) {
      numeros = numMatchName[1];
    }
  }

  // 2. Limpar o nome base
  let nomeBase = currentName;

  // Se temos números, vamos remover eles e os separadores do final do nome
  if (numeros) {
    // Regex para remover separadores + números no final do nome
    // Ex: "Calça - 870" -> "Calça"
    // Ex: "Conjunto — 610" -> "Conjunto"
    const cleanupRegex = new RegExp(`\\s*[—|–|-|:|\\s]+\\s*${numeros}$`);
    nomeBase = nomeBase.replace(cleanupRegex, "").trim();
  }

  // Limpeza recursiva de tamanhos e outros sufixos
  let prevNome;
  do {
    prevNome = nomeBase;
    // Remove tamanhos no final (P, M, G, GG, G1, G2, G3, PEÇAS, 34, 36...)
    nomeBase = nomeBase.replace(/\s*[—|–|-|:|/]\s*(P|M|G|GG|G1|G2|G3|G4|G5|XG|XGG|PEÇAS|\d{2})$/i, "").trim();
    
    // Se por acaso sobrou outro número de referência (ex: "Calça - 870 - 870")
    if (numeros) {
       const repeatRegex = new RegExp(`\\s*[—|–|-|:|\\s]+\\s*${numeros}$`);
       nomeBase = nomeBase.replace(repeatRegex, "").trim();
    }
  } while (nomeBase !== prevNome);

  // Limpeza final de separadores residuais
  nomeBase = nomeBase.replace(/\s*[—|–|-|:|/|\\|]\s*$/, "").trim();

  // 3. Formatação Final: "Nome - 000"
  const numDisplay = numeros ? numeros.slice(-3).padStart(3, '0') : '';
  const nomeExibicao = numDisplay ? `${nomeBase} - ${numDisplay}` : nomeBase;

  return {
    nomeBase,
    refBase: numeros || currentRef,
    tamanho: (currentRef.match(/[-–—:]\s*(P|M|G|GG|G1|G2|G3|XGG|PEÇAS|\d{2})$/i)?.[1] || null),
    nomeExibicao,
  };
};

const tests = [
    { nome: "Calça alfaiataria pantalona todas as cores - 870", ref: "Calça alfaiataria pantalona todas as cores - 870" },
    { nome: "short alfaiataria plus - 166", ref: "short alfaiataria plus - 166" },
    { nome: "Conjunto alfaiataria short e blusa tomara que caia — -PEÇAS - 610", ref: "Conjunto alfaiataria short e blusa tomara que caia — -PEÇAS - 610" },
    { nome: "Calça Jeans - 12345", ref: "12345" },
    { nome: "Blusa Linda", ref: "BL-999" },
    { nome: "Produto Sem Ref", ref: "Produto Sem Ref" }
];

tests.forEach(t => {
    const res = parseProductName(t.nome, t.ref);
    console.log(`Input: "${t.nome}"`);
    console.log(`Result: "${res.nomeExibicao}"`);
    console.log(`NomeBase: "${res.nomeBase}"`);
    console.log('---');
});
