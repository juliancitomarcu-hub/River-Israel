import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { renderizarPlacaRedes } from "./generar-placa-redes";
import { crearCaptionRedes, enviarNotaAMakeConfirmado } from "./enviar-a-make";

test("placa cuadrada JPEG con degradado inferior y título escapado", async () => {
  const foto = await sharp({ create: {
    width: 1600, height: 900, channels: 3, background: "#eeeeee",
  } }).png().toBuffer();
  const imagen = await renderizarPlacaRedes(foto, 'River: "pasión" & comunidad <Israel>');
  const metadata = await sharp(imagen).metadata();
  assert.equal(metadata.width, 1080);
  assert.equal(metadata.height, 1080);
  assert.equal(metadata.format, "jpeg");
  const superior = await sharp(await sharp(imagen).extract({ left: 1000, top: 100, width: 10, height: 10 }).toBuffer()).stats();
  const inferior = await sharp(await sharp(imagen).extract({ left: 1000, top: 1050, width: 10, height: 10 }).toBuffer()).stats();
  assert.ok(superior.channels[0].mean > inferior.channels[0].mean + 100);
});

test("rechaza foto o título vacíos sin generar una placa engañosa", async () => {
  await assert.rejects(renderizarPlacaRedes(Buffer.alloc(0), "River"), /falta la foto/);
  await assert.rejects(renderizarPlacaRedes(Buffer.from("x"), ""), /vacío/);
  await assert.rejects(renderizarPlacaRedes(Buffer.from("x"), "x".repeat(601)), /máximo/);
});

test("caption breve con gancho y hashtags obligatorios sin repetir", () => {
  const caption = crearCaptionRedes({
    id: 1, titulo: "**River prepara su próxima fecha**", contenido: "No debe copiarse".repeat(1000),
    categoria: "river", tags: "#RiverPlate #ElMasGrande #RiverIsrael",
  });
  assert.ok(caption.length < 500);
  assert.ok(!caption.includes("No debe copiarse"));
  assert.equal(caption.match(/#RiverPlate/g)?.length, 1);
  assert.equal(caption.match(/#ElMasGrande/g)?.length, 1);
  assert.ok(caption.includes("nota completa"));
});

test("el secret nuevo es obligatorio y falla antes de generar o enviar", async () => {
  const previous = process.env.WEBHOOK_REDES_URL;
  delete process.env.WEBHOOK_REDES_URL;
  try {
    await assert.rejects(enviarNotaAMakeConfirmado({
      id: 1, titulo: "River", contenido: "", categoria: "river",
    }), /WEBHOOK_REDES_URL no configurada/);
  } finally {
    if (previous !== undefined) process.env.WEBHOOK_REDES_URL = previous;
  }
});