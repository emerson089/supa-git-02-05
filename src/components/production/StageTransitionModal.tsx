import { useState, useEffect } from 'react';
import { ProducaoData } from '@/entities/Producao';
import { ResponsavelSelector } from './ResponsavelSelector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { STAGES } from '@/data/production-data';
import { Loader2, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface StageFieldConfig {
  showResponsavel: boolean;
  responsavelLabel?: string;
  extraFields: Array<{ key: string; label: string; type: 'number' | 'text' | 'boolean' }>;
}

const STAGE_FIELDS: Record<string, StageFieldConfig> = {
  'Corte': {
    showResponsavel: true,
    responsavelLabel: 'Cortador',
    extraFields: [
      { key: 'rolos', label: 'Qtd de rolos de tecido', type: 'number' }
    ]
  },
  'Costura/Facção': {
    showResponsavel: true,
    responsavelLabel: 'Facção / Costureira',
    extraFields: [
      { key: 'pecas',      label: 'Qtd de peças cortadas',        type: 'number'  },
      { key: 'numeracao',  label: 'Numeração das peças (Ex: 34 ao 44)', type: 'text' },
      { key: 'cor_linha',  label: 'Cor da linha',                  type: 'text'    },
      { key: 'qtd_ziper',  label: 'Quantidade de zíper',           type: 'number'  },
      { key: 'tipo_ziper', label: 'Tipo / tamanho do ziper',           type: 'text'    },
      { key: 'abanhado',   label: 'Abanhado',                      type: 'boolean' },
      { key: 'etiquetas',  label: 'Etiquetas por tamanho',         type: 'boolean' },
      { key: 'forro',      label: 'Forro',                         type: 'boolean' },
    ]
  },
  'Travete': {
    showResponsavel: true,
    extraFields: []
  },
  'Destroyed': {
    showResponsavel: true,
    extraFields: []
  },
  'Lavanderia': {
    showResponsavel: true,
    responsavelLabel: 'Lavanderia',
    extraFields: [
      { key: 'tipo_lavado',       label: 'Tipo de lavado',    type: 'text'    },
      { key: 'cor_resultado',     label: 'Cor do resultado',  type: 'text'    },
      { key: 'qtd_pecas',         label: 'Qtd de peças',      type: 'number'  },
      { key: 'processo_especial', label: 'Processo especial', type: 'boolean' },
    ]
  },
  'Acabamento': {
    showResponsavel: true,
    extraFields: []
  },
  'Aprontamento': {
    showResponsavel: true,
    extraFields: [
      { key: 'botao',              label: 'Quantidade de botões',            type: 'number'  },
      { key: 'bolsa_transparente', label: 'Bolsa transparente',              type: 'boolean' },
      { key: 'cordao',             label: 'Cordão',                          type: 'boolean' },
      { key: 'placa_marca',        label: 'Placa de identificação da marca', type: 'boolean' },
      { key: 'tag',                label: 'Tag da peça',                     type: 'boolean' },
    ]
  },
  'Vendas': {
    showResponsavel: false,
    extraFields: []
  }
};

export interface StageTransitionData {
  responsavel?: string;
  observacao?: string;
  extras?: Record<string, string>;
}

interface StageTransitionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lot: ProducaoData | null;
  fromStage: string;
  toStage: string;
  onConfirm: (data: StageTransitionData) => void;
  loading?: boolean;
}

export function StageTransitionModal({
  open,
  onOpenChange,
  lot,
  fromStage,
  toStage,
  onConfirm,
  loading
}: StageTransitionModalProps) {
  const [responsavel, setResponsavel] = useState('');
  const [observacao, setObservacao] = useState('');
  const [extras, setExtras] = useState<Record<string, string>>({});

  const config = STAGE_FIELDS[toStage] || { showResponsavel: true, extraFields: [] };
  const toStageLabel = STAGES.find(s => s.id === toStage)?.label || toStage;
  const fromStageLabel = STAGES.find(s => s.id === fromStage)?.label || fromStage;

  // Pre-fill Numeração based on Grade de Corte if transitioning to Costura/Facção
  useEffect(() => {
    if (toStage === 'Costura/Facção' && lot?.observacoes) {
      const gradeMatch = lot.observacoes.match(/Grade:\s*([^|]+)/i);
      if (gradeMatch) {
        const gradeStr = gradeMatch[1].trim();
        const items = gradeStr.split(',');
        const sizes = items.map(item => {
          const match = item.trim().match(/^([^\s:]+):\d+/);
          return match ? match[1] : null;
        }).filter(Boolean) as string[];

        if (sizes.length > 0) {
          let numeracao = sizes.join(', ');
          const allNumeric = sizes.every(s => !isNaN(parseInt(s)));
          
          if (allNumeric && sizes.length > 1) {
            const nums = sizes.map(s => parseInt(s)).sort((a,b) => a - b);
            numeracao = `${nums[0]} ao ${nums[nums.length - 1]}`;
          }

          setExtras(prev => ({
            ...prev,
            numeracao: prev.numeracao || numeracao
          }));
        }
      }
    }
  }, [toStage, lot]);

  const handleConfirm = () => {
    onConfirm({
      responsavel: config.showResponsavel ? responsavel : undefined,
      observacao: observacao.trim() || undefined,
      extras: Object.keys(extras).length > 0 ? extras : undefined
    });
    // Reset form
    setResponsavel('');
    setObservacao('');
    setExtras({});
  };

  const handleCancel = () => {
    setResponsavel('');
    setObservacao('');
    setExtras({});
    onOpenChange(false);
  };

  if (!lot) return null;

  const buildResumoWhatsApp = () => {
    const lines: string[] = [];
    const emoji = toStage === 'Lavanderia' ? '🫧' : (toStage === 'Acabamento' || toStage === 'Aprontamento') ? '✨' : '🧵';

    lines.push(`${emoji} *${toStageLabel} - Lote #${lot.id_producao}*`);
    if (lot.modelo_nome_cache) lines.push(`📌 Modelo: ${lot.modelo_nome_cache}`);
    if (responsavel) lines.push(`👤 ${config.responsavelLabel || 'Responsável'}: ${responsavel}`);
    lines.push('');

    if (toStage === 'Costura/Facção') {
      if (extras.pecas)     lines.push(`📦 Peças: ${extras.pecas}`);
      if (extras.numeracao) lines.push(`📏 Numeração: ${extras.numeracao}`);
      if (extras.cor_linha) lines.push(`🎨 Cor da linha: ${extras.cor_linha}`);
      if (extras.qtd_ziper || extras.tipo_ziper) {
        const zipParts = [extras.qtd_ziper, extras.tipo_ziper].filter(Boolean).join('x ');
        lines.push(`🤐 Zíper: ${zipParts}`);
      }
      if (extras.abanhado  === 'Sim') lines.push('✅ Abanhado');
      if (extras.etiquetas === 'Sim') lines.push('✅ Etiquetas por tamanho');
      if (extras.forro     === 'Sim') lines.push('✅ Forro');
    } else if (toStage === 'Lavanderia') {
      if (extras.tipo_lavado)   lines.push(`🫧 Tipo de lavado: ${extras.tipo_lavado}`);
      if (extras.cor_resultado) lines.push(`🎨 Cor do resultado: ${extras.cor_resultado}`);
      if (extras.qtd_pecas)     lines.push(`📦 Peças: ${extras.qtd_pecas}`);
      if (extras.processo_especial === 'Sim') lines.push('✅ Processo especial');
    } else if (toStage === 'Acabamento' || toStage === 'Aprontamento') {
      if (extras.botao)                          lines.push(`🔢 Botão: ${extras.botao}x`);
      if (extras.bolsa_transparente  === 'Sim')  lines.push('✅ Bolsa transparente');
      if (extras.cordao              === 'Sim')  lines.push('✅ Cordão');
      if (extras.placa_marca         === 'Sim')  lines.push('✅ Placa de identificação da marca');
      if (extras.tag                 === 'Sim')  lines.push('✅ Tag da peça');
    }

    if (lot.observacoes) {
      const gradeMatch = lot.observacoes.match(/Grade:\s*([^|]+)/i);
      if (gradeMatch) {
        lines.push('');
        lines.push(`📊 Grade: ${gradeMatch[1].trim()}`);
      }
    }

    if (observacao.trim()) {
      lines.push('');
      lines.push(`💬 Obs: ${observacao.trim()}`);
    }

    return lines.join('\n');
  };

  const handleCopiarResumo = async () => {
    const msg = buildResumoWhatsApp();
    try {
      await navigator.clipboard.writeText(msg);
      toast.success('Resumo copiado! Cole no WhatsApp da costureira.');
    } catch {
      toast.error('Não foi possível copiar. Verifique as permissões do navegador.');
    }
  };

  // Split fields into sections for Costura/Facção: numeric/text first, then booleans
  const numericTextFields = config.extraFields.filter(f => f.type !== 'boolean');
  const booleanFields = config.extraFields.filter(f => f.type === 'boolean');

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Mover lote {lot.id_producao} para {toStageLabel}
          </DialogTitle>
          <DialogDescription>
            Saindo de: {fromStageLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Numeric / text extra fields */}
          {numericTextFields.map(field => (
            <div key={field.key} className="space-y-2">
              <Label>{field.label}</Label>
              <Input
                type={field.type}
                min={field.type === 'number' ? 0 : undefined}
                value={extras[field.key] || ''}
                onChange={(e) => setExtras(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={`Informe ${field.label.toLowerCase()}`}
              />
            </div>
          ))}

          {/* Boolean (Sim/Não) fields */}
          {booleanFields.length > 0 && (
            <div className="space-y-3">
              {booleanFields.map(field => {
                const current = extras[field.key] || 'Não';
                return (
                  <div key={field.key} className="flex items-center justify-between gap-4">
                    <Label className="text-sm">{field.label}</Label>
                    <div className="flex gap-1.5 shrink-0">
                      {['Não', 'Sim'].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setExtras(prev => ({ ...prev, [field.key]: opt }))}
                          className={cn(
                            "w-14 py-1 text-sm rounded-md border transition-colors",
                            current === opt
                              ? opt === 'Sim'
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted text-foreground border-border font-medium"
                              : "border-border text-muted-foreground hover:bg-accent"
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Responsável selector */}
          {config.showResponsavel && (
            <div className="space-y-2">
              <Label>{config.responsavelLabel || 'Responsável'}</Label>
              <ResponsavelSelector
                value={responsavel}
                onChange={setResponsavel}
                etapaAtual={toStage}
              />
            </div>
          )}

          {/* Observação */}
          <div className="space-y-2">
            <Label>Observação <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Adicione uma observação sobre esta movimentação..."
              rows={3}
            />
          </div>

          {/* Copiar resumo — for Costura/Facção and Lavanderia */}
          {(toStage === 'Costura/Facção' || toStage === 'Lavanderia' || toStage === 'Acabamento' || toStage === 'Aprontamento') && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopiarResumo}
              className="w-full gap-2"
            >
              <Copy className="h-4 w-4" />
              Copiar resumo para WhatsApp
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Movendo...
              </>
            ) : (
              'Confirmar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
