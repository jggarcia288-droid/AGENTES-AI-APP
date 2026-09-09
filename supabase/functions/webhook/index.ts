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

async function generateResponse(marcaNombre: string, knowledgeBase: string, locations: any[], userMessage: string): Promise<string> {
  if (!knowledgeBase || knowledgeBase.trim().length === 0) {
    return "Aún no tengo info entrenada para esta marca. Pronto estaré disponible para ayudarte.";
  }

  const locationsText = locations && locations.length > 0
    ? locations.map((l: any) => `${l.address} (Maps: ${l.maps_link})`).join("\n")
    : "Sin ubicaciones registradas.";

  const prompt = `Eres asistente oficial de ${marcaNombre}. Tu única verdad es la siguiente base de conocimiento y ubicaciones.

BASE DE CONOCIMIENTO:
${knowledgeBase}

UBICACIONES:
${locationsText}

REGLAS:
- Nunca inventes servicios, precios, tours o direcciones que no estén en la base de conocimiento.
- Si piden ubicación usa solo las ubicaciones listadas arriba con su link de Maps real.
- Si no sabes algo, di que no tienes esa info. No la inventes.
- Responde corto, vendedor, en el idioma del cliente.
- Si el cliente quiere comprar o apartar, guíalo en el flujo: confirma lo que pide, pide solo lo que falta (nombre, contacto), y cierra.

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

async function sendToFacebook(senderId: string, pageToken: string, message: string): Promise<void> {
  await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${pageToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: senderId },
      message: { text: message },
    }),
  });
}

async function sendToWhatsApp(phoneNumberId: string, token: string, to: string, message: string): Promise<void> {
  await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message },
    }),
  });
}

async function sendToInstagram(senderId: string, pageToken: string, message: string): Promise<void> {
  await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${pageToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: senderId },
      message: { text: message },
    }),
  });
}

async function sendToTikTok(openId: string, accessToken: string, message: string): Promise<void> {
  await fetch("https://open.tiktokapis.com/v2/post/publish/video/msg/send/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
    body: JSON.stringify({
      open_id: openId,
      text: message,
    }),
  });
}

async function processIncomingMessage(plataforma: string, externalId: string, senderId: string, messageText: string): Promise<string | null> {
  const { data: canal } = await supabase
    .from("canales")
    .select("id, marca_id, page_token, external_id")
    .eq("plataforma", plataforma)
    .eq("external_id", externalId)
    .maybeSingle();

  if (!canal) return null;

  const { data: marca } = await supabase
    .from("marcas")
    .select("*")
    .eq("id", canal.marca_id)
    .maybeSingle();

  if (!marca) return null;

  const response = await generateResponse(
    marca.nombre,
    marca.knowledge_base || "",
    marca.locations || [],
    messageText
  );

  await supabase.from("mensajes").insert({
    marca_id: marca.id,
    canal_id: canal.id,
    plataforma,
    mensaje_in: messageText,
    respuesta_out: response,
  });

  const token = canal.page_token || "";

  if (plataforma === "facebook") await sendToFacebook(senderId, token, response);
  else if (plataforma === "instagram") await sendToInstagram(senderId, token, response);
  else if (plataforma === "whatsapp") await sendToWhatsApp(canal.external_id, token, senderId, response);
  else if (plataforma === "tiktok") await sendToTikTok(senderId, token, response);

  return response;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const plataforma = url.pathname.split("/").pop() || "";

    if (req.method === "GET" && plataforma === "facebook") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && token === "lopvel_verify") {
        return new Response(challenge || "OK", { status: 200, headers: corsHeaders });
      }
      return new Response("Forbidden", { status: 403 });
    }

    if (req.method === "GET" && plataforma === "whatsapp") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && token === "lopvel_verify") {
        return new Response(challenge || "OK", { status: 200, headers: corsHeaders });
      }
      return new Response("Forbidden", { status: 403 });
    }

    const body = await req.json();

    if (plataforma === "facebook" || plataforma === "instagram") {
      const entries = body.entry || [];
      for (const entry of entries) {
        const messaging = entry.messaging || [];
        for (const msg of messaging) {
          const senderId = msg.sender?.id;
          const pageId = entry.id || msg.recipient?.id;
          const text = msg.message?.text;
          if (senderId && text && pageId) {
            await processIncomingMessage(plataforma, pageId, senderId, text);
          }
        }
      }
    } else if (plataforma === "whatsapp") {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const messages = change.value?.messages || [];
          const phoneNumberId = change.value?.metadata?.phone_number_id || "";
          for (const msg of messages) {
            const from = msg.from;
            const text = msg.text?.body;
            if (from && text) {
              await processIncomingMessage("whatsapp", phoneNumberId, from, text);
            }
          }
        }
      }
    } else if (plataforma === "tiktok") {
      const events = body.events || [];
      for (const event of events) {
        const openId = event.from?.open_id;
        const text = event.content?.text;
        if (openId && text) {
          await processIncomingMessage("tiktok", openId, openId, text);
        }
      }
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
