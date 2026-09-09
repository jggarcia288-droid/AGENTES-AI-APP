/*
# Marcas: add training columns + create brand_channels table

1. Modified Tables
- `marcas`: add training_data (text, default ''), entrenada (boolean, default false),
  last_trained_at (timestamptz, nullable), locations_count (int, default 0)
- These columns store the knowledge scraped from Facebook Graph API instead of website URL

2. New Tables
- `brand_channels`: stores social media channel connections per brand
  - id (uuid pk)
  - brand_id (text, references marcas id as text for flexibility)
  - channel_type (text: facebook/instagram/whatsapp/tiktok)
  - page_id (text)
  - page_name (text)
  - access_token (text)
  - connected (boolean, default false)
  - created_at (timestamptz)

3. Security
- RLS enabled on brand_channels with anon,authenticated CRUD (no-auth app)
- All existing anon policies on marcas/canales/mensajes remain unchanged

4. Notes
- training_data replaces knowledge_base as the source of truth for the chat agent
- brand_channels allows multiple channels per brand (one per platform)
- Facebook page access tokens are stored per channel for Graph API calls
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marcas' AND column_name = 'training_data') THEN
    ALTER TABLE marcas ADD COLUMN training_data text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marcas' AND column_name = 'entrenada') THEN
    ALTER TABLE marcas ADD COLUMN entrenada boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marcas' AND column_name = 'last_trained_at') THEN
    ALTER TABLE marcas ADD COLUMN last_trained_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marcas' AND column_name = 'locations_count') THEN
    ALTER TABLE marcas ADD COLUMN locations_count int NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS brand_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id text NOT NULL,
  channel_type text NOT NULL DEFAULT '',
  page_id text NOT NULL DEFAULT '',
  page_name text NOT NULL DEFAULT '',
  access_token text NOT NULL DEFAULT '',
  connected boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE brand_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_brand_channels" ON brand_channels;
CREATE POLICY "anon_select_brand_channels" ON brand_channels FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_brand_channels" ON brand_channels;
CREATE POLICY "anon_insert_brand_channels" ON brand_channels FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_brand_channels" ON brand_channels;
CREATE POLICY "anon_update_brand_channels" ON brand_channels FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_brand_channels" ON brand_channels;
CREATE POLICY "anon_delete_brand_channels" ON brand_channels FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_brand_channels_brand_id ON brand_channels(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_channels_channel_type ON brand_channels(channel_type);
