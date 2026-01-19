import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEstoque, ItemEstoque, TipoEstoque, StatusEstoque } from '@/contexts/EstoqueContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, Plus, Package, Layers, AlertTriangle, Edit, Trash2, PackageCheck, Pencil, Check, X, Upload, ImagePlus, FileSpreadsheet, DollarSign, PackageX, Download, FileText, Image, ChevronDown, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { supabase } from '@/integrations/supabase/client';
import { ImportModelosCSVModal } from '@/components/estoque/ImportModelosCSVModal';
import { ProductCard } from '@/components/estoque/ProductCard';
import { MobileProductCard } from '@/components/estoque/MobileProductCard';
import { EstoqueItemSchema, NovoModeloAcabadoSchema } from '@/lib/validations';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { getSignedUrl, getImageAsBase64 } from '@/utils/imageUtils';
import jsPDF from 'jspdf';

type FiltroRapido = 'todos' | 'esgotado' | 'baixo';
const statusConfig: Record<StatusEstoque, { label: string; color: string }> = {
  disponivel: { label: 'Disponível', color: 'bg-emerald-100 text-emerald-700' },
  em_producao: { label: 'Em Produção', color: 'bg-blue-100 text-blue-700' },
  reservado: { label: 'Reservado', color: 'bg-amber-100 text-amber-700' },
  baixo_estoque: { label: 'Baixo Estoque', color: 'bg-red-100 text-red-700' },
};

const categoriasMateriaPrima = ['Tecido', 'Aviamentos', 'Acessórios', 'Embalagem'];

// Component for product image with signed URL support
function ProductImage({ imagemUrl, nome }: { imagemUrl?: string; nome: string }) {
  const { signedUrl, loading } = useSignedUrl(imagemUrl);
  
  if (!imagemUrl) {
    return (
      <div className="p-2 rounded-lg bg-primary/10">
        <Package size={20} className="text-primary" />
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="w-12 h-12 rounded-lg bg-muted/50 animate-pulse" />
    );
  }
  
  return (
    <div className="w-12 h-12 rounded-lg overflow-hidden shadow-[inset_1px_1px_3px_hsl(var(--muted)/0.4)] border border-border/30">
      <img 
        src={signedUrl || imagemUrl} 
        alt={nome}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

export default function Estoque() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { itens, addItem, updateItem, removeItem, getMateriasPrimas, getProdutosAcabados } = useEstoque();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'materia_prima' | 'produto_acabado'>('produto_acabado');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ItemEstoque | null>(null);
  const [editingItem, setEditingItem] = useState<ItemEstoque | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState<number>(0);
  const [formData, setFormData] = useState<{
    nome: string;
    categoria: string;
    quantidade: number | string;
    unidade: string;
    quantidadeMinima: number | string;
    precoUnitario: number | string;
    localizacao: string;
  }>({
    nome: '',
    categoria: '',
    quantidade: '',
    unidade: 'metros',
    quantidadeMinima: '',
    precoUnitario: '',
    localizacao: '',
  });

  // Modal para Novo Modelo Acabado
  const [showNovoModeloModal, setShowNovoModeloModal] = useState(false);
  const [showDuplicadoModal, setShowDuplicadoModal] = useState(false);
  const [produtoDuplicado, setProdutoDuplicado] = useState<ItemEstoque | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [novoModeloForm, setNovoModeloForm] = useState({
    nome: '',
    referencia: '',
    quantidade: 0,
    precoVenda: 0,
    imagemUrl: '',
    imagemPreview: '',
  });

  // Modal para importação CSV
  const [showImportModal, setShowImportModal] = useState(false);

  // Filtro rápido
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapido>('todos');

  // Função de refresh manual
  const handleRefreshData = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['estoque-itens'] });
    await queryClient.invalidateQueries({ queryKey: ['estoque-por-local'] });
    setIsRefreshing(false);
    toast.success('Dados atualizados');
  };

  // Export CSV function
  const handleExportModelos = () => {
    if (itensFiltrados.length === 0) {
      toast.error('Não há modelos para exportar.');
      return;
    }

    const headers = ['Nome', 'Categoria', 'Quantidade', 'Unidade', 'Preço Unitário', 'Localização'];
    
    const csvRows = [
      headers.join(','),
      ...itensFiltrados.map(item => 
        [
          item.nome,
          item.categoria,
          item.quantidade.toString(),
          item.unidade,
          (item.precoUnitario || 0).toFixed(2),
          item.localizacao || ''
        ].map(field => `"${(field || '').replace(/"/g, '""')}"`).join(',')
      )
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `modelos_estoque_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`${itensFiltrados.length} modelos exportados com sucesso!`);
  };

  // Export PDF with images function
  const handleExportModelosPDF = async () => {
    if (itensFiltrados.length === 0) {
      toast.error('Não há modelos para exportar.');
      return;
    }

    toast.info('Gerando PDF com imagens... Isso pode levar alguns segundos.');
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Title
      doc.setFontSize(18);
      doc.text('Catálogo de Modelos', pageWidth / 2, 20, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`Exportado em: ${new Date().toLocaleDateString('pt-BR')} - ${itensFiltrados.length} modelos`, pageWidth / 2, 28, { align: 'center' });
      
      let yPosition = 45;
      const itemsPerRow = 3;
      const cardWidth = 55;
      const cardHeight = 65;
      const imageHeight = 38;
      const margin = 15;
      const spacing = 5;
      
      for (let i = 0; i < itensFiltrados.length; i++) {
        const item = itensFiltrados[i];
        const col = i % itemsPerRow;
        const xPosition = margin + (col * (cardWidth + spacing));
        
        // New page if needed
        if (i > 0 && col === 0 && yPosition + cardHeight > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
        }
        
        // Draw card background
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(xPosition, yPosition, cardWidth, cardHeight, 3, 3, 'F');
        
        // Fetch and add image
        if (item.imagemUrl) {
          try {
            const signedUrl = await getSignedUrl(item.imagemUrl);
            if (signedUrl) {
              const base64 = await getImageAsBase64(signedUrl);
              if (base64) {
                doc.addImage(base64, 'JPEG', xPosition + 2, yPosition + 2, cardWidth - 4, imageHeight, undefined, 'MEDIUM');
              }
            }
          } catch (e) {
            console.error('Erro ao carregar imagem:', e);
          }
        } else {
          // Placeholder for no image
          doc.setFillColor(220, 220, 220);
          doc.rect(xPosition + 2, yPosition + 2, cardWidth - 4, imageHeight, 'F');
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text('Sem imagem', xPosition + cardWidth / 2, yPosition + imageHeight / 2 + 2, { align: 'center' });
        }
        
        // Product data
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(7);
        const nome = item.nome.length > 30 ? item.nome.substring(0, 30) + '...' : item.nome;
        doc.text(nome, xPosition + 2, yPosition + imageHeight + 8);
        
        doc.setFontSize(6);
        doc.setTextColor(100, 100, 100);
        doc.text(`Qtd: ${item.quantidade} ${item.unidade}`, xPosition + 2, yPosition + imageHeight + 14);
        
        doc.setTextColor(0, 128, 0);
        doc.text(`R$ ${(item.precoUnitario || 0).toFixed(2)}`, xPosition + 2, yPosition + imageHeight + 20);
        
        // Next row
        if (col === itemsPerRow - 1) {
          yPosition += cardHeight + spacing;
        }
      }
      
      doc.save(`modelos_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
      toast.success(`${itensFiltrados.length} modelos exportados em PDF!`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF. Tente novamente.');
    }
  };

  const materiasPrimas = getMateriasPrimas();
  const produtosAcabados = getProdutosAcabados();

  const itensExibidos = activeTab === 'materia_prima' ? materiasPrimas : produtosAcabados;
  
  // Apply search filter
  let itensFiltrados = itensExibidos.filter(
    item =>
      item.nome.toLowerCase().includes(search.toLowerCase()) ||
      item.categoria.toLowerCase().includes(search.toLowerCase())
  );

  // Apply quick filter
  if (filtroRapido === 'esgotado') {
    itensFiltrados = itensFiltrados.filter(item => item.quantidade === 0);
  } else if (filtroRapido === 'baixo') {
    itensFiltrados = itensFiltrados.filter(item => item.quantidade > 0 && item.quantidade <= 20);
  }

  const itensComBaixoEstoque = itens.filter(item => item.status === 'baixo_estoque');

  // Metrics calculations
  const totalPecas = itensExibidos.reduce((sum, item) => sum + item.quantidade, 0);
  const valorTotal = itensExibidos.reduce((sum, item) => sum + (item.precoUnitario * item.quantidade), 0);
  const itensAlerta = itensExibidos.filter(item => item.quantidade > 0 && item.quantidade <= 20).length;
  const itensEsgotados = itensExibidos.filter(item => item.quantidade === 0).length;

  const handleOpenModal = (item?: ItemEstoque) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        nome: item.nome,
        categoria: item.categoria,
        quantidade: item.quantidade,
        unidade: item.unidade,
        quantidadeMinima: item.quantidadeMinima ?? 0,
        precoUnitario: item.precoUnitario ?? 0,
        localizacao: item.localizacao ?? '',
      });
    } else {
      setEditingItem(null);
      setFormData({
        nome: '',
        categoria: '',
        quantidade: 0,
        unidade: 'metros',
        quantidadeMinima: 0,
        precoUnitario: 0,
        localizacao: '',
      });
    }
    setShowModal(true);
  };

  const handleSave = () => {
    // Validate with Zod schema
    const result = EstoqueItemSchema.safeParse(formData);
    if (!result.success) {
      const firstError = result.error.errors[0]?.message || 'Dados inválidos';
      toast.error(firstError);
      return;
    }

    // Para matéria-prima, categoria é obrigatória
    if ((!editingItem || editingItem.tipo === 'materia-prima') && !formData.categoria) {
      toast.error('Preencha a categoria do item');
      return;
    }

    // Converter valores para número (campos podem estar vazios como string)
    const dataToSave = {
      nome: formData.nome,
      categoria: formData.categoria,
      quantidade: formData.quantidade === '' ? 0 : Number(formData.quantidade),
      unidade: formData.unidade,
      quantidadeMinima: formData.quantidadeMinima === '' ? 0 : Number(formData.quantidadeMinima),
      precoUnitario: formData.precoUnitario === '' ? 0 : Number(formData.precoUnitario),
      localizacao: formData.localizacao,
    };

    if (editingItem) {
      // Para produtos acabados, atualiza apenas nome, quantidade e localização
      if (editingItem.tipo === 'acabado') {
        updateItem(editingItem.id, {
          nome: dataToSave.nome,
          quantidade: dataToSave.quantidade,
          localizacao: dataToSave.localizacao,
        });
      } else {
        updateItem(editingItem.id, dataToSave);
      }
      toast.success('Item atualizado com sucesso!');
    } else {
      addItem({
        ...dataToSave,
        tipo: 'materia_prima',
      });
      toast.success('Item adicionado ao estoque!');
    }
    setShowModal(false);
  };

  const handleDeleteClick = (item: ItemEstoque) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    if (itemToDelete) {
      const itemId = itemToDelete.id;
      
      // Fechar modal IMEDIATAMENTE para feedback instantâneo
      setShowDeleteModal(false);
      setItemToDelete(null);
      
      // Executar exclusão em background (optimistic update já remove da lista)
      removeItem(itemId)
        .then(() => {
          toast.success('Item removido do estoque');
        })
        .catch((error: any) => {
          toast.error(error.message || 'Erro ao excluir item');
          // Rollback automático no onError do mutation
        });
    }
  };

  const handleStartEditPrice = (item: ItemEstoque) => {
    setEditingPriceId(item.id);
    setEditingPriceValue(item.precoUnitario);
  };

  const handleSavePrice = (itemId: string) => {
    updateItem(itemId, { precoUnitario: editingPriceValue });
    setEditingPriceId(null);
    toast.success('Preço atualizado!');
  };

  const handleCancelEditPrice = () => {
    setEditingPriceId(null);
    setEditingPriceValue(0);
  };

  // Handler para atualizar imagem de produto existente
  const handleProductImageUpdate = async (productId: string, file: File) => {
    if (!file) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Você precisa estar autenticado');
        return;
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${user.id}/produtos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('lotes')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      updateItem(productId, { imagemUrl: filePath });
      toast.success('Imagem atualizada com sucesso!');
    } catch {
      toast.error('Erro ao atualizar imagem');
    }
  };

  // Handlers para Novo Modelo Acabado
  const handleOpenNovoModelo = async () => {
    // Buscar a maior referência numérica existente
    let maxRef = 0;
    const produtosAcabadosExistentes = itens.filter(item => item.tipo === 'acabado');
    
    produtosAcabadosExistentes.forEach(item => {
      // Procura padrão " - NNN" no final do nome
      const match = item.nome.match(/ - (\d{3})$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxRef) maxRef = num;
      }
    });
    
    // Próxima referência: max + 1, formatada com 3 dígitos
    const nextRef = String(maxRef + 1).padStart(3, '0');
    
    setNovoModeloForm({
      nome: '',
      referencia: nextRef,
      quantidade: 0,
      precoVenda: 0,
      imagemUrl: '',
      imagemPreview: '',
    });
    setShowNovoModeloModal(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview local
    const reader = new FileReader();
    reader.onloadend = () => {
      setNovoModeloForm(prev => ({ ...prev, imagemPreview: reader.result as string }));
    };
    reader.readAsDataURL(file);

    // Upload para Supabase Storage
    setUploadingImage(true);
    try {
      // Get current user for user-specific path (required by storage RLS)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Você precisa estar autenticado para enviar imagens.');
        return;
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${user.id}/produtos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('lotes')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setNovoModeloForm(prev => ({ ...prev, imagemUrl: filePath }));
      toast.success('Imagem carregada!');
    } catch {
      toast.error('Erro ao carregar imagem');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveNovoModelo = () => {
    // Validate with Zod schema
    const result = NovoModeloAcabadoSchema.safeParse(novoModeloForm);
    if (!result.success) {
      const firstError = result.error.errors[0]?.message || 'Dados inválidos';
      toast.error(firstError);
      return;
    }

    // Verificar se já existe um produto com o mesmo nome/referência
    const nomeCompleto = novoModeloForm.referencia 
      ? `${novoModeloForm.nome} - ${novoModeloForm.referencia}` 
      : novoModeloForm.nome;
    
    const produtoExistente = itens.find(
      item => item.tipo === 'acabado' && 
        item.nome.toLowerCase() === nomeCompleto.toLowerCase()
    );

    if (produtoExistente) {
      setProdutoDuplicado(produtoExistente);
      setShowDuplicadoModal(true);
      return;
    }

    // Criar novo produto
    criarNovoModeloAcabado(nomeCompleto, false);
  };

  const criarNovoModeloAcabado = (nomeCompleto: string, somarQuantidade: boolean) => {
    if (somarQuantidade && produtoDuplicado) {
      // Somar à quantidade existente
        updateItem(produtoDuplicado.id, {
          quantidade: produtoDuplicado.quantidade + novoModeloForm.quantidade,
          precoUnitario: novoModeloForm.precoVenda || (produtoDuplicado.precoUnitario ?? 0),
          imagemUrl: novoModeloForm.imagemUrl || produtoDuplicado.imagemUrl || undefined,
      });
        toast.success(`Quantidade somada ao produto existente!`);
      } else {
        // Criar novo
        addItem({
          nome: nomeCompleto,
          tipo: 'acabado',
          categoria: 'Modelo Manual',
          quantidade: novoModeloForm.quantidade,
          unidade: 'peças',
          quantidadeMinima: 0,
          precoUnitario: novoModeloForm.precoVenda,
          localizacao: 'Estoque Produção',
          imagemUrl: novoModeloForm.imagemUrl,
      });
      toast.success('Modelo adicionado ao estoque!');
    }

    setShowNovoModeloModal(false);
    setShowDuplicadoModal(false);
    setProdutoDuplicado(null);
  };

  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      {/* Mobile Header */}
      {isMobile && <MobileHeader title="Estoque" />}
      
      {/* Sidebar - Desktop only */}
      {!isMobile && <AppSidebar />}

      <main className={cn(
        "flex-1 flex flex-col h-screen overflow-hidden",
        isMobile && "pt-14 pb-20"
      )}>
        {/* Header - Desktop only */}
        {!isMobile && (
          <header className="px-6 py-4 border-b border-border bg-card/50">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Controle de Estoque</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {itens.length} itens cadastrados
                </p>
              </div>

              <div className="flex items-center gap-4">
                {/* Botão de Refresh */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleRefreshData}
                  disabled={isRefreshing}
                  title="Atualizar dados"
                >
                  <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                </Button>

                {/* Alerta de baixo estoque */}
                {itensComBaixoEstoque.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle size={16} className="text-amber-600" />
                    <span className="text-sm text-amber-700 font-medium">
                      {itensComBaixoEstoque.length} itens com estoque baixo
                    </span>
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input
                    placeholder="Buscar item..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-10 w-64 bg-background shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                  />
                </div>
              </div>
            </div>
          </header>
        )}
        
        {/* Mobile Search */}
        {isMobile && (
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Buscar item..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 bg-background shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className={cn("flex-1 overflow-auto", isMobile ? "p-4" : "p-6")}>
          {/* Metrics Cards */}
          <div className={cn(
            "grid gap-3 mb-4",
            isMobile ? "grid-cols-3" : "grid-cols-4"
          )}>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Total Peças</p>
                  <p className="font-bold text-sm sm:text-lg">{totalPecas.toLocaleString()}</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Valor Total</p>
                  <p className="font-bold text-sm sm:text-lg text-emerald-600">
                    {isMobile ? `${(valorTotal / 1000).toFixed(1)}k` : `R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  </p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Em Alerta</p>
                  <p className="font-bold text-sm sm:text-lg text-amber-600">{itensAlerta}</p>
                </div>
              </div>
            </Card>
            {!isMobile && (
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <PackageX className="h-4 w-4 text-red-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Esgotados</p>
                    <p className="font-bold text-lg text-red-600">{itensEsgotados}</p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <Button
              variant={filtroRapido === 'todos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroRapido('todos')}
              className="h-8"
            >
              Ver Todos
            </Button>
            <Button
              variant={filtroRapido === 'esgotado' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroRapido('esgotado')}
              className={cn(
                "h-8 gap-1",
                filtroRapido === 'esgotado' ? "bg-red-600 hover:bg-red-700" : "text-red-600 border-red-200 hover:bg-red-50"
              )}
            >
              <div className="w-2 h-2 rounded-full bg-red-500" />
              Esgotados ({itensEsgotados})
            </Button>
            <Button
              variant={filtroRapido === 'baixo' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroRapido('baixo')}
              className={cn(
                "h-8 gap-1",
                filtroRapido === 'baixo' ? "bg-amber-600 hover:bg-amber-700" : "text-amber-600 border-amber-200 hover:bg-amber-50"
              )}
            >
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              Estoque Baixo ({itensAlerta})
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'materia_prima' | 'produto_acabado')}>
            {/* Mobile: Scrollable tabs */}
            {isMobile ? (
              <ScrollArea className="w-full mb-4">
                <div className="flex gap-2 pb-2">
                  <button
                    onClick={() => setActiveTab('materia_prima')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all whitespace-nowrap",
                      "border text-sm font-medium",
                      activeTab === 'materia_prima'
                        ? "bg-primary/10 text-primary border-primary/30 shadow-sm"
                        : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                    )}
                  >
                    <Layers className="h-4 w-4 shrink-0" />
                    <span>Matéria-Prima</span>
                    <span className={cn(
                      "inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-xs font-semibold",
                      activeTab === 'materia_prima'
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {materiasPrimas.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('produto_acabado')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all whitespace-nowrap",
                      "border text-sm font-medium",
                      activeTab === 'produto_acabado'
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 shadow-sm"
                        : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                    )}
                  >
                    <PackageCheck className="h-4 w-4 shrink-0" />
                    <span>Produtos</span>
                    <span className={cn(
                      "inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-xs font-semibold",
                      activeTab === 'produto_acabado'
                        ? "bg-emerald-500/20 text-emerald-600"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {produtosAcabados.length}
                    </span>
                  </button>
                </div>
                <ScrollBar orientation="horizontal" className="h-2" />
              </ScrollArea>
            ) : (
              /* Desktop: Original tabs */
              <div className="flex items-center justify-between mb-6">
                <TabsList className="shadow-[3px_3px_6px_hsl(var(--muted)/0.3),-3px_-3px_6px_hsl(var(--background))] bg-muted/30">
                  <TabsTrigger value="materia_prima" className="gap-2 data-[state=active]:shadow-[inset_2px_2px_4px_hsl(var(--muted)/0.4),inset_-2px_-2px_4px_hsl(var(--background))]">
                    <Layers size={16} />
                    Matéria-Prima ({materiasPrimas.length})
                  </TabsTrigger>
                  <TabsTrigger value="produto_acabado" className="gap-2 data-[state=active]:shadow-[inset_2px_2px_4px_hsl(var(--muted)/0.4),inset_-2px_-2px_4px_hsl(var(--background))]">
                    <PackageCheck size={16} />
                    Produtos Acabados ({produtosAcabados.length})
                  </TabsTrigger>
                </TabsList>

                {activeTab === 'produto_acabado' && (
                  <div className="flex items-center gap-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="outline"
                          className="gap-2 shadow-[4px_4px_10px_hsl(var(--muted)/0.4),-2px_-2px_8px_hsl(var(--background))] border-0 bg-card hover:bg-muted/50"
                        >
                          <Download size={18} />
                          Exportar Modelos
                          <ChevronDown size={14} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleExportModelos} className="gap-2 cursor-pointer">
                          <FileText size={16} />
                          Exportar CSV (texto)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleExportModelosPDF} className="gap-2 cursor-pointer">
                          <Image size={16} />
                          Exportar PDF (com imagens)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button 
                      onClick={() => setShowImportModal(true)}
                      variant="outline"
                      className="gap-2 shadow-[4px_4px_10px_hsl(var(--muted)/0.4),-2px_-2px_8px_hsl(var(--background))] border-0 bg-card hover:bg-muted/50"
                    >
                      <FileSpreadsheet size={18} />
                      Importar Lista de Modelos
                    </Button>
                    <Button 
                      onClick={handleOpenNovoModelo} 
                      className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-[4px_4px_10px_hsl(var(--muted)/0.4),-2px_-2px_8px_hsl(var(--background))]"
                    >
                      <Plus size={18} />
                      Novo Modelo Acabado
                    </Button>
                  </div>
                )}
                {activeTab === 'materia_prima' && (
                  <Button 
                    onClick={() => handleOpenModal()} 
                    className="gap-2 shadow-[4px_4px_10px_hsl(var(--muted)/0.4),-2px_-2px_8px_hsl(var(--background))]"
                  >
                    <Plus size={18} />
                    Novo Item
                  </Button>
                )}
              </div>
            )}

            <TabsContent value={activeTab} className="mt-0">
              <div className={cn(
                "grid gap-3",
                isMobile 
                  ? "grid-cols-1" 
                  : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              )}>
                {itensFiltrados.map(item => (
                  item.tipo === 'acabado' ? (
                    isMobile ? (
                      <MobileProductCard
                        key={item.id}
                        item={{
                          id: item.id,
                          nome: item.nome,
                          categoria: item.categoria,
                          quantidade: item.quantidade,
                          precoUnitario: item.precoUnitario,
                          imagemUrl: item.imagemUrl,
                          localizacao: item.localizacao,
                          tipo: item.tipo,
                        }}
                        editingPriceId={editingPriceId}
                        editingPrice={editingPriceValue.toString()}
                        onEditPrice={(id, price) => {
                          setEditingPriceId(id);
                          setEditingPriceValue(price);
                        }}
                        onSavePrice={handleSavePrice}
                        onCancelEditPrice={handleCancelEditPrice}
                        onPriceChange={(v) => setEditingPriceValue(Number(v))}
                        onEdit={handleOpenModal}
                        onDelete={handleDeleteClick}
                        onImageUpdate={handleProductImageUpdate}
                      />
                    ) : (
                      <ProductCard
                        key={item.id}
                        item={item}
                        editingPriceId={editingPriceId}
                        editingPriceValue={editingPriceValue}
                        onEditPrice={handleStartEditPrice}
                        onSavePrice={handleSavePrice}
                        onCancelEditPrice={handleCancelEditPrice}
                        onPriceValueChange={setEditingPriceValue}
                        onEdit={handleOpenModal}
                        onDelete={handleDeleteClick}
                        onImageUpdate={handleProductImageUpdate}
                      />
                    )
                  ) : (
                    <Card
                      key={item.id}
                      className="overflow-hidden shadow-soft border border-border/50 bg-card rounded-2xl"
                    >
                      <CardContent className={cn("p-6", isMobile && "p-4")}>
                        {/* Two column layout */}
                        <div className="flex gap-4 mb-4 pb-4 border-b border-border/30">
                          {/* Left: Image */}
                          <ProductImage imagemUrl={item.imagemUrl} nome={item.nome} />
                          
                          {/* Right: Main info */}
                          <div className="flex-1 min-w-0">
                            <h3 className={cn(
                              "font-bold text-foreground",
                              isMobile ? "text-sm line-clamp-2" : "text-lg truncate"
                            )}>{item.nome}</h3>
                            <p className="text-xs text-muted-foreground/70 uppercase tracking-wider mt-1">{item.categoria}</p>
                          </div>
                          
                          <Badge className={statusConfig[item.status].color + " h-fit shrink-0"}>
                            {statusConfig[item.status].label}
                          </Badge>
                        </div>

                        {/* Technical data - clean aligned layout */}
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground/70 uppercase tracking-wider">Quantidade</span>
                            <span className="font-bold text-lg text-foreground">
                              {item.quantidade} <span className="text-xs font-normal text-muted-foreground">{item.unidade}</span>
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground/70 uppercase tracking-wider">Mínimo</span>
                            <span className="text-sm text-muted-foreground">{item.quantidadeMinima} {item.unidade}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground/70 uppercase tracking-wider">Preço unit.</span>
                            <span className="font-semibold text-primary">R$ {(item.precoUnitario ?? 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground/70 uppercase tracking-wider">Localização</span>
                            <span className="text-sm text-muted-foreground">{item.localizacao}</span>
                          </div>
                        </div>

                        <div className="flex gap-3 mt-5 pt-4 border-t border-border/30">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1.5 h-10"
                            onClick={() => handleOpenModal(item)}
                          >
                            <Edit size={14} />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive h-10 px-3"
                            onClick={() => handleDeleteClick(item)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                ))}

                {itensFiltrados.length === 0 && (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    {search
                      ? 'Nenhum item encontrado para a busca.'
                      : activeTab === 'materia_prima'
                      ? 'Nenhuma matéria-prima cadastrada.'
                      : 'Nenhum produto acabado no estoque.'}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Mobile FAB for adding items */}
        {isMobile && activeTab === 'produto_acabado' && (
          <Button
            onClick={handleOpenNovoModelo}
            className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90"
          >
            <Plus size={24} />
          </Button>
        )}
        {isMobile && activeTab === 'materia_prima' && (
          <Button
            onClick={() => handleOpenModal()}
            className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90"
          >
            <Plus size={24} />
          </Button>
        )}
      </main>

      {/* Modal de Novo/Editar Item */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Item' : 'Novo Item de Estoque'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Atualize as informações do item' : 'Adicione um novo item ao estoque'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Item</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={e => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Jeans Azul Escuro"
                className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
              />
            </div>

            {/* Campos apenas para matéria-prima */}
            {(!editingItem || editingItem.tipo === 'materia-prima') && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="categoria">Categoria</Label>
                    <Select
                      value={formData.categoria}
                      onValueChange={v => setFormData({ ...formData, categoria: v })}
                    >
                      <SelectTrigger className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoriasMateriaPrima.map(cat => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unidade">Unidade</Label>
                    <Select
                      value={formData.unidade}
                      onValueChange={v => setFormData({ ...formData, unidade: v })}
                    >
                      <SelectTrigger className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="metros">Metros</SelectItem>
                        <SelectItem value="unidades">Unidades</SelectItem>
                        <SelectItem value="cones">Cones</SelectItem>
                        <SelectItem value="peças">Peças</SelectItem>
                        <SelectItem value="kg">Quilos (kg)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantidade">Quantidade</Label>
                    <Input
                      id="quantidade"
                      type="number"
                      value={formData.quantidade}
                      onChange={e => setFormData({ ...formData, quantidade: e.target.value === '' ? '' : Number(e.target.value) })}
                      min={0}
                      className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quantidadeMinima">Qtd. Mínima</Label>
                    <Input
                      id="quantidadeMinima"
                      type="number"
                      value={formData.quantidadeMinima}
                      onChange={e => setFormData({ ...formData, quantidadeMinima: e.target.value === '' ? '' : Number(e.target.value) })}
                      min={0}
                      className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="precoUnitario">Preço Unitário (R$)</Label>
                    <Input
                      id="precoUnitario"
                      type="number"
                      step="0.01"
                      value={formData.precoUnitario}
                      onChange={e => setFormData({ ...formData, precoUnitario: e.target.value === '' ? '' : Number(e.target.value) })}
                      min={0}
                      className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="localizacao">Localização</Label>
                    <Input
                      id="localizacao"
                      value={formData.localizacao}
                      onChange={e => setFormData({ ...formData, localizacao: e.target.value })}
                      placeholder="Ex: Prateleira A1"
                      className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Campos para produtos acabados */}
            {editingItem?.tipo === 'acabado' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="quantidade">Quantidade (peças)</Label>
                  <Input
                    id="quantidade"
                    type="number"
                    value={formData.quantidade}
                    onChange={e => setFormData({ ...formData, quantidade: e.target.value === '' ? '' : Number(e.target.value) })}
                    min={0}
                    className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="localizacao">Localização</Label>
                  <Input
                    id="localizacao"
                    value={formData.localizacao}
                    onChange={e => setFormData({ ...formData, localizacao: e.target.value })}
                    placeholder="Ex: Estoque Produção"
                    className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingItem ? 'Atualizar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 size={20} />
              Remover Item
            </DialogTitle>
            <DialogDescription>
              Deseja remover este lote do estoque?
            </DialogDescription>
          </DialogHeader>

          {itemToDelete && (
            <div className="py-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))]">
                <ProductImage imagemUrl={itemToDelete.imagemUrl} nome={itemToDelete.nome} />
                <div>
                  <p className="font-medium text-foreground">{itemToDelete.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {itemToDelete.quantidade} {itemToDelete.unidade}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              <Trash2 size={16} className="mr-2" />
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Novo Modelo Acabado */}
      <Dialog open={showNovoModeloModal} onOpenChange={setShowNovoModeloModal}>
        <DialogContent className="sm:max-w-[480px] bg-muted/95 shadow-[12px_12px_30px_hsl(216_26%_80%/0.6),-12px_-12px_30px_hsl(0_0%_100%/0.9)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck size={20} className="text-primary" />
              Novo Modelo Acabado
            </DialogTitle>
            <DialogDescription>
              Cadastre um produto acabado manualmente no estoque
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Upload de Imagem */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground/70 uppercase tracking-wider">Imagem do Produto</Label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative w-full h-32 rounded-xl bg-background shadow-[inset_3px_3px_8px_hsl(var(--muted)/0.4),inset_-3px_-3px_8px_hsl(var(--background))] border border-border/30 cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-center overflow-hidden group"
              >
                {novoModeloForm.imagemPreview ? (
                  <>
                    <img 
                      src={novoModeloForm.imagemPreview} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-sm font-medium">Trocar imagem</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    {uploadingImage ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    ) : (
                      <>
                        <ImagePlus size={32} className="text-muted-foreground/50" />
                        <span className="text-xs uppercase tracking-wider">Clique para adicionar</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <input 
                type="file" 
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            {/* Nome e Referência */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground/70 uppercase tracking-wider">Nome do Modelo</Label>
                <Input
                  value={novoModeloForm.nome}
                  onChange={e => setNovoModeloForm({ ...novoModeloForm, nome: e.target.value })}
                  placeholder="Ex: Short Jeans"
                  className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground/70 uppercase tracking-wider">Referência (automática)</Label>
                <Input
                  value={novoModeloForm.referencia}
                  readOnly
                  disabled
                  className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0 bg-muted/50 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Quantidade e Preço */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground/70 uppercase tracking-wider">Quantidade Inicial</Label>
                <Input
                  type="number"
                  min={1}
                  value={novoModeloForm.quantidade}
                  onChange={e => setNovoModeloForm({ ...novoModeloForm, quantidade: Number(e.target.value) })}
                  placeholder="0"
                  className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground/70 uppercase tracking-wider">Preço de Venda (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={novoModeloForm.precoVenda}
                  onChange={e => setNovoModeloForm({ ...novoModeloForm, precoVenda: Number(e.target.value) })}
                  placeholder="0.00"
                  className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNovoModeloModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveNovoModelo}
              disabled={uploadingImage}
              className="gap-2 bg-gradient-to-r from-primary to-primary/80"
            >
              <Check size={16} />
              Adicionar ao Estoque
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Duplicado */}
      <Dialog open={showDuplicadoModal} onOpenChange={setShowDuplicadoModal}>
        <DialogContent className="sm:max-w-[450px] bg-muted/95 shadow-[12px_12px_30px_hsl(216_26%_80%/0.6),-12px_-12px_30px_hsl(0_0%_100%/0.9)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle size={20} />
              Produto Já Existe
            </DialogTitle>
            <DialogDescription>
              Um produto com esse nome já existe no estoque. O que deseja fazer?
            </DialogDescription>
          </DialogHeader>

          {produtoDuplicado && (
            <div className="py-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-background shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))]">
                <ProductImage imagemUrl={produtoDuplicado.imagemUrl} nome={produtoDuplicado.nome} />
                <div className="flex-1">
                  <p className="font-bold text-lg text-foreground">{produtoDuplicado.nome}</p>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-sm text-muted-foreground">
                      Estoque atual: <span className="font-semibold text-foreground">{produtoDuplicado.quantidade} peças</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-sm text-amber-800">
                  Você está tentando adicionar <strong>{novoModeloForm.quantidade} peças</strong>.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowDuplicadoModal(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                const nomeCompleto = novoModeloForm.referencia 
                  ? `${novoModeloForm.nome} - ${novoModeloForm.referencia}` 
                  : novoModeloForm.nome;
                criarNovoModeloAcabado(nomeCompleto + ` (${Date.now()})`, false);
              }}
              variant="outline"
              className="flex-1"
            >
              Criar Novo Registro
            </Button>
            <Button 
              onClick={() => {
                const nomeCompleto = novoModeloForm.referencia 
                  ? `${novoModeloForm.nome} - ${novoModeloForm.referencia}` 
                  : novoModeloForm.nome;
                criarNovoModeloAcabado(nomeCompleto, true);
              }}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500"
            >
              Somar Quantidade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Importação CSV */}
      <ImportModelosCSVModal 
        open={showImportModal} 
        onOpenChange={setShowImportModal} 
      />
      
      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}
