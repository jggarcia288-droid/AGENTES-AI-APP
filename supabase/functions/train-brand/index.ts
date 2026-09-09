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

function extractTextFromHTML(html: string): string {
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, " ");
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, " ");
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";

  const metaDesc = text.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  const description = metaDesc ? metaDesc[1].trim() : "";

  const headings: string[] = [];
  const headingRegex = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  let hMatch;
  while ((hMatch = headingRegex.exec(text)) !== null) {
    headings.push(hMatch[1].replace(/<[^>]+>/g, "").trim());
  }

  const paragraphs: string[] = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pMatch;
  while ((pMatch = pRegex.exec(text)) !== null) {
    const pText = pMatch[1].replace(/<[^>]+>/g, "").trim();
    if (pText.length > 20) paragraphs.push(pText);
  }

  const listItems: string[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let liMatch;
  while ((liMatch = liRegex.exec(text)) !== null) {
    const liText = liMatch[1].replace(/<[^>]+>/g, "").trim();
    if (liText.length > 5) listItems.push(liText);
  }

  let result = "";
  if (title) result += `${title}\n`;
  if (description) result += `${description}\n`;
  if (headings.length) result += headings.slice(0, 30).join("\n") + "\n";
  if (paragraphs.length) result += paragraphs.slice(0, 40).join("\n") + "\n";
  if (listItems.length) result += listItems.slice(0, 40).join("\n") + "\n";

  if (!result) {
    result = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 8000);
  }

  return result.slice(0, 12000);
}

function extractAddresses(text: string): string[] {
  const addresses: string[] = [];
  const patterns = [
    /(?:calle|av\.|avenida|carril|blvd|boulevard|plaza)\s+[^,.\n]{3,60}(?:,\s*[^,.\n]{3,60})?/gi,
    /(?:dirección|direccion|address|ubicación|ubicacion)[:\s]+([^\n]{5,80})/gi,
  ];
  for (const p of patterns) {
    let m;
    while ((m = p.exec(text)) !== null) {
      const addr = m[0].replace(/^(?:dirección|direccion|address|ubicación|ubicacion)[:\s]+/i, "").trim();
      if (addr.length > 8 && !addresses.includes(addr)) addresses.push(addr);
    }
  }
  return addresses.slice(0, 5);
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; maps_link: string } | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GEMINI_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === "OK" && data.results && data.results[0]) {
      const loc = data.results[0].geometry.location;
      return {
        lat: loc.lat,
        lng: loc.lng,
        maps_link: `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`,
      };
    }
  } catch { /* ignore */ }
  return null;
}

async function generateKnowledgeBase(scrapedContent: string, url: string): Promise<{ knowledge: string; nombre: string }> {
  const prompt = `Analiza el siguiente contenido extraído de una página web y estructúralo como base de conocimiento para un asistente de ventas.

URL: ${url}

Contenido:
${scrapedContent}

Devuelve un JSON válido con esta estructura exacta:
{
  "nombre": "Nombre de la marca/empresa detectado en la web",
  "knowledge": "Base de conocimiento estructurada en texto plano. Incluye: descripción de la empresa, servicios/productos con precios si los hay, horarios, políticas, métodos de pago, y cualquier info relevante para vender. NO inventes nada que no esté en el contenido. Si no hay info de algo, omítelo."
}

Solo devuelve el JSON, sin texto adicional.`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    }),
  });

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        knowledge: parsed.knowledge || scrapedContent.slice(0, 6000),
        nombre: parsed.nombre || new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, ""),
      };
    }
  } catch { /* fall through */ }

  return {
    knowledge: scrapedContent.slice(0, 6000),
    nombre: new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, ""),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, marcaId, websiteUrl, knowledgeText } = body;

    if (action === "train") {
      if (!websiteUrl) {
        return new Response(JSON.stringify({ error: "Falta la URL" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const targetUrl = websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`;
      const domain = new URL(targetUrl).hostname.replace(/^www\./, "");

      let scrapedContent = "";
      let fetchSucceeded = false;

      try {
        const scrapeRes = await fetch(targetUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
          },
          redirect: "follow",
        });

        if (scrapeRes.ok) {
          const html = await scrapeRes.text();
          scrapedContent = extractTextFromHTML(html);
          if (scrapedContent.trim().length > 50) {
            fetchSucceeded = true;
          }
        }
      } catch { /* fetch failed, fall through to fallback */ }

      let knowledge: string;
      let nombre: string;
      let locations: any[] = [];

      if (fetchSucceeded && scrapedContent.trim().length > 0) {
        const result = await generateKnowledgeBase(scrapedContent, websiteUrl);
        knowledge = result.knowledge;
        nombre = result.nombre;

        const addresses = extractAddresses(scrapedContent + " " + knowledge);
        for (const addr of addresses) {
          const geo = await geocodeAddress(addr);
          if (geo) {
            locations.push({ address: addr, ...geo });
          }
        }
      } else {
        knowledge = `Sitio: ${domain} - pendiente de crawl manual`;
        nombre = domain;
      }

      if (marcaId) {
        const { data, error } = await supabase
          .from("marcas")
          .update({ nombre, website_url: websiteUrl, knowledge_base: knowledge, locations })
          .eq("id", marcaId)
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify({ success: true, marca: data, crawled: fetchSucceeded }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("marcas")
        .insert({ nombre, website_url: websiteUrl, knowledge_base: knowledge, locations })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, marca: data, crawled: fetchSucceeded }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save_knowledge") {
      if (!marcaId || knowledgeText === undefined) {
        return new Response(JSON.stringify({ error: "Faltan datos" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("marcas")
        .update({ knowledge_base: knowledgeText })
        .eq("id", marcaId)
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, marca: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Acción no válida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
