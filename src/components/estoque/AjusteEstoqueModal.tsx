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
import { Loader2, AlertCircle, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AjusteEstoqueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: EstoqueLocalDetalhado | null;
}

export function AjusteEstoqueModal({ open, onOpenChange, item }: AjusteEstoqueModalProps) {
  const [estoqueAtualEditavel, setEstoqueAtualEditavel] = useState('');
  const [qtdVendida, setQtdVendida] = useState('0');
  const [tipoAjusteId, setTipoAjusteId] = useState<string>('');
  const [observacao, setObservacao] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { isAdmin } = useRole();
  const isMobile = useIsMobile();
  
  const ajustarEstoque = useAjustarEstoqueLocal();
  const { data: tiposAjuste = [], isLoading: isLoadingTipos } = useTiposAjuste(item?.localId);
  const criarTiposPadrao = useCriarTiposPadrao();

  useEffect(() => {
    if (open && item) {
      setEstoqueAtualEditavel(String(item.quantidade));
      setQtdVendida('0');
      setTipoAjusteId('');
      setObservacao('');
    }
  }, [open, item]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
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

  const estoqueAtualInt = parseInt(estoqueAtualEditavel) || 0;
  const qtdVendidaInt = parseInt(qtdVendida) || 0;
  const novoEstoqueCalculado = estoqueAtualInt - qtdVendidaInt;
  const isSaida = qtdVendidaInt > 0;
  const semAlteracao = qtdVendidaInt === 0;

  // Encontrar nome do tipo selecionado para compor o motivo
  const tipoSelecionado = tiposAjuste.find(t => t.id === tipoAjusteId);

  const isValid = novoEstoqueCalculado >= 0 && estoqueAtualInt >= 0 && tipoAjusteId.length > 0;

  const handleEstoqueAtualChange = (value: string) => {
    const cleanValue = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    setEstoqueAtualEditavel(cleanValue);
  };

  const handleQtdVendidaChange = (value: string) => {
    const cleanValue = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    setQtdVendida(cleanValue);
  };

  const handleSalvar = async () => {
    if (!isValid || !item) return;

    // Montar motivo: tipo de ajuste + observação opcional
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
        precoAplicado: item.precoExibido ?? item.itemPrecoUnitario ?? undefined,
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

      {/* Ajuste de Quantidade */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {/* Estoque Atual - Editável */}
        <div className="text-center">
          <Label htmlFor="estoque-atual" className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">
            Estoque Atual
          </Label>
          <Input
            id="estoque-atual"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={estoqueAtualEditavel}
            onChange={(e) => handleEstoqueAtualChange(e.target.value)}
            onFocus={(e) => { if (e.target.value === '0') setEstoqueAtualEditavel(''); e.target.select(); }}
            onBlur={(e) => { if (e.target.value === '') setEstoqueAtualEditavel('0'); }}
            className={cn(
              "text-base sm:text-2xl font-bold text-center h-12 sm:h-14",
              estoqueAtualInt < 0 && "border-destructive"
            )}
          />
        </div>

        {/* Qtd Vendida */}
        <div className="text-center">
          <Label htmlFor="qtd-vendida" className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">
            Qtd Vendida
          </Label>
          <Input
            ref={inputRef}
            id="qtd-vendida"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={qtdVendida}
            onChange={(e) => handleQtdVendidaChange(e.target.value)}
            onFocus={(e) => { if (e.target.value === '0') setQtdVendida(''); e.target.select(); }}
            onBlur={(e) => { if (e.target.value === '') setQtdVendida('0'); }}
            className="text-base sm:text-2xl font-bold text-center h-12 sm:h-14"
          />
        </div>

        {/* Novo Estoque (calculado) */}
        <div className={cn(
          "text-center p-2 sm:p-4 rounded-lg border",
          isSaida && "bg-red-500/10 border-red-500/30",
          semAlteracao && "bg-muted/30"
        )}>
          <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Novo Estoque</p>
          <div className="flex items-center justify-center gap-0.5 sm:gap-1">
            {isSaida && <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />}
            <span className={cn(
              "text-xl sm:text-2xl font-bold",
              isSaida && "text-red-600",
              novoEstoqueCalculado < 0 && "text-destructive"
            )}>
              {novoEstoqueCalculado}
            </span>
          </div>
          {isSaida && (
            <p className="text-[10px] sm:text-xs mt-1 text-red-600">
              -{qtdVendidaInt} peças
            </p>
          )}
        </div>
      </div>

      {/* Tipo de Ajuste */}
      <div className="space-y-2">
        <Label htmlFor="tipo-ajuste">
          Tipo de Ajuste <span className="text-destructive">*</span>
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
              <SelectValue placeholder="Selecione o tipo de ajuste..." />
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
            Selecione o tipo de ajuste para continuar
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

      {/* Aviso */}
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
      >
        {ajustarEstoque.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Salvar Ajuste
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[85vh] overflow-hidden flex flex-col">
          <DrawerHeader className="px-4 pt-2 pb-3 border-b shrink-0">
            <DrawerTitle>Ajustar Estoque</DrawerTitle>
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
      <DialogContent className="w-[96vw] max-w-[720px] max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Ajustar Estoque</DialogTitle>
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
