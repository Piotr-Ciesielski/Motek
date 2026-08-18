const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_DOCUMENTS = [
  "README.md",
  "SPEC.md",
  "docs/ARCHITECTURE.md",
  "docs/QUALITY.md",
  "docs/SECURITY.md",
  "docs/OPERATIONS.md",
  "docs/DESIGN-QA.md",
];

const REQUIRED_OPERATIONS_DOMAINS = [
  "https://www.staging.rysia.org",
  "https://staging.rysia.org",
  "https://www.rysia.org",
];

const REQUIRED_ENVIRONMENT_KEYS = [
  "PORT",
  "HOST",
  "NODE_ENV",
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "COOKIE_SECURE",
  "APP_ORIGIN",
  "AUTH_IDLE_TIMEOUT_SECONDS",
  "IDLE_SESSION_SECRET",
  "DEPLOYMENT_ENV",
  "CAPTCHA_ENABLED",
  "CAPTCHA_PROVIDER",
  "CAPTCHA_SITE_KEY",
  "METRICS_ENABLED",
  "TRUST_PROXY",
];

const FORBIDDEN_HISTORICAL_REFERENCES = [
  "docs/operations/",
  "docs/superpowers/",
  "Designs/",
  "AUDYT_",
  "CHANGELOG.txt",
  "docs/PATTERN-CATALOG.md",
  "docs/UX-UI-ROADMAP.md",
];

function relativePath(rootDir, candidatePath) {
  return path.relative(rootDir, candidatePath).replaceAll("\\", "/");
}

function isPathOutsideRoot(rootDir, candidatePath) {
  const result = path.relative(rootDir, candidatePath);

  return result === ".." || result.startsWith(`..${path.sep}`) || path.isAbsolute(result);
}

function resolvesToEnvironmentFile(rootDir, candidatePath) {
  return relativePath(rootDir, candidatePath).toLowerCase() === ".env";
}

function isForbiddenHistoricalPath(rootDir, candidatePath) {
  const candidate = relativePath(rootDir, candidatePath).toLowerCase();
  const segments = candidate.split("/");

  return (
    candidate === "docs/operations" ||
    candidate.startsWith("docs/operations/") ||
    candidate === "docs/superpowers" ||
    candidate.startsWith("docs/superpowers/") ||
    candidate === "designs" ||
    candidate.startsWith("designs/") ||
    segments.some((segment) => segment.startsWith("audyt_")) ||
    segments.includes("changelog.txt") ||
    candidate === "docs/pattern-catalog.md" ||
    candidate === "docs/ux-ui-roadmap.md"
  );
}

function resolveExistingPath(candidatePath) {
  try {
    return { path: fs.realpathSync(candidatePath) };
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      return { missing: true };
    }

    return { error: true };
  }
}

function readFile(candidatePath) {
  try {
    return { contents: fs.readFileSync(candidatePath, "utf8") };
  } catch {
    return { error: true };
  }
}

function markdownLinks(contents) {
  const links = new Set();
  const inlineLinks = /!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+[^)]*)?\)/g;
  const referenceDefinitions = /^\s*\[(?!\^)[^\]]+]\s*:\s*(?:<([^>]+)>|(\S+))(?:\s+.*)?$/gm;

  for (const match of contents.matchAll(inlineLinks)) {
    links.add(match[1] || match[2]);
  }

  for (const match of contents.matchAll(referenceDefinitions)) {
    links.add(match[1] || match[2]);
  }

  return links;
}

function isIgnoredLink(link) {
  return /^(?:https?:|mailto:|#)/i.test(link);
}

function environmentAssignmentNames(contents) {
  return new Set(
    [...contents.matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)].map(
      (match) => match[1],
    ),
  );
}

function documentedUrls(contents) {
  return new Set(
    [...contents.matchAll(/https?:\/\/[^\s<>"'`(){}]+/g)].map((match) =>
      match[0].replace(/[.,;:!?]+$/, ""),
    ),
  );
}

function normalizedPolishText(contents) {
  return contents
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replaceAll("ł", "l");
}

function catalogPublicationContract(contents) {
  const normalizedContents = normalizedPolishText(contents);
  const heading =
    /^#{2,6}\s+[^\r\n]*publikacj[^\r\n]*(?:tresc[^\r\n]*katalog|katalog[^\r\n]*tresc)[^\r\n]*$/mu.exec(
      normalizedContents,
    );

  if (!heading) {
    return "";
  }

  const sectionRemainder = normalizedContents.slice(
    heading.index + heading[0].length,
  );
  const nextHeading = /^#{1,6}\s+/m.exec(sectionRemainder);

  return nextHeading
    ? sectionRemainder.slice(0, nextHeading.index)
    : sectionRemainder;
}

function catalogPublicationErrors(contents) {
  const contract = catalogPublicationContract(contents);
  const normalizedContract = contract.replace(/\s+/gu, " ").trim();
  const errors = [];
  const hasAll = (...fragments) =>
    fragments.every((fragment) => contract.includes(fragment));
  const canonicalProhibitedSourceMaterialRule =
    "nie publikujemy instrukcji, tlumaczen, diagramow, zdjec pdf ani dlugich cytatow.";
  const canonicalAffirmativeSourceMaterialRule =
    "publikujemy instrukcje, tlumaczenia, diagramy, zdjecia pdf i dlugie cytaty.";
  const prohibitedSourceMaterialRule =
    normalizedContract.includes(canonicalProhibitedSourceMaterialRule) &&
    !normalizedContract.includes(canonicalAffirmativeSourceMaterialRule);

  if (
    !/(?:wiarygodn\w*.{0,80}zrodl|zrodl\w*.{0,80}wiarygodn)/su.test(contract)
  ) {
    errors.push("Missing catalog publication rule: credible source");
  }

  if (!hasAll("krotk", "wlasn", "opis", "faktograficzn")) {
    errors.push(
      "Missing catalog publication rule: short original factual description",
    );
  }

  if (!prohibitedSourceMaterialRule) {
    errors.push("Missing catalog publication rule: prohibited source material");
  }

  if (
    !/(?:\bnie\b|bez|zakaz|niedozwol)[^.\n]{0,100}domysl/u.test(contract)
  ) {
    errors.push("Missing catalog publication rule: no guessing");
  }

  if (
    !/(?:niepewn\w*[^.\n]{0,100}ukryt\w*|ukryt\w*[^.\n]{0,100}niepewn\w*)/u.test(
      contract,
    )
  ) {
    errors.push("Missing catalog publication rule: uncertain records hidden");
  }

  return errors;
}

function checkDocumentation(rootDir) {
  const errors = [];
  const resolvedRootDir = path.resolve(rootDir);
  const root = resolveExistingPath(resolvedRootDir);

  if (!root.path) {
    return { errors: ["Unable to access documentation root"] };
  }

  const existingDocuments = [];

  for (const relativeDocumentPath of REQUIRED_DOCUMENTS) {
    const documentPath = path.join(resolvedRootDir, relativeDocumentPath);
    const document = resolveExistingPath(documentPath);

    if (document.missing) {
      errors.push(`Missing documentation file: ${relativeDocumentPath}`);
      continue;
    }

    if (document.error) {
      errors.push(`Unable to access documentation file: ${relativeDocumentPath}`);
      continue;
    }

    if (isPathOutsideRoot(root.path, document.path)) {
      errors.push(`Documentation file escapes repository root: ${relativeDocumentPath}`);
      continue;
    }

    if (resolvesToEnvironmentFile(root.path, document.path)) {
      errors.push(`Documentation file must not resolve to .env: ${relativeDocumentPath}`);
      continue;
    }

    const contents = readFile(document.path);

    if (contents.error) {
      errors.push(`Unable to read documentation file: ${relativeDocumentPath}`);
      continue;
    }

    existingDocuments.push({
      relativePath: relativeDocumentPath,
      documentPath,
      contents: contents.contents,
    });
  }

  for (const document of existingDocuments) {
    let hasForbiddenHistoricalReference = FORBIDDEN_HISTORICAL_REFERENCES.some(
      (reference) => document.contents.includes(reference),
    );

    for (const link of markdownLinks(document.contents)) {
      if (isIgnoredLink(link)) {
        continue;
      }

      const localPath = link.split("#", 1)[0];

      if (!localPath) {
        continue;
      }

      const targetPath = path.resolve(path.dirname(document.documentPath), localPath);

      if (isPathOutsideRoot(resolvedRootDir, targetPath)) {
        errors.push(`Documentation link escapes repository root: ${document.relativePath}`);
        continue;
      }

      if (isForbiddenHistoricalPath(resolvedRootDir, targetPath)) {
        hasForbiddenHistoricalReference = true;
      }

      const target = resolveExistingPath(targetPath);

      if (target.missing) {
        errors.push(`Broken documentation link: ${document.relativePath}`);
        continue;
      }

      if (target.error) {
        errors.push(`Unable to access documentation link: ${document.relativePath}`);
        continue;
      }

      if (isPathOutsideRoot(root.path, target.path)) {
        errors.push(`Documentation link escapes repository root: ${document.relativePath}`);
        continue;
      }

      if (resolvesToEnvironmentFile(root.path, target.path)) {
        errors.push(`Documentation link must not resolve to .env: ${document.relativePath}`);
        continue;
      }

      if (isForbiddenHistoricalPath(root.path, target.path)) {
        hasForbiddenHistoricalReference = true;
      }
    }

    if (hasForbiddenHistoricalReference) {
      errors.push(`Forbidden historical reference: ${document.relativePath}`);
    }
  }

  const specificationDocument = existingDocuments.find(
    (document) => document.relativePath === "SPEC.md",
  );

  if (specificationDocument) {
    errors.push(...catalogPublicationErrors(specificationDocument.contents));
  }

  const operationsDocument = existingDocuments.find(
    (document) => document.relativePath === "docs/OPERATIONS.md",
  );

  if (operationsDocument) {
    const operationsUrls = documentedUrls(operationsDocument.contents);

    for (const domain of REQUIRED_OPERATIONS_DOMAINS) {
      if (!operationsUrls.has(domain)) {
        errors.push(`Missing operations domain: ${domain}`);
      }
    }
  }

  const environmentExamplePath = path.join(resolvedRootDir, ".env.example");
  const environmentExample = resolveExistingPath(environmentExamplePath);
  let environmentNames = new Set();
  let shouldCheckEnvironmentKeys = true;

  if (environmentExample.error) {
    errors.push("Unable to read .env.example");
    shouldCheckEnvironmentKeys = false;
  } else if (environmentExample.path) {
    if (isPathOutsideRoot(root.path, environmentExample.path)) {
      errors.push("Environment example escapes repository root");
      shouldCheckEnvironmentKeys = false;
    } else if (resolvesToEnvironmentFile(root.path, environmentExample.path)) {
      errors.push("Environment example must not resolve to .env");
      shouldCheckEnvironmentKeys = false;
    } else {
      const contents = readFile(environmentExample.path);

      if (contents.error) {
        errors.push("Unable to read .env.example");
        shouldCheckEnvironmentKeys = false;
      } else {
        environmentNames = environmentAssignmentNames(contents.contents);
      }
    }
  }

  if (!environmentExample.error && !environmentExample.path) {
    environmentNames = new Set();
  }

  if (shouldCheckEnvironmentKeys) {
    for (const name of REQUIRED_ENVIRONMENT_KEYS) {
      if (!environmentNames.has(name)) {
        errors.push(`Missing .env.example key: ${name}`);
      }
    }

    for (const name of environmentNames) {
      if (!REQUIRED_ENVIRONMENT_KEYS.includes(name)) {
        errors.push(`Unexpected .env.example key: ${name}`);
      }
    }
  }

  return { errors };
}

module.exports = { checkDocumentation };
