/*
# Plataforma SaaS para revender agentes de IA - Tablas

1. Tablas nuevas
- `agentes`: cada agente entrenado para un cliente (nombre, url, contenido scrapeado, status, ventas, logo, auto-aprender)
- `conversaciones`: cada mensaje intercambiado entre cliente y bot, con venta_cerrada

2. Seguridad
- App sin login: políticas TO anon, authenticated para CRUD completo en ambas tablas.

3. Notas
- agentes.tiempo_minutos lleva el conteo de minutos consumidos por conversaciones.
- agentes.logo_url permite cambiar el logo del widget por agente.
- agentes.auto_aprender controla el re-entrenamiento automático cada 24h.
- conversaciones.guarda cada par mensaje_cliente + respuesta_bot.
*/

CREATE TABLE IF NOT EXISTS agentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_code text NOT NULL UNIQUE,
  nombre_cliente text NOT NULL,
  url_web text NOT NULL,
  contenido_entrenado text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'activo',
  fecha_creacion timestamptz DEFAULT now(),
  cerrar_ventas_activado boolean NOT NULL DEFAULT true,
  auto_aprender boolean NOT NULL DEFAULT false,
  tiempo_minutos numeric NOT NULL DEFAULT 0,
  ventas_cerradas integer NOT NULL DEFAULT 0,
  logo_url text,
  last_trained_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id uuid REFERENCES agentes(id) ON DELETE CASCADE,
  session_id text NOT NULL DEFAULT '',
  mensaje_cliente text NOT NULL DEFAULT '',
  respuesta_bot text NOT NULL DEFAULT '',
  venta_cerrada boolean NOT NULL DEFAULT false,
  fase_venta text NOT NULL DEFAULT 'enganche',
  customer_name text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;

-- agentes policies
DROP POLICY IF EXISTS "anon_select_agentes" ON agentes;
CREATE POLICY "anon_select_agentes" ON agentes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_agentes" ON agentes;
CREATE POLICY "anon_insert_agentes" ON agentes FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_agentes" ON agentes;
CREATE POLICY "anon_update_agentes" ON agentes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_agentes" ON agentes;
CREATE POLICY "anon_delete_agentes" ON agentes FOR DELETE TO anon, authenticated USING (true);

-- conversaciones policies
DROP POLICY IF EXISTS "anon_select_conversaciones" ON conversaciones;
CREATE POLICY "anon_select_conversaciones" ON conversaciones FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_conversaciones" ON conversaciones;
CREATE POLICY "anon_insert_conversaciones" ON conversaciones FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_conversaciones" ON conversaciones;
CREATE POLICY "anon_update_conversaciones" ON conversaciones FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_conversaciones" ON conversaciones;
CREATE POLICY "anon_delete_conversaciones" ON conversaciones FOR DELETE TO anon, authenticated USING (true);
