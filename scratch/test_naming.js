
const parseProductName = (nome, referencia) => {
  const currentRef = (referencia || "").toUpperCase().trim();
  const currentName = (nome || "").trim();

  const sizeMatch = currentRef.match(/^(.+)[-–—](P|M|G|GG|G1|G2|G3|XGG|PEÇAS|\d{2})$/i);
  const refBase = (sizeMatch ? sizeMatch[1] : currentRef).trim();
  const tamanho = sizeMatch ? sizeMatch[2].toUpperCase() : null;

  const numerosMatch = refBase.match(/(\d+)$/);
  let numeros = numerosMatch ? numerosMatch[1] : "";
  
  if (!numeros) {
    const nomeReferenciaMatch = currentName.match(/\s*[—|-]\s*(\d+)$/);
    if (nomeReferenciaMatch) {
      numeros = nomeReferenciaMatch[1];
    } else {
      const finalNumericoMatch = currentName.match(/\s+(\d+)$/);
      if (finalNumericoMatch) {
        numeros = finalNumericoMatch[1];
      }
    }
  }

  const refCurta = numeros ? `REF ${numeros.slice(-3).padStart(3, '0')}` : "";

  let nomeBase = currentName;
  
  if (refBase && nomeBase.includes(refBase)) {
    nomeBase = nomeBase.replace(refBase, '').trim();
  }
  
  let prevNomeBase;
  do {
    prevNomeBase = nomeBase;
    nomeBase = nomeBase.replace(/\s*[—|–|-|:]\s*\d{3,}$/, "").trim();
    nomeBase = nomeBase.replace(/\s*[—|–|-|:]\s*(P|M|G|GG|G1|G2|G3|G4|G5|XG|XGG|PEÇAS|\d{2})$/i, "").trim();
  } while (nomeBase !== prevNomeBase);

  nomeBase = nomeBase.replace(/\s*[—|–|-|:]\s*$/, "").trim();

  const numDisplay = numeros ? numeros.slice(-3).padStart(3, '0') : '';
  const nomeExibicao = numDisplay ? `${nomeBase} - ${numDisplay}` : nomeBase;

  return {
    nomeBase,
    refBase: refBase || numeros,
    tamanho,
    refCurta,
    nomeExibicao,
  };
};

const tests = [
    { nome: "Calça alfaiataria pantalona todas as cores - 870", ref: "Calça alfaiataria pantalona todas as cores - 870" },
    { nome: "short alfaiataria plus - 166", ref: "short alfaiataria plus - 166" },
    { nome: "Conjunto alfaiataria short e blusa tomara que caia — -PEÇAS - 610", ref: "Conjunto alfaiataria short e blusa tomara que caia — -PEÇAS - 610" }
];

tests.forEach(t => {
    const res = parseProductName(t.nome, t.ref);
    console.log(`Input: "${t.nome}"`);
    console.log(`Result: "${res.nomeExibicao}"`);
    console.log(`NomeBase: "${res.nomeBase}"`);
    console.log('---');
});
