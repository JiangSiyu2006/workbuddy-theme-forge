import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DEFAULT_CDP_PORT } from "./constants.mjs";
import { CdpSession, discoverTargets } from "./cdp-client.mjs";
import { readState } from "./state.mjs";

const execFileAsync = promisify(execFile);

function validPort(value) {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : null;
}

export function candidatePorts({ explicitPort, envPort, statePort, ownedPorts = [] } = {}) {
  const values = [
    [explicitPort, "explicit"], [envPort, "environment"], [statePort, "state"], [DEFAULT_CDP_PORT, "default"],
    ...ownedPorts.map((port) => [port, "workbuddy-listener"])
  ];
  const seen = new Set();
  return values.flatMap(([value, source]) => {
    const port = validPort(value);
    if (!port || seen.has(port)) return [];
    seen.add(port);
    return [{ port, source }];
  });
}

export async function windowsListeningPorts({ execFileImpl = execFileAsync } = {}) {
  if (process.platform !== "win32") return [];
  const script = "$items=Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {$_.LocalAddress -in @('127.0.0.1','::1')} | ForEach-Object {$p=Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; if($p){[pscustomobject]@{port=$_.LocalPort;pid=$_.OwningProcess;name=$p.ProcessName;path=$p.Path}}}; @($items)|ConvertTo-Json -Compress";
  const { stdout } = await execFileImpl("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true, timeout: 5000 });
  const parsed = JSON.parse(stdout.trim() || "[]");
  return (Array.isArray(parsed) ? parsed : [parsed]).map((item) => ({ ...item, port: Number(item.port), pid: Number(item.pid) }));
}

export function isWorkBuddyOwner(owner) {
  return /workbuddy/i.test(owner?.name || "") || /[\\/]WorkBuddy(?:\.exe)?$/i.test(owner?.path || "");
}

export async function discoverVerifiedTargets(port, { discoverImpl = discoverTargets, SessionImpl = CdpSession, timeoutMs = 1200, ownerVerified } = {}) {
  const targets = await discoverImpl(port, { timeoutMs });
  const verified = [];
  const rendererFallback = [];
  for (const target of targets) {
    let session;
    try {
      session = await new SessionImpl(target.webSocketDebuggerUrl, { timeoutMs }).connect();
      const identity = await session.evaluate(`(() => ({url:location.href,applicationName:[document.documentElement?.dataset?.productName,document.body?.dataset?.productName,document.documentElement?.dataset?.applicationName,document.body?.dataset?.applicationName,document.querySelector('meta[name="application-name"]')?.content,document.title].find(value=>/workbuddy/i.test(value||""))||null}))()`);
      if (/workbuddy/i.test(identity?.applicationName || "")) verified.push(target);
      else if (/renderer/i.test(identity?.url || "")) rendererFallback.push(target);
    } catch { /* a broken or unrelated page does not invalidate other renderers */ }
    finally { session?.close(); }
  }
  if (verified.length || !rendererFallback.length) return verified;
  let owned = ownerVerified;
  if (owned === undefined && process.platform === "win32") {
    const listeners = await windowsListeningPorts().catch(() => []);
    owned = isWorkBuddyOwner(listeners.find((item) => item.port === port));
  }
  return owned ? rendererFallback : verified;
}

export async function verifyCdpEndpoint(port, { listeners, discoverImpl = discoverTargets, SessionImpl = CdpSession } = {}) {
  const knownListeners = listeners ?? await windowsListeningPorts().catch(() => []);
  const owner = knownListeners.find((item) => item.port === port);
  const ownerVerified = isWorkBuddyOwner(owner);
  if (process.platform === "win32" && !ownerVerified) return { ok: false, port, ownerVerified, owner, reason: owner ? `owned-by:${owner.name}` : "owner-not-found" };
  let targets;
  try { targets = await discoverVerifiedTargets(port, { discoverImpl, SessionImpl, timeoutMs: 900, ownerVerified }); }
  catch (error) { return { ok: false, port, ownerVerified, owner, reason: error.message }; }
  return { ok: targets.length > 0, port, ownerVerified, owner, targets, rendererCount: targets.length, reason: targets.length ? "workbuddy-renderer-handshake" : "identity-handshake-failed" };
}

export async function resolveCdpEndpoint({ explicitPort, envPort = process.env.WORKBUDDY_REMOTE_DEBUGGING_PORT, statePort, savedState, listeners, verifyImpl = verifyCdpEndpoint } = {}) {
  const knownListeners = listeners ?? await windowsListeningPorts().catch(() => []);
  const persisted = savedState ?? await readState();
  const savedPort = statePort ?? (persisted.ownerVerified === true ? persisted.port : undefined);
  const ownedPorts = knownListeners.filter(isWorkBuddyOwner).map((item) => item.port);
  const attempts = [];
  for (const candidate of candidatePorts({ explicitPort, envPort, statePort: savedPort, ownedPorts })) {
    const result = await verifyImpl(candidate.port, { listeners: knownListeners });
    attempts.push({ ...candidate, ...result });
    if (result.ok) return { ...candidate, ...result, attempts };
  }
  const error = new Error("no verified WorkBuddy CDP endpoint found");
  error.details = attempts;
  throw error;
}
