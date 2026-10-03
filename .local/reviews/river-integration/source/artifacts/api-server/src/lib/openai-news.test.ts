import assert from "node:assert/strict";
import test from "node:test";
import {
  diferenciaHorariaArgentinaIsrael,
  extraerFechaDelEvento,
  generarNotaEstructurada,
  resolverCaptionTelegram,
  validarTelegramCaption,
} from "./openai-news";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.OPENAI_API_KEY;
process.env.OPENAI_API_KEY = "test-only-key";

function openAiResponse(output: unknown): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(output) } }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function validOutput() {
  return {
    titulo: "River prepara una nueva noche de fútbol",
    bajada: "El equipo afronta el próximo desafío con los datos confirmados en el cable.",
    tags: "#RiverPlate #RiverIsrael",
    web_content: Array.from({ length: 320 }, (_, index) => `dato${index}`).join(" "),
    telegram_caption: "⚪️🔴 River prepara una noche que puede marcar el rumbo. 🚨 Leé todos los detalles [en la web]({{ARTICLE_URL}}).",
  };
}

test("rechaza una respuesta de OpenAI inválida sin guardar contenido", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return openAiResponse({
      ...validOutput(),
      web_content: "demasiado corto",
    });
  };
  try {
    await assert.rejects(
      generarNotaEstructurada({ sourceText: "River informó una novedad verificable." }),
      /No se pudo generar una nota editorial válida/,
    );
    assert.equal(calls, 2, "el reintento debe estar acotado");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("falla cerrado cuando OpenAI responde con error HTTP", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("error", { status: 503 });
  };
  try {
    await assert.rejects(
      generarNotaEstructurada({ sourceText: "River informó una novedad verificable." }),
      /No se pudo generar una nota editorial válida/,
    );
    assert.equal(calls, 2, "el reintento debe estar acotado");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("valida el teaser separado y nunca devuelve el artículo completo a Telegram", () => {
  const caption = resolverCaptionTelegram(validOutput().telegram_caption, {
    titulo: validOutput().titulo,
    contenido: validOutput().web_content,
    url: "https://riverplateisrael.com/noticia/42",
  });
  assert.ok(validarTelegramCaption(caption));
  assert.match(caption, /https:\/\/riverplateisrael\.com\/noticia\/42/);
  assert.ok(caption.split(/\s+/).length <= 60);
  assert.ok(!caption.includes("dato319"));
});

test("acepta los límites editoriales de un paquete estructurado válido", async () => {
  globalThis.fetch = async () => openAiResponse(validOutput());
  try {
    const paquete = await generarNotaEstructurada({
      sourceText: "River informó una novedad verificable.",
    });
    assert.equal(paquete.web_content.split(/\s+/).length, 320);
    assert.ok(paquete.telegram_caption.split(/\s+/).length <= 60);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("usa la diferencia horaria estacional de Israel cuando hay fecha", () => {
  assert.equal(diferenciaHorariaArgentinaIsrael(new Date("2026-07-01T12:00:00Z")), 6);
  assert.equal(diferenciaHorariaArgentinaIsrael(new Date("2026-01-01T12:00:00Z")), 5);
});

test("convierte la fecha del partido y no la fecha de publicación del cable", () => {
  const cable = "Publicado el 30 de marzo. River enfrenta a su rival el 1 de abril a las 21:00.";
  const fechaPartido = extraerFechaDelEvento(cable, 2026);
  assert.equal(fechaPartido?.toISOString(), "2026-04-01T12:00:00.000Z");
});