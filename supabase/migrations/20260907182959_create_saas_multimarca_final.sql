/*
# SaaS Multi-Marca: 1 Marca = 1 Cerebro = 4 Canales

1. New Tables
- `marcas`: id (uuid pk), owner_id (uuid, defaults to auth.uid()), nombre (text),
  website_url (text), knowledge_base (text, empty), locations (jsonb, empty), created_at
- `mensajes`: id (uuid pk), marca_id (fk marcas), canal_id (fk canales), plataforma (text),
  mensaje_in (text), respuesta_out (text), created_at

2. Modified Tables
- `canales`: add marca_id (fk marcas), external_id (text), page_token (text), status (text)
  Repurposes existing nombre_canal as external_id fallback, estado_conexion as status fallback.

3. Security
- RLS enabled on marcas, canales, mensajes
- Only owner_id can see/manage their marcas, canales, mensajes
- owner_id defaults to auth.uid() on insert
- canales scoped through marca ownership (EXISTS check against marcas)
- mensajes scoped through marca ownership

4. Notes
- Auth required: user signs up/in, gets a session, creates marcas
- Each marca trained once with URL -> knowledge_base + locations
- 4 canales per marca: facebook, instagram, whatsapp, tiktok, webchat
- No global tokens, no hardcoded names
*/

CREATE TABLE IF NOT EXISTS marcas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  nombre text NOT NULL DEFAULT '',
  website_url text NOT NULL DEFAULT '',
  knowledge_base text NOT NULL DEFAULT '',
  locations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add new columns to canales
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'canales' AND column_name = 'marca_id') THEN
    ALTER TABLE canales ADD COLUMN marca_id uuid REFERENCES marcas(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'canales' AND column_name = 'external_id') THEN
    ALTER TABLE canales ADD COLUMN external_id text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'canales' AND column_name = 'page_token') THEN
    ALTER TABLE canales ADD COLUMN page_token text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'canales' AND column_name = 'status') THEN
    ALTER TABLE canales ADD COLUMN status text NOT NULL DEFAULT 'desconectado';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marca_id uuid REFERENCES marcas(id) ON DELETE CASCADE,
  canal_id uuid REFERENCES canales(id) ON DELETE CASCADE,
  plataforma text NOT NULL DEFAULT '',
  mensaje_in text NOT NULL DEFAULT '',
  respuesta_out text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE marcas ENABLE ROW LEVEL SECURITY;
ALTER TABLE canales ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;

-- marcas policies (owner-scoped)
DROP POLICY IF EXISTS "owner_select_marcas" ON marcas;
CREATE POLICY "owner_select_marcas" ON marcas FOR SELECT
  TO authenticated USING (auth.uid() = owner_id);
DROP POLICY IF EXISTS "owner_insert_marcas" ON marcas;
CREATE POLICY "owner_insert_marcas" ON marcas FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "owner_update_marcas" ON marcas;
CREATE POLICY "owner_update_marcas" ON marcas FOR UPDATE
  TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "owner_delete_marcas" ON marcas;
CREATE POLICY "owner_delete_marcas" ON marcas FOR DELETE
  TO authenticated USING (auth.uid() = owner_id);

-- canales policies (scoped through marca ownership)
DROP POLICY IF EXISTS "owner_select_canales" ON canales;
CREATE POLICY "owner_select_canales" ON canales FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM marcas WHERE marcas.id = canales.marca_id AND marcas.owner_id = auth.uid()));
DROP POLICY IF EXISTS "owner_insert_canales" ON canales;
CREATE POLICY "owner_insert_canales" ON canales FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM marcas WHERE marcas.id = canales.marca_id AND marcas.owner_id = auth.uid()));
DROP POLICY IF EXISTS "owner_update_canales" ON canales;
CREATE POLICY "owner_update_canales" ON canales FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM marcas WHERE marcas.id = canales.marca_id AND marcas.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM marcas WHERE marcas.id = canales.marca_id AND marcas.owner_id = auth.uid()));
DROP POLICY IF EXISTS "owner_delete_canales" ON canales;
CREATE POLICY "owner_delete_canales" ON canales FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM marcas WHERE marcas.id = canales.marca_id AND marcas.owner_id = auth.uid()));

-- mensajes policies (scoped through marca ownership)
DROP POLICY IF EXISTS "owner_select_mensajes" ON mensajes;
CREATE POLICY "owner_select_mensajes" ON mensajes FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM marcas WHERE marcas.id = mensajes.marca_id AND marcas.owner_id = auth.uid()));
DROP POLICY IF EXISTS "owner_insert_mensajes" ON mensajes;
CREATE POLICY "owner_insert_mensajes" ON mensajes FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM marcas WHERE marcas.id = mensajes.marca_id AND marcas.owner_id = auth.uid()));
DROP POLICY IF EXISTS "owner_delete_mensajes" ON mensajes;
CREATE POLICY "owner_delete_mensajes" ON mensajes FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM marcas WHERE marcas.id = mensajes.marca_id AND marcas.owner_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_canales_marca_id ON canales(marca_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_marca_id ON mensajes(marca_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_canal_id ON mensajes(canal_id);
CREATE INDEX IF NOT EXISTS idx_marcas_owner_id ON marcas(owner_id);
