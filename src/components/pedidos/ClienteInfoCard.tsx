import { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Search, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useClientesContext } from '@/contexts/ClientesContext';
import { cn } from '@/lib/utils';

interface ClienteInfoCardProps {
  clienteId: string;
  cidade: string;
  estado: string;
  telefone: string;
  excursao: string;
  onClienteChange: (clienteId: string) => void;
  onCidadeChange: (value: string) => void;
  onEstadoChange: (value: string) => void;
  onTelefoneChange: (value: string) => void;
  onExcursaoChange: (value: string) => void;
  onAddCliente: () => void;
}

export function ClienteInfoCard({
  clienteId,
  cidade,
  estado,
  telefone,
  excursao,
  onClienteChange,
  onCidadeChange,
  onEstadoChange,
  onTelefoneChange,
  onExcursaoChange,
  onAddCliente,
}: ClienteInfoCardProps) {
  const { clientes, getClienteById } = useClientesContext();
  
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce de 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Filtrar clientes baseado no termo de busca com debounce
  const filteredClientes = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return clientes.slice(0, 15); // Mostrar primeiros 15 quando vazio
    }
    const term = debouncedSearch.toLowerCase();
    return clientes.filter(c => c.nome.toLowerCase().includes(term));
  }, [clientes, debouncedSearch]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focar no input ao abrir
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleClienteSelect = (id: string) => {
    onClienteChange(id);
    const selectedCliente = getClienteById(id);
    if (selectedCliente) {
      onCidadeChange(selectedCliente.cidade);
      onEstadoChange(selectedCliente.estado);
      onTelefoneChange(selectedCliente.telefone);
      onExcursaoChange(selectedCliente.excursao);
    } else {
      onCidadeChange('');
      onEstadoChange('');
      onTelefoneChange('');
      onExcursaoChange('');
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredClientes.length > 0) {
      e.preventDefault();
      handleClienteSelect(filteredClientes[0].id);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  const selectedCliente = getClienteById(clienteId);

  return (
    <div className="neu-card p-7">
      <h2 className="text-lg font-bold text-foreground mb-6 pb-4 border-b border-border/30">Informações do Cliente</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-5 gap-y-5">
        {/* Row 1: Cliente + Cidade + Estado */}
        <div className="lg:col-span-5 space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Nome do Cliente
          </Label>
          <div className="flex gap-2">
            {/* Combobox com busca em tempo real */}
            <div className="relative flex-1" ref={dropdownRef}>
              <div
                className={cn(
                  "h-12 rounded-xl neu-input border-0 bg-background flex items-center cursor-pointer transition-all",
                  isOpen && "ring-2 ring-primary/30"
                )}
                onClick={() => setIsOpen(true)}
              >
                {isOpen ? (
                  <div className="flex items-center w-full px-4 gap-2">
                    <Search size={16} className="text-muted-foreground/60 flex-shrink-0" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Digite para buscar..."
                      className="flex-1 bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground/60"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full px-4">
                    <span className={cn(
                      "text-sm truncate",
                      clienteId ? "text-foreground font-medium" : "text-muted-foreground"
                    )}>
                      {selectedCliente ? selectedCliente.nome : "Selecione um cliente"}
                    </span>
                    <ChevronDown size={16} className="text-muted-foreground flex-shrink-0" />
                  </div>
                )}
              </div>

              {/* Dropdown com sugestões */}
              {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                  {filteredClientes.length === 0 ? (
                    <div className="py-4 px-4 text-center text-muted-foreground text-sm">
                      {debouncedSearch ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
                    </div>
                  ) : (
                    filteredClientes.map((cliente) => (
                      <div
                        key={cliente.id}
                        className={cn(
                          "px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors",
                          cliente.id === clienteId && "bg-primary/10"
                        )}
                        onClick={() => handleClienteSelect(cliente.id)}
                      >
                        <span className="text-sm font-medium text-foreground">
                          {cliente.nome}
                        </span>
                        {cliente.excursao && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({cliente.excursao})
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <Button
              type="button"
              onClick={onAddCliente}
              className="h-12 w-12 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground"
            >
              <Plus size={18} />
            </Button>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Cidade
          </Label>
          <Input
            value={cidade}
            onChange={(e) => onCidadeChange(e.target.value)}
            placeholder="Cidade"
            className="h-12 rounded-xl neu-input border-0 bg-background"
            readOnly
          />
        </div>

        <div className="lg:col-span-3 space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Estado
          </Label>
          <Input
            value={estado}
            onChange={(e) => onEstadoChange(e.target.value)}
            placeholder="UF"
            maxLength={2}
            className="h-12 rounded-xl neu-input border-0 bg-background"
            readOnly
          />
        </div>

        {/* Row 2: Telefone + Excursão */}
        <div className="lg:col-span-6 space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Telefone
          </Label>
          <Input
            value={telefone}
            onChange={(e) => onTelefoneChange(e.target.value)}
            placeholder="(11) 99999-9999"
            className="h-12 rounded-xl neu-input border-0 bg-background"
            readOnly
          />
        </div>

        <div className="lg:col-span-6 space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Excursão
          </Label>
          <Input
            value={excursao}
            onChange={(e) => onExcursaoChange(e.target.value)}
            placeholder="Nome da excursão"
            className="h-12 rounded-xl neu-input border-0 bg-background"
            readOnly
          />
        </div>
      </div>
    </div>
  );
}
