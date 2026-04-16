import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Comprovante } from '@/hooks/useComprovantes';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface ComprovanteModalProps {
  isOpen: boolean;
  onClose: () => void;
  comprovante: Comprovante | null;
  onSave: (id: string, updates: Partial<Comprovante>) => void;
  isSaving: boolean;
}

export function ComprovanteModal({ isOpen, onClose, comprovante, onSave, isSaving }: ComprovanteModalProps) {
  const [formData, setFormData] = useState<Partial<Comprovante>>({});

  useEffect(() => {
    if (comprovante) {
      setFormData({
        valor: comprovante.valor,
        nome_pagador: comprovante.nome_pagador || '',
        banco_origem: comprovante.banco_origem || '',
        status: comprovante.status,
        observacoes: comprovante.observacoes || '',
        tipo_pagamento: comprovante.tipo_pagamento || ''
      });
    }
  }, [comprovante]);

  if (!comprovante) return null;

  const handleChange = (field: keyof Comprovante, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave(comprovante.id, formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col sm:flex-row gap-0 overflow-hidden">
        
        {/* Lado Esquerdo - Imagem do Comprovante */}
        <div className="w-full sm:w-1/2 bg-zinc-100 dark:bg-zinc-900 border-r border-border p-4 flex flex-col">
          <DialogHeader className="sm:text-left mb-4 px-2">
            <DialogTitle>Visualizador da Imagem</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 bg-white dark:bg-zinc-950 border rounded-lg overflow-hidden flex items-center justify-center p-2 relative h-[40vh] sm:h-full">
            <a href={comprovante.imagem_url} target="_blank" rel="noreferrer" className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded hover:bg-black/80 transition z-10" title="Abrir em Nova Guia">
              <ExternalLink size={16} />
            </a>
            <img 
              src={comprovante.imagem_url} 
              alt="Comprovante" 
              className="max-w-full h-auto object-contain max-h-[60vh] sm:max-h-[80vh] m-auto block"
            />
          </ScrollArea>
        </div>

        {/* Lado Direito - Edição dos Dados */}
        <div className="w-full sm:w-1/2 p-6 flex flex-col gap-4 overflow-y-auto max-h-[50vh] sm:max-h-full">
          <DialogHeader>
            <DialogTitle>Métricas e Edição</DialogTitle>
            <div className="text-sm text-muted-foreground">
              Recebido em: {format(new Date(comprovante.created_at), "dd/MM/yyyy 'às' HH:mm")}
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={formData.valor || ''} 
                  onChange={(e) => handleChange('valor', parseFloat(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
                  <SelectTrigger className={
                    formData.status === 'confirmado' ? 'border-emerald-500 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30' :
                    formData.status === 'pendente_revisao' ? 'border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-950/30' :
                    'border-red-500 text-red-700 bg-red-50 dark:bg-red-950/30'
                  }>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmado">Confirmado</SelectItem>
                    <SelectItem value="pendente_revisao">Pendente Revisão</SelectItem>
                    <SelectItem value="rejeitado">Rejeitado (Descartar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nome do Pagador</Label>
              <Input 
                value={formData.nome_pagador || ''} 
                onChange={(e) => handleChange('nome_pagador', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Banco de Origem</Label>
                <Input 
                  value={formData.banco_origem || ''} 
                  onChange={(e) => handleChange('banco_origem', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Pagamento</Label>
                <Input 
                  value={formData.tipo_pagamento || ''} 
                  onChange={(e) => handleChange('tipo_pagamento', e.target.value)}
                  placeholder="EX: PIX"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Extração Original da IA (Debug)</Label>
              <pre className="text-xs bg-zinc-100 dark:bg-zinc-900 p-2 rounded max-h-24 overflow-y-auto text-zinc-600 dark:text-zinc-400">
                {JSON.stringify(comprovante.dados_brutos, null, 2)}
              </pre>
            </div>

            <div className="space-y-2">
              <Label>Observações Manuais</Label>
              <Textarea 
                value={formData.observacoes || ''} 
                onChange={(e) => handleChange('observacoes', e.target.value)}
                placeholder="Insira notas adicionais..."
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="mt-auto pt-4 flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
