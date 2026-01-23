import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Printer } from 'lucide-react';
import { EstoqueLocalDetalhado } from '@/hooks/useEstoquePorLocalGerenciamento';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PrintEstoqueLocalProps {
  itens: EstoqueLocalDetalhado[];
  localNome: string;
  showPreview?: boolean;
  onClose?: () => void;
  onPrint?: () => void;
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
 * Pode funcionar em modo preview (tela cheia com botões) ou oculto para impressão direta
 */
export function PrintEstoqueLocal({ 
  itens, 
  localNome,
  showPreview = false,
  onClose,
  onPrint
}: PrintEstoqueLocalProps) {
  const itensOrdenados = useMemo(() => ordenarPorReferencia(itens), [itens]);
  const dataHora = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  
  return (
    <div 
      id="print-estoque-area"
      className={cn(showPreview && "print-preview-mode")}
    >
      {/* Barra de ações - visível apenas no preview */}
      {showPreview && (
        <div className="print-preview-actions no-print">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="h-11"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Button 
            onClick={onPrint}
            className="h-11"
          >
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>
      )}
      
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
