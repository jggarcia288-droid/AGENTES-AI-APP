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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { brandId } = await req.json();

    if (!brandId) {
      return new Response(JSON.stringify({ error: "Falta brandId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: channel, error: channelError } = await supabase
      .from("brand_channels")
      .select("*")
      .eq("brand_id", brandId)
      .eq("channel_type", "facebook")
      .eq("connected", true)
      .maybeSingle();

    if (channelError || !channel) {
      return new Response(JSON.stringify({ error: "Primero conecta Facebook" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pageId = channel.page_id;
    const accessToken = channel.access_token;

    const fields = "name,about,description,bio,website,phone,emails,location,posts.limit(50){message,full_picture,created_time,permalink_url}";
    const graphUrl = `https://graph.facebook.com/v21.0/${pageId}?fields=${encodeURIComponent(fields)}&access_token=${accessToken}`;

    const graphRes = await fetch(graphUrl);
    const pageData = await graphRes.json();

    if (!graphRes.ok) {
      const errorMsg = pageData?.error?.message || "Error al consultar Facebook Graph API";
      if (pageData?.error?.code === 190) {
        await supabase.from("brand_channels").update({ connected: false }).eq("id", channel.id);
        return new Response(JSON.stringify({ error: "Token expirado. Reconecta Facebook." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let trainingText = `PAGINA: ${pageData.name || ""}\n`;
    if (pageData.about) trainingText += `ACERCA DE: ${pageData.about}\n`;
    if (pageData.description) trainingText += `DESCRIPCION: ${pageData.description}\n`;
    if (pageData.bio) trainingText += `BIO: ${pageData.bio}\n`;
    if (pageData.website) trainingText += `SITIO WEB: ${pageData.website}\n`;
    if (pageData.phone) trainingText += `TELEFONO: ${pageData.phone}\n`;
    if (pageData.emails && pageData.emails.length) trainingText += `EMAILS: ${pageData.emails.join(", ")}\n`;
    if (pageData.location) {
      const loc = pageData.location;
      const locStr = [loc.street, loc.city, loc.state, loc.country, loc.zip].filter(Boolean).join(", ");
      if (locStr) trainingText += `UBICACION: ${locStr}\n`;
    }

    if (pageData.posts && pageData.posts.data && pageData.posts.data.length > 0) {
      trainingText += `\nPUBLICACIONES RECIENTES (${pageData.posts.data.length}):\n`;
      for (const post of pageData.posts.data) {
        if (post.message) {
          const date = post.created_time ? new Date(post.created_time).toLocaleDateString("es-MX") : "";
          trainingText += `- [${date}] ${post.message}\n`;
          if (post.permalink_url) trainingText += `  Link: ${post.permalink_url}\n`;
        }
      }
    }

    let structuredKnowledge = trainingText;
    try {
      const prompt = `Eres un asistente que estructura informacion de una pagina de Facebook para un bot de ventas. Toma esta data y devuelvela como base de conocimiento en texto plano, organizada con secciones claras: descripcion, servicios/productos, contacto, ubicacion, y publicaciones destacadas. NO inventes nada. Si no hay info de algo, omitelo.

DATA DE FACEBOOK:
${trainingText}

Devuelve SOLO el texto de la base de conocimiento, sin JSON ni explicaciones.`;

      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
        }),
      });

      const geminiData = await geminiRes.json();
      const geminiText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (geminiText && geminiText.trim().length > 50) {
        structuredKnowledge = geminiText.trim();
      }
    } catch { /* use raw trainingText if Gemini fails */ }

    const locationsCount = pageData.location ? 1 : 0;

    const { data: updated, error: updateError } = await supabase
      .from("marcas")
      .update({
        training_data: structuredKnowledge,
        entrenada: true,
        last_trained_at: new Date().toISOString(),
        locations_count: locationsCount,
      })
      .eq("id", brandId)
      .select()
      .single();

    if (updateError) throw updateError;

    return new Response(JSON.stringify({
      success: true,
      marca: updated,
      postsCount: pageData.posts?.data?.length || 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
