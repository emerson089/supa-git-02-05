import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LotImage } from '@/components/production/LotImage';
import { Loader2, AlertTriangle, ArrowRight, Package, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TransferenciaComItensHistorico, calcularTotaisCargaPublic } from '@/hooks/useFeiraHistorico';
import { format } from 'date-fns';
import { parseProductName } from '@/utils/productNameUtils';

interface EditarRetornoCargaModalProps {
  carga: TransferenciaComItensHistorico | null;
  onClose: () => void;
  onConfirm: (
    transferenciaId: string,
    itensCorrigidos: Array<{
      itemId: string;
      novaQuantidadeRetornada: number;
      quantidadeEnviadaOriginal: number;
      quantidadeRetornadaAnterior: number;
    }>,
    motivo: string
  ) => void;
  isLoading: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function EditarRetornoCargaModal({
  carga,
  onClose,
  onConfirm,
  isLoading,
}: EditarRetornoCargaModalProps) {
  const [motivo, setMotivo] = useState('');
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');

  // Inicializar valores quando modal abre
  useEffect(() => {
    if (carga) {
      const initialValues: Record<string, string> = {};
      carga.itens.forEach((item) => {
        initialValues[item.itemId] = String(item.quantidadeRetornada ?? 0);
      });
      setInputValues(initialValues);
      setMotivo('');
      setSearchTerm('');
    }
  }, [carga]);

  // Calcular novos valores e deltas
  const { itensComDelta, resumoAntes, resumoDepois, temAlteracoes } = useMemo(() => {
    if (!carga) {
      return {
        itensComDelta: [],
        resumoAntes: { enviado: 0, retornado: 0, vendido: 0, valor: 0 },
        resumoDepois: { enviado: 0, retornado: 0, vendido: 0, valor: 0 },
        temAlteracoes: false,
      };
    }

    const itensComDelta = carga.itens.map((item) => {
      const retornoAnterior = item.quantidadeRetornada ?? 0;
      const novoRetorno = parseInt(inputValues[item.itemId] || '0', 10) || 0;
      const delta = novoRetorno - retornoAnterior;
      const novoVendido = Math.max(0, item.quantidadeEnviada - novoRetorno);
      const preco = item.precoUnitario ?? item.produtoPreco ?? 0;

      return {
        ...item,
        retornoAnterior,
        novoRetorno,
        delta,
        vendidoAnterior: Math.max(0, item.quantidadeEnviada - retornoAnterior),
        novoVendido,
        valorAnterior: Math.max(0, item.quantidadeEnviada - retornoAnterior) * preco,
        novoValor: novoVendido * preco,
      };
    });

    const resumoAntes = calcularTotaisCargaPublic(carga.itens);
    
    // Calcular resumo depois
    let retornadoDepois = 0;
    let vendidoDepois = 0;
    let valorDepois = 0;

    itensComDelta.forEach((item) => {
      retornadoDepois += item.novoRetorno;
      vendidoDepois += item.novoVendido;
      valorDepois += item.novoValor;
    });

    const resumoDepois = {
      enviado: resumoAntes.enviado,
      retornado: retornadoDepois,
      vendido: vendidoDepois,
      valor: valorDepois,
    };

    const temAlteracoes = itensComDelta.some((item) => item.delta !== 0);

    return { itensComDelta, resumoAntes, resumoDepois, temAlteracoes };
  }, [carga, inputValues]);

  // Filtrar itens baseado no termo de busca
  const itensFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return itensComDelta;
    
    const termo = searchTerm.toLowerCase().trim();
    
    return itensComDelta.filter((item) => {
      const nome = (item.produtoNome || '').toLowerCase();
      return nome.includes(termo);
    });
  }, [itensComDelta, searchTerm]);

  const handleUpdateRetorno = (itemId: string, value: string) => {
    // Permitir apenas números
    if (value !== '' && !/^\d+$/.test(value)) return;
    
    const item = carga?.itens.find((i) => i.itemId === itemId);
    if (!item) return;

    const numValue = parseInt(value, 10) || 0;
    
    // Limitar ao máximo enviado
    if (numValue > item.quantidadeEnviada) {
      setInputValues((prev) => ({
        ...prev,
        [itemId]: String(item.quantidadeEnviada),
      }));
      return;
    }

    setInputValues((prev) => ({
      ...prev,
      [itemId]: value,
    }));
  };

  // Debug: log estado do botão
  console.log('[EditarRetornoCargaModal] Estado do botão:', {
    isLoading,
    temAlteracoes,
    motivoPreenchido: !!motivo.trim(),
    itensAlterados: itensComDelta.filter(i => i.delta !== 0).length,
  });

  const handleConfirm = () => {
    console.log('[EditarRetornoCargaModal] handleConfirm chamado');
    
    if (!carga || !motivo.trim()) {
      console.log('[EditarRetornoCargaModal] Validação falhou:', { carga: !!carga, motivo: motivo.trim() });
      return;
    }

    const itensCorrigidos = itensComDelta
      .filter((item) => item.delta !== 0)
      .map((item) => ({
        itemId: item.itemId,
        novaQuantidadeRetornada: item.novoRetorno,
        quantidadeEnviadaOriginal: item.quantidadeEnviada,
        quantidadeRetornadaAnterior: item.retornoAnterior,
      }));

    console.log('[EditarRetornoCargaModal] Chamando onConfirm com:', {
      cargaId: carga.id,
      itensCorrigidos: itensCorrigidos.length,
      motivo: motivo.trim(),
    });
    
    onConfirm(carga.id, itensCorrigidos, motivo.trim());
  };

  if (!carga) return null;

  const dataFormatada = format(new Date(carga.dataSaida), 'dd/MM/yyyy HH:mm');

  return (
    <Dialog open={!!carga} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-2xl sm:h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Corrigir Retorno
          </DialogTitle>
          <DialogDescription>
            Carga #{carga.id.slice(0, 8)} • {dataFormatada}
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 shrink-0">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            Esta carga já foi concluída. A correção irá ajustar o estoque baseado na diferença.
          </AlertDescription>
        </Alert>

        <div className="space-y-3 shrink-0">
          <Label htmlFor="motivo">Motivo da correção *</Label>
          <Textarea
            id="motivo"
            placeholder="Descreva o motivo da correção (ex: Erro na contagem do retorno)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="resize-none"
            rows={2}
          />
        </div>

        <div className="flex items-center justify-between shrink-0 py-2 border-b gap-3">
          <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">
            {itensFiltrados.length === itensComDelta.length 
              ? `${itensComDelta.length} produto(s)`
              : `${itensFiltrados.length} de ${itensComDelta.length} produto(s)`
            }
          </span>
          
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por nome ou referência..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 h-8 text-sm"
            />
            {searchTerm && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground"
                onClick={() => setSearchTerm('')}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y pr-1">
          <div className="space-y-3">
            {itensFiltrados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum produto encontrado para "{searchTerm}"</p>
              </div>
            ) : (
            itensFiltrados.map((item) => {
              const preco = item.precoUnitario ?? item.produtoPreco ?? 0;

              return (
                <div
                  key={item.itemId}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                    item.delta !== 0
                      ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800'
                      : 'bg-muted/30'
                  )}
                >
                  <LotImage
                    src={item.produtoImagem}
                    alt={item.produtoNome || 'Produto'}
                    containerClassName="w-10 h-10 rounded-md flex-shrink-0"
                    eager
                  />

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {parseProductName(item.produtoNome || "", item.itemId).nomeExibicao}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>•</span>
                      <span>Env: {item.quantidadeEnviada}</span>
                      <span>•</span>
                      <span>{formatCurrency(preco)}/un</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right text-xs">
                      <p className="text-muted-foreground">Retorno</p>
                      <p className="text-muted-foreground line-through">
                        {item.retornoAnterior}
                      </p>
                    </div>

                    <ArrowRight className="h-4 w-4 text-muted-foreground" />

                    <Input
                      type="text"
                      inputMode="numeric"
                      value={inputValues[item.itemId] || '0'}
                      onChange={(e) => handleUpdateRetorno(item.itemId, e.target.value)}
                      className={cn(
                        'w-16 text-center font-medium',
                        item.delta !== 0 && 'border-amber-400 ring-1 ring-amber-200'
                      )}
                    />

                    {item.delta !== 0 && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs min-w-[50px] justify-center',
                          item.delta > 0
                            ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                            : 'border-red-300 text-red-700 bg-red-50'
                        )}
                      >
                        {item.delta > 0 ? '+' : ''}{item.delta}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })
            )}
          </div>
        </div>

        {/* Resumo das alterações */}
        {temAlteracoes && (
          <div className="border rounded-lg p-4 bg-muted/30 space-y-2 shrink-0">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Package className="h-4 w-4" />
              Resumo das alterações
            </h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Retorno</p>
                <p>
                  <span className="line-through text-muted-foreground">{resumoAntes.retornado}</span>
                  <ArrowRight className="inline h-3 w-3 mx-1" />
                  <span className="font-medium">{resumoDepois.retornado}</span>
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Vendido</p>
                <p>
                  <span className="line-through text-muted-foreground">{resumoAntes.vendido}</span>
                  <ArrowRight className="inline h-3 w-3 mx-1" />
                  <span className="font-medium text-emerald-600">{resumoDepois.vendido}</span>
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Valor</p>
                <p>
                  <span className="line-through text-muted-foreground">
                    {formatCurrency(resumoAntes.valor)}
                  </span>
                  <ArrowRight className="inline h-3 w-3 mx-1" />
                  <span className="font-medium text-primary">
                    {formatCurrency(resumoDepois.valor)}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading || !temAlteracoes || !motivo.trim()}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Correção'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
