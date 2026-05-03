import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LotImage } from '@/components/production/LotImage';
import { useAjustarEstoqueLocal, EstoqueLocalDetalhado } from '@/hooks/useEstoquePorLocalGerenciamento';
import { useTiposAjuste, useCriarTiposPadrao } from '@/hooks/useTiposAjuste';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRole } from '@/contexts/RoleContext';
import { Loader2, AlertCircle, ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AjusteEstoqueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: EstoqueLocalDetalhado | null;
}

export function AjusteEstoqueModal({ open, onOpenChange, item }: AjusteEstoqueModalProps) {
  const [qtdSaida, setQtdSaida] = useState('0');
  const [qtdEntrada, setQtdEntrada] = useState('0');
  const [preco, setPreco] = useState('');
  const [tipoAjusteId, setTipoAjusteId] = useState<string>('');
  const [observacao, setObservacao] = useState('');
  const inputSaidaRef = useRef<HTMLInputElement>(null);
  const { isAdmin } = useRole();
  const isMobile = useIsMobile();

  const ajustarEstoque = useAjustarEstoqueLocal();
  const { data: tiposAjuste = [], isLoading: isLoadingTipos } = useTiposAjuste(item?.localId);
  const criarTiposPadrao = useCriarTiposPadrao();

  // Reset ao abrir
  useEffect(() => {
    if (open && item) {
      setQtdSaida('0');
      setQtdEntrada('0');
      // Pré-preencher preço com o preço do produto
      const precoInicial = item.precoExibido ?? item.itemPrecoUnitario ?? 0;
      setPreco(precoInicial > 0 ? precoInicial.toFixed(2) : '');
      setTipoAjusteId('');
      setObservacao('');
    }
  }, [open, item]);

  // Auto-foco no campo de saída
  useEffect(() => {
    if (open && inputSaidaRef.current) {
      setTimeout(() => {
        inputSaidaRef.current?.focus();
        inputSaidaRef.current?.select();
      }, 100);
    }
  }, [open]);

  // Criar tipos padrão se não existirem (apenas para admin)
  useEffect(() => {
    if (open && isAdmin && !isLoadingTipos && tiposAjuste.length === 0 && !criarTiposPadrao.isPending) {
      criarTiposPadrao.mutate();
    }
  }, [open, isAdmin, isLoadingTipos, tiposAjuste.length, criarTiposPadrao]);

  if (!item) return null;

  const estoqueAtual = item.quantidade;
  const qtdSaidaInt = parseInt(qtdSaida) || 0;
  const qtdEntradaInt = parseInt(qtdEntrada) || 0;
  const novoEstoqueCalculado = estoqueAtual - qtdSaidaInt + qtdEntradaInt;

  const isSaida = qtdSaidaInt > 0 && qtdEntradaInt === 0;
  const isEntrada = qtdEntradaInt > 0 && qtdSaidaInt === 0;
  const isConflito = qtdSaidaInt > 0 && qtdEntradaInt > 0;
  const semAlteracao = qtdSaidaInt === 0 && qtdEntradaInt === 0;

  // Preço parseado
  const precoNumerico = parseFloat(preco.replace(',', '.')) || 0;

  // Tipo selecionado para compor o motivo
  const tipoSelecionado = tiposAjuste.find(t => t.id === tipoAjusteId);

  const isValid =
    novoEstoqueCalculado >= 0 &&
    tipoAjusteId.length > 0 &&
    !isConflito;

  const handleSaidaChange = (value: string) => {
    const clean = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    setQtdSaida(clean);
  };

  const handleEntradaChange = (value: string) => {
    const clean = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    setQtdEntrada(clean);
  };

  const handlePrecoChange = (value: string) => {
    // Aceitar apenas números, vírgula e ponto
    const clean = value.replace(/[^\d,\.]/g, '');
    setPreco(clean);
  };

  const handleSalvar = async () => {
    if (!isValid || !item) return;

    // Motivo: tipo + observação opcional
    let motivoFinal = tipoSelecionado?.nome || '';
    if (observacao.trim()) {
      motivoFinal += ` - ${observacao.trim()}`;
    }

    try {
      await ajustarEstoque.mutateAsync({
        estoqueLocalId: item.id,
        itemId: item.itemId,
        localId: item.localId,
        novaQuantidade: novoEstoqueCalculado,
        motivo: motivoFinal,
        precoAplicado: precoNumerico > 0 ? precoNumerico : undefined,
        tipoAjusteId,
      });
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  const content = (
    <>
      {/* Produto Info */}
      <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg bg-muted/50 border">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-muted border shrink-0">
          <LotImage
            src={item.itemImagemUrl}
            alt={item.itemNome}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate text-sm sm:text-base">{item.itemNome}</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Cód: {item.itemCodigo}
            {item.itemPrecoUnitario && (
              <> • R$ {item.itemPrecoUnitario.toFixed(2)}</>
            )}
          </p>
        </div>
      </div>

      {/* Grade de quantidades: 4 colunas */}
      <div className="grid grid-cols-4 gap-2">
        {/* Estoque Atual - somente leitura */}
        <div className="text-center">
          <Label className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">
            Estoque Atual
          </Label>
          <div className="flex items-center justify-center h-12 sm:h-14 rounded-md border bg-muted/30">
            <span className="text-base sm:text-2xl font-bold text-muted-foreground">
              {estoqueAtual}
            </span>
          </div>
        </div>

        {/* Qtd de Saída */}
        <div className="text-center">
          <Label htmlFor="qtd-saida" className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">
            Qtd de Saída
          </Label>
          <Input
            ref={inputSaidaRef}
            id="qtd-saida"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={qtdSaida}
            onChange={(e) => handleSaidaChange(e.target.value)}
            onFocus={(e) => { if (e.target.value === '0') setQtdSaida(''); e.target.select(); }}
            onBlur={(e) => { if (e.target.value === '') setQtdSaida('0'); }}
            className={cn(
              "text-base sm:text-2xl font-bold text-center h-12 sm:h-14",
              isSaida && "border-red-400 focus:ring-red-300"
            )}
          />
        </div>

        {/* Qtd de Entrada */}
        <div className="text-center">
          <Label htmlFor="qtd-entrada" className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">
            Qtd de Entrada
          </Label>
          <Input
            id="qtd-entrada"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={qtdEntrada}
            onChange={(e) => handleEntradaChange(e.target.value)}
            onFocus={(e) => { if (e.target.value === '0') setQtdEntrada(''); e.target.select(); }}
            onBlur={(e) => { if (e.target.value === '') setQtdEntrada('0'); }}
            className={cn(
              "text-base sm:text-2xl font-bold text-center h-12 sm:h-14",
              isEntrada && "border-green-400 focus:ring-green-300"
            )}
          />
        </div>

        {/* Novo Estoque - calculado */}
        <div className={cn(
          "text-center p-2 rounded-lg border",
          isSaida && "bg-red-500/10 border-red-400/40",
          isEntrada && "bg-green-500/10 border-green-400/40",
          semAlteracao && "bg-muted/30",
          isConflito && "bg-yellow-500/10 border-yellow-400/40"
        )}>
          <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Novo Estoque</p>
          <div className="flex items-center justify-center gap-0.5 sm:gap-1">
            {isSaida && <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />}
            {isEntrada && <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />}
            <span className={cn(
              "text-xl sm:text-2xl font-bold",
              isSaida && "text-red-600",
              isEntrada && "text-green-600",
              novoEstoqueCalculado < 0 && "text-destructive"
            )}>
              {novoEstoqueCalculado}
            </span>
          </div>
          {isSaida && (
            <p className="text-[10px] sm:text-xs mt-1 text-red-600">
              -{qtdSaidaInt} peças
            </p>
          )}
          {isEntrada && (
            <p className="text-[10px] sm:text-xs mt-1 text-green-600">
              +{qtdEntradaInt} peças
            </p>
          )}
        </div>
      </div>

      {/* Alerta de conflito */}
      {isConflito && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-400/40 text-yellow-700 dark:text-yellow-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p className="text-sm">Use apenas Saída OU Entrada, não ambos ao mesmo tempo</p>
        </div>
      )}

      {/* Preço da Movimentação */}
      <div className="space-y-2">
        <Label htmlFor="preco-mov">
          Preço da Movimentação{' '}
          <span className="text-muted-foreground text-xs">(R$ — opcional)</span>
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
            R$
          </span>
          <Input
            id="preco-mov"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={preco}
            onChange={(e) => handlePrecoChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Pré-preenchido com o preço do produto. Edite se necessário.
        </p>
      </div>

      {/* Tipo de Movimentação */}
      <div className="space-y-2">
        <Label htmlFor="tipo-ajuste">
          Tipo de Movimentação <span className="text-destructive">*</span>
        </Label>
        {isLoadingTipos ? (
          <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Carregando tipos...</span>
          </div>
        ) : tiposAjuste.length === 0 ? (
          <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Criando tipos padrão...</span>
          </div>
        ) : (
          <Select value={tipoAjusteId} onValueChange={setTipoAjusteId}>
            <SelectTrigger id="tipo-ajuste">
              <SelectValue placeholder="Selecione o tipo de movimentação..." />
            </SelectTrigger>
            <SelectContent>
              {tiposAjuste.map(tipo => (
                <SelectItem key={tipo.id} value={tipo.id}>
                  {tipo.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!tipoAjusteId && !isLoadingTipos && tiposAjuste.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Selecione o tipo de movimentação para continuar
          </p>
        )}
      </div>

      {/* Observação (opcional) */}
      <div className="space-y-2">
        <Label htmlFor="observacao">
          Observação <span className="text-muted-foreground text-xs">(opcional)</span>
        </Label>
        <Textarea
          id="observacao"
          placeholder="Detalhe adicional se necessário..."
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          className="min-h-[60px] resize-none text-base sm:text-sm"
        />
      </div>

      {/* Aviso de estoque negativo */}
      {novoEstoqueCalculado < 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p className="text-sm">Estoque não pode ser negativo</p>
        </div>
      )}
    </>
  );

  const footerButtons = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)}>
        Cancelar
      </Button>
      <Button
        onClick={handleSalvar}
        disabled={!isValid || ajustarEstoque.isPending}
        className={cn(
          isEntrada && "bg-green-600 hover:bg-green-700",
        )}
      >
        {ajustarEstoque.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Salvar Movimentação
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[90vh] overflow-hidden flex flex-col">
          <DrawerHeader className="px-4 pt-2 pb-3 border-b shrink-0">
            <DrawerTitle>Movimentações</DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-4">
              {content}
            </div>
          </div>

          <DrawerFooter className="px-4 py-4 border-t shrink-0 bg-background flex-row justify-end gap-2">
            {footerButtons}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[760px] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Movimentações</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            {content}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
          {footerButtons}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
