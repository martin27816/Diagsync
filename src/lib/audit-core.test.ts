import assert from "node:assert/strict";
import { buildChangesPayload, canViewAuditLogs, getAuditMetaFromRequest } from "./audit-core";

function testRoleAccess() {
  assert.equal(canViewAuditLogs("HRM"), true);
  assert.equal(canViewAuditLogs("SUPER_ADMIN"), true);
  assert.equal(canViewAuditLogs("MD"), false);
}

function testChangesBuilder() {
  const explicit = buildChangesPayload({
    changes: { field: "status", to: "APPROVED" },
    oldValue: { status: "PENDING" },
    newValue: { status: "APPROVED" },
  });
  assert.deepEqual(explicit, { field: "status", to: "APPROVED" });

  const fallback = buildChangesPayload({
    oldValue: { status: "PENDING" },
    newValue: { status: "APPROVED" },
  }) as any;
  assert.deepEqual(fallback.before, { status: "PENDING" });
  assert.deepEqual(fallback.after, { status: "APPROVED" });
}

function testRequestMeta() {
  const req = new Request("https://example.com", {
    headers: {
      "x-forwarded-for": "10.0.0.1, 10.0.0.2",
      "user-agent": "DiagSyncTest/1.0",
    },
  });
  const meta = getAuditMetaFromRequest(req);
  assert.equal(meta.ipAddress, "10.0.0.1");
  assert.equal(meta.userAgent, "DiagSyncTest/1.0");
}

function run() {
  testRoleAccess();
  testChangesBuilder();
  testRequestMeta();
  console.log("audit-core tests passed");
}

run();

