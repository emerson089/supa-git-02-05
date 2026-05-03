
const { parseProductName } = require('./src/utils/productNameUtils');

const testCases = [
  "Calça jeans escura lycra - 523",
  "Calça jeans escura lycra - 523 ",
  "Bermuda jeans preta vintage - 963",
  "Bermuda 963 P",
  "Bermuda 963 - P",
  "523-34",
  "Calça 523-34",
  "Calça 523 - 34",
  "Calça jeans escura lycra – 523", // en dash
];

console.log("Testing parseProductName:\n");
testCases.forEach(name => {
  const info = parseProductName(name, name);
  console.log(`Input: "${name}"`);
  console.log(`  refBase: "${info.refBase}"`);
  console.log(`  nomeExibicao: "${info.nomeExibicao}"`);
  console.log('---');
});
