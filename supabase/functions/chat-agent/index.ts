import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("VITE_GEMINI_API_KEY") || "";

async function generateResponse(marcaNombre: string, trainingData: string, userMessage: string): Promise<string> {
  if (!trainingData || trainingData.trim().length === 0) {
    return "Aun no tengo info entrenada para esta marca. Conecta Facebook y entrena la marca primero.";
  }

  const prompt = `Eres asistente oficial de ${marcaNombre}. Tu unica verdad es la siguiente base de conocimiento extraida de Facebook.

BASE DE CONOCIMIENTO:
${trainingData}

REGLAS:
- Nunca inventes servicios, precios, tours o direcciones que no esten en la base de conocimiento.
- Si no sabes algo, di que no tienes esa info. No la inventes.
- Responde corto, vendedor, en el idioma del cliente.
- Si el cliente quiere comprar o apartar, guialo en el flujo: confirma lo que pide, pide solo lo que falta (nombre, contacto), y cierra.

Mensaje del cliente: ${userMessage}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
    }),
  });

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Lo siento, no pude procesar tu mensaje en este momento.";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { marcaId, mensaje, canalId, plataforma } = body;

    if (!marcaId || !mensaje) {
      return new Response(JSON.stringify({ error: "Faltan marcaId o mensaje" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: marca, error: marcaError } = await supabase
      .from("marcas")
      .select("*")
      .eq("id", marcaId)
      .maybeSingle();

    if (marcaError || !marca) {
      return new Response(JSON.stringify({ error: "Marca no encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trainingData = marca.training_data || marca.knowledge_base || "";

    const response = await generateResponse(marca.nombre, trainingData, mensaje);

    await supabase.from("mensajes").insert({
      marca_id: marcaId,
      canal_id: canalId || null,
      plataforma: plataforma || "webchat",
      mensaje_in: mensaje,
      respuesta_out: response,
    });

    return new Response(JSON.stringify({ response }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
