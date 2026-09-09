import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Marca = {
  id: string;
  nombre: string;
  website_url: string;
  knowledge_base: string;
  training_data: string;
  entrenada: boolean;
  last_trained_at: string | null;
  locations_count: number;
  locations: any[];
  created_at: string;
};

export type BrandChannel = {
  id: string;
  brand_id: string;
  channel_type: string;
  page_id: string;
  page_name: string;
  access_token: string;
  connected: boolean;
  created_at: string;
};

export type Canal = {
  id: string;
  marca_id: string;
  plataforma: string;
  external_id: string;
  page_token: string | null;
  status: string;
  created_at: string;
};

export type Mensaje = {
  id: string;
  marca_id: string;
  canal_id: string;
  plataforma: string;
  mensaje_in: string;
  respuesta_out: string;
  created_at: string;
};

export const TRAIN_FB_FUNCTION_URL = `${supabaseUrl}/functions/v1/train-facebook`;
export const CHAT_FUNCTION_URL = `${supabaseUrl}/functions/v1/chat-agent`;
