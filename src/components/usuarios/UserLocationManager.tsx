import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  useUserLocationManagement, 
  UserLocationPermission 
} from '@/hooks/useUserLocationManagement';
import { 
  Loader2, 
  MapPin, 
  Plus, 
  Trash2, 
  Eye, 
  Package, 
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UserLocationManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    user_id: string;
    nome: string | null;
    email: string;
    role: string | null;
  };
}

interface AvailableLocation {
  id: string;
  nome: string;
  tipo: string;
}

export function UserLocationManager({ 
  open, 
  onOpenChange, 
  user 
}: UserLocationManagerProps) {
  const {
    loading,
    fetchUserLocations,
    fetchAvailableLocations,
    addUserLocation,
    updateUserLocation,
    removeUserLocation
  } = useUserLocationManagement();

  const [userLocations, setUserLocations] = useState<UserLocationPermission[]>([]);
  const [availableLocations, setAvailableLocations] = useState<AvailableLocation[]>([]);
  const [selectedLocalId, setSelectedLocalId] = useState<string>('');
  const [newPermissions, setNewPermissions] = useState({
    can_view: true,
    can_adjust_stock: true,
    can_edit_price: true
  });
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (open && user.user_id) {
      loadData();
    }
  }, [open, user.user_id]);

  const loadData = async () => {
    setIsLoading(true);
    const [locations, available] = await Promise.all([
      fetchUserLocations(user.user_id),
      fetchAvailableLocations()
    ]);
    setUserLocations(locations);
    setAvailableLocations(available);
    setIsLoading(false);
  };

  const handleAddLocation = async () => {
    if (!selectedLocalId) return;
    
    const success = await addUserLocation(user.user_id, selectedLocalId, newPermissions);
    if (success) {
      await loadData();
      setSelectedLocalId('');
      setNewPermissions({ can_view: true, can_adjust_stock: true, can_edit_price: true });
    }
  };

  const handleUpdatePermission = async (
    location: UserLocationPermission,
    field: 'can_view' | 'can_adjust_stock' | 'can_edit_price'
  ) => {
    setSavingId(location.id);
    const updatedPermissions = {
      can_view: location.can_view,
      can_adjust_stock: location.can_adjust_stock,
      can_edit_price: location.can_edit_price,
      [field]: !location[field]
    };

    const success = await updateUserLocation(location.id, updatedPermissions);
    if (success) {
      setUserLocations(prev => 
        prev.map(ul => ul.id === location.id ? { ...ul, [field]: !ul[field] } : ul)
      );
    }
    setSavingId(null);
  };

  const handleRemoveLocation = async (id: string) => {
    setDeletingId(id);
    const success = await removeUserLocation(id);
    if (success) {
      setUserLocations(prev => prev.filter(ul => ul.id !== id));
    }
    setDeletingId(null);
  };

  // Filter out already assigned locations
  const unassignedLocations = availableLocations.filter(
    loc => !userLocations.some(ul => ul.local_id === loc.id)
  );

  const isVendedor = user.role === 'vendedor';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Configurar Locais
          </DialogTitle>
          <DialogDescription>
            Gerenciar permissões de locais para{' '}
            <span className="font-medium">{user.nome || user.email}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-4">
          {!isVendedor && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Permissões de local são relevantes apenas para usuários com role <strong>Vendedor</strong>.
                Admins e Gerentes têm acesso total a todos os locais.
              </AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Current Locations */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Locais com Acesso</Label>
                
                {userLocations.length === 0 ? (
                  <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 text-center">
                    Nenhum local configurado. Adicione um local abaixo.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {userLocations.map((location) => (
                      <div
                        key={location.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {location.local_nome}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <Checkbox
                                checked={location.can_view}
                                onCheckedChange={() => handleUpdatePermission(location, 'can_view')}
                                disabled={savingId === location.id}
                              />
                              <Eye className="h-3 w-3" />
                              Ver
                            </label>
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <Checkbox
                                checked={location.can_adjust_stock}
                                onCheckedChange={() => handleUpdatePermission(location, 'can_adjust_stock')}
                                disabled={savingId === location.id}
                              />
                              <Package className="h-3 w-3" />
                              Ajustar
                            </label>
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <Checkbox
                                checked={location.can_edit_price}
                                onCheckedChange={() => handleUpdatePermission(location, 'can_edit_price')}
                                disabled={savingId === location.id}
                              />
                              <DollarSign className="h-3 w-3" />
                              Preço
                            </label>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveLocation(location.id)}
                          disabled={deletingId === location.id}
                        >
                          {deletingId === location.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Location */}
              {unassignedLocations.length > 0 && (
                <div className="space-y-3 pt-4 border-t">
                  <Label className="text-sm font-medium">Adicionar Novo Local</Label>
                  
                  <Select value={selectedLocalId} onValueChange={setSelectedLocalId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um local" />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedLocations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.nome}
                          <Badge variant="outline" className="ml-2 text-xs">
                            {loc.tipo}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedLocalId && (
                    <div className="space-y-3">
                      <Label className="text-xs text-muted-foreground">Permissões</Label>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={newPermissions.can_view}
                            onCheckedChange={(checked) => 
                              setNewPermissions(prev => ({ ...prev, can_view: !!checked }))
                            }
                          />
                          <Eye className="h-4 w-4" />
                          Ver Estoque
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={newPermissions.can_adjust_stock}
                            onCheckedChange={(checked) => 
                              setNewPermissions(prev => ({ ...prev, can_adjust_stock: !!checked }))
                            }
                          />
                          <Package className="h-4 w-4" />
                          Ajustar Estoque
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={newPermissions.can_edit_price}
                            onCheckedChange={(checked) => 
                              setNewPermissions(prev => ({ ...prev, can_edit_price: !!checked }))
                            }
                          />
                          <DollarSign className="h-4 w-4" />
                          Editar Preço
                        </label>
                      </div>

                      <Button 
                        onClick={handleAddLocation} 
                        disabled={loading}
                        className="w-full"
                      >
                        {loading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        Adicionar Local
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
