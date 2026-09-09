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

function generateAgentCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "agent_";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

function detectMarcaFromUrl(url: string, marcas: any[]): any | null {
  const domain = extractDomain(url);
  for (const marca of marcas) {
    if (marca.dominio && domain.includes(marca.dominio)) {
      return marca;
    }
  }
  return null;
}

function detectMarcaFromContent(contenido: string, marcas: any[]): any | null {
  const lower = contenido.toLowerCase();
  for (const marca of marcas) {
    if (marca.nombre && lower.includes(marca.nombre.toLowerCase())) {
      return marca;
    }
  }
  return null;
}

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

  const prices = text.match(/\$[\d,]+(?:\.\d{2})?/g) || [];

  const links: string[] = [];
  const aRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let aMatch;
  while ((aMatch = aRegex.exec(text)) !== null) {
    const linkText = aMatch[2].replace(/<[^>]+>/g, "").trim();
    if (linkText.length > 3 && !aMatch[1].startsWith("#") && !aMatch[1].startsWith("javascript:")) {
      links.push(linkText);
    }
  }

  let result = "";
  if (title) result += `TITULO: ${title}\n`;
  if (description) result += `DESCRIPCION: ${description}\n`;
  if (headings.length) result += `SECCIONES:\n${headings.slice(0, 30).join("\n")}\n`;
  if (paragraphs.length) result += `CONTENIDO PRINCIPAL:\n${paragraphs.slice(0, 40).join("\n")}\n`;
  if (listItems.length) result += `LISTA DE SERVICIOS/PRODUCTOS:\n${listItems.slice(0, 40).join("\n")}\n`;
  if (prices.length) result += `PRECIOS DETECTADOS:\n${[...new Set(prices)].slice(0, 30).join(", ")}\n`;
  if (links.length) result += `ENLACES IMPORTANTES:\n${[...new Set(links)].slice(0, 20).join(", ")}\n`;

  if (!result) {
    const stripped = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    result = stripped.slice(0, 8000);
  }

  return result.slice(0, 10000);
}

function extractServices(contenido: string): string {
  const lines = contenido.split("\n");
  const services: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.length > 3 &&
      trimmed.length < 100 &&
      !trimmed.startsWith("TITULO") &&
      !trimmed.startsWith("DESCRIPCION") &&
      !trimmed.startsWith("SECCIONES") &&
      !trimmed.startsWith("CONTENIDO") &&
      !trimmed.startsWith("LISTA") &&
      !trimmed.startsWith("PRECIOS") &&
      !trimmed.startsWith("ENLACES")
    ) {
      if (
        /tour|paquete|servicio|excursion|viaje|hotel|traslado|renta|curso|clase|producto|plan|promo|oferta|xcaret|xel-ha|xplor|fotos|sesion|evento|show|entrada|boleto|abordo|cancun|playa|isla|mujeres|tulum|cobá|coba|chichen|itza/i.test(trimmed)
      ) {
        services.push(trimmed.replace(/^[-•*]\s*/, ""));
      }
    }
  }
  return services.slice(0, 20).join("\n");
}

function extractPricesStr(contenido: string): string {
  const matches = contenido.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
  return [...new Set(matches)].slice(0, 20).join(", ");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, url, agentId, nombreCliente, marcaId, marcaNombre, documentoTexto } = body;

    // Fetch existing marcas for auto-detection
    const { data: marcas } = await supabase.from("marcas").select("*");

    if (action === "scrape") {
      const targetUrl = url.startsWith("http") ? url : `https://${url}`;

      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LOPVELBot/1.0)",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "es-MX,es;q=0.9",
        },
        redirect: "follow",
      });

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: `No se pudo acceder a la URL (HTTP ${response.status})` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const html = await response.text();
      const contenido = extractTextFromHTML(html);
      const servicios = extractServices(contenido);
      const precios = extractPricesStr(contenido);

      // Auto-detect brand
      let marca = null;
      if (marcaId) {
        marca = (marcas || []).find((m: any) => m.id === marcaId);
      } else {
        marca = detectMarcaFromUrl(url, marcas || []);
        if (!marca) marca = detectMarcaFromContent(contenido, marcas || []);
      }

      let marcaRecord = marca;

      // If no brand detected and marcaNombre provided, create it
      if (!marcaRecord && marcaNombre) {
        const { data: newMarca, error: marcaError } = await supabase
          .from("marcas")
          .insert({
            nombre: marcaNombre,
            dominio: extractDomain(url),
          })
          .select()
          .single();
        if (!marcaError) marcaRecord = newMarca;
      }

      // If still no brand, create one from the domain
      if (!marcaRecord) {
        const domain = extractDomain(url);
        const { data: newMarca, error: marcaError } = await supabase
          .from("marcas")
          .insert({
            nombre: nombreCliente || domain,
            dominio: domain,
          })
          .select()
          .single();
        if (!marcaError) marcaRecord = newMarca;
      }

      // Save knowledge
      if (marcaRecord) {
        await supabase.from("conocimientos").insert({
          marca_id: marcaRecord.id,
          tipo: "url",
          url_origen: url,
          titulo: nombreCliente || marcaRecord.nombre,
          contenido: contenido,
          servicios: servicios,
          precios: precios,
        });
      }

      // Update or create agent
      if (agentId) {
        const { data, error } = await supabase
          .from("agentes")
          .update({
            contenido_entrenado: contenido,
            last_trained_at: new Date().toISOString(),
            marca_id: marcaRecord?.id || null,
          })
          .eq("id", agentId)
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify({ success: true, agente: data, marca: marcaRecord }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const agentCode = generateAgentCode();
      const { data, error } = await supabase
        .from("agentes")
        .insert({
          agent_code: agentCode,
          marca_id: marcaRecord?.id || null,
          nombre_cliente: nombreCliente || marcaRecord?.nombre || "Cliente",
          url_web: url,
          contenido_entrenado: contenido,
          status: "activo",
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, agente: data, marca: marcaRecord }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "documento") {
      // Save a pasted document as knowledge for a brand
      const contenido = documentoTexto || "";
      const servicios = extractServices(contenido);
      const precios = extractPricesStr(contenido);

      let marcaRecord = null;
      if (marcaId) {
        marcaRecord = (marcas || []).find((m: any) => m.id === marcaId);
      } else if (marcaNombre) {
        const { data: existing } = await supabase.from("marcas").select("*").eq("nombre", marcaNombre).maybeSingle();
        if (existing) {
          marcaRecord = existing;
        } else {
          const { data: newMarca } = await supabase.from("marcas").insert({ nombre: marcaNombre }).select().single();
          marcaRecord = newMarca;
        }
      }

      if (marcaRecord) {
        await supabase.from("conocimientos").insert({
          marca_id: marcaRecord.id,
          tipo: "documento",
          url_origen: "",
          titulo: marcaNombre || "Documento",
          contenido: contenido,
          servicios: servicios,
          precios: precios,
        });
      }

      return new Response(JSON.stringify({ success: true, marca: marcaRecord }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_marca") {
      const { data, error } = await supabase
        .from("marcas")
        .insert({
          nombre: marcaNombre,
          dominio: body.dominio || "",
          color_primario: body.colorPrimario || "#6366f1",
          color_secundario: body.colorSecundario || "#8b5cf6",
          personalidad_bot: body.personalidadBot || "amable, de barrio, directo, crea urgencia y cierra",
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, marca: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Acción no válida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
