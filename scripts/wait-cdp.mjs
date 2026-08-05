import { discoverVerifiedTargets } from "../src/cdp-discovery.mjs";

const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const port = Number(value("--port"));
const timeoutMs = Number(value("--timeout") || 30_000);

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.log(JSON.stringify({ ok: false, error: "a valid --port is required" }));
  process.exitCode = 1;
} else {
  const deadline = Date.now() + timeoutMs;
  let lastError = "renderer not ready";
  let rendererCount = 0;
  while (Date.now() < deadline) {
    try {
      const targets = await discoverVerifiedTargets(port, { ownerVerified: true });
      rendererCount = targets.length;
      if (rendererCount) break;
      lastError = "no verified WorkBuddy renderer found";
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  const ok = rendererCount > 0;
  console.log(JSON.stringify({ ok, port, rendererCount, ...(ok ? {} : { error: lastError }) }));
  if (!ok) process.exitCode = 1;
}
