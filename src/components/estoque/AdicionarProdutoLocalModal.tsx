import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { LotImage } from '@/components/production/LotImage';
import { useAdicionarProdutoLocal, useProdutosDisponiveis } from '@/hooks/useEstoquePorLocalGerenciamento';
import { Loader2, Search, Check, Package, Box, Store, Info, AlertCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AdicionarProdutoLocalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localId: string;
  localNome: string;
}

interface ProdutoDisponivel {
  id: string;
  nome: string;
  codigo: string;
  imagemUrl: string | null;
  precoUnitario: number | null;
  quantidadeCentral: number;
  quantidadeNoLocal: number;
  jaNoLocal: boolean;
}

export function AdicionarProdutoLocalModal({ 
  open, 
  onOpenChange, 
  localId, 
  localNome 
}: AdicionarProdutoLocalModalProps) {
  const [busca, setBusca] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoDisponivel | null>(null);
  const [quantidade, setQuantidade] = useState('');
  const [motivo, setMotivo] = useState('');
  const quantidadeRef = useRef<HTMLInputElement>(null);

  // Condicionar ao open para forçar refetch quando o modal abrir
  const { data: produtos = [], isLoading } = useProdutosDisponiveis(open ? localId : null);
  const transferirProduto = useAdicionarProdutoLocal();

  useEffect(() => {
    if (open) {
      setBusca('');
      setProdutoSelecionado(null);
      setQuantidade('');
      setMotivo('');
    }
  }, [open]);

  useEffect(() => {
    if (produtoSelecionado && quantidadeRef.current) {
      setTimeout(() => {
        quantidadeRef.current?.focus();
        quantidadeRef.current?.select();
      }, 100);
    }
  }, [produtoSelecionado]);

  const produtosFiltrados = produtos.filter((p) => {
    const termo = busca.toLowerCase();
    return p.nome.toLowerCase().includes(termo) || p.codigo.toLowerCase().includes(termo);
  });

  const qtd = parseInt(quantidade) || 0;
  const maxQuantidade = produtoSelecionado?.quantidadeCentral || 0;
  const excedeDisponivel = qtd > maxQuantidade;
  const isValid = produtoSelecionado && qtd > 0 && !excedeDisponivel;

  const handleTransferir = async () => {
    if (!isValid || !produtoSelecionado) return;

    try {
      await transferirProduto.mutateAsync({
        itemId: produtoSelecionado.id,
        localId: localId,
        quantidade: qtd,
        motivo: motivo.trim() || `Transferência para ${localNome}`,
      });
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  const handleSelecionarProduto = (produto: ProdutoDisponivel) => {
    setProdutoSelecionado(produto);
    setQuantidade('1');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[720px] max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Box className="h-5 w-5 text-blue-600" />
            <span>Central</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Store className="h-5 w-5 text-emerald-600" />
            <span>{localNome}</span>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Transferir produtos do Estoque Central</p>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-4">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto por nome ou código..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Lista de produtos */}
            {!produtoSelecionado && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Selecione um produto
                </Label>
                
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : produtosFiltrados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mb-3 opacity-50" />
                    <p className="font-medium">Nenhum produto encontrado</p>
                    <p className="text-sm mt-1">Tente buscar por outro termo</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {produtosFiltrados.map((produto) => (
                      <button
                        key={produto.id}
                        onClick={() => handleSelecionarProduto(produto)}
                        className={cn(
                          "w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all",
                          "hover:bg-accent hover:border-primary/30 hover:shadow-sm",
                          produto.jaNoLocal && "bg-muted/30"
                        )}
                      >
                        {/* Foto */}
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted border shrink-0">
                          <LotImage
                            src={produto.imagemUrl}
                            alt={produto.nome}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Informações */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium leading-tight">{produto.nome}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Cód: {produto.codigo}
                            {produto.precoUnitario && (
                              <> • R$ {produto.precoUnitario.toFixed(2)}</>
                            )}
                          </p>
                          
                          {/* Badges de disponibilidade */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <Badge 
                              variant="secondary" 
                              className={cn(
                                "text-xs font-medium",
                                produto.quantidadeCentral > 0 
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              <Box className="h-3 w-3 mr-1" />
                              Central: {produto.quantidadeCentral} pçs
                            </Badge>
                            {produto.jaNoLocal && (
                              <Badge 
                                variant="secondary" 
                                className="text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              >
                                <Store className="h-3 w-3 mr-1" />
                                Local: {produto.quantidadeNoLocal} pçs
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Ação */}
                        <div className="text-right shrink-0 pt-1">
                          {produto.jaNoLocal ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Check className="h-3 w-3" />
                              Adicionar mais
                            </span>
                          ) : produto.quantidadeCentral > 0 ? (
                            <span className="text-xs text-primary font-medium">Selecionar</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem estoque</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Produto selecionado */}
            {produtoSelecionado && (
              <div className="space-y-4">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Produto Selecionado
                </Label>
                
                <div className="flex items-start gap-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
                  {/* Foto maior */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted border shrink-0">
                    <LotImage
                      src={produtoSelecionado.imagemUrl}
                      alt={produtoSelecionado.nome}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold leading-tight">{produtoSelecionado.nome}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Cód: {produtoSelecionado.codigo}
                    </p>
                    
                    {/* Badges de disponibilidade */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          "text-xs font-medium",
                          produtoSelecionado.quantidadeCentral > 0 
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Box className="h-3 w-3 mr-1" />
                        Central: {produtoSelecionado.quantidadeCentral} disponíveis
                      </Badge>
                      {produtoSelecionado.jaNoLocal && (
                        <Badge 
                          variant="secondary" 
                          className="text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        >
                          <Store className="h-3 w-3 mr-1" />
                          Já no local: {produtoSelecionado.quantidadeNoLocal}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setProdutoSelecionado(null)}
                    className="shrink-0"
                  >
                    Trocar
                  </Button>
                </div>

                {/* Campos de entrada */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantidade-inicial">
                      Quantidade a Transferir <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        ref={quantidadeRef}
                        id="quantidade-inicial"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={quantidade}
                        onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ''))}
                        onFocus={(e) => e.target.select()}
                        className={cn(
                          "text-lg font-semibold pr-24",
                          excedeDisponivel && "border-destructive focus-visible:ring-destructive"
                        )}
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        / {maxQuantidade} disp.
                      </span>
                    </div>
                    {excedeDisponivel && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Quantidade excede o disponível no Central
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="motivo-adicao">Motivo (opcional)</Label>
                    <Input
                      id="motivo-adicao"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Ex: Reposição de estoque"
                    />
                  </div>
                </div>

                {/* Mensagem informativa sobre a transferência */}
                <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800 dark:text-blue-300">
                    A quantidade será <strong>transferida do Estoque Central</strong> para {localNome}.
                    {produtoSelecionado.jaNoLocal && (
                      <> Este produto já possui <strong>{produtoSelecionado.quantidadeNoLocal}</strong> unidades no local, que serão somadas.</>
                    )}
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleTransferir}
            disabled={!isValid || transferirProduto.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {transferirProduto.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <ArrowRight className="h-4 w-4 mr-2" />
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
