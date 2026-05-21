import { db, noticiasTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

const PROMPT_TRADUCCION = `Sos traductor profesional español → hebreo moderno, con nivel y rigor de la Universidad Hebrea de Jerusalén y de la Academia de la Lengua Hebrea (האקדמיה ללשון העברית).

Tarea: traducir un artículo periodístico de fútbol (Club Atlético River Plate) al hebreo moderno actual, gramática perfecta, ortografía impecable, estilo periodístico israelí natural y fluido — como El País deportes pero en hebreo.

Reglas estrictas:
1. Nombres propios de jugadores, técnicos, clubes y lugares: transliterar al hebreo con la convención periodística israelí estándar.
   - "River Plate" → "ריבר פלאטה"
   - "Eduardo Coudet" / "El Chacho" → "אדוארדו קודה" / "אל צ׳אצ׳ו"
   - "Monumental" → "מונומנטל"
   - "Núñez" → "נוניס"
   - "Buenos Aires" → "בואנוס איירס"
   - "Ramat Gan" → "רמת גן"
   - "Filial" → "סניף"
2. Mantené la estructura: bajada en negrita al inicio (con *asteriscos*), después párrafos.
3. NO inventes información ni cambies hechos. Traducción literal del sentido, idiomática del idioma.
4. Hashtags: traducidos al hebreo.

Devolvé EXACTAMENTE en este formato (sin agregar comentarios, sin texto antes/después):

**Título:**
[título en hebreo]

**Contenido:**
[contenido completo en hebreo, párrafos preservados, bajada con *asteriscos* al inicio]

**Tags:**
#ריברפלאטה #ריברישראל #רמתגן #הגדולמכולם`;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

async function traducir(titulo: string, contenido: string, tags: string, maxRetries = 3) {
  let texto = "";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text:
          `**Título:** ${titulo}\n\n**Contenido:** ${contenido}\n\n**Tags:** ${tags}`
        }] }],
        config: { systemInstruction: PROMPT_TRADUCCION, maxOutputTokens: 6000 },
      });
      texto = response.text ?? "";
      break;
    } catch (err) {
      const msg = (err as Error).message ?? "";
      const m = msg.match(/"retryDelay":"(\d+)s"/);
      if (m && attempt < maxRetries) {
        const wait = (parseInt(m[1], 10) + 2) * 1000;
        process.stdout.write(`\n   ⏳ rate-limit, retry en ${wait / 1000}s... `);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  if (!texto || texto.length < 50) return null;

  const mTit = texto.match(/\*\*Título:\*\*\s*([\s\S]+?)\n\s*\*\*Contenido:\*\*/);
  const mCon = texto.match(/\*\*Contenido:\*\*\s*([\s\S]+?)\n\s*\*\*Tags:\*\*/);
  const mTag = texto.match(/\*\*Tags:\*\*\s*([\s\S]+?)$/);
  if (!mTit || !mCon) return null;

  return {
    tituloHe: mTit[1].trim(),
    contenidoHe: mCon[1].trim(),
    tagsHe: (mTag?.[1] ?? "#ריברפלאטה #ריברישראל #רמתגן #הגדולמכולם").trim(),
  };
}

function getFlag(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (arg) return arg.split("=")[1];
  if (process.argv.includes(`--${name}`)) return "true";
  return undefined;
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ Falta GEMINI_API_KEY");
    process.exit(1);
  }

  const dryRun = getFlag("dry-run") === "true";
  const force = getFlag("force") === "true";
  const limit = parseInt(getFlag("limit") ?? "0", 10);
  const delayMs = parseInt(getFlag("delay") ?? "1500", 10);

  console.log("🇮🇱 Backfill traducción hebrea");
  console.log(`   dry-run: ${dryRun} | force: ${force} | limit: ${limit || "todas"} | delay: ${delayMs}ms\n`);

  const where = force
    ? eq(noticiasTable.publicada, true)
    : and(
        eq(noticiasTable.publicada, true),
        sql`coalesce(length(${noticiasTable.contenidoHe}), 0) < 100`,
      );

  const noticias = await db
    .select({
      id: noticiasTable.id,
      titulo: noticiasTable.titulo,
      contenido: noticiasTable.contenido,
      tags: noticiasTable.tags,
      contenidoHe: noticiasTable.contenidoHe,
    })
    .from(noticiasTable)
    .where(where)
    .orderBy(noticiasTable.id);

  const target = limit > 0 ? noticias.slice(0, limit) : noticias;
  console.log(`📰 Encontradas ${noticias.length} candidatas. Procesando ${target.length}.\n`);

  if (dryRun) {
    target.forEach((n) =>
      console.log(`  [${n.id}] ${n.titulo.slice(0, 80)} ${n.contenidoHe ? "(ya tiene HE)" : ""}`),
    );
    console.log("\n✅ Dry-run completado. No se modificó la DB.");
    process.exit(0);
  }

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < target.length; i++) {
    const n = target[i];
    const prefix = `[${i + 1}/${target.length}] #${n.id}`;
    process.stdout.write(`${prefix} ${n.titulo.slice(0, 60)}... `);

    try {
      const traduccion = await traducir(n.titulo, n.contenido, n.tags ?? "");
      if (!traduccion) {
        console.log("❌ traducción vacía/inválida");
        fail++;
        continue;
      }
      await db
        .update(noticiasTable)
        .set(traduccion)
        .where(eq(noticiasTable.id, n.id));
      console.log(`✅ ${traduccion.tituloHe.slice(0, 50)}`);
      ok++;
    } catch (err) {
      console.log(`❌ ${(err as Error).message}`);
      fail++;
    }

    if (i < target.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  console.log(`\n📊 Resultado: ${ok} traducidas, ${fail} fallidas, ${target.length} total.`);
  process.exit(fail > 0 && ok === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("💥 Error fatal:", err);
  process.exit(1);
});
