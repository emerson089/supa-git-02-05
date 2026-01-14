import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Producao, ProducaoData, ProducaoInsert, ProducaoUpdate } from '@/entities/Producao';
import { STAGES } from '@/data/production-data';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Loader2, X } from 'lucide-react';
import { ProducaoFormSchema, getValidationErrors } from '@/lib/validations';
import { toast } from 'sonner';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { ResponsavelSelector } from '@/components/production/ResponsavelSelector';

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
      await onSave({ ...formData, prioridade: 'normal' });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao salvar. Tente novamente.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
            required
            placeholder="0"
            className={errors.quantidade ? 'border-destructive' : ''}
          />
          {errors.quantidade && <p className="text-xs text-destructive">{errors.quantidade}</p>}
        </div>
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
      <div className="border border-border rounded-lg overflow-hidden bg-muted flex items-center justify-center h-40">
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
