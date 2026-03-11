import React, { useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { PedidoPaginatedDB } from '@/hooks/usePedidosPaginated';
import { useEstoque } from '@/contexts/EstoqueContext';
import { Input } from '@/components/ui/input';
import { Search, ArrowUpDown, Package } from 'lucide-react';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

interface ProductSummaryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pedidos: PedidoPaginatedDB[];
}

interface ProductAgg {
    nome: string;
    categoria: string;
    quantidade: number;
    valorTotal: number;
}

export function ProductSummaryModal({
    open,
    onOpenChange,
    pedidos
}: ProductSummaryModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortField, setSortField] = useState<'quantidade' | 'valorTotal'>('quantidade');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    // Load all stock items to cross-reference product categories
    // In a real high-volume scenario we'd do this purely backend, but for 50-200 items in memory this is instant
    const { itens: estoqueItens } = useEstoque();

    const handleSort = (field: 'quantidade' | 'valorTotal') => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc'); // default to descending when changing sort field
        }
    };

    // Group statistics
    const { aggProducts, summaryJeans, summaryAlfaiataria } = useMemo(() => {
        const aggMap = new Map<string, ProductAgg>();
        let jeansQtd = 0;
        let jeansValor = 0;
        let alfaiatariaQtd = 0;
        let alfaiatariaValor = 0;

        // Cross reference and sum
        pedidos.forEach(pedido => {
            (pedido.pedido_itens || []).forEach(item => {
                // Find in stock to get Category
                const stockItem = estoqueItens.find(e => e.id === item.produto_id || e.nome.trim() === item.produto_nome.trim());

                // Define category logic
                let cat = stockItem?.categoria || 'Outros';

                // Sometimes users named it generically or empty, let's try to infer if empty
                const isAlfaiataria = cat.toLowerCase().includes('alfaiataria') || item.produto_nome.toLowerCase().includes('alfaiataria');
                const isJeans = cat.toLowerCase().includes('jeans') || item.produto_nome.toLowerCase().includes('jeans');

                let parentCat = 'Outros';
                if (isAlfaiataria) parentCat = 'Alfaiataria';
                else if (isJeans) parentCat = 'Jeans';
                else if (cat === 'Outros') parentCat = 'Outros'; // Keep standard
                else parentCat = cat; // E.g. "T-Shirt"

                const itemValorTotal = item.quantidade * (item.valor_unitario || 0);

                // Group counters
                if (parentCat === 'Jeans') {
                    jeansQtd += item.quantidade;
                    jeansValor += itemValorTotal;
                } else if (parentCat === 'Alfaiataria') {
                    alfaiatariaQtd += item.quantidade;
                    alfaiatariaValor += itemValorTotal;
                }

                // Aggregate by product model
                let key = item.produto_nome.trim();
                if (key.includes(' | REF: ')) {
                    key = key.split(' | REF: ')[0];
                }
                
                // Clear suffixes if they slipped into the raw name saved in DB
                key = key
                    .replace(/ — Tamanho (PEÇAS)/gi, '')
                    .replace(/ — (PEÇAS)/gi, '')
                    .replace(/-(PEÇAS)/gi, '')
                    .trim();

                const existing = aggMap.get(key);
                if (existing) {
                    existing.quantidade += item.quantidade;
                    existing.valorTotal += itemValorTotal;
                } else {
                    aggMap.set(key, {
                        nome: key,
                        categoria: parentCat,
                        quantidade: item.quantidade,
                        valorTotal: itemValorTotal
                    });
                }
            });
        });

        let results = Array.from(aggMap.values());

        // Client side filter
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            results = results.filter(r =>
                r.nome.toLowerCase().includes(lowerSearch) ||
                r.categoria.toLowerCase().includes(lowerSearch)
            );
        }

        // Client side Sort
        results.sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];

            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        return {
            aggProducts: results,
            summaryJeans: { qtd: jeansQtd, valor: jeansValor },
            summaryAlfaiataria: { qtd: alfaiatariaQtd, valor: alfaiatariaValor }
        };
    }, [pedidos, estoqueItens, searchTerm, sortField, sortDir]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="text-xl text-[#0F172A] flex items-center gap-2">
                        <span>Resumo de Vendas por Produto</span>
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                            (Filtrado pelo período e status atuais da tela)
                        </span>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2 pb-4 space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-4 mt-2">
                        <div className="bg-[#EAEFF9]/40 border border-[#CBD5E1]/50 p-4 rounded-xl relative overflow-hidden group hover:shadow-sm transition-all">
                            <div className="absolute top-0 left-0 w-1 h-full bg-[#3B82F6]"></div>
                            <h3 className="text-sm font-bold text-[#334155] mb-2 uppercase tracking-wider">Total Alfaiataria</h3>
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-2xl font-black text-[#1E293B]">
                                        {summaryAlfaiataria.qtd} <span className="text-sm font-semibold text-muted-foreground">peças</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-[#10B981]">
                                        {formatCurrency(summaryAlfaiataria.valor)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#EAEFF9]/40 border border-[#CBD5E1]/50 p-4 rounded-xl relative overflow-hidden group hover:shadow-sm transition-all">
                            <div className="absolute top-0 left-0 w-1 h-full bg-[#1e293b]"></div>
                            <h3 className="text-sm font-bold text-[#334155] mb-2 uppercase tracking-wider">Total Jeans</h3>
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-2xl font-black text-[#1E293B]">
                                        {summaryJeans.qtd} <span className="text-sm font-semibold text-muted-foreground">peças</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-[#10B981]">
                                        {formatCurrency(summaryJeans.valor)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
                        <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="font-semibold text-[#1E293B] flex items-center gap-2">
                                Lista Detalhada por Modelo
                            </h3>
                            <div className="relative w-64">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                <Input
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Buscar modelo ou categoria..."
                                    className="pl-9 h-8 text-sm"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-[#F8FAFC] text-[#475569]">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold w-[40%] text-slate-700">MODELO</th>
                                        <th className="px-4 py-3 font-semibold w-[20%] text-slate-700">CATEGORIA</th>
                                        <th
                                            className="px-4 py-3 font-semibold text-right cursor-pointer hover:bg-slate-100 transition-colors group"
                                            onClick={() => handleSort('quantidade')}
                                        >
                                            <div className="flex justify-end items-center gap-1 text-slate-700">
                                                QTD VENDIDA
                                                <ArrowUpDown className={`w-3 h-3 ${sortField === 'quantidade' ? 'text-primary' : 'text-slate-400 opacity-0 group-hover:opacity-100'}`} />
                                            </div>
                                        </th>
                                        <th
                                            className="px-4 py-3 font-semibold text-right cursor-pointer hover:bg-slate-100 transition-colors group"
                                            onClick={() => handleSort('valorTotal')}
                                        >
                                            <div className="flex justify-end items-center gap-1 text-slate-700">
                                                VALOR TOTAL
                                                <ArrowUpDown className={`w-3 h-3 ${sortField === 'valorTotal' ? 'text-primary' : 'text-slate-400 opacity-0 group-hover:opacity-100'}`} />
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E2E8F0] tracking-tight">
                                    {aggProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                                                Nenhum produto encontrado neste período com os filtros atuais.
                                            </td>
                                        </tr>
                                    ) : (
                                        aggProducts.map((p, idx) => (
                                            <tr
                                                key={idx}
                                                className="hover:bg-[#F8FAFC]/50 transition-colors duration-150"
                                            >
                                                <td className="px-4 py-3 font-medium text-[#1E293B]">
                                                    {p.nome}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {p.categoria === 'Alfaiataria' && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Alfaiataria</span>}
                                                    {p.categoria === 'Jeans' && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">Jeans</span>}
                                                    {p.categoria !== 'Alfaiataria' && p.categoria !== 'Jeans' && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{p.categoria}</span>}
                                                </td>
                                                <td className="px-4 py-3 font-bold text-right text-[#3B82F6]">
                                                    {p.quantidade}
                                                </td>
                                                <td className="px-4 py-3 font-bold text-right text-[#10B981]">
                                                    {formatCurrency(p.valorTotal)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-between items-center text-sm">
                            <span className="text-slate-500 font-medium">Modelos únicos listados: {aggProducts.length}</span>
                            <span className="font-bold text-slate-700">
                                Total Visível: {aggProducts.reduce((acc, curr) => acc + curr.quantidade, 0)} peças / {formatCurrency(aggProducts.reduce((acc, curr) => acc + curr.valorTotal, 0))}
                            </span>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
