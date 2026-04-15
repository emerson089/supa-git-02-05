import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEstoque, ItemEstoque, TipoEstoque, StatusEstoque } from '@/contexts/EstoqueContext';
import { useEstoqueItensPaginated, useEstoqueMetrics, FiltroRapido } from '@/hooks/useEstoqueItensPaginated';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, Plus, Package, Layers, AlertTriangle, Edit, Trash2, PackageCheck, Pencil, Check, X, Upload, ImagePlus, FileSpreadsheet, DollarSign, PackageX, Download, FileText, Image, ChevronDown, RefreshCw, ChevronLeft, ChevronRight, Sparkles, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { supabase } from '@/integrations/supabase/client';
import { ImportModelosCSVModal } from '@/components/estoque/ImportModelosCSVModal';
import { ProductCard } from '@/components/estoque/ProductCard';
import { MobileProductCard } from '@/components/estoque/MobileProductCard';
import { NovoModeloPadronizadoModal } from '@/components/estoque/NovoModeloPadronizadoModal';
import { DetalhesModeloPadronizadoModal } from '@/components/estoque/DetalhesModeloPadronizadoModal';
import { ModeloPadronizadoCard } from '@/components/estoque/ModeloPadronizadoCard';
import { MobileModeloPadronizadoCard } from '@/components/estoque/MobileModeloPadronizadoCard';
import { useModelosPadronizados, ModeloPadronizado, CATEGORIA_MODELO_PAD, CATEGORIA_VARIACAO_PAD } from '@/hooks/useModelosPadronizados';
import { useVendasSemana } from '@/hooks/useVendasSemana';
import { EstoqueItemSchema, NovoModeloAcabadoSchema } from '@/lib/validations';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { getSignedUrl, getImageAsBase64 } from '@/utils/imageUtils';
import jsPDF from 'jspdf';
const PAGE_SIZE = 24;
const statusConfig: Record<StatusEstoque, {
  label: string;
  color: string;
}> = {
  disponivel: {
    label: 'Disponível',
    color: 'bg-emerald-100 text-emerald-700'
  },
  em_producao: {
    label: 'Em Produção',
    color: 'bg-blue-100 text-blue-700'
  },
  reservado: {
    label: 'Reservado',
    color: 'bg-amber-100 text-amber-700'
  },
  baixo_estoque: {
    label: 'Baixo Estoque',
    color: 'bg-red-100 text-red-700'
  }
};
const categoriasMateriaPrima = ['Tecido', 'Aviamentos', 'Acessórios', 'Embalagem'];

// Component for product image with signed URL support
function ProductImage({
  imagemUrl,
  nome
}: {
  imagemUrl?: string;
  nome: string;
}) {
  const {
    signedUrl,
    loading
  } = useSignedUrl(imagemUrl);
  if (!imagemUrl) {
    return <div className="p-2 rounded-lg bg-primary/10">
      <Package size={20} className="text-primary" />
    </div>;
  }
  if (loading) {
    return <div className="w-12 h-12 rounded-lg bg-muted/50 animate-pulse" />;
  }
  return <div className="w-12 h-12 rounded-lg overflow-hidden shadow-[inset_1px_1px_3px_hsl(var(--muted)/0.4)] border border-border/30">
    <img src={signedUrl || imagemUrl} alt={nome} className="w-full h-full object-cover" />
  </div>;
}
const SCROLL_KEY = 'estoque_scroll';
export default function Estoque() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const {
    itens,
    addItem,
    updateItem,
    removeItem,
    getMateriasPrimas,
    getProdutosAcabados
  } = useEstoque();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // URL params para persistir busca, filtros e paginação
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') || '';
  const activeTab = searchParams.get('tab') as 'materia_prima' | 'produto_acabado' || 'produto_acabado';
  const filtroRapido = searchParams.get('filtro') as FiltroRapido || 'todos';
  const currentPage = parseInt(searchParams.get('page') || '0', 10);

  // Ref para restaurar scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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
    quantidadeInicial: number | string;
  }>({
    nome: '',
    categoria: '',
    quantidade: '',
    unidade: 'metros',
    quantidadeMinima: '',
    precoUnitario: '',
    localizacao: '',
    quantidadeInicial: ''
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
    imagemPreview: ''
  });

  // Modal para importação CSV
  const [showImportModal, setShowImportModal] = useState(false);

  // Modal para Novo Modelo Padronizado
  const [showNovoModeloPadronizadoModal, setShowNovoModeloPadronizadoModal] = useState(false);

  // Modal de detalhes do Modelo Padronizado
  const [modeloDetalhes, setModeloDetalhes] = useState<ModeloPadronizado | null>(null);

  // Hook de Modelos Padronizados
  const { modelosPadronizados } = useModelosPadronizados();

  // Mapear tipo de tab para tipo de estoque
  const tipoEstoque = activeTab === 'materia_prima' ? 'materia-prima' : 'acabado';

  // Hook paginado para buscar itens
  const {
    data: paginatedData,
    isLoading: isPaginatedLoading,
    isFetching: isPaginatedFetching
  } = useEstoqueItensPaginated({
    page: currentPage,
    pageSize: PAGE_SIZE,
    search,
    tipo: tipoEstoque,
    filtroRapido
  });

  // Métricas agregadas para os cards de resumo (filtradas pela busca)
  const {
    data: metrics
  } = useEstoqueMetrics(tipoEstoque, search);

  // Vendas da semana atual por produto_id
  const { data: vendasSemanaMap } = useVendasSemana();

  // Helper para atualizar URL params (persistência)
  const updateParams = (updates: Record<string, string | undefined>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === '') {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });
    setSearchParams(newParams, {
      replace: true
    });
  };

  // Handlers que atualizam URL params
  const handleFilterChange = (newFiltro: FiltroRapido) => {
    updateParams({
      filtro: newFiltro === 'todos' ? undefined : newFiltro,
      page: '0'
    });
  };
  const handleTabChange = (tab: 'materia_prima' | 'produto_acabado') => {
    updateParams({
      tab,
      page: '0'
    });
  };
  const handleSearchChange = (value: string) => {
    updateParams({
      q: value || undefined,
      page: '0'
    });
  };
  const handlePageChange = (page: number) => {
    updateParams({
      page: page.toString()
    });
  };
  const handleClearSearch = () => {
    updateParams({
      q: undefined,
      page: '0'
    });
  };

  // Salvar posição de scroll ao sair da rota
  useEffect(() => {
    return () => {
      if (scrollContainerRef.current) {
        sessionStorage.setItem(SCROLL_KEY, scrollContainerRef.current.scrollTop.toString());
      }
    };
  }, []);

  // Restaurar posição de scroll após dados carregarem
  useEffect(() => {
    if (!isPaginatedLoading && scrollContainerRef.current) {
      const savedScroll = sessionStorage.getItem(SCROLL_KEY);
      if (savedScroll) {
        scrollContainerRef.current.scrollTop = parseInt(savedScroll, 10);
        sessionStorage.removeItem(SCROLL_KEY);
      }
    }
  }, [isPaginatedLoading]);

  // Função de refresh manual
  const handleRefreshData = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({
      queryKey: ['estoque-itens']
    });
    await queryClient.invalidateQueries({
      queryKey: ['estoque-itens-paginated']
    });
    await queryClient.invalidateQueries({
      queryKey: ['estoque-metrics']
    });
    await queryClient.invalidateQueries({
      queryKey: ['estoque-por-local']
    });
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
    const csvRows = [headers.join(','), ...itensFiltrados.map(item => [item.nome, item.categoria, item.quantidade.toString(), item.unidade, (item.precoUnitario || 0).toFixed(2), item.localizacao || ''].map(field => `"${(field || '').replace(/"/g, '""')}"`).join(','))];
    const csvContent = csvRows.join('\n');
    const blob = new Blob(['\ufeff' + csvContent], {
      type: 'text/csv;charset=utf-8;'
    });
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
      doc.text('Catálogo de Modelos', pageWidth / 2, 20, {
        align: 'center'
      });
      doc.setFontSize(10);
      doc.text(`Exportado em: ${new Date().toLocaleDateString('pt-BR')} - ${itensFiltrados.length} modelos`, pageWidth / 2, 28, {
        align: 'center'
      });
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
        const xPosition = margin + col * (cardWidth + spacing);

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
          doc.text('Sem imagem', xPosition + cardWidth / 2, yPosition + imageHeight / 2 + 2, {
            align: 'center'
          });
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

  // Usar dados paginados para renderização
  const itensFiltrados = paginatedData?.data || [];
  const totalCount = paginatedData?.totalCount || 0;
  const totalPages = paginatedData?.totalPages || 0;

  // Usar métricas do hook para os cards de resumo
  const totalPecas = metrics?.totalPecas || 0;
  const valorTotal = metrics?.valorTotal || 0;
  const itensAlerta = metrics?.itensAlerta || 0;
  const itensEsgotados = metrics?.itensEsgotados || 0;
  const totalItens = metrics?.totalItens || 0;

  // Calcular range de paginação
  const fromItem = totalCount > 0 ? currentPage * PAGE_SIZE + 1 : 0;
  const toItem = Math.min((currentPage + 1) * PAGE_SIZE, totalCount);
  const handleOpenModal = (item?: any) => {
    if (item) {
      // Find the full item from context for proper editing
      const fullItem = itens.find(i => i.id === item.id);
      if (fullItem) {
        setEditingItem(fullItem);
        setFormData({
          nome: fullItem.nome,
          categoria: fullItem.categoria,
          quantidade: fullItem.quantidade,
          unidade: fullItem.unidade,
          quantidadeMinima: fullItem.quantidadeMinima ?? 0,
          precoUnitario: fullItem.precoUnitario ?? 0,
          localizacao: fullItem.localizacao ?? '',
          quantidadeInicial: fullItem.quantidadeInicial ?? fullItem.quantidade
        });
      } else {
        // Use the passed item data (for paginated items)
        setEditingItem(null);
        setFormData({
          nome: item.nome,
          categoria: item.categoria,
          quantidade: item.quantidade,
          unidade: item.unidade,
          quantidadeMinima: item.quantidadeMinima ?? 0,
          precoUnitario: item.precoUnitario ?? 0,
          localizacao: item.localizacao ?? '',
          quantidadeInicial: (item as any).quantidadeInicial ?? item.quantidade
        });
      }
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
        quantidadeInicial: 0
      });
    }
    setShowModal(true);
  };
  const handleDeleteClick = (item: any) => {
    // Find the full item from context for proper deletion
    const fullItem = itens.find(i => i.id === item.id);
    setItemToDelete(fullItem || item);
    setShowDeleteModal(true);
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
      quantidadeInicial: formData.quantidadeInicial === '' ? 0 : Number(formData.quantidadeInicial)
    };
    if (editingItem) {
      // Para produtos acabados, atualiza apenas nome, quantidade e localização
      if (editingItem.tipo === 'acabado') {
        updateItem(editingItem.id, {
          nome: dataToSave.nome,
          quantidade: dataToSave.quantidade,
          localizacao: dataToSave.localizacao,
          quantidadeInicial: dataToSave.quantidadeInicial
        });
      } else {
        updateItem(editingItem.id, dataToSave);
      }
      toast.success('Item atualizado com sucesso!');
    } else {
      addItem({
        ...dataToSave,
        tipo: 'materia_prima'
      });
      toast.success('Item adicionado ao estoque!');
    }
    setShowModal(false);
  };
  const handleConfirmDelete = () => {
    if (itemToDelete) {
      const itemId = itemToDelete.id;

      // Fechar modal IMEDIATAMENTE para feedback instantâneo
      setShowDeleteModal(false);
      setItemToDelete(null);

      // Executar exclusão em background (optimistic update já remove da lista)
      removeItem(itemId).then(() => {
        toast.success('Item removido do estoque');
      }).catch((error: any) => {
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
    updateItem(itemId, {
      precoUnitario: editingPriceValue
    });
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
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Você precisa estar autenticado');
        return;
      }
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${user.id}/produtos/${fileName}`;
      const {
        error: uploadError
      } = await supabase.storage.from('lotes').upload(filePath, file);
      if (uploadError) throw uploadError;
      updateItem(productId, {
        imagemUrl: filePath
      });
      toast.success('Imagem atualizada com sucesso!');
    } catch {
      toast.error('Erro ao atualizar imagem');
    }
  };

  // Handlers para Novo Modelo Acabado
  const handleOpenNovoModelo = async () => {
    // Buscar todas as referências numéricas já usadas (1+ dígitos no final)
    const referenciasUsadas = new Set<number>();
    const produtosAcabadosExistentes = itens.filter(item => item.tipo === 'acabado');

    produtosAcabadosExistentes.forEach(item => {
      // Captura qualquer sequência de dígitos no final do nome (após " - ")
      const match = item.nome.match(/ - (\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        // Considerar apenas referências na faixa válida de 3 dígitos (001-999)
        if (num >= 1 && num <= 999) {
          referenciasUsadas.add(num);
        }
      }
    });

    // Gerar número aleatório único entre 001 e 999
    let nextRefNum: number;
    const maxTentativas = 1000;
    let tentativas = 0;

    // Se ainda há números disponíveis na faixa 001-999
    if (referenciasUsadas.size < 999) {
      do {
        // Gerar número aleatório entre 1 e 999
        nextRefNum = Math.floor(Math.random() * 999) + 1;
        tentativas++;
      } while (referenciasUsadas.has(nextRefNum) && tentativas < maxTentativas);
    } else {
      // Todos os 999 números estão em uso - usar 1 como fallback
      nextRefNum = 1;
    }

    // Formatar sempre com 3 dígitos
    const nextRef = String(nextRefNum).padStart(3, '0');

    setNovoModeloForm({
      nome: '',
      referencia: nextRef,
      quantidade: 0,
      precoVenda: 0,
      imagemUrl: '',
      imagemPreview: ''
    });
    setShowNovoModeloModal(true);
  };
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview local
    const reader = new FileReader();
    reader.onloadend = () => {
      setNovoModeloForm(prev => ({
        ...prev,
        imagemPreview: reader.result as string
      }));
    };
    reader.readAsDataURL(file);

    // Upload para Supabase Storage
    setUploadingImage(true);
    try {
      // Get current user for user-specific path (required by storage RLS)
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Você precisa estar autenticado para enviar imagens.');
        return;
      }
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${user.id}/produtos/${fileName}`;
      const {
        error: uploadError
      } = await supabase.storage.from('lotes').upload(filePath, file);
      if (uploadError) throw uploadError;
      setNovoModeloForm(prev => ({
        ...prev,
        imagemUrl: filePath
      }));
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
    const nomeCompleto = novoModeloForm.referencia ? `${novoModeloForm.nome} - ${novoModeloForm.referencia}` : novoModeloForm.nome;
    const produtoExistente = itens.find(item => item.tipo === 'acabado' && item.nome.toLowerCase() === nomeCompleto.toLowerCase());
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
        quantidadeInicial: (produtoDuplicado.quantidadeInicial || 0) + novoModeloForm.quantidade,
        precoUnitario: novoModeloForm.precoVenda || (produtoDuplicado.precoUnitario ?? 0),
        imagemUrl: novoModeloForm.imagemUrl || produtoDuplicado.imagemUrl || undefined
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
        quantidadeInicial: novoModeloForm.quantidade
      });
      toast.success('Modelo adicionado ao estoque!');
    }
    setShowNovoModeloModal(false);
    setShowDuplicadoModal(false);
    setProdutoDuplicado(null);
  };
  return <div className="min-h-screen bg-background flex overflow-hidden">
    {/* Mobile Header */}
    {isMobile && <MobileHeader title="Estoque" />}

    {/* Sidebar - Desktop only */}
    {!isMobile && <AppSidebar />}

    <main className={cn("flex-1 flex flex-col h-screen overflow-hidden", isMobile && "pt-14 pb-20")}>
      {/* Header - Desktop only */}
      {!isMobile && <header className="px-6 py-4 border-b border-border bg-card/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">CONTROLE DE ESTOQUE</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {itens.length} itens cadastrados
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Botão de Refresh */}
            <Button variant="ghost" size="icon" onClick={handleRefreshData} disabled={isRefreshing} title="Atualizar dados">
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>

            {/* Alerta de baixo estoque */}
            {itensAlerta > 0 && <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle size={16} className="text-amber-600" />
              <span className="text-sm text-amber-700 font-medium">
                {itensAlerta} itens com estoque baixo
              </span>
            </div>}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input placeholder="Buscar item..." value={search} onChange={e => handleSearchChange(e.target.value)} className="pl-10 pr-8 w-64 bg-background shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0" />
              {search && <button onClick={handleClearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted" title="Limpar busca">
                <X size={14} className="text-muted-foreground" />
              </button>}
            </div>
          </div>
        </div>
      </header>}

      {/* Mobile Search */}
      {isMobile && <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input placeholder="Buscar item..." value={search} onChange={e => handleSearchChange(e.target.value)} className="pl-10 pr-8 bg-background shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0" />
          {search && <button onClick={handleClearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted" title="Limpar busca">
            <X size={14} className="text-muted-foreground" />
          </button>}
        </div>
      </div>}

      {/* Content */}
      <div ref={scrollContainerRef} className={cn("flex-1 overflow-auto", isMobile ? "p-4" : "p-6")}>
        {/* Metrics Cards */}
        <div className={cn("grid gap-3 mb-4", isMobile ? "grid-cols-3" : "grid-cols-4")}>
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
                  {isMobile ? `${(valorTotal / 1000).toFixed(1)}k` : `R$ ${valorTotal.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2
                  })}`}
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
          {!isMobile && <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-red-500/10">
                <PackageX className="h-4 w-4 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Esgotados</p>
                <p className="font-bold text-lg text-red-600">{itensEsgotados}</p>
              </div>
            </div>
          </Card>}
          <Card className="p-3 bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <ShoppingBag className="h-4 w-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-blue-700/70 dark:text-blue-400 font-medium truncate">Total Vendas</p>
                <p className="font-bold text-sm sm:text-lg text-blue-600 dark:text-blue-400">
                  {Math.max(0, (metrics?.totalProduzido || 0) - totalPecas).toLocaleString()}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <Button variant={filtroRapido === 'todos' ? 'default' : 'outline'} size="sm" onClick={() => handleFilterChange('todos')} className="h-8">
            Ver Todos
          </Button>
          <Button variant={filtroRapido === 'esgotado' ? 'default' : 'outline'} size="sm" onClick={() => handleFilterChange('esgotado')} className={cn("h-8 gap-1", filtroRapido === 'esgotado' ? "bg-red-600 hover:bg-red-700" : "text-red-600 border-red-200 hover:bg-red-50")}>
            <div className="w-2 h-2 rounded-full bg-red-500" />
            Esgotados ({itensEsgotados})
          </Button>
          <Button variant={filtroRapido === 'baixo' ? 'default' : 'outline'} size="sm" onClick={() => handleFilterChange('baixo')} className={cn("h-8 gap-1", filtroRapido === 'baixo' ? "bg-amber-600 hover:bg-amber-700" : "text-amber-600 border-amber-200 hover:bg-amber-50")}>
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            Estoque Baixo ({itensAlerta})
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={v => handleTabChange(v as 'materia_prima' | 'produto_acabado')}>
          {/* Mobile: Scrollable tabs */}

            <div className="flex items-center justify-end mb-6">

              {activeTab === 'produto_acabado' && <div className="flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2 shadow-[4px_4px_10px_hsl(var(--muted)/0.4),-2px_-2px_8px_hsl(var(--background))] border-0 bg-card hover:bg-muted/50">
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
                <Button onClick={() => setShowImportModal(true)} variant="outline" className="gap-2 shadow-[4px_4px_10px_hsl(var(--muted)/0.4),-2px_-2px_8px_hsl(var(--background))] border-0 bg-card hover:bg-muted/50">
                  <FileSpreadsheet size={18} />
                  Importar Lista de Modelos
                </Button>
                <Button onClick={() => setShowNovoModeloPadronizadoModal(true)} className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-[4px_4px_10px_hsl(var(--muted)/0.4),-2px_-2px_8px_hsl(var(--background))]">
                  <Sparkles size={18} />
                  + Novo Modelo Padronizado
                </Button>
              </div>}
              {activeTab === 'materia_prima' && <Button onClick={() => handleOpenModal()} className="gap-2 shadow-[4px_4px_10px_hsl(var(--muted)/0.4),-2px_-2px_8px_hsl(var(--background))]">
                <Plus size={18} />
                Novo Item
              </Button>}
            </div>

          <TabsContent value={activeTab} className="mt-0">
            {/* ── Seção Única de Produtos Acabados ────────────────────────── */}
            <div className={cn("grid gap-3 pt-4", isMobile ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6")}>
              {itensFiltrados.filter(i =>
                i.tipo === 'acabado' && i.categoria !== CATEGORIA_VARIACAO_PAD
              ).map(item => {
                // Se for um Modelo Padronizado (pai)
                if (item.categoria === CATEGORIA_MODELO_PAD) {
                    const modeloCompleto = modelosPadronizados.find(m => m.id === item.id);
                    if (!modeloCompleto) return null; // Fallback se não bater no hook ainda
                    
                    // Somar vendas da semana de todas as variações deste modelo
                    const vendasSemanasAgrupadas = modeloCompleto.variacoes?.reduce((acc, v) => {
                       return acc + (vendasSemanaMap?.get(v.id) || 0);
                    }, 0) || 0;

                    if (isMobile) {
                        return (
                          <MobileModeloPadronizadoCard
                            key={item.id}
                            modelo={modeloCompleto}
                            onVerDetalhes={m => setModeloDetalhes(m)}
                            onImageUpdate={handleProductImageUpdate}
                            vendasSemana={vendasSemanasAgrupadas}
                          />
                        );
                    }

                    return (
                      <ModeloPadronizadoCard
                        key={item.id}
                        modelo={modeloCompleto}
                        onVerDetalhes={m => setModeloDetalhes(m)}
                        onImageUpdate={handleProductImageUpdate}
                        vendasSemana={vendasSemanasAgrupadas}
                      />
                    );
                }

                // Se não for Padronizado, é Manual antigo
                if (isMobile) {
                  return (
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
                        quantidadeInicial: item.quantidadeInicial
                      }} 
                      editingPriceId={editingPriceId} 
                      editingPrice={editingPriceValue.toString()} 
                      onEditPrice={(id, price) => {
                        setEditingPriceId(id);
                        setEditingPriceValue(price);
                      }} 
                      onSavePrice={handleSavePrice} 
                      onCancelEditPrice={handleCancelEditPrice} 
                      onPriceChange={v => setEditingPriceValue(Number(v))} 
                      onEdit={handleOpenModal} 
                      onDelete={handleDeleteClick} 
                      onImageUpdate={handleProductImageUpdate} 
                      vendasSemana={vendasSemanaMap?.get(item.id) || 0} 
                    />
                  );
                }

                return (
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
                    vendasSemana={vendasSemanaMap?.get(item.id) || 0} 
                  />
                );
              })}

              {itensFiltrados.length === 0 && !isPaginatedLoading && <div className="col-span-full text-center py-12 text-muted-foreground">
                {search ? 'Nenhum item encontrado para a busca.' : activeTab === 'materia_prima' ? 'Nenhuma matéria-prima cadastrada.' : 'Nenhum produto acabado no estoque.'}
              </div>}

              {isPaginatedLoading && <div className="col-span-full text-center py-12 text-muted-foreground">
                Carregando...
              </div>}
            </div>

            {/* Paginação */}
            {totalCount > 0 && <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                Mostrando {fromItem}-{toItem} de {totalCount} itens
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handlePageChange(Math.max(0, currentPage - 1))} disabled={currentPage === 0 || isPaginatedFetching} className="gap-1">
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Página {currentPage + 1} de {totalPages}
                </span>
                <Button variant="outline" size="sm" onClick={() => handlePageChange(Math.min(totalPages - 1, currentPage + 1))} disabled={currentPage >= totalPages - 1 || isPaginatedFetching} className="gap-1">
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>}
          </TabsContent>
        </Tabs>
      </div>

      {/* Mobile FAB for adding items */}
      {isMobile && activeTab === 'produto_acabado' && <Button onClick={() => setShowNovoModeloPadronizadoModal(true)} className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90">
        <Plus size={24} />
      </Button>}
      {isMobile && activeTab === 'materia_prima' && <Button onClick={() => handleOpenModal()} className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90">
        <Plus size={24} />
      </Button>}
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
            <Input id="nome" value={formData.nome} onChange={e => setFormData({
              ...formData,
              nome: e.target.value
            })} placeholder="Ex: Jeans Azul Escuro" className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0" />
          </div>

          {/* Campos apenas para matéria-prima */}
          {(!editingItem || editingItem.tipo === 'materia-prima') && <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria</Label>
                <Select value={formData.categoria} onValueChange={v => setFormData({
                  ...formData,
                  categoria: v
                })}>
                  <SelectTrigger className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriasMateriaPrima.map(cat => <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unidade">Unidade</Label>
                <Select value={formData.unidade} onValueChange={v => setFormData({
                  ...formData,
                  unidade: v
                })}>
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
                <Input id="quantidade" type="number" value={formData.quantidade} onChange={e => setFormData({
                  ...formData,
                  quantidade: e.target.value === '' ? '' : Number(e.target.value)
                })} min={0} className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantidadeMinima">Qtd. Mínima</Label>
                <Input id="quantidadeMinima" type="number" value={formData.quantidadeMinima} onChange={e => setFormData({
                  ...formData,
                  quantidadeMinima: e.target.value === '' ? '' : Number(e.target.value)
                })} min={0} className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="precoUnitario">Preço Unitário (R$)</Label>
                <Input id="precoUnitario" type="number" step="0.01" value={formData.precoUnitario} onChange={e => setFormData({
                  ...formData,
                  precoUnitario: e.target.value === '' ? '' : Number(e.target.value)
                })} min={0} className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="localizacao">Localização</Label>
                <Input id="localizacao" value={formData.localizacao} onChange={e => setFormData({
                  ...formData,
                  localizacao: e.target.value
                })} placeholder="Ex: Prateleira A1" className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0" />
              </div>
            </div>
          </>}

          {editingItem?.tipo === 'acabado' && <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantidade">Estoque Atual</Label>
                <Input id="quantidade" type="number" value={formData.quantidade} onChange={e => setFormData({
                  ...formData,
                  quantidade: e.target.value === '' ? '' : Number(e.target.value)
                })} min={0} className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantidadeInicial" className="flex items-center gap-2">
                  Volume Total
                  <div className="group relative">
                    <AlertTriangle size={12} className="text-muted-foreground" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-popover text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                      Total de peças já produzidas deste modelo (usado para calcular vendas)
                    </div>
                  </div>
                </Label>
                <Input id="quantidadeInicial" type="number" value={formData.quantidadeInicial} onChange={e => setFormData({
                  ...formData,
                  quantidadeInicial: e.target.value === '' ? '' : Number(e.target.value)
                })} min={0} className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0 text-primary font-bold" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="localizacao">Localização</Label>
              <Input id="localizacao" value={formData.localizacao} onChange={e => setFormData({
                ...formData,
                localizacao: e.target.value
              })} placeholder="Ex: Estoque Produção" className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0" />
            </div>
          </>}
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

        {itemToDelete && <div className="py-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))]">
            <ProductImage imagemUrl={itemToDelete.imagemUrl} nome={itemToDelete.nome} />
            <div>
              <p className="font-medium text-foreground">{itemToDelete.nome}</p>
              <p className="text-sm text-muted-foreground">
                {itemToDelete.quantidade} {itemToDelete.unidade}
              </p>
            </div>
          </div>
        </div>}

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
            <div onClick={() => fileInputRef.current?.click()} className="relative w-full h-48 rounded-xl bg-background shadow-[inset_3px_3px_8px_hsl(var(--muted)/0.4),inset_-3px_-3px_8px_hsl(var(--background))] border border-border/30 cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-center overflow-hidden group">
              {novoModeloForm.imagemPreview ? <>
                <img src={novoModeloForm.imagemPreview} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-sm font-medium">Trocar imagem</span>
                </div>
              </> : <div className="flex flex-col items-center gap-2 text-muted-foreground">
                {uploadingImage ? <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /> : <>
                  <ImagePlus size={32} className="text-muted-foreground/50" />
                  <span className="text-xs uppercase tracking-wider">Clique para adicionar</span>
                </>}
              </div>}
            </div>
            <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />
          </div>

          {/* Nome e Referência */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground/70 uppercase tracking-wider">Nome do Modelo</Label>
              <Input value={novoModeloForm.nome} onChange={e => setNovoModeloForm({
                ...novoModeloForm,
                nome: e.target.value
              })} placeholder="Ex: Short Jeans" className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground/70 uppercase tracking-wider">Referência</Label>
              <Input value={novoModeloForm.referencia} onChange={e => setNovoModeloForm({
                ...novoModeloForm,
                referencia: e.target.value
              })} placeholder="Ex: 164" className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0" />
              <span className="text-[10px] text-muted-foreground">
                Sugestão automática. Edite para usar referência existente.
              </span>
            </div>
          </div>

          {/* Quantidade e Preço */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground/70 uppercase tracking-wider">Quantidade Inicial</Label>
              <Input type="number" min={1} value={novoModeloForm.quantidade === 0 ? '' : novoModeloForm.quantidade} onChange={e => setNovoModeloForm({
                ...novoModeloForm,
                quantidade: e.target.value === '' ? 0 : Number(e.target.value)
              })} placeholder="0" className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground/70 uppercase tracking-wider">Preço de Venda (R$)</Label>
              <Input type="number" step="0.01" min={0} value={novoModeloForm.precoVenda === 0 ? '' : novoModeloForm.precoVenda} onChange={e => setNovoModeloForm({
                ...novoModeloForm,
                precoVenda: e.target.value === '' ? 0 : Number(e.target.value)
              })} placeholder="0.00" className="shadow-[inset_2px_2px_5px_hsl(var(--muted)/0.3),inset_-2px_-2px_5px_hsl(var(--background))] border-0" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowNovoModeloModal(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSaveNovoModelo} disabled={uploadingImage} className="gap-2 bg-gradient-to-r from-primary to-primary/80">
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

        {produtoDuplicado && <div className="py-4">
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
        </div>}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => setShowDuplicadoModal(false)} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={() => {
            const nomeCompleto = novoModeloForm.referencia ? `${novoModeloForm.nome} - ${novoModeloForm.referencia}` : novoModeloForm.nome;
            criarNovoModeloAcabado(nomeCompleto + ` (${Date.now()})`, false);
          }} variant="outline" className="flex-1">
            Criar Novo Registro
          </Button>
          <Button onClick={() => {
            const nomeCompleto = novoModeloForm.referencia ? `${novoModeloForm.nome} - ${novoModeloForm.referencia}` : novoModeloForm.nome;
            criarNovoModeloAcabado(nomeCompleto, true);
          }} className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500">
            Somar Quantidade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Modal de Importação CSV */}
    <ImportModelosCSVModal open={showImportModal} onOpenChange={setShowImportModal} />

    {/* Modal de Novo Modelo Padronizado */}
    <NovoModeloPadronizadoModal
      open={showNovoModeloPadronizadoModal}
      onClose={() => setShowNovoModeloPadronizadoModal(false)}
    />

    {/* Modal de Detalhes do Modelo Padronizado */}
    <DetalhesModeloPadronizadoModal
      open={!!modeloDetalhes}
      modelo={modeloDetalhes}
      onClose={() => setModeloDetalhes(null)}
    />

    {/* Bottom Navigation */}
    <BottomNavigation />
  </div>;
}