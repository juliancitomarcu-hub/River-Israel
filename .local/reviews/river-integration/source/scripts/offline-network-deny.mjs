// Defense in depth for the test child, NOT an OS/network sandbox.
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  },
});
const blocked = () => { throw new Error("Offline review: outgoing network disabled"); };
globalThis.fetch = blocked;
http.request = blocked;
http.get = blocked;
https.request = blocked;
https.get = blocked;
net.connect = blocked;
net.createConnection = blocked;
tls.connect = blocked;