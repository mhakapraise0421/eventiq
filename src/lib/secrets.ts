import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

type SecretFile = Record<string, string>;

let cache: SecretFile | null = null;
const warned = new Set<string>();

function secretsPath() {
  return process.env.INSTALL_SECRETS_PATH || path.join(process.cwd(), ".data", "install-secrets.json");
}

function readSecrets(): SecretFile {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(fs.readFileSync(secretsPath(), "utf8")) as SecretFile;
    cache = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    cache = {};
  }
  return cache;
}

function persist(name: string, value: string) {
  const secrets = readSecrets();
  secrets[name] = value;
  try {
    const file = secretsPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(secrets, null, 2), { mode: 0o600 });
    fs.renameSync(temp, file);
  } catch (error) {
    // The value still works for this process; only restarts lose it.
    console.warn(
      `[eventiq] Could not persist the generated secret "${name}" to ${secretsPath()}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Returns a secret from the environment, or a random one generated on first
 * use and stored privately under .data so that restarts keep signatures valid.
 * This removes the old known password fallbacks that made cookies forgeable.
 */
export function resolveSecret(envVar: string, installName: string) {
  const fromEnv = (process.env[envVar] || "").trim();
  if (fromEnv) return fromEnv;

  const secrets = readSecrets();
  if (secrets[installName]) return secrets[installName];

  const generated = randomBytes(32).toString("base64url");
  persist(installName, generated);
  if (!warned.has(envVar)) {
    warned.add(envVar);
    console.warn(
      `[eventiq] ${envVar} is not set. Using a generated secret stored in ${secretsPath()}. ` +
        "Set it explicitly for production deployments.",
    );
  }
  return generated;
}
