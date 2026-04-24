
const parseProductName = (nome, referencia) => {
  const currentRef = (referencia || "").trim();
  const currentName = (nome || "").trim();

  // 1. Extrair a referência técnica e o tamanho
  // Primeiro, tentamos limpar se a referência for igual ao nome
  let rawRef = currentRef;
  let rawName = currentName;

  // 2. Extrair o tamanho (P, M, G, etc) do final da referência
  const sizeMatch = rawRef.match(/^(.+?)\s*[-–—:]\s*(P|M|G|GG|G1|G2|G3|XGG|PEÇAS|\d{2})$/i);
  const refBase = (sizeMatch ? sizeMatch[1] : rawRef).trim();
  const tamanho = sizeMatch ? sizeMatch[2].toUpperCase() : null;

  // 3. Extrair os números da referência (os últimos 3 ou mais dígitos)
  // Tentamos primeiro na refBase, depois no nome
  let numeros = "";
  const numMatchRef = refBase.match(/(\d+)$/);
  if (numMatchRef) {
    numeros = numMatchRef[1];
  } else {
    const numMatchName = rawName.match(/(\d+)$/);
    if (numMatchName) {
      numeros = numMatchName[1];
    }
  }

  // 4. Limpar o nome base
  let nomeBase = rawName;

  // Se o nome contém a referência técnica (mesmo que parcial), removemos
  if (refBase && refBase.length > 2) {
    // Escape special chars for regex
    const escapedRef = refBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const refRegex = new RegExp(`\\s*[-–—:]?\\s*${escapedRef}\\s*`, 'i');
    nomeBase = nomeBase.replace(refRegex, '').trim();
  }

  // Limpeza recursiva de qualquer coisa que pareça referência ou tamanho no final do nome
  let prevNome;
  do {
    prevNome = nomeBase;
    // Remove números no final (referências)
    nomeBase = nomeBase.replace(/\s*[-–—:]\s*\d{3,}$/, "").trim();
    // Remove tamanhos no final
    nomeBase = nomeBase.replace(/\s*[-–—:]\s*(P|M|G|GG|G1|G2|G3|G4|G5|XG|XGG|PEÇAS|\d{2})$/i, "").trim();
    // Remove referências duplicadas (ex: "Calça - 870") se já temos os números
    if (numeros) {
       const numRegex = new RegExp(`\\s*[-–—:]\\s*${numeros}$`);
       nomeBase = nomeBase.replace(numRegex, "").trim();
    }
  } while (nomeBase !== prevNome);

  // Limpeza final de separadores residuais
  nomeBase = nomeBase.replace(/\s*[-–—:]\s*$/, "").trim();

  // 5. Formatação Final
  const numDisplay = numeros ? numeros.slice(-3).padStart(3, '0') : '';
  const nomeExibicao = numDisplay ? `${nomeBase} - ${numDisplay}` : nomeBase;

  return {
    nomeBase,
    refBase: refBase || numeros,
    tamanho,
    nomeExibicao,
  };
};

const tests = [
    { nome: "Calça alfaiataria pantalona todas as cores - 870", ref: "Calça alfaiataria pantalona todas as cores - 870" },
    { nome: "short alfaiataria plus - 166", ref: "short alfaiataria plus - 166" },
    { nome: "Conjunto alfaiataria short e blusa tomara que caia — -PEÇAS - 610", ref: "Conjunto alfaiataria short e blusa tomara que caia — -PEÇAS - 610" },
    { nome: "Calça Jeans - 12345", ref: "12345" },
    { nome: "Blusa Linda", ref: "BL-999" }
];

tests.forEach(t => {
    const res = parseProductName(t.nome, t.ref);
    console.log(`Input: "${t.nome}" | Ref: "${t.ref}"`);
    console.log(`Result: "${res.nomeExibicao}"`);
    console.log(`NomeBase: "${res.nomeBase}"`);
    console.log('---');
});
