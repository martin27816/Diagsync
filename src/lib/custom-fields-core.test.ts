import assert from "node:assert/strict";
import {
  toCustomFieldKey,
  validateCustomFieldsMap,
  validateResultDataPayload,
} from "./custom-fields-core";

function testToCustomFieldKey() {
  assert.equal(toCustomFieldKey(" Colony Count "), "colony_count");
  assert.equal(toCustomFieldKey("Gram+ Stain"), "gram_stain");
}

function testValidateCustomFieldsMap() {
  const good = validateCustomFieldsMap({ colony_count: "1e5", organism: "E. coli" });
  assert.equal(good.ok, true);
  if (good.ok) {
    assert.equal(good.value.colony_count, "1e5");
  }

  const badKey = validateCustomFieldsMap({ "Bad Key!": "x" });
  assert.equal(badKey.ok, false);
}

function testValidateResultDataPayload() {
  const good = validateResultDataPayload({ hb: "12", sensitivity: "Ciprofloxacin", flagged: true });
  assert.equal(good.ok, true);

  const bad = validateResultDataPayload({ obj: { nested: true } });
  assert.equal(bad.ok, false);
}

function run() {
  testToCustomFieldKey();
  testValidateCustomFieldsMap();
  testValidateResultDataPayload();
  console.log("custom-fields-core tests passed");
}

run();
