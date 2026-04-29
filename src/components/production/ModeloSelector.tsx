import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Package, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useModelosZerados, ModeloZerado } from '@/hooks/useModelosZerados';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/utils';

interface ModeloSelectorProps {
  onSelect: (modelo: {
    nome: string;
    imagemUrl: string;
    id: string;
  }) => void;
}

function ModeloCard({ modelo, onSelect }: { modelo: ModeloZerado; onSelect: () => void }) {
  const { signedUrl, loading } = useSignedUrl(modelo.imagem_url);
  const zerado = modelo.quantidade === 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-col items-center p-3 border rounded-lg hover:border-primary hover:bg-accent/50 transition-all cursor-pointer text-left group relative",
        zerado ? "border-red-200 dark:border-red-800" : "border-border"
      )}
    >
      {/* Stock badge */}
      <span className={cn(
        "absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full",
        zerado
          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
      )}>
        {zerado ? 'Zerado' : `${modelo.quantidade} pçs`}
      </span>

      <div className="w-full aspect-square bg-muted rounded-md overflow-hidden mb-2 flex items-center justify-center">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : signedUrl ? (
          <img
            src={signedUrl}
            alt={modelo.nome}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <Package className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <span className="text-xs font-medium text-center line-clamp-2 w-full">
        {modelo.nome}
      </span>
    </button>
  );
}

export function ModeloSelector({ onSelect }: ModeloSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  
  const { data: modelos, isLoading } = useModelosZerados(debouncedSearch);

  const handleSelect = (modelo: ModeloZerado) => {
    onSelect({
      nome: modelo.nome,
      imagemUrl: modelo.imagem_url || '',
      id: modelo.id,
    });
    setIsExpanded(false);
    setSearch('');
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full justify-between"
      >
        <span className="flex items-center gap-2">
          <Package className="h-4 w-4" />
          Usar modelo do estoque
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>

      {isExpanded && (
        <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar modelos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : modelos && modelos.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-64 overflow-y-auto">
              {modelos.map((modelo) => (
                <ModeloCard
                  key={modelo.id}
                  modelo={modelo}
                  onSelect={() => handleSelect(modelo)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {search ? 'Nenhum modelo encontrado' : 'Nenhum modelo cadastrado no estoque'}
              </p>
            </div>
          )}
        </div>
      )}

      {isExpanded && (
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">ou preencha manualmente</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}
    </div>
  );
}
