/*
# Switch RLS from owner-scoped to anon access (no auth)

1. Drop ALL existing policies on marcas, canales, mensajes (both owner-scoped and old anon ones)
2. Recreate with anon,authenticated CRUD (single-tenant, no sign-in)
3. Make marcas.owner_id nullable
*/

ALTER TABLE marcas ALTER COLUMN owner_id DROP NOT NULL;

-- Drop all existing policies on marcas
DROP POLICY IF EXISTS "owner_select_marcas" ON marcas;
DROP POLICY IF EXISTS "owner_insert_marcas" ON marcas;
DROP POLICY IF EXISTS "owner_update_marcas" ON marcas;
DROP POLICY IF EXISTS "owner_delete_marcas" ON marcas;

-- Drop all existing policies on canales (old anon + owner)
DROP POLICY IF EXISTS "anon_select_canales" ON canales;
DROP POLICY IF EXISTS "anon_insert_canales" ON canales;
DROP POLICY IF EXISTS "anon_update_canales" ON canales;
DROP POLICY IF EXISTS "anon_delete_canales" ON canales;
DROP POLICY IF EXISTS "owner_select_canales" ON canales;
DROP POLICY IF EXISTS "owner_insert_canales" ON canales;
DROP POLICY IF EXISTS "owner_update_canales" ON canales;
DROP POLICY IF EXISTS "owner_delete_canales" ON canales;

-- Drop all existing policies on mensajes
DROP POLICY IF EXISTS "owner_select_mensajes" ON mensajes;
DROP POLICY IF EXISTS "owner_insert_mensajes" ON mensajes;
DROP POLICY IF EXISTS "owner_delete_mensajes" ON mensajes;

-- marcas: anon CRUD
CREATE POLICY "anon_select_marcas" ON marcas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_marcas" ON marcas FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_marcas" ON marcas FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_marcas" ON marcas FOR DELETE TO anon, authenticated USING (true);

-- canales: anon CRUD
CREATE POLICY "anon_select_canales" ON canales FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_canales" ON canales FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_canales" ON canales FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_canales" ON canales FOR DELETE TO anon, authenticated USING (true);

-- mensajes: anon CRUD
CREATE POLICY "anon_select_mensajes" ON mensajes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_mensajes" ON mensajes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_delete_mensajes" ON mensajes FOR DELETE TO anon, authenticated USING (true);
