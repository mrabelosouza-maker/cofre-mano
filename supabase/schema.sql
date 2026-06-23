-- ============================================================
-- Cofre do Mano — schema do Supabase
-- ------------------------------------------------------------
-- COMO USAR:
--   1) No painel do Supabase: SQL Editor → New query.
--   2) Cole este arquivo INTEIRO.
--   3) Troque os dois e-mails no bloco "SEED" lá embaixo pelos
--      e-mails que você e seu irmão vão usar para entrar.
--   4) Run. Pronto: as tabelas, a segurança (RLS) e o cofre
--      compartilhado de vocês dois ficam criados.
-- ============================================================

-- ---------- Tabelas ----------
create table if not exists households (
  id             uuid primary key default gen_random_uuid(),
  name           text not null default 'Nosso cofre',
  monthly_target numeric not null default 0,
  goal_amount    numeric not null default 0,
  created_at     timestamptz not null default now()
);

create table if not exists members (
  household_id uuid not null references households(id) on delete cascade,
  email        text not null,
  role         text not null default 'member',
  primary key (household_id, email)
);

create table if not exists entries (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  date         date not null,
  type         text not null check (type in ('deposit','withdrawal','spend')),
  amount       numeric not null check (amount > 0),
  note         text,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);

create index if not exists entries_household_date_idx on entries(household_id, date);

-- ---------- E-mail do usuário logado (helper) ----------
create or replace function auth_email() returns text
language sql stable as $$ select lower(auth.jwt() ->> 'email') $$;

-- ---------- Quais cofres o usuário logado pode ver ----------
create or replace function my_household_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select household_id from members where email = auth_email()
$$;

-- ---------- Row Level Security ----------
alter table households enable row level security;
alter table members    enable row level security;
alter table entries    enable row level security;

drop policy if exists households_rw on households;
create policy households_rw on households
  for all using (id in (select my_household_ids()))
  with check (id in (select my_household_ids()));

drop policy if exists members_read on members;
create policy members_read on members
  for select using (email = auth_email() or household_id in (select my_household_ids()));

drop policy if exists entries_rw on entries;
create policy entries_rw on entries
  for all using (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));

-- ---------- Sync em tempo real ----------
alter publication supabase_realtime add table entries;

-- ============================================================
-- SEED — troque os e-mails abaixo e rode junto.
-- (Pode rodar de novo sem duplicar.)
-- ============================================================
do $$
declare hh uuid;
  email_voce  text := 'mrabelo.souza@gmail.com';
  email_irmao text := null;  -- coloque o e-mail do seu irmão aqui (entre aspas) quando tiver
begin
  select id into hh from households order by created_at limit 1;
  if hh is null then
    insert into households(name) values ('Nosso cofre') returning id into hh;
  end if;
  insert into members(household_id, email, role)
    values (hh, lower(email_voce), 'owner') on conflict do nothing;
  if email_irmao is not null then
    insert into members(household_id, email, role)
      values (hh, lower(email_irmao), 'member') on conflict do nothing;
  end if;
end $$;
