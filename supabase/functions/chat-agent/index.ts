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

// AHORA SI, YA LEEMOS GROQ_API_KEY DIRECTO
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("VITE_GEMINI_API_KEY") || "";

async function generateResponse(marcaNombre: string, trainingData: string, userMessage: string) {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY está vacía en Supabase Secrets");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: `Eres el asistente de ${marcaNombre}. Usa esta info: ${trainingData}. Responde en español, corto, útil` },
        { role: "user", content: userMessage }
      ],
      temperature: 0.7
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`GROQ dijo: ${JSON.stringify(data)}`);
  }

  if (data.error) {
    throw new Error(JSON.stringify(data.error));
  }

  return data.choices[0].message.content;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { marcaNombre, trainingData, userMessage, message } = await req.json();
    const finalMessage = userMessage || message;
    const finalMarca = marcaNombre || "TNBR";
    const finalTraining = trainingData || "";

    if (!finalMessage) {
      throw new Error("No llegó userMessage");
    }

    const reply = await generateResponse(finalMarca, finalTraining, finalMessage);

    return new Response(JSON.stringify({ reply }), {
      headers: {...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("ERROR REAL:", e);
    return new Response(JSON.stringify({ reply: `Error: ${(e as Error).message}` }), {
      status: 200,
      headers: {...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


