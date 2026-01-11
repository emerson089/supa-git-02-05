import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Eye, Pencil, FileText, Trash2, MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PedidoPaginatedDB } from '@/hooks/usePedidosPaginated';
import { InlineStatusSelect } from './InlineStatusSelect';
import {
  statusPagamentoOptions,
  statusPedidoOptions,
  statusEntregaOptions,
} from './StatusSelector';

// Status colors mapping
const statusPagamentoColors: Record<string, string> = {
  'PAGO': 'bg-emerald-100 text-emerald-700 border-emerald-300',
  'PENDENTE': 'bg-amber-100 text-amber-700 border-amber-300',
  'CANCELADO': 'bg-red-100 text-red-700 border-red-300',
  'INCOMPLETO': 'bg-purple-100 text-purple-700 border-purple-300',
  'PEND. ENTREGA': 'bg-blue-100 text-blue-700 border-blue-300',
  'GOLPE CANCELADO': 'bg-zinc-900 text-white border-zinc-900',
};

const statusPedidoColors: Record<string, string> = {
  'SEPARADO': 'bg-emerald-100 text-emerald-700 border-emerald-300',
  'NÃO SEPARADO': 'bg-amber-100 text-amber-700 border-amber-300',
  'AMANHÃ': 'bg-blue-100 text-blue-700 border-blue-300',
  'INCOMPLETO': 'bg-purple-100 text-purple-700 border-purple-300',
  'CANCELADO': 'bg-red-100 text-red-700 border-red-300',
  'GOLPE CANCELADO': 'bg-zinc-900 text-white border-zinc-900',
};

const statusEntregaColors: Record<string, string> = {
  'ENTREGUE': 'bg-emerald-100 text-emerald-700 border-emerald-300',
  'RETIRADA': 'bg-blue-100 text-blue-700 border-blue-300',
  'PRÓX. SEMANA': 'bg-amber-100 text-amber-700 border-amber-300',
  'PEND. ENTREGA': 'bg-blue-100 text-blue-700 border-blue-300',
  'NÃO ENTREGOU': 'bg-red-100 text-red-700 border-red-300',
  'ENTREGOU ERRADO': 'bg-red-100 text-red-700 border-red-300',
  'CANCELADO': 'bg-red-100 text-red-700 border-red-300',
};

interface MobileOrderCardProps {
  pedido: PedidoPaginatedDB;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onGeneratePDF: () => void;
  onStatusUpdate: (field: 'statusPagamento' | 'statusPedido' | 'statusEntrega', value: string) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const getModelosResumo = (pedido: PedidoPaginatedDB) => {
  const itens = pedido.pedido_itens || [];
  if (itens.length === 0) return '-';
  if (itens.length === 1) return itens[0].produto_nome;
  return `${itens[0].produto_nome} +${itens.length - 1}`;
};

export function MobileOrderCard({
  pedido,
  onView,
  onEdit,
  onDelete,
  onGeneratePDF,
  onStatusUpdate,
}: MobileOrderCardProps) {
  return (
    <div className="neu-card p-4 space-y-3">
      {/* Header com nome, data e valor */}
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{pedido.cliente_nome}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(pedido.created_at), "dd/MM/yyyy", { locale: ptBR })} • {pedido.total_pecas || 0} pçs
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {getModelosResumo(pedido)}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <span className="font-bold text-lg text-emerald-600">
            {formatCurrency(pedido.valor_total || 0)}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="neu-card border-0 rounded-xl shadow-lg z-50">
              <DropdownMenuItem onClick={onView} className="gap-2 cursor-pointer">
                <Eye className="h-4 w-4" />
                Ver Detalhes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit} className="gap-2 cursor-pointer">
                <Pencil className="h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onGeneratePDF} className="gap-2 cursor-pointer">
                <FileText className="h-4 w-4" />
                Gerar PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Status badges - clicáveis para editar */}
      <div className="flex gap-1.5 flex-wrap">
        <InlineStatusSelect
          options={statusPagamentoOptions}
          value={pedido.status_pagamento || 'PENDENTE'}
          onChange={(value) => onStatusUpdate('statusPagamento', value)}
        />
        <InlineStatusSelect
          options={statusPedidoOptions}
          value={pedido.status_pedido || 'NÃO SEPARADO'}
          onChange={(value) => onStatusUpdate('statusPedido', value)}
        />
        <InlineStatusSelect
          options={statusEntregaOptions}
          value={pedido.status_entrega || 'PEND. ENTREGA'}
          onChange={(value) => onStatusUpdate('statusEntrega', value)}
        />
      </div>
    </div>
  );
}
