import assert from "node:assert/strict";
import {
  hasSingleActiveVersion,
  isEditedVersion,
  isVersionChainValid,
  pickActiveVersion,
  resolveEditNotificationTargets,
} from "./edit-versioning-core";

function testActivePickAndSingleActive() {
  const versions = [
    { id: "v1", version: 1, isActive: false, parentId: null },
    { id: "v2", version: 2, isActive: true, parentId: "v1" },
  ];
  assert.equal(pickActiveVersion(versions)?.id, "v2");
  assert.equal(hasSingleActiveVersion(versions), true);
  assert.equal(
    hasSingleActiveVersion([
      { id: "v1", version: 1, isActive: true, parentId: null },
      { id: "v2", version: 2, isActive: true, parentId: "v1" },
    ]),
    false
  );
}

function testVersionChainIntegrity() {
  assert.equal(
    isVersionChainValid([
      { id: "v1", version: 1, parentId: null },
      { id: "v2", version: 2, parentId: "v1" },
      { id: "v3", version: 3, parentId: "v2" },
    ]),
    true
  );
  assert.equal(
    isVersionChainValid([
      { id: "v1", version: 1, parentId: null },
      { id: "v2", version: 2, parentId: "bad-id" },
    ]),
    false
  );
}

function testNotificationTargets() {
  const targets = resolveEditNotificationTargets({
    editorId: "u1",
    mdIds: ["u1", "u2"],
    performerIds: ["u3", "u2"],
  });
  assert.deepEqual(targets.sort(), ["u2", "u3"]);
}

function testEditedBadgeLogic() {
  assert.equal(isEditedVersion(1), false);
  assert.equal(isEditedVersion(2), true);
}

function run() {
  testActivePickAndSingleActive();
  testVersionChainIntegrity();
  testNotificationTargets();
  testEditedBadgeLogic();
  console.log("edit-versioning-core tests passed");
}

run();
