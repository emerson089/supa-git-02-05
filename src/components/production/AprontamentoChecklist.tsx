import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ChecklistAprontamento } from '@/types/production';
import { ProducaoData, Producao } from '@/entities/Producao';
import { toast } from 'sonner';
import { Loader2, Check, Package, Tag, CircleDot, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AprontamentoChecklistProps {
  lot: ProducaoData;
  open: boolean;
  onClose: () => void;
  onUpdate?: (checklist: ChecklistAprontamento) => void;
}

const checklistItems = [
  { key: 'botao' as const, label: 'Botão', icon: CircleDot },
  { key: 'bolsa' as const, label: 'Bolsa', icon: ShoppingBag },
  { key: 'cordao' as const, label: 'Cordão', icon: Package },
  { key: 'tag' as const, label: 'Tag', icon: Tag },
];

const defaultChecklist: ChecklistAprontamento = {
  botao: false,
  bolsa: false,
  cordao: false,
  tag: false,
};

export function AprontamentoChecklist({ lot, open, onClose, onUpdate }: AprontamentoChecklistProps) {
  const [checklist, setChecklist] = useState<ChecklistAprontamento>(defaultChecklist);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lot && open) {
      // Parse checklist from lot data
      const lotChecklist = lot.checklist_aprontamento as ChecklistAprontamento | null;
      setChecklist(lotChecklist || defaultChecklist);
    }
  }, [lot, open]);

  const handleToggle = (key: keyof ChecklistAprontamento) => {
    setChecklist(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Producao.updateChecklist(lot.id, checklist);

      toast.success('Checklist atualizado!');
      onUpdate?.(checklist);
      onClose();
    } catch (error) {
      console.error('Erro ao salvar checklist:', error);
      toast.error('Erro ao salvar checklist');
    } finally {
      setSaving(false);
    }
  };

  const completedCount = Object.values(checklist).filter(Boolean).length;
  const totalCount = checklistItems.length;
  const isComplete = completedCount === totalCount;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Checklist de Aprontamento
            <span className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              isComplete 
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400" 
                : "bg-muted text-muted-foreground"
            )}>
              {completedCount}/{totalCount}
            </span>
          </DialogTitle>
          <DialogDescription>
            Lote {lot.id_producao} - {lot.modelo_nome_cache || 'Sem modelo'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {checklistItems.map((item) => {
            const Icon = item.icon;
            const isChecked = checklist[item.key];
            
            return (
              <div
                key={item.key}
                onClick={() => handleToggle(item.key)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                  isChecked
                    ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800"
                    : "bg-muted/30 border-border hover:bg-muted/50"
                )}
              >
                <Checkbox
                  id={item.key}
                  checked={isChecked}
                  onCheckedChange={() => handleToggle(item.key)}
                  className="pointer-events-none"
                />
                <Icon className={cn(
                  "h-5 w-5",
                  isChecked ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                )} />
                <Label
                  htmlFor={item.key}
                  className={cn(
                    "flex-1 cursor-pointer font-medium",
                    isChecked ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
                  )}
                >
                  {item.label}
                </Label>
                {isChecked && (
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isComplete && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex-1 text-center sm:text-left">
              ✓ Lote pronto para mover para Vendas!
            </p>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper to check if checklist is complete
export function isChecklistComplete(checklist: ChecklistAprontamento | null | undefined): boolean {
  if (!checklist) return false;
  return checklist.botao && checklist.bolsa && checklist.cordao && checklist.tag;
}

// Helper to get checklist progress
export function getChecklistProgress(checklist: ChecklistAprontamento | null | undefined): { completed: number; total: number } {
  if (!checklist) return { completed: 0, total: 4 };
  const completed = [checklist.botao, checklist.bolsa, checklist.cordao, checklist.tag].filter(Boolean).length;
  return { completed, total: 4 };
}
