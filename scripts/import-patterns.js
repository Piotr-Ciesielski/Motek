const fs = require("node:fs");
const path = require("node:path");

const { createSupabaseConnection } = require("../supabase");
const { maxPatternCatalogRecords: MAX_PATTERN_CATALOG_RECORDS } = require("../limits");

const PROJECT_DIR = path.resolve(__dirname, "..");
const IMPORT_PATH = path.join(PROJECT_DIR, "data", "patterns-import.json");
const EXECUTE = process.argv.includes("--execute");
const SOURCE_FILTER = process.argv
  .find((argument) => argument.startsWith("--source="))
  ?.slice("--source=".length);
const BATCH_SIZE = 50;

function validateImportCapacity(target) {
  const finalCount = target.tableRecordCount + target.newRecordCount;
  if (finalCount > MAX_PATTERN_CATALOG_RECORDS) {
    throw new Error(
      `Import przekroczył limit katalogu: maksymalnie ${MAX_PATTERN_CATALOG_RECORDS} rekordów, wynik wyniósłby ${finalCount}.`
    );
  }
}

function validateRequirement(requirement, context) {
  if (!requirement || typeof requirement !== "object" || Array.isArray(requirement)) {
    throw new Error(`${context} musi być obiektem.`);
  }

  for (const field of ["yarns_needed", "meters_needed", "grams_needed"]) {
    if (!Number.isInteger(requirement[field]) || requirement[field] < 1) {
      throw new Error(`${context}.${field} musi być dodatnią liczbą całkowitą.`);
    }
  }

  for (const field of ["materials", "weight_classes"]) {
    if (!Array.isArray(requirement[field]) || requirement[field].length === 0 || requirement[field].some((value) => typeof value !== "string" || !value.trim())) {
      throw new Error(`${context}.${field} musi być niepustą tablicą tekstów.`);
    }
  }
}

function validateMatchingRequirements(value, sourceFilename) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.variants)) {
    throw new Error(`Rekord ${sourceFilename} nie zawiera poprawnego matching_requirements.`);
  }

  value.variants.forEach((variant, index) => {
    const context = `Rekord ${sourceFilename}, wariant ${index + 1}`;
    validateRequirement(variant, context);
    if (variant.yarn_requirements !== undefined) {
      if (!Array.isArray(variant.yarn_requirements) || variant.yarn_requirements.length > 8) {
        throw new Error(`${context}.yarn_requirements musi zawierać od 0 do 8 elementów.`);
      }
      variant.yarn_requirements.forEach((requirement, requirementIndex) =>
        validateRequirement(requirement, `${context}.yarn_requirements[${requirementIndex}]`)
      );
    }
  });
}

function readImportData() {
  const document = JSON.parse(fs.readFileSync(IMPORT_PATH, "utf8"));

  if (!Array.isArray(document.records) || document.records.length === 0) {
    throw new Error("Plik importu nie zawiera rekordów.");
  }

  const filenames = document.records.map((record) => record.source_filename);
  if (new Set(filenames).size !== filenames.length) {
    throw new Error("Plik importu zawiera powtórzone nazwy plików źródłowych.");
  }

  for (const record of document.records) {
    validateMatchingRequirements(record.matching_requirements, record.source_filename);
  }

  if (!SOURCE_FILTER) {
    return document.records;
  }

  const filteredRecords = document.records.filter(
    (record) => record.source_filename === SOURCE_FILTER
  );
  if (filteredRecords.length === 0) {
    throw new Error(
      `Nie znaleziono rekordu źródłowego wskazanego przez --source.`
    );
  }

  return filteredRecords;
}

function splitIntoBatches(items, size) {
  const batches = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

async function inspectTarget(client, records) {
  const { count, error: countError } = await client
    .from("patterns")
    .select("*", { count: "exact", head: true });

  if (countError) {
    throw new Error(`Nie udało się odczytać tabeli patterns: ${countError.message}`);
  }

  let matchingCount = 0;
  for (const batch of splitIntoBatches(records, BATCH_SIZE)) {
    const filenames = batch.map((record) => record.source_filename);
    const { data, error } = await client
      .from("patterns")
      .select("source_filename")
      .in("source_filename", filenames);

    if (error) {
      throw new Error(
        `Nie udało się sprawdzić istniejących rekordów: ${error.message}`
      );
    }
    matchingCount += data.length;
  }

  return {
    tableRecordCount: count ?? 0,
    matchingRecordCount: matchingCount,
    newRecordCount: records.length - matchingCount,
  };
}

async function importRecords(client, records) {
  let savedCount = 0;

  for (const batch of splitIntoBatches(records, BATCH_SIZE)) {
    const { data, error } = await client
      .from("patterns")
      .upsert(batch, { onConflict: "source_filename" })
      .select("id");

    if (error) {
      throw new Error(`Import został zatrzymany: ${error.message}`);
    }
    savedCount += data.length;
  }

  return savedCount;
}

async function main() {
  const connection = createSupabaseConnection();
  if (!connection) {
    throw new Error(
      "Brak konfiguracji Supabase. Ustaw SUPABASE_URL i SUPABASE_SECRET_KEY w pliku .env."
    );
  }

  const records = readImportData();
  await connection.verify();
  const target = await inspectTarget(connection.client, records);
  validateImportCapacity(target);

  console.log(`RECORDS_IN_FILE=${records.length}`);
  console.log(`RECORDS_IN_TABLE=${target.tableRecordCount}`);
  console.log(`NEW_RECORDS=${target.newRecordCount}`);
  console.log(`RECORDS_TO_UPDATE=${target.matchingRecordCount}`);

  if (!EXECUTE) {
    console.log("MODE=CHECK_ONLY");
    console.log(
      "Nie zapisano danych. Użyj flagi --execute dopiero po sprawdzeniu podsumowania."
    );
    return;
  }

  const savedCount = await importRecords(connection.client, records);
  const { count: finalCount, error: finalCountError } = await connection.client
    .from("patterns")
    .select("*", { count: "exact", head: true });

  if (finalCountError) {
    throw new Error(
      `Dane zapisano, ale nie udało się sprawdzić wyniku: ${finalCountError.message}`
    );
  }

  if ((finalCount ?? 0) > MAX_PATTERN_CATALOG_RECORDS) {
    throw new Error(
      `Dane zapisano, ale katalog przekracza limit ${MAX_PATTERN_CATALOG_RECORDS} rekordów.`
    );
  }

  console.log("MODE=EXECUTE");
  console.log(`SAVED_RECORDS=${savedCount}`);
  console.log(`FINAL_TABLE_RECORDS=${finalCount ?? 0}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`PATTERNS_IMPORT_ERROR=${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  validateImportCapacity,
  validateMatchingRequirements,
};
