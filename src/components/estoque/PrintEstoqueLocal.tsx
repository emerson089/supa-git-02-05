import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EstoqueLocalDetalhado } from '@/hooks/useEstoquePorLocalGerenciamento';
import { useSignedUrl } from '@/hooks/useSignedUrl';

interface PrintEstoqueLocalProps {
  itens: EstoqueLocalDetalhado[];
  localNome: string;
}

/**
 * Extrai referência numérica do nome do produto
 * Exemplo: "Short Alfa. botoes salmao - 170" → "170"
 */
function extrairReferencia(nome: string): string {
  const match = nome.match(/\s*-\s*(\d+)$/);
  return match ? match[1] : '-';
}

/**
 * Ordena itens por referência numérica
 */
function ordenarPorReferencia(itens: EstoqueLocalDetalhado[]): EstoqueLocalDetalhado[] {
  return [...itens].sort((a, b) => {
    const refA = extrairReferencia(a.itemNome);
    const refB = extrairReferencia(b.itemNome);
    const numA = parseInt(refA, 10);
    const numB = parseInt(refB, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;
    return refA.localeCompare(refB);
  });
}

/**
 * Componente de imagem com fallback para placeholder
 */
function PrintImage({ src, alt }: { src: string | null; alt: string }) {
  const { signedUrl, loading } = useSignedUrl(src);
  
  if (!src) {
    return (
      <div className="print-placeholder">
        <span>Sem<br/>foto</span>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="print-placeholder">
        <span>...</span>
      </div>
    );
  }
  
  return (
    <>
      <img 
        src={signedUrl || ''} 
        alt={alt}
        className="print-thumbnail"
        onError={(e) => {
          const target = e.currentTarget;
          target.style.display = 'none';
          const fallback = target.nextElementSibling as HTMLElement;
          if (fallback) fallback.style.display = 'flex';
        }}
      />
      <div className="print-placeholder" style={{ display: 'none' }}>
        <span>Sem<br/>foto</span>
      </div>
    </>
  );
}

/**
 * Linha individual da tabela
 */
function PrintRow({ item }: { item: EstoqueLocalDetalhado }) {
  const referencia = extrairReferencia(item.itemNome);
  
  return (
    <tr>
      <td>
        <PrintImage src={item.itemImagemUrl} alt={item.itemNome} />
      </td>
      <td>{item.itemNome}</td>
      <td>{referencia}</td>
      <td>
        <div className="print-qty-cell" />
      </td>
    </tr>
  );
}

/**
 * Componente de layout para impressão do relatório de estoque
 * Fica oculto na tela e só aparece durante window.print()
 */
export function PrintEstoqueLocal({ itens, localNome }: PrintEstoqueLocalProps) {
  const itensOrdenados = useMemo(() => ordenarPorReferencia(itens), [itens]);
  const dataHora = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  
  return (
    <div id="print-estoque-area">
      {/* Header */}
      <div className="print-header">
        <h1>ESTOQUE – {localNome.toUpperCase()}</h1>
        <p>Gerado em {dataHora} • {itensOrdenados.length} modelos</p>
      </div>
      
      {/* Tabela */}
      <table>
        <thead>
          <tr>
            <th>Foto</th>
            <th>Modelo</th>
            <th>Ref.</th>
            <th>Quantidade</th>
          </tr>
        </thead>
        <tbody>
          {itensOrdenados.map((item) => (
            <PrintRow key={item.id} item={item} />
          ))}
        </tbody>
      </table>
      
      {/* Footer */}
      <div className="print-footer">
        <p>Relatório de Estoque para Contagem Manual</p>
      </div>
    </div>
  );
}
