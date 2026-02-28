import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquarePlus } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface FeedbackModalProps {
    clienteId: string;
    clienteNome: string;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

const MOTIVOS = [
    'Preço',
    'Prazo',
    'Coleção não agradou',
    'Comprou no concorrente',
    'Outros'
];

export function FeedbackModal({ clienteId, clienteNome, isOpen, onOpenChange, onSuccess }: FeedbackModalProps) {
    const { user } = useAuth();
    const { toast } = useToast();

    const [motivo, setMotivo] = useState<string>('');
    const [observacao, setObservacao] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!motivo) {
            toast({
                title: "Motivo obrigatório",
                description: "Selecione o motivo principal do feedback.",
                variant: "destructive"
            });
            return;
        }

        if (!user?.id) return;

        try {
            setIsSubmitting(true);

            const { error } = await (supabase as any)
                .from('cliente_feedbacks')
                .insert({
                    cliente_id: clienteId,
                    motivo,
                    observacao: observacao || null,
                    user_id: user.id
                });

            if (error) throw error;

            toast({
                title: "Feedback registrado!",
                description: "As informações foram salvas com sucesso.",
            });

            // Limpar form
            setMotivo('');
            setObservacao('');
            onOpenChange(false);
            onSuccess?.();

        } catch (err: any) {
            console.error('Erro ao registrar feedback:', err);
            toast({
                title: "Erro ao salvar",
                description: "Não foi possível registrar o feedback.",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Registrar Feedback</DialogTitle>
                    <DialogDescription>
                        Anote o motivo da inatividade de {clienteNome.split(' ')[0]}.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Motivo Principal</label>
                        <Select value={motivo} onValueChange={setMotivo}>
                            <SelectTrigger className="w-full h-11 rounded-xl">
                                <SelectValue placeholder="Selecione o motivo" />
                            </SelectTrigger>
                            <SelectContent>
                                {MOTIVOS.map(m => (
                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex justify-between">
                            <span>Observações <span className="text-muted-foreground font-normal">(Opcional)</span></span>
                        </label>
                        <Textarea
                            value={observacao}
                            onChange={e => setObservacao(e.target.value)}
                            placeholder="Detalhes adicionais sobre a conversa..."
                            className="resize-none h-24 rounded-xl"
                        />
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="w-full sm:w-auto h-11 rounded-xl"
                        disabled={isSubmitting}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        className="w-full sm:w-auto h-11 rounded-xl"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <span className="flex items-center gap-2">Salvando...</span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <MessageSquarePlus className="w-4 h-4" />
                                Salvar Feedback
                            </span>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
