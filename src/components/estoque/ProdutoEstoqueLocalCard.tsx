import React from 'react';
import { Button } from '@/components/ui/button';
import { LotImage } from '@/components/production/LotImage';
import { EstoqueLocalDetalhado } from '@/hooks/useEstoquePorLocalGerenciamento';
import { Settings, History, Trash2, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ProdutoEstoqueLocalCardProps {
  item: EstoqueLocalDetalhado;
  onAjustar: (item: EstoqueLocalDetalhado) => void;
  onHistorico: (item: EstoqueLocalDetalhado) => void;
  onZerar?: (item: EstoqueLocalDetalhado) => void;
}

export function ProdutoEstoqueLocalCard({
  item,
  onAjustar,
  onHistorico,
  onZerar,
}: ProdutoEstoqueLocalCardProps) {
  return (
    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow w-full">
      {/* Foto */}
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden bg-muted border shrink-0">
        <LotImage
          src={item.itemImagemUrl}
          alt={item.itemNome}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Info - nome do produto */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium truncate text-sm leading-tight">{item.itemNome}</h4>
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">Cód: {item.itemCodigo}</span>
          {item.itemPrecoUnitario && (
            <>
              <span>•</span>
              <span>R$ {item.itemPrecoUnitario.toFixed(2)}</span>
            </>
          )}
        </div>
      </div>

      {/* Linha 2 no mobile: Quantidade + Ações */}
      <div className="flex items-center justify-between w-full sm:w-auto sm:justify-end gap-3 mt-1 sm:mt-0 pl-12 sm:pl-0">
        {/* Quantidade */}
        <div className="text-left sm:text-right shrink-0">
          <div className="flex items-baseline gap-1">
            <p className={cn(
              "text-base sm:text-lg font-bold",
              item.quantidade <= 0 && "text-destructive",
              item.quantidade > 0 && item.quantidade <= 5 && "text-yellow-600"
            )}>
              {item.quantidade}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">peças</p>
          </div>
        </div>

        {/* Ações - DropdownMenu para telas < lg, ícones individuais para >= lg */}
        {/* Mobile/Tablet: DropdownMenu */}
        <div className="lg:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-50">
              <DropdownMenuItem onClick={() => onHistorico(item)}>
                <History className="h-4 w-4 mr-2" />
                Ver histórico
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAjustar(item)}>
                <Settings className="h-4 w-4 mr-2" />
                Ajustar estoque
              </DropdownMenuItem>
              {onZerar && (
                <DropdownMenuItem 
                  onClick={() => onZerar(item)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Zerar estoque
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Desktop: ícones individuais */}
        <div className="hidden lg:flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onHistorico(item)}
            title="Ver histórico"
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onAjustar(item)}
            title="Ajustar estoque"
          >
            <Settings className="h-4 w-4" />
          </Button>
          {onZerar && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onZerar(item)}
              title="Zerar estoque"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
