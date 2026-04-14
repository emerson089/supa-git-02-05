import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Producao, ProducaoData, ProducaoInsert, ProducaoUpdate } from '@/entities/Producao';
import { STAGES } from '@/data/production-data';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Loader2, X, Star, Plus, MessageSquare } from 'lucide-react';
import { ProducaoFormSchema, getValidationErrors } from '@/lib/validations';
import { toast } from 'sonner';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { ResponsavelSelector } from '@/components/production/ResponsavelSelector';
import { ModeloSelector } from '@/components/production/ModeloSelector';
import { useModeloVariacoes } from '@/hooks/useModeloVariacoes';
import { TAMANHOS_LETRAS, TAMANHOS_NUMERICOS } from '@/hooks/useModelosPadronizados';
import { useProducaoLogs } from '@/hooks/useProducaoLog';

interface ProducaoFormProps {
  lote?: ProducaoData | null;
  onSave: (data: ProducaoInsert | ProducaoUpdate) => Promise<void>;
  onCancel: () => void;
}

export default function ProducaoForm({ lote, onSave, onCancel }: ProducaoFormProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingRef, setLoadingRef] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rolos, setRolos] = useState<number>(0);
  const [selectedModeloId, setSelectedModeloId] = useState<string | null>(null);
  const [showSizePicker, setShowSizePicker] = useState(false);
  const [sizeRows, setSizeRows] = useState<Array<{ tamanho: string; quantidade: number; prioridade: boolean }>>([]);

  const [formData, setFormData] = useState({
    id_producao: '',
    modelo_nome_cache: '',
    quantidade: 0,
    processo_atual: 'Corte',
    responsavel: '',
    observacoes: '',
    imagem_url: ''
  });

  // Load existing lot data for editing
  useEffect(() => {
    if (lote) {
      setFormData({
        id_producao: lote.id_producao || '',
        modelo_nome_cache: lote.modelo_nome_cache || '',
        quantidade: lote.quantidade || 0,
        processo_atual: lote.processo_atual || 'Corte',
        responsavel: lote.responsavel || '',
        observacoes: lote.observacoes || '',
        imagem_url: lote.imagem_url || ''
      });
    }
  }, [lote]);

  // Auto-generate reference for new lots
  useEffect(() => {
    const generateReference = async () => {
      if (!lote) {
        setLoadingRef(true);
        try {
          const nextRef = await Producao.getNextReference();
          setFormData(prev => ({ ...prev, id_producao: nextRef }));
        } catch {
          // Reference generation failed - silently continue
        } finally {
          setLoadingRef(false);
        }
      }
    };
    generateReference();
  }, [lote]);

  // Fetch size variations when a model from stock is selected
  const { data: modeloVariacoes, isLoading: loadingVariacoes } = useModeloVariacoes(selectedModeloId);

  // Fetch movement logs for edit mode (to build contextual WhatsApp messages)
  const { data: logs } = useProducaoLogs(lote?.id ?? null);

  // Auto-populate size rows when variations load
  useEffect(() => {
    if (!selectedModeloId || !modeloVariacoes?.length) return;
    setSizeRows(modeloVariacoes.map(v => ({ tamanho: v.tamanho, quantidade: 0, prioridade: false })));
  }, [modeloVariacoes, selectedModeloId]);

  // Handler for selecting existing model
  const handleModeloSelect = (modelo: { nome: string; imagemUrl: string; id: string }) => {
    setFormData(prev => ({
      ...prev,
      modelo_nome_cache: modelo.nome,
      imagem_url: modelo.imagemUrl,
    }));
    setSelectedModeloId(modelo.id);
    setSizeRows([]);
    toast.success('Modelo selecionado! Complete os demais campos.');
  };


  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Por favor, selecione apenas arquivos de imagem (JPG, PNG, WEBP, GIF).');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB.');
      return;
    }

    setUploading(true);

    try {
      // Get current user for user-specific path
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Você precisa estar autenticado para enviar imagens.');
        return;
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      // Use user-specific path for storage policy compliance
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('lotes')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Store the file path (not URL) for signed URL generation
      setFormData({ ...formData, imagem_url: filePath });
      toast.success('Imagem enviada com sucesso!');
    } catch {
      toast.error('Erro ao fazer upload da imagem. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setFormData({ ...formData, imagem_url: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateForm = () => {
    const result = ProducaoFormSchema.safeParse(formData);
    if (!result.success) {
      const validationErrors = getValidationErrors(result.error);
      setErrors(validationErrors);
      const firstError = Object.values(validationErrors)[0];
      toast.error(firstError);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    
    try {
      if (lote) {
        // Editing existing lot — send formData as-is
        await onSave({ ...formData, prioridade: 'normal' });
      } else {
        // Creating new lot — build structured observacoes prefix
        const gradeParts = sizeRows
          .filter(r => r.quantidade > 0)
          .map(r => `${r.tamanho}:${r.quantidade}${r.prioridade ? '★' : ''}`);
        const gradePrefix = gradeParts.length > 0 ? `Grade: ${gradeParts.join(', ')}` : '';

        const prefixParts = [gradePrefix, rolos > 0 ? `Rolos: ${rolos}` : ''].filter(Boolean);
        const obsWithMeta = prefixParts.length > 0
          ? (formData.observacoes.trim()
              ? `${prefixParts.join(' | ')} | ${formData.observacoes.trim()}`
              : prefixParts.join(' | '))
          : formData.observacoes;

        await onSave({ ...formData, quantidade: 0, observacoes: obsWithMeta, prioridade: 'normal' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao salvar. Tente novamente.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ── Size table helpers ────────────────────────────────────────────────
  const TODOS_TAMANHOS = [...TAMANHOS_LETRAS, ...TAMANHOS_NUMERICOS] as string[];
  const tamanhosDisponiveis = TODOS_TAMANHOS.filter(t => !sizeRows.some(r => r.tamanho === t));
  const totalPecas = sizeRows.reduce((sum, r) => sum + (r.quantidade || 0), 0);

  const handleAddTamanho = (tamanho: string) => {
    setSizeRows(prev => [...prev, { tamanho, quantidade: 0, prioridade: false }]);
    setShowSizePicker(false);
  };

  const handleRemoveTamanho = (tamanho: string) => {
    setSizeRows(prev => prev.filter(r => r.tamanho !== tamanho));
  };

  const handleQuantidadeChange = (tamanho: string, value: string) => {
    const num = value === '' ? 0 : Math.min(Math.max(parseInt(value) || 0, 0), 100000);
    setSizeRows(prev => prev.map(r => r.tamanho === tamanho ? { ...r, quantidade: num } : r));
  };

  const handleTogglePrioridade = (tamanho: string) => {
    setSizeRows(prev => prev.map(r => r.tamanho === tamanho ? { ...r, prioridade: !r.prioridade } : r));
  };

  // ── WhatsApp message builder ──────────────────────────────────────────

  /** Parse pipe-separated "Label: value" observacao into a key-value map */
  const parseLogObs = (obs?: string): Record<string, string> => {
    const result: Record<string, string> = {};
    if (!obs) return result;
    obs.split('|').forEach(part => {
      const m = part.trim().match(/^([^:]+):\s*(.+)$/);
      if (m) result[m[1].trim()] = m[2].trim();
    });
    return result;
  };

  const handleCopiarWhatsApp = () => {
    if (lote) {
      const currentStage = formData.processo_atual;

      if (currentStage === 'Corte') {
        // Corte: parse grade and rolos from lot's observacoes
        const obs = formData.observacoes;
        const gradeMatch = obs.match(/Grade:\s*([^|]+)/i);
        const rolosMatch = obs.match(/Rolos:\s*(\d+)/i);
        const rolosValue = rolosMatch ? parseInt(rolosMatch[1]) : 0;

        let gradeLines = '';
        let totalPecasValue = 0;
        if (gradeMatch) {
          const lines: string[] = [];
          gradeMatch[1].split(',').forEach(item => {
            const m = item.trim().match(/^([^\s:]+):(\d+)(★)?$/);
            if (m) {
              const qty = parseInt(m[2]);
              totalPecasValue += qty;
              lines.push(`  ${m[1]} → ${qty} peças${m[3] ? ' ⭐ (prioridade)' : ''}`);
            }
          });
          gradeLines = lines.join('\n');
        }

        const obsLivre = obs
          .split('|').map(p => p.trim())
          .filter(p => !p.match(/^Grade:/i) && !p.match(/^Rolos:/i))
          .join(' | ').trim();

        const parts: string[] = [
          `🧵 *Pedido de Corte - Lote ${formData.id_producao}*`,
          `Modelo: ${formData.modelo_nome_cache}`,
        ];
        if (rolosValue > 0) parts.push(`Rolos de tecido: ${rolosValue}`);

        // Extract list of all sizes in the grade
        const allSizes = gradeMatch[1].split(',').map(item => {
          const m = item.trim().match(/^([^\s:]+)/);
          return m ? m[1] : '';
        }).filter(Boolean).join(', ');
        
        if (allSizes) parts.push(`Tamanhos : ${allSizes}`);

        if (gradeLines) {
          parts.push('');
          parts.push('📐 *Grade de Corte:*');
          parts.push(gradeLines);
          parts.push(`Total: ${totalPecasValue} peças`);
        }
        if (obsLivre) { parts.push(''); parts.push(`📝 Obs: ${obsLivre}`); }

        navigator.clipboard.writeText(parts.join('\n'));
        toast.success('Mensagem copiada para WhatsApp!');
        return;
      }

      // Other stages: read from the log entry of entering that stage
      const stageLog = logs?.find(l => l.processo_novo === currentStage);
      const d = parseLogObs(stageLog?.observacao);
      const stageResponsavel = stageLog?.responsavel || '';

      const emoji =
        currentStage === 'Lavanderia' ? '🫧' :
        currentStage === 'Acabamento' ? '✨' : '🧵';

      const parts: string[] = [
        `${emoji} *${currentStage} - Lote ${formData.id_producao}*`,
        `Modelo: ${formData.modelo_nome_cache}`,
      ];
      if (stageResponsavel) parts.push(`👤 Responsável: ${stageResponsavel}`);
      parts.push('');

      if (currentStage === 'Costura/Facção') {
        if (d['Cortador'])       parts.push(`✂️ Cortador: ${d['Cortador']}`);
        if (d['Peças cortadas']) parts.push(`📦 Peças: ${d['Peças cortadas']}`);
        if (d['Numeração'])      parts.push(`📏 Numeração: ${d['Numeração']}`);
        if (d['Cor da linha'])   parts.push(`🎨 Cor da linha: ${d['Cor da linha']}`);
        const qtd = d['Zíper (qtd)'], tipo = d['Zíper (tipo/cor)'];
        if (qtd || tipo) parts.push(`🤐 Zíper: ${[qtd, tipo].filter(Boolean).join('x ')}`);
        if (d['Abanhado']  === 'Sim') parts.push('✅ Abanhado');
        if (d['Etiquetas'] === 'Sim') parts.push('✅ Etiquetas por tamanho');
        if (d['Forro']     === 'Sim') parts.push('✅ Forro');
      } else if (currentStage === 'Lavanderia') {
        if (d['Tipo de lavado'])   parts.push(`🫧 Tipo de lavado: ${d['Tipo de lavado']}`);
        if (d['Cor do resultado']) parts.push(`🎨 Cor do resultado: ${d['Cor do resultado']}`);
        if (d['Peças'])            parts.push(`📦 Peças: ${d['Peças']}`);
        if (d['Processo especial'] === 'Sim') parts.push('✅ Processo especial');
      } else if (currentStage === 'Acabamento') {
        if (d['Botão'])                        parts.push(`🔢 Botão: ${d['Botão']}x`);
        if (d['Bolsa transparente'] === 'Sim') parts.push('✅ Bolsa transparente');
        if (d['Cordão']            === 'Sim')  parts.push('✅ Cordão');
        if (d['Placa da marca']    === 'Sim')  parts.push('✅ Placa de identificação da marca');
        if (d['Tag']               === 'Sim')  parts.push('✅ Tag da peça');
      }

      // Always append the original grade if present
      const gradeMatch = formData.observacoes.match(/Grade:\s*([^|]+)/i);
      if (gradeMatch) {
        parts.push('');
        parts.push(`📊 Grade: ${gradeMatch[1].trim()}`);
      }

      navigator.clipboard.writeText(parts.join('\n'));
      toast.success('Mensagem copiada para WhatsApp!');
      return;
    }

    // Create mode: use sizeRows state
    const gradeLines = sizeRows
      .filter(r => r.quantidade > 0)
      .map(r => `  ${r.tamanho} → ${r.quantidade} peças${r.prioridade ? ' ⭐ (prioridade)' : ''}`)
      .join('\n');

    const parts: string[] = [
      `🧵 *Pedido de Corte - Lote ${formData.id_producao}*`,
      `Modelo: ${formData.modelo_nome_cache}`,
    ];
    if (rolos > 0) parts.push(`Rolos de tecido: ${rolos}`);
    
    // List all sizes currently in the table
    const allSizes = sizeRows.map(r => r.tamanho).join(', ');
    if (allSizes) parts.push(`Tamanhos : ${allSizes}`);

    if (gradeLines) {
      parts.push('');
      parts.push('📐 *Grade de Corte:*');
      parts.push(gradeLines);
      parts.push(`Total: ${totalPecas} peças`);
    }
    if (formData.observacoes.trim()) {
      parts.push('');
      parts.push(`📝 Obs: ${formData.observacoes.trim()}`);
    }

    navigator.clipboard.writeText(parts.join('\n'));
    toast.success('Mensagem copiada para WhatsApp!');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Seletor de modelo existente - apenas para novos lotes */}
      {!lote && (
        <ModeloSelector onSelect={handleModeloSelect} />
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="id_producao">Referência do Lote</Label>
          <Input
            id="id_producao"
            value={loadingRef ? '' : formData.id_producao}
            onChange={(e) => {
              setFormData({ ...formData, id_producao: e.target.value });
              if (errors.id_producao) setErrors({ ...errors, id_producao: '' });
            }}
            placeholder={loadingRef ? 'Gerando...' : 'Ex: 4944'}
            required
            disabled={!!lote || loadingRef}
            maxLength={50}
            className={errors.id_producao ? 'border-destructive' : ''}
          />
          {errors.id_producao && <p className="text-xs text-destructive">{errors.id_producao}</p>}
        </div>

        {lote ? (
          <div className="space-y-2">
            <Label htmlFor="quantidade">Quantidade</Label>
            <Input
              id="quantidade"
              type="number"
              value={formData.quantidade === 0 ? '' : formData.quantidade}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '') {
                  setFormData({ ...formData, quantidade: 0 });
                } else {
                  const val = parseInt(value);
                  if (!isNaN(val)) {
                    setFormData({ ...formData, quantidade: Math.min(Math.max(val, 0), 100000) });
                  }
                }
                if (errors.quantidade) setErrors({ ...errors, quantidade: '' });
              }}
              min={0}
              max={100000}
              placeholder="0"
              className={errors.quantidade ? 'border-destructive' : ''}
            />
            {errors.quantidade && <p className="text-xs text-destructive">{errors.quantidade}</p>}
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="rolos">Qtd de rolos de tecido</Label>
            <Input
              id="rolos"
              type="number"
              value={rolos === 0 ? '' : rolos}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '') {
                  setRolos(0);
                } else {
                  const val = parseInt(value);
                  if (!isNaN(val)) {
                    setRolos(Math.min(Math.max(val, 0), 10000));
                  }
                }
              }}
              min={0}
              max={10000}
              placeholder="Ex: 3"
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="modelo_nome_cache">Nome do Modelo</Label>
        <Input
          id="modelo_nome_cache"
          value={formData.modelo_nome_cache}
          onChange={(e) => {
            setFormData({ ...formData, modelo_nome_cache: e.target.value });
            if (errors.modelo_nome_cache) setErrors({ ...errors, modelo_nome_cache: '' });
          }}
          placeholder="Ex: Wide Leg Destroyed"
          required
          maxLength={200}
          className={errors.modelo_nome_cache ? 'border-destructive' : ''}
        />
        {errors.modelo_nome_cache && <p className="text-xs text-destructive">{errors.modelo_nome_cache}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="processo_atual">Etapa Atual</Label>
          <Select
            value={formData.processo_atual}
            onValueChange={(value) => setFormData({ ...formData, processo_atual: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a etapa" />
            </SelectTrigger>
            <SelectContent>
              {STAGES.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="responsavel">Responsável</Label>
          <ResponsavelSelector
            value={formData.responsavel}
            onChange={(value) => setFormData({ ...formData, responsavel: value })}
            etapaAtual={formData.processo_atual}
          />
        </div>
        </div>

      <div className="space-y-2">
        <Label>Imagem do Lote</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
          disabled={uploading}
        />
        
        {!formData.imagem_url ? (
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors"
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Enviando...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Clique para selecionar uma imagem
                </span>
                <span className="text-xs text-muted-foreground">
                  PNG, JPG ou WEBP (máx. 5MB)
                </span>
              </div>
            )}
          </div>
        ) : (
          <ImagePreview 
            imagePath={formData.imagem_url} 
            onRemove={handleRemoveImage} 
          />
        )}
      </div>

      {/* ── Grade de Corte — only for new lots ── */}
      {!lote && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Grade de Corte</Label>
            {loadingVariacoes && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Carregando numerações...
              </span>
            )}
          </div>

          <div className="border border-border rounded-lg">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_120px_40px_40px] gap-2 px-3 py-2 bg-muted/50 border-b border-border rounded-t-lg">
              <span className="text-xs font-medium text-muted-foreground">Tamanho</span>
              <span className="text-xs font-medium text-muted-foreground">Quantidade</span>
              <span className="text-xs font-medium text-muted-foreground text-center">Prior.</span>
              <span className="text-xs font-medium text-muted-foreground text-center">Rem.</span>
            </div>

            {/* Size rows */}
            {sizeRows.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                {selectedModeloId
                  ? 'Nenhuma numeração cadastrada para este modelo'
                  : 'Adicione tamanhos ou selecione um modelo acima'}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {sizeRows.map((row) => (
                  <div
                    key={row.tamanho}
                    className="grid grid-cols-[1fr_120px_40px_40px] gap-2 items-center px-3 py-2"
                  >
                    <span className="text-sm font-medium">{row.tamanho}</span>
                    <Input
                      type="number"
                      min={0}
                      max={100000}
                      value={row.quantidade === 0 ? '' : row.quantidade}
                      onChange={(e) => handleQuantidadeChange(row.tamanho, e.target.value)}
                      placeholder="0"
                      className="h-8 text-sm"
                    />
                    <button
                      type="button"
                      title={row.prioridade ? 'Remover prioridade' : 'Marcar como prioridade (melhor venda)'}
                      onClick={() => handleTogglePrioridade(row.tamanho)}
                      className="h-8 w-8 mx-auto flex items-center justify-center rounded hover:bg-accent transition-colors"
                    >
                      <Star
                        className={`h-4 w-4 transition-colors ${
                          row.prioridade ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      title="Remover tamanho"
                      onClick={() => handleRemoveTamanho(row.tamanho)}
                      className="h-8 w-8 mx-auto flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Footer: total + add button */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/30 rounded-b-lg">
              <span className="text-xs text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{totalPecas}</span> peças
              </span>

              {tamanhosDisponiveis.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSizePicker(prev => !prev)}
                    className="flex items-center gap-1 text-xs border border-border rounded px-2 py-1 hover:bg-accent transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Adicionar tamanho
                  </button>

                  {showSizePicker && (
                    <div className="absolute right-0 bottom-full mb-2 z-50 bg-popover border border-border rounded-xl shadow-xl p-3 w-56">
                      {TAMANHOS_LETRAS.filter(t => tamanhosDisponiveis.includes(t)).length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-muted-foreground mb-2">Letras</p>
                          <div className="flex flex-wrap gap-1.5">
                            {TAMANHOS_LETRAS.filter(t => tamanhosDisponiveis.includes(t)).map(t => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => handleAddTamanho(t)}
                                className="min-w-[2.5rem] px-2 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {TAMANHOS_NUMERICOS.filter(t => tamanhosDisponiveis.includes(t)).length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2">Numéricos</p>
                          <div className="flex flex-wrap gap-1.5">
                            {TAMANHOS_NUMERICOS.filter(t => tamanhosDisponiveis.includes(t)).map(t => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => handleAddTamanho(t)}
                                className="min-w-[2.5rem] px-2 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          value={formData.observacoes}
          onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
          placeholder="Observações adicionais..."
          rows={3}
          maxLength={1000}
        />
        <p className="text-xs text-muted-foreground">{formData.observacoes.length}/1000 caracteres</p>
      </div>

      {/* ── Copiar para WhatsApp ── */}
      {(lote || rolos > 0 || sizeRows.length > 0) && (
        <button
          type="button"
          onClick={handleCopiarWhatsApp}
          className="w-full flex items-center justify-center gap-2 border border-green-500/40 text-green-700 dark:text-green-400 rounded-md px-4 py-2 text-sm hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors"
        >
          <MessageSquare className="h-4 w-4" />
          Copiar para WhatsApp
        </button>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : lote ? 'Atualizar' : 'Criar Lote'}
        </Button>
      </div>
    </form>
  );
}

function ImagePreview({ imagePath, onRemove }: { imagePath: string; onRemove: () => void }) {
  const { signedUrl, loading } = useSignedUrl(imagePath);

  return (
    <div className="relative">
      <div className="border border-border rounded-lg overflow-hidden bg-muted flex items-center justify-center h-48">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : signedUrl ? (
          <img 
            src={signedUrl} 
            alt="Preview" 
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-sm text-muted-foreground">Erro ao carregar imagem</span>
        )}
      </div>
      <Button
        type="button"
        variant="destructive"
        size="icon"
        className="absolute top-2 right-2 h-8 w-8"
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
