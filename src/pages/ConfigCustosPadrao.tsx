import { useState } from 'react';
import { Plus, Trash2, GripVertical, DollarSign, Check, X, Pencil } from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCustosPadrao, CustoPadrao } from '@/hooks/useCustosPadrao';
import { useIsMobile } from '@/hooks/use-mobile';

const TIPOS_CUSTO = [
  'Facção/Costura',
  'Lavanderia',
  'Acabamento',
  'Aviamentos',
  'Material',
  'Transporte',
  'Outros'
];

export default function ConfigCustosPadrao() {
  const isMobile = useIsMobile();
  const { 
    custosPadrao, 
    isLoading, 
    createCustoPadrao, 
    updateCustoPadrao, 
    deleteCustoPadrao,
    toggleAtivo,
    isCreating,
  } = useCustosPadrao();

  // Estado para novo custo
  const [novoTipo, setNovoTipo] = useState('Facção/Costura');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoValor, setNovoValor] = useState('');

  // Estado para edição inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleAddCusto = async () => {
    const valorNum = parseFloat(novoValor) || 0;
    if (!novaDescricao.trim()) {
      return;
    }

    await createCustoPadrao({
      tipo: novoTipo,
      descricao: novaDescricao.trim(),
      valor_unitario: valorNum,
    });

    setNovaDescricao('');
    setNovoValor('');
  };

  const handleStartEdit = (custo: CustoPadrao) => {
    setEditingId(custo.id);
    setEditValue(custo.valor_unitario.toString());
  };

  const handleSaveEdit = async (id: string) => {
    const valorNum = parseFloat(editValue) || 0;
    await updateCustoPadrao({ id, valor_unitario: valorNum });
    setEditingId(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleDelete = async (id: string) => {
    if (confirm('Remover este custo padrão?')) {
      await deleteCustoPadrao(id);
    }
  };

  // Agrupar por tipo
  const custosPorTipo = custosPadrao.reduce((acc, custo) => {
    if (!acc[custo.tipo]) acc[custo.tipo] = [];
    acc[custo.tipo].push(custo);
    return acc;
  }, {} as Record<string, CustoPadrao[]>);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      
      <main className="flex-1 p-4 md:p-6 lg:p-8 pb-24 md:pb-6 overflow-auto">
        <MobileHeader title="Custos Padrão" />
        
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div className="space-y-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <DollarSign className="text-primary" />
              Custos Padrão
            </h1>
            <p className="text-muted-foreground text-sm">
              Configure os custos que são aplicados em todos os lotes. 
              Use o botão "Aplicar Custos Padrão" no modal de custos para adicionar todos de uma vez.
            </p>
          </div>

          {/* Adicionar novo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Plus size={18} className="text-primary" />
                Adicionar Custo Padrão
              </CardTitle>
              <CardDescription>
                Valores por peça que serão aplicados aos lotes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Select value={novoTipo} onValueChange={setNovoTipo}>
                  <SelectTrigger className="sm:w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CUSTO.map(tipo => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Input
                  placeholder="Descrição (ex: Izabel, Sky Blue)"
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  className="flex-1"
                />
                
                <div className="flex gap-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={novoValor}
                      onChange={(e) => setNovoValor(e.target.value)}
                      className="pl-9 w-28"
                    />
                  </div>
                  <Button 
                    onClick={handleAddCusto} 
                    disabled={isCreating || !novaDescricao.trim()}
                    className="shrink-0"
                  >
                    <Plus size={18} className="mr-1" />
                    Adicionar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de custos */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : custosPadrao.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <DollarSign size={40} className="mx-auto mb-3 opacity-30" />
                <p>Nenhum custo padrão cadastrado</p>
                <p className="text-sm mt-1">Adicione custos que se repetem em todos os lotes</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {Object.entries(custosPorTipo).map(([tipo, custos]) => (
                <Card key={tipo}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-primary">
                      {tipo}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {custos.map((custo) => (
                      <div 
                        key={custo.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          custo.ativo 
                            ? 'bg-background' 
                            : 'bg-muted/50 opacity-60'
                        }`}
                      >
                        {/* Drag handle (visual only for now) */}
                        <GripVertical size={16} className="text-muted-foreground/50 shrink-0" />
                        
                        {/* Switch ativo */}
                        <Switch
                          checked={custo.ativo}
                          onCheckedChange={(checked) => toggleAtivo({ id: custo.id, ativo: checked })}
                          className="shrink-0"
                        />
                        
                        {/* Descrição */}
                        <span className={`flex-1 font-medium ${!custo.ativo && 'line-through'}`}>
                          {custo.descricao}
                        </span>
                        
                        {/* Valor - Edição inline */}
                        {editingId === custo.id ? (
                          <div className="flex items-center gap-1">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
                              <Input
                                type="number"
                                step="0.01"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="h-8 w-24 pl-7 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit(custo.id);
                                  if (e.key === 'Escape') handleCancelEdit();
                                }}
                              />
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-emerald-600"
                              onClick={() => handleSaveEdit(custo.id)}
                            >
                              <Check size={16} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={handleCancelEdit}
                            >
                              <X size={16} />
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(custo)}
                            className="flex items-center gap-1 text-sm font-semibold hover:text-primary transition-colors group"
                          >
                            R$ {custo.valor_unitario.toFixed(2)}
                            <Pencil size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                        
                        {/* Suffix */}
                        <span className="text-xs text-muted-foreground">/pç</span>
                        
                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => handleDelete(custo.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Dica */}
          {custosPadrao.length > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm">
              <p className="font-medium text-primary mb-1">💡 Como usar</p>
              <p className="text-muted-foreground">
                Ao abrir o modal de custos de um lote, clique em "Aplicar Custos Padrão" 
                para adicionar todos os custos ativos de uma vez. Depois é só ajustar os valores se necessário.
              </p>
            </div>
          )}
        </div>
      </main>

      {isMobile && <BottomNavigation />}
    </div>
  );
}
