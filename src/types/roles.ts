export type AppRole = 'admin' | 'gerente' | 'vendedor';

export interface UserProfile {
  id: string;
  user_id: string;
  nome: string | null;
  email: string;
  status: 'ativo' | 'inativo';
  must_change_password: boolean;
  last_sign_in_at: string | null;
  role: AppRole | null;
}

export interface UserWithRole extends UserProfile {
  role: AppRole;
}

// Permissions mapping
export const ROLE_PERMISSIONS: Record<AppRole, string[]> = {
  admin: [
    'dashboard.view',
    'dashboard.view_financials',
    'clientes.view',
    'clientes.create',
    'clientes.edit',
    'clientes.delete',
    'clientes.export',
    'estoque.view',
    'estoque.view_prices',
    'estoque.create',
    'estoque.edit',
    'estoque.delete',
    'estoque.export',
    'feira.view',
    'feira.create',
    'feira.edit',
    'feira.delete',
    'feira.view_history',
    'feira.generate_pdf',
    'transferencias.view',
    'transferencias.create',
    'transferencias.edit',
    'pedidos.view',
    'pedidos.view_financials',
    'pedidos.create',
    'pedidos.edit',
    'pedidos.delete',
    'pedidos.export',
    'producao.view',
    'producao.create',
    'producao.edit',
    'producao.delete',
    'users.view',
    'users.create',
    'users.edit',
    'users.deactivate',
  ],
  gerente: [
    'dashboard.view',
    'clientes.view',
    'clientes.create',
    'clientes.edit',
    'clientes.export',
    'estoque.view',
    'estoque.create',
    'estoque.edit',
    'feira.view',
    'feira.create',
    'feira.edit',
    'feira.delete',
    'feira.view_history',
    'feira.generate_pdf',
    'transferencias.view',
    'transferencias.create',
    'pedidos.view',
    'pedidos.create',
    'pedidos.edit',
    'pedidos.export',
    'producao.view',
    'producao.create',
    'producao.edit',
  ],
  vendedor: [
    'feira.view',
    'feira.retorno',
    'estoque.view',
    // Novas permissões:
    'transferencias.view',
    'transferencias.create',
    'estoque.ajustar_local',
    'estoque.editar_preco_local',
  ],
};

// Role-based landing pages
export const ROLE_LANDING_PAGES: Record<AppRole, string> = {
  admin: '/dashboard',
  gerente: '/pedidos/criados',
  vendedor: '/transferencias',
};

// Role display names
export const ROLE_DISPLAY_NAMES: Record<AppRole, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  vendedor: 'Vendedor',
};
