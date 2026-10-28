import "server-only";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

// Private files never live under public/. They are only reachable through
// authenticated route handlers that check ownership first.
function baseDir() {
  return (
    process.env.PRIVATE_STORAGE_PATH ||
    path.join(process.cwd(), ".data", "private")
  );
}

function resolveSafe(relativePath: string) {
  const base = path.resolve(baseDir());
  const target = path.resolve(base, relativePath);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) {
    throw new Error("Invalid storage path.");
  }
  return target;
}

export function hashBytes(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function savePrivateFile(relativePath: string, bytes: Uint8Array) {
  const target = resolveSafe(relativePath);
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.writeFile(target, bytes, { flag: "wx" });
  return relativePath;
}

export async function readPrivateFile(relativePath: string) {
  return fs.promises.readFile(resolveSafe(relativePath));
}

export async function deletePrivateFile(relativePath: string) {
  try {
    await fs.promises.unlink(resolveSafe(relativePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
