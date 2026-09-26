import assert from "node:assert/strict";
import test from "node:test";
import { sessionDevice } from "./session-device";

test("identifica navegadores sin confundir sus tokens de compatibilidad", () => {
  for (const [ua, expected] of [
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/128.0 Mobile/15 Safari/604.1", "Chrome · iPhone"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14) Gecko/20100101 Firefox/130.0", "Firefox · Mac"],
    ["Mozilla/5.0 (iPad; CPU OS 18 like Mac OS X) Version/18 Mobile/15 Safari/604.1", "Safari · iPad"],
    ["Mozilla/5.0 (Windows NT 10.0) Chrome/128 Safari/537 Edg/128", "Edge · Windows"],
    ["Mozilla/5.0 (Linux; Android 14) Chrome/128 Safari/537 SamsungBrowser/26", "Samsung Internet · Android"],
    ["Mozilla/5.0 (Linux; Android 14) Chrome/128 Safari/537 OPR/80", "Opera · Android"],
    ["Mozilla/5.0 (iPhone) FxiOS/130 Mobile/15 Safari/604", "Firefox · iPhone"],
  ]) assert.equal(sessionDevice(ua), expected);
});

test("sesiones sin header y agentes desconocidos tienen un resultado explícito", () => {
  assert.equal(sessionDevice(), null);
  assert.equal(sessionDevice("  "), null);
  assert.equal(sessionDevice("<script>alert(1)</script>"), "Navegador desconocido · Dispositivo desconocido");
  assert.equal(sessionDevice("x".repeat(512) + " Chrome/1 (Windows)"), "Navegador desconocido · Dispositivo desconocido");
});