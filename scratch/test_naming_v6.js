
const parseProductName = (nome, referencia) => {
  const currentRef = (referencia || "").trim();
  const currentName = (nome || "").trim();

  // 1. Extrair os números da referência (os últimos 3 ou mais dígitos)
  let numeros = "";
  const numMatchRef = currentRef.match(/(\d+)$/);
  if (numMatchRef) {
    numeros = numMatchRef[1];
  } else {
    const numMatchName = currentName.match(/(\d+)$/);
    if (numMatchName) {
      numeros = numMatchName[1];
    }
  }

  // 2. Extrair o tamanho
  const sizeMatch = currentRef.match(/[-—–:/]\s*(P|M|G|GG|G1|G2|G3|XGG|PEÇAS|\d{2})$/i);
  const tamanho = sizeMatch ? sizeMatch[1].toUpperCase() : null;

  // 3. Limpar o nome base
  let nomeBase = currentName;

  // Se a referência técnica estiver no nome, removemos ela primeiro (mais específico)
  // Ex: "Conjunto — CJ2603-610" onde ref é "CJ2603-610"
  if (currentRef && currentRef.length > 2 && currentRef !== currentName) {
    // Escape e regex para remover a referência do nome
    const escapedRef = currentRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const refRegex = new RegExp(`\\s*[-—–:/\\\\|]?\\s*${escapedRef}\\s*`, 'i');
    nomeBase = nomeBase.replace(refRegex, '').trim();
  }

  // Se ainda sobraram os números no final, removemos
  if (numeros) {
    const numCleanupRegex = new RegExp(`\\s*[-—–:/\\\\|\\s]+\\s*${numeros}$`);
    nomeBase = nomeBase.replace(numCleanupRegex, "").trim();
  }

  // Limpeza recursiva de tamanhos e separadores
  let prevNome;
  let iterations = 0;
  do {
    prevNome = nomeBase;
    
    // Remove tamanhos no final
    nomeBase = nomeBase.replace(/\s*[-—–:/\\\\|]\s*(P|M|G|GG|G1|G2|G3|G4|G5|XG|XGG|PEÇAS|\d{2})$/i, "").trim();
    
    // Remove separadores residuais no final
    nomeBase = nomeBase.replace(/\s*[-—–:/\\\\|]+\s*$/, "").trim();

    iterations++;
  } while (nomeBase !== prevNome && iterations < 5);

  // 4. Formatação Final: "Nome - 000"
  const numDisplay = numeros ? numeros.slice(-3).padStart(3, '0') : '';
  const nomeExibicao = numDisplay ? `${nomeBase} - ${numDisplay}` : nomeBase;

  return { nomeBase, nomeExibicao };
};

const tests = [
    { nome: "Conjunto alfaiataria short e blusa tomara que caia — CJ2603-610", ref: "CJ2603-610" },
    { nome: "Calça alfaiataria pantalona todas as cores - 870", ref: "870" },
    { nome: "Calça alfaiataria pantalona todas as cores - 870", ref: "Calça alfaiataria pantalona todas as cores - 870" }
];

tests.forEach(t => {
    const res = parseProductName(t.nome, t.ref);
    console.log(`Input: "${t.nome}" | Ref: "${t.ref}"`);
    console.log(`Result: "${res.nomeExibicao}"`);
    console.log('---');
});
