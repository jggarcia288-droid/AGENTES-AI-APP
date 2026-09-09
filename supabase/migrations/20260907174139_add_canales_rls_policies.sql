/*
# Add RLS policies to canales table

1. Security
- Enable RLS on `canales` (already enabled, this is idempotent).
- Add 4 CRUD policies (SELECT/INSERT/UPDATE/DELETE) scoped to `anon, authenticated`
  because this is a single-tenant app with no sign-in screen.
- The data is intentionally shared/public across the platform.

2. Notes
- The `canales` table already exists with columns: id, nombre_canal, plataforma, pais,
  estado_conexion, created_at. No schema changes needed.
*/

ALTER TABLE canales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_canales" ON canales;
CREATE POLICY "anon_select_canales" ON canales FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_canales" ON canales;
CREATE POLICY "anon_insert_canales" ON canales FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_canales" ON canales;
CREATE POLICY "anon_update_canales" ON canales FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_canales" ON canales;
CREATE POLICY "anon_delete_canales" ON canales FOR DELETE
  TO anon, authenticated USING (true);
