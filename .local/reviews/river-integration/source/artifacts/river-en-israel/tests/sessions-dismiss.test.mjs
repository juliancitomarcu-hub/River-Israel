import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Exercise the actual effect, without authenticating or changing live sessions.
const source = readFileSync(new URL("../src/pages/Redactor.tsx", import.meta.url), "utf8");
const start = source.indexOf("  useEffect(() => {", source.indexOf("const sesionesRef ="));
const end = source.indexOf("}, [mostrarSesiones]);", start);
assert.ok(start >= 0 && end > start);
const effect = ts.transpile(source.slice(start, end + "}, [mostrarSesiones]);".length));

function mount(open = true) {
  const listeners = new Map();
  const inside = {};
  let closed = false;
  let cleanup;
  vm.runInNewContext(effect, {
    mostrarSesiones: open,
    sesionesRef: { current: { contains: target => target === inside } },
    setMostrarSesiones: value => { closed = !value; },
    useEffect: callback => { cleanup = callback(); },
    document: {
      addEventListener: (name, callback, capture) => listeners.set(name, { callback, capture }),
      removeEventListener: (name, callback, capture) => {
        assert.equal(listeners.get(name).callback, callback);
        assert.equal(listeners.get(name).capture, capture);
        listeners.delete(name);
      },
    },
  });
  return { listeners, inside, cleanup, closed: () => closed };
}

for (const pointerType of ["touch", "mouse", "pen"]) {
  test(`outside ${pointerType} closes; inside ${pointerType} stays open`, () => {
    const panel = mount();
    const listener = panel.listeners.get("pointerdown");
    assert.equal(listener.capture, true, "outside handlers cannot be blocked by bubbling handlers");
    listener.callback({ target: panel.inside, pointerType });
    assert.equal(panel.closed(), false);
    listener.callback({ target: {}, pointerType });
    assert.equal(panel.closed(), true);
    panel.cleanup();
    assert.equal(panel.listeners.size, 0);
  });
}

test("Escape closes while other keys do not", () => {
  const panel = mount();
  panel.listeners.get("keydown").callback({ key: "Enter" });
  assert.equal(panel.closed(), false);
  panel.listeners.get("keydown").callback({ key: "Escape" });
  assert.equal(panel.closed(), true);
});

test("closed popover registers no listeners", () => {
  assert.equal(mount(false).listeners.size, 0);
});