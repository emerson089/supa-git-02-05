
const parseProductName = (nome, referencia) => {
  const currentRef = (referencia || "").trim();
  const currentName = (nome || "").trim();

  let numeros = "";
  const numMatchRef = currentRef.match(/(\d+)$/);
  if (numMatchRef) numeros = numMatchRef[1];
  else {
    const numMatchName = currentName.match(/(\d+)$/);
    if (numMatchName) numeros = numMatchName[1];
  }

  let nomeBase = currentName;
  if (numeros) {
    const cleanupRegex = new RegExp(`\\s*[-—–:/\\\\|\\s]+\\s*([A-Z0-9]+[-—–:/\\\\|\\s]*)?${numeros}$`, 'i');
    nomeBase = nomeBase.replace(cleanupRegex, "").trim();
  }

  let prevNome;
  let iterations = 0;
  do {
    prevNome = nomeBase;
    console.log(`Iteration ${iterations}: "${nomeBase}"`);
    
    nomeBase = nomeBase.replace(/\s*[-—–:/\\\\|]\s*(P|M|G|GG|G1|G2|G3|G4|G5|XG|XGG|PEÇAS|\d{2})$/i, "").trim();
    
    // O problema está aqui?
    nomeBase = nomeBase.replace(/\s*[-—–:/\\\\|]\s*[A-Z0-9]{3,10}$/i, "").trim();

    nomeBase = nomeBase.replace(/\s*[-—–:/\\\\|]+\s*$/, "").trim();

    iterations++;
  } while (nomeBase !== prevNome && iterations < 5);

  const numDisplay = numeros ? numeros.slice(-3).padStart(3, '0') : '';
  const nomeExibicao = numDisplay ? `${nomeBase} - ${numDisplay}` : nomeBase;

  return { nomeBase, nomeExibicao };
};

const tests = [
    { nome: "Calça alfaiataria pantalona todas as cores - 870", ref: "870" }
];

tests.forEach(t => {
    const res = parseProductName(t.nome, t.ref);
    console.log(`Final Result: "${res.nomeExibicao}"`);
});
