
const parseProductName = (nome, referencia) => {
  const currentRef = (referencia || "").trim();
  const currentName = (nome || "").trim();

  // 1. Extrair os números da referência
  // Procuramos por um número de 3 ou mais dígitos que NÃO seja o tamanho no final
  let numeros = "";
  
  // Tenta achar um padrão de 3+ dígitos na referência
  const match3Plus = currentRef.match(/(\d{3,})/);
  if (match3Plus) {
    numeros = match3Plus[1];
  } else {
    // Se não achar na ref, tenta no nome
    const match3PlusName = currentName.match(/(\d{3,})/);
    if (match3PlusName) {
      numeros = match3PlusName[1];
    } else {
      // Fallback: se só tiver números curtos, pega o último
      const matchAny = currentRef.match(/(\d+)$/) || currentName.match(/(\d+)$/);
      if (matchAny) numeros = matchAny[1];
    }
  }

  // 2. Extrair o tamanho (especialmente se for numérico de 2 dígitos no final da ref)
  let tamanho = null;
  const sizeMatch = currentRef.match(/[-—–:/]\s*(P|M|G|GG|G1|G2|G3|XGG|PEÇAS|\d{2})$/i);
  if (sizeMatch) {
    tamanho = sizeMatch[1].toUpperCase();
    // Se o tamanho extraído for igual aos "numeros" que pegamos, e os numeros forem curtos,
    // então precisamos re-procurar os numeros de referência de forma mais agressiva
    if (tamanho === numeros && numeros.length <= 2) {
      const betterNumMatch = currentRef.replace(new RegExp(`[-—–:/\\s]*${tamanho}$`), "").match(/(\d{3,})/);
      if (betterNumMatch) {
        numeros = betterNumMatch[1];
      }
    }
  }

  // 3. Limpar o nome base
  let nomeBase = currentName;
  if (currentRef && currentRef.length > 2 && currentRef !== currentName) {
    const escapedRef = currentRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const refRegex = new RegExp(`\\s*[-—–:/\\\\|]?\\s*${escapedRef}\\s*`, 'i');
    nomeBase = nomeBase.replace(refRegex, '').trim();
  }

  if (numeros) {
    const cleanupRegex = new RegExp(`\\s*[-—–:/\\\\|\\s]+\\s*${numeros}$`);
    nomeBase = nomeBase.replace(cleanupRegex, "").trim();
  }

  let prevNome;
  let iterations = 0;
  do {
    prevNome = nomeBase;
    nomeBase = nomeBase.replace(/\s*[-—–:/\\\\|]\s*(P|M|G|GG|G1|G2|G3|G4|G5|XG|XGG|PEÇAS|\d{2})$/i, "").trim();
    if (numeros) {
       const repeatRegex = new RegExp(`\\s*[-—–:/\\\\|\\s]+\\s*${numeros}$`);
       nomeBase = nomeBase.replace(repeatRegex, "").trim();
    }
    nomeBase = nomeBase.replace(/\s*[-—–:/\\\\|]+\s*$/, "").trim();
    iterations++;
  } while (nomeBase !== prevNome && iterations < 5);

  // 4. Formatação Final: "Nome - 000"
  // SEMPRE usar a referência de 3 dígitos se disponível
  const numDisplay = numeros ? (numeros.length >= 3 ? numeros.slice(-3) : numeros.padStart(3, '0')) : '';
  const nomeExibicao = numDisplay ? `${nomeBase} - ${numDisplay}` : nomeBase;

  return { nomeBase, nomeExibicao, numeros, tamanho };
};

const tests = [
    { nome: "Bermuda jeans laser - 481", ref: "481-34" },
    { nome: "Bermuda jeans laser", ref: "REF-481-36" },
    { nome: "Conjunto alfaiataria - 610", ref: "610-M" }
];

tests.forEach(t => {
    const res = parseProductName(t.nome, t.ref);
    console.log(`Input: "${t.nome}" | Ref: "${t.ref}"`);
    console.log(`Result: "${res.nomeExibicao}"`);
    console.log(`Extracted Ref: ${res.numeros} | Size: ${res.tamanho}`);
    console.log('---');
});
