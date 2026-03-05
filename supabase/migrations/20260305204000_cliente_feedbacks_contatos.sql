-- Create cliente_feedbacks table
create table if not exists public.cliente_feedbacks (
  id uuid default gen_random_uuid() primary key,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  motivo text not null,
  observacao text,
  created_at timestamptz default now() not null
);

-- RLS
alter table public.cliente_feedbacks enable row level security;

create policy "Users can manage their own feedbacks"
  on public.cliente_feedbacks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Create cliente_contatos table for persistent contact tracking
create table if not exists public.cliente_contatos (
  id uuid default gen_random_uuid() primary key,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  canal text not null check (canal in ('whatsapp', 'ligacao', 'outro')),
  contatado_em timestamptz default now() not null,
  -- Unique constraint: one record per (cliente, user) — upsert on contact
  unique (cliente_id, user_id)
);

-- RLS
alter table public.cliente_contatos enable row level security;

create policy "Users can manage their own contatos"
  on public.cliente_contatos
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for fast lookups
create index if not exists idx_cliente_contatos_user_id on public.cliente_contatos (user_id);
create index if not exists idx_cliente_feedbacks_cliente_id on public.cliente_feedbacks (cliente_id);
