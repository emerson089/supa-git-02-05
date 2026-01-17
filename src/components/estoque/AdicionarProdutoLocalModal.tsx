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
import { LotImage } from '@/components/production/LotImage';
import { useAdicionarProdutoLocal, useProdutosDisponiveis } from '@/hooks/useEstoquePorLocalGerenciamento';
import { Loader2, Search, Check, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  const { data: produtos = [], isLoading } = useProdutosDisponiveis(localId);
  const adicionarProduto = useAdicionarProdutoLocal();

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
  const isValid = produtoSelecionado && qtd > 0;

  const handleAdicionar = async () => {
    if (!isValid || !produtoSelecionado) return;

    try {
      await adicionarProduto.mutateAsync({
        itemId: produtoSelecionado.id,
        localId: localId,
        quantidade: qtd,
        motivo: motivo.trim() || `Adição inicial ao ${localNome}`,
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
          <DialogTitle>Adicionar Produto ao Estoque</DialogTitle>
          <p className="text-sm text-muted-foreground">{localNome}</p>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
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
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : produtosFiltrados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Package className="h-10 w-10 mb-2 opacity-50" />
                    <p>Nenhum produto encontrado</p>
                  </div>
                ) : (
                  <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-2">
                    {produtosFiltrados.map((produto) => (
                      <button
                        key={produto.id}
                        onClick={() => handleSelecionarProduto(produto)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                          "hover:bg-accent hover:border-accent-foreground/20",
                          produto.jaNoLocal && "opacity-60"
                        )}
                      >
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted border shrink-0">
                          <LotImage
                            src={produto.imagemUrl}
                            alt={produto.nome}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{produto.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            Cód: {produto.codigo}
                            {produto.precoUnitario && (
                              <> • R$ {produto.precoUnitario.toFixed(2)}</>
                            )}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {produto.jaNoLocal ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Check className="h-3 w-3" />
                              Já no local ({produto.quantidadeNoLocal})
                            </span>
                          ) : (
                            <span className="text-xs text-primary">Selecionar</span>
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
                <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted border shrink-0">
                    <LotImage
                      src={produtoSelecionado.imagemUrl}
                      alt={produtoSelecionado.nome}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{produtoSelecionado.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      Cód: {produtoSelecionado.codigo}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setProdutoSelecionado(null)}
                  >
                    Trocar
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantidade-inicial">
                      Quantidade Inicial <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      ref={quantidadeRef}
                      id="quantidade-inicial"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={quantidade}
                      onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ''))}
                      onFocus={(e) => e.target.select()}
                      className="text-lg font-semibold"
                      placeholder="0"
                    />
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

                {produtoSelecionado.jaNoLocal && (
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    Este produto já possui {produtoSelecionado.quantidadeNoLocal} unidades no local.
                    A quantidade informada será somada ao estoque existente.
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleAdicionar}
            disabled={!isValid || adicionarProduto.isPending}
          >
            {adicionarProduto.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
