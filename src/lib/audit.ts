import "server-only";
import { run } from "./db";
import { randomId } from "./format";

export function writeAudit(opts: {
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before?: unknown;
  after?: unknown;
  outcome?: "success" | "failure";
  ip?: string | null;
}) {
  run(
    `INSERT INTO audit_logs (id, actor_id, actor_name, actor_role, action, entity_type, entity_id, outcome, before_json, after_json, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    randomId("audit_"),
    opts.actorId,
    opts.actorName,
    opts.actorRole,
    opts.action,
    opts.entityType,
    opts.entityId,
    opts.outcome || "success",
    opts.before === undefined ? null : JSON.stringify(opts.before),
    opts.after === undefined ? null : JSON.stringify(opts.after),
    opts.ip || null,
    new Date().toISOString(),
  );
}
