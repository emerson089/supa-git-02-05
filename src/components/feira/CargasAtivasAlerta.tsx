import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Eye } from 'lucide-react';
import { TransferenciaComItensHistorico } from '@/hooks/useFeiraHistorico';

interface CargasAtivasAlertaProps {
  cargasAtivas: TransferenciaComItensHistorico[];
  onVerCarga: (carga: TransferenciaComItensHistorico) => void;
  periodoEhHoje: boolean;
}

export function CargasAtivasAlerta({ cargasAtivas, onVerCarga, periodoEhHoje }: CargasAtivasAlertaProps) {
  // Não mostrar se não houver cargas ativas - SEMPRE exibir para garantir visibilidade de cargas pendentes de outros dias
  if (cargasAtivas.length === 0) {
    return null;
  }

  return (
    <Alert className="border-amber-500/50 bg-amber-500/10">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="flex items-center gap-2 text-amber-600">
        Cargas em Andamento
        <Badge variant="secondary" className="bg-amber-500/20 text-amber-700">
          {cargasAtivas.length}
        </Badge>
      </AlertTitle>
      <AlertDescription className="flex items-center justify-between mt-2">
        <span className="text-sm text-muted-foreground">
          {cargasAtivas.length === 1
            ? 'Há 1 carga aguardando registro de retorno.'
            : `Há ${cargasAtivas.length} cargas aguardando registro de retorno.`}
        </span>
        <div className="flex gap-2">
          {cargasAtivas.slice(0, 2).map((carga) => (
            <Button
              key={carga.id}
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => onVerCarga(carga)}
            >
              <Eye size={14} />
              Ver
            </Button>
          ))}
          {cargasAtivas.length > 2 && (
            <Badge variant="secondary" className="self-center">
              +{cargasAtivas.length - 2}
            </Badge>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
