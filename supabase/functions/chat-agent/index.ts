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

// Ahora usa la misma variable GEMINI_API_KEY pero con la gsk_ de GROQ
const GROQ_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("VITE_GEMINI_API_KEY") || "";

async function generateResponse(marcaNombre: string, trainingData: string, userMessage: string) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: `Eres el asistente de ${marcaNombre}. Usa esta info: ${trainingData}. Responde en español, corto, útil y amigable.` },
        { role: "user", content: userMessage }
      ],
      temperature: 0.7
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.choices[0].message.content;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { marcaNombre, trainingData, userMessage, message } = await req.json();
    const finalMessage = userMessage || message;
    const finalMarca = marcaNombre || "INBR";
    const finalTraining = trainingData || "";

    const reply = await generateResponse(finalMarca, finalTraining, finalMessage);

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ reply: `Error: ${e.message}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
