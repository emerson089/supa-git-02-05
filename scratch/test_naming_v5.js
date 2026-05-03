
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

  // 2. Limpar o nome base
  let nomeBase = currentName;

  // Se temos números, vamos remover eles e qualquer prefixo alfanumérico que venha depois de um separador
  // Ex: "Conjunto — CJ2603-610" -> "Conjunto"
  if (numeros) {
    // Regex que pega: separador + (opcional alfanumérico + separador) + números no final
    const cleanupRegex = new RegExp(`\\s*[-—–:/\\\\|\\s]+\\s*([A-Z0-9]+[-—–:/\\\\|\\s]*)?${numeros}$`, 'i');
    nomeBase = nomeBase.replace(cleanupRegex, "").trim();
  }

  // Limpeza recursiva adicional
  let prevNome;
  let iterations = 0;
  do {
    prevNome = nomeBase;
    
    // Remove tamanhos no final
    nomeBase = nomeBase.replace(/\s*[-—–:/\\\\|]\s*(P|M|G|GG|G1|G2|G3|G4|G5|XG|XGG|PEÇAS|\d{2})$/i, "").trim();
    
    // Remove qualquer coisa que pareça código técnico curto no final (ex: CJ2603)
    // Se sobrar algo como "Conjunto — CJ2603"
    nomeBase = nomeBase.replace(/\s*[-—–:/\\\\|]\s*[A-Z0-9]{3,10}$/i, "").trim();

    // Remove separadores residuais no final
    nomeBase = nomeBase.replace(/\s*[-—–:/\\\\|]+\s*$/, "").trim();

    iterations++;
  } while (nomeBase !== prevNome && iterations < 5);

  // 3. Formatação Final: "Nome - 000"
  const numDisplay = numeros ? numeros.slice(-3).padStart(3, '0') : '';
  const nomeExibicao = numDisplay ? `${nomeBase} - ${numDisplay}` : nomeBase;

  return {
    nomeBase,
    nomeExibicao,
  };
};

const tests = [
    { nome: "Conjunto alfaiataria short e blusa tomara que caia — CJ2603-610", ref: "CJ2603-610" },
    { nome: "Calça alfaiataria pantalona todas as cores - 870", ref: "870" }
];

tests.forEach(t => {
    const res = parseProductName(t.nome, t.ref);
    console.log(`Input: "${t.nome}"`);
    console.log(`Result: "${res.nomeExibicao}"`);
    console.log('---');
});
