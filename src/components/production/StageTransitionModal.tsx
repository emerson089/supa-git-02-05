import { useState } from 'react';
import { ProducaoData } from '@/entities/Producao';
import { ResponsavelSelector } from './ResponsavelSelector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { STAGES } from '@/data/production-data';
import { Loader2 } from 'lucide-react';

interface StageFieldConfig {
  showResponsavel: boolean;
  responsavelLabel?: string;
  extraFields: Array<{ key: string; label: string; type: 'number' | 'text' }>;
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
      { key: 'pecas', label: 'Qtd de peças cortadas', type: 'number' },
      { key: 'numeracao', label: 'Numeração das peças (Ex: 34 ao 44)', type: 'text' }
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
    extraFields: []
  },
  'Limpado': {
    showResponsavel: true,
    extraFields: []
  },
  'Aprontamento': {
    showResponsavel: true,
    extraFields: []
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

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>
            Mover lote {lot.id_producao} para {toStageLabel}
          </DialogTitle>
          <DialogDescription>
            Saindo de: {fromStageLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Extra fields (e.g., rolos for Corte) */}
          {config.extraFields.map(field => (
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
