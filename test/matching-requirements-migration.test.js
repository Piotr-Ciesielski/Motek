const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migrationPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20260803113832_harden_matching_requirements_validation.sql",
);

const requiredFields = [
  ["variant", "id"],
  ["variant", "label"],
  ["variant", "requirements"],
  ["requirement", "role"],
  ["requirement", "measurement_basis"],
  ["requirement", "material_match"],
  ["requirement", "materials"],
  ["requirement", "color_mode"],
  ["requirement", "weight_classes"],
];

test("migracja wymaga każdego pola wariantu i roli także gdy JSON zwraca NULL", () => {
  const migration = fs.readFileSync(migrationPath, "utf8");

  for (const [container, field] of requiredFields) {
    assert.match(
      migration,
      new RegExp(`not \\(${container} \\? '${field}'\\)[\\s\\S]{0,200}is distinct from`),
      `brakuje kontroli NULL-safe dla ${container}.${field}`,
    );
  }
});