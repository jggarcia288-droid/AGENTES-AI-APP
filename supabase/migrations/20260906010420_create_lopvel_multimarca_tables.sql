/*
# Multi-marca LOPVEL - Tablas

1. Tablas nuevas
- `marcas`: cada marca bajo Grupo LOPVEL (nombre, dominio, logo, colores, personalidad del bot)
- `conocimientos`: contenido extraido de URLs o documentos, guardado por marca

2. Tablas modificadas
- `agentes`: anade marca_id, logo_url, auto_aprender, last_trained_at (si no existen)
- `conversaciones`: anade marca_id, customer_personas, customer_fecha, customer_ubicacion, customer_hotel (si no existen)

3. Seguridad
- App sin login: politicas TO anon, authenticated para CRUD completo en todas las tablas.

4. Notas
- marcas.dominio permite auto-detectar la marca segun la URL del cliente.
- conocimientos.tipo distingue entre 'url' (scraping) y 'documento' (texto pegado).
*/

CREATE TABLE IF NOT EXISTS marcas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  dominio text NOT NULL DEFAULT '',
  logo_url text,
  color_primario text NOT NULL DEFAULT '#6366f1',
  color_secundario text NOT NULL DEFAULT '#8b5cf6',
  personalidad_bot text NOT NULL DEFAULT 'amable, de barrio, directo, crea urgencia y cierra',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conocimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marca_id uuid REFERENCES marcas(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'url',
  url_origen text NOT NULL DEFAULT '',
  titulo text NOT NULL DEFAULT '',
  contenido text NOT NULL DEFAULT '',
  servicios text NOT NULL DEFAULT '',
  precios text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Alter agentes: add marca_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agentes' AND column_name = 'marca_id') THEN
    ALTER TABLE agentes ADD COLUMN marca_id uuid REFERENCES marcas(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agentes' AND column_name = 'logo_url') THEN
    ALTER TABLE agentes ADD COLUMN logo_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agentes' AND column_name = 'auto_aprender') THEN
    ALTER TABLE agentes ADD COLUMN auto_aprender boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agentes' AND column_name = 'last_trained_at') THEN
    ALTER TABLE agentes ADD COLUMN last_trained_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Alter conversaciones: add new columns if not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversaciones' AND column_name = 'marca_id') THEN
    ALTER TABLE conversaciones ADD COLUMN marca_id uuid REFERENCES marcas(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversaciones' AND column_name = 'customer_personas') THEN
    ALTER TABLE conversaciones ADD COLUMN customer_personas text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversaciones' AND column_name = 'customer_fecha') THEN
    ALTER TABLE conversaciones ADD COLUMN customer_fecha text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversaciones' AND column_name = 'customer_ubicacion') THEN
    ALTER TABLE conversaciones ADD COLUMN customer_ubicacion text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversaciones' AND column_name = 'customer_hotel') THEN
    ALTER TABLE conversaciones ADD COLUMN customer_hotel text NOT NULL DEFAULT '';
  END IF;
END $$;

ALTER TABLE marcas ENABLE ROW LEVEL SECURITY;
ALTER TABLE conocimientos ENABLE ROW LEVEL SECURITY;

-- marcas policies
DROP POLICY IF EXISTS "anon_select_marcas" ON marcas;
CREATE POLICY "anon_select_marcas" ON marcas FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_marcas" ON marcas;
CREATE POLICY "anon_insert_marcas" ON marcas FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_marcas" ON marcas;
CREATE POLICY "anon_update_marcas" ON marcas FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_marcas" ON marcas;
CREATE POLICY "anon_delete_marcas" ON marcas FOR DELETE TO anon, authenticated USING (true);

-- conocimientos policies
DROP POLICY IF EXISTS "anon_select_conocimientos" ON conocimientos;
CREATE POLICY "anon_select_conocimientos" ON conocimientos FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_conocimientos" ON conocimientos;
CREATE POLICY "anon_insert_conocimientos" ON conocimientos FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_conocimientos" ON conocimientos;
CREATE POLICY "anon_update_conocimientos" ON conocimientos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_conocimientos" ON conocimientos;
CREATE POLICY "anon_delete_conocimientos" ON conocimientos FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_conocimientos_marca_id ON conocimientos(marca_id);
CREATE INDEX IF NOT EXISTS idx_agentes_marca_id ON agentes(marca_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_marca_id ON conversaciones(marca_id);
