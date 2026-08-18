const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const nodeFs = require("node:fs");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ENVIRONMENT_KEYS = [
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

const OPERATIONS_DOMAINS = [
  "https://www.staging.rysia.org",
  "https://staging.rysia.org",
  "https://www.rysia.org",
];

const SPEC_CATALOG_PUBLICATION_CONTRACT = `## Publikacja treści katalogu

Każdy rekord wymaga wiarygodnego źródła.
Publikujemy wyłącznie krótki, własny opis faktograficzny.
Nie publikujemy instrukcji, tłumaczeń, diagramów, zdjęć PDF ani długich cytatów.
Nie uzupełniamy braków domysłami.
Niepewne rekordy pozostają ukryte.
`;

async function createFixture({ files = {}, omittedFiles = [] } = {}) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "motek-docs-policy-"));
  const fixtureFiles = {
    "README.md": "# Motek\n",
    "SPEC.md": `# Specyfikacja\n\n${SPEC_CATALOG_PUBLICATION_CONTRACT}`,
    "docs/ARCHITECTURE.md": "# Architektura\n",
    "docs/QUALITY.md": "# Jakość\n",
    "docs/SECURITY.md": "# Bezpieczeństwo\n",
    "docs/OPERATIONS.md": `${OPERATIONS_DOMAINS.join("\n")}\n`,
    "docs/DESIGN-QA.md": "# Design QA\n",
    ".env.example": `${ENVIRONMENT_KEYS.map((name) => `${name}=`).join("\n")}\n`,
    ...files,
  };

  for (const omittedFile of omittedFiles) {
    delete fixtureFiles[omittedFile];
  }

  await Promise.all(
    Object.entries(fixtureFiles).map(async ([relativePath, contents]) => {
      const filePath = path.join(rootDir, relativePath);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, contents, "utf8");
    }),
  );

  return rootDir;
}

async function withFixture(options, run) {
  const rootDir = await createFixture(options);

  try {
    await run(rootDir);
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
}

async function withExternalFile(run) {
  const externalDir = await fs.mkdtemp(path.join(os.tmpdir(), "motek-docs-external-"));
  const externalFile = path.join(externalDir, "external.md");
  await fs.writeFile(externalFile, "# Zewnętrzny plik\n", "utf8");

  try {
    await run(externalFile);
  } finally {
    await fs.rm(externalDir, { recursive: true, force: true });
  }
}

async function createSymlinkOrSkip(t, targetPath, linkPath) {
  try {
    await fs.symlink(targetPath, linkPath, "file");
    return true;
  } catch (error) {
    if (error.code === "EACCES" || error.code === "EPERM") {
      t.skip(`Symlinki niedostępne bez wymaganych uprawnień (${error.code}).`);
      return false;
    }

    throw error;
  }
}

test("reports a missing required current document", async () => {
  await withFixture({ omittedFiles: ["docs/SECURITY.md"] }, async (rootDir) => {
    const { checkDocumentation } = require("../docs-policy.js");

    assert.deepEqual(checkDocumentation(rootDir).errors, [
      "Missing documentation file: docs/SECURITY.md",
    ]);
  });
});

test("reports a broken relative Markdown link", async () => {
  await withFixture(
    { files: { "README.md": "[Brak](docs/missing.md)\n" } },
    async (rootDir) => {
      const { checkDocumentation } = require("../docs-policy.js");

      assert.deepEqual(checkDocumentation(rootDir).errors, [
        "Broken documentation link: README.md",
      ]);
    },
  );
});

test("reports a Markdown link that escapes the repository root", async () => {
  await withFixture(
    { files: { "docs/QUALITY.md": "[Poza repozytorium](../../outside.md)\n" } },
    async (rootDir) => {
      const { checkDocumentation } = require("../docs-policy.js");

      assert.deepEqual(checkDocumentation(rootDir).errors, [
        "Documentation link escapes repository root: docs/QUALITY.md",
      ]);
    },
  );
});

test("reports a forbidden historical reference", async () => {
  await withFixture(
    {
      files: {
        "SPEC.md": `${SPEC_CATALOG_PUBLICATION_CONTRACT}\n[Plan](docs/superpowers/old-plan.md)\n`,
        "docs/superpowers/old-plan.md": "# Historyczny plan\n",
      },
    },
    async (rootDir) => {
      const { checkDocumentation } = require("../docs-policy.js");

      assert.deepEqual(checkDocumentation(rootDir).errors, [
        "Forbidden historical reference: SPEC.md",
      ]);
    },
  );
});

const INCOMPLETE_CATALOG_PUBLICATION_CONTRACTS = [
  {
    name: "wiarygodnego źródła",
    contents: SPEC_CATALOG_PUBLICATION_CONTRACT.replace(
      "Każdy rekord wymaga wiarygodnego źródła.\n",
      "",
    ),
    error: "Missing catalog publication rule: credible source",
  },
  {
    name: "krótkiego własnego opisu faktograficznego",
    contents: SPEC_CATALOG_PUBLICATION_CONTRACT.replace(
      "Publikujemy wyłącznie krótki, własny opis faktograficzny.\n",
      "Publikujemy podstawowe metadane.\n",
    ),
    error:
      "Missing catalog publication rule: short original factual description",
  },
  ...[
    ["instrukcji", "instrukcji, "],
    ["tłumaczeń", "tłumaczeń, "],
    ["diagramów", "diagramów, "],
    ["zdjęć PDF", "zdjęć PDF "],
    ["długich cytatów", "długich cytatów"],
  ].map(([name, fragment]) => ({
    name: `zakazu publikacji: ${name}`,
    contents: SPEC_CATALOG_PUBLICATION_CONTRACT.replace(fragment, ""),
    error: "Missing catalog publication rule: prohibited source material",
  })),
  {
    name: "zakazu uzupełniania domysłami",
    contents: SPEC_CATALOG_PUBLICATION_CONTRACT.replace(
      "Nie uzupełniamy braków domysłami.\n",
      "",
    ),
    error: "Missing catalog publication rule: no guessing",
  },
  {
    name: "ukrywania niepewnych rekordów",
    contents: SPEC_CATALOG_PUBLICATION_CONTRACT.replace(
      "Niepewne rekordy pozostają ukryte.\n",
      "",
    ),
    error: "Missing catalog publication rule: uncertain records hidden",
  },
];

for (const {
  name,
  contents,
  error,
} of INCOMPLETE_CATALOG_PUBLICATION_CONTRACTS) {
  test(`reports a missing catalog publication rule: ${name}`, async () => {
    await withFixture({ files: { "SPEC.md": contents } }, async (rootDir) => {
      const { checkDocumentation } = require("../docs-policy.js");

      assert.deepEqual(checkDocumentation(rootDir).errors, [error]);
    });
  });
}

test("rejects a catalog contract that explicitly allows prohibited source material", async () => {
  const invertedContract = SPEC_CATALOG_PUBLICATION_CONTRACT.replace(
    "Nie publikujemy instrukcji, tłumaczeń, diagramów, zdjęć PDF ani długich cytatów.",
    "Publikujemy instrukcje, tłumaczenia, diagramy, zdjęcia PDF i długie cytaty.",
  );

  await withFixture({ files: { "SPEC.md": invertedContract } }, async (rootDir) => {
    const { checkDocumentation } = require("../docs-policy.js");

    assert.deepEqual(checkDocumentation(rootDir).errors, [
      "Missing catalog publication rule: prohibited source material",
    ]);
  });
});

test("rejects an unrelated publication ban followed by the canonical affirmative list", async () => {
  const misleadingContract = SPEC_CATALOG_PUBLICATION_CONTRACT.replace(
    "Nie publikujemy instrukcji, tłumaczeń, diagramów, zdjęć PDF ani długich cytatów.",
    "Nie publikujemy podstawowych metadanych, ale publikujemy instrukcje, tłumaczenia, diagramy, zdjęcia PDF i długie cytaty.",
  );

  await withFixture({ files: { "SPEC.md": misleadingContract } }, async (rootDir) => {
    const { checkDocumentation } = require("../docs-policy.js");

    assert.deepEqual(checkDocumentation(rootDir).errors, [
      "Missing catalog publication rule: prohibited source material",
    ]);
  });
});

test("rejects the canonical ban accompanied by the canonical affirmative list", async () => {
  const contradictoryContract = `${SPEC_CATALOG_PUBLICATION_CONTRACT}
Publikujemy instrukcje, tłumaczenia, diagramy, zdjęcia PDF i długie cytaty.
`;

  await withFixture(
    { files: { "SPEC.md": contradictoryContract } },
    async (rootDir) => {
      const { checkDocumentation } = require("../docs-policy.js");

      assert.deepEqual(checkDocumentation(rootDir).errors, [
        "Missing catalog publication rule: prohibited source material",
      ]);
    },
  );
});

const HISTORICAL_LINK_FIXTURES = [
  ["operations/old.md", "docs/operations/old.md"],
  ["superpowers/old.md", "docs/superpowers/old.md"],
  ["../Designs/old.md", "Designs/old.md"],
  ["../AUDYT_SEC.md", "AUDYT_SEC.md"],
  ["../CHANGELOG.txt", "CHANGELOG.txt"],
  ["PATTERN-CATALOG.md", "docs/PATTERN-CATALOG.md"],
  ["UX-UI-ROADMAP.md", "docs/UX-UI-ROADMAP.md"],
];

for (const [link, target] of HISTORICAL_LINK_FIXTURES) {
  test(`reports a historical path resolved from ${link}`, async () => {
    await withFixture(
      {
        files: {
          "docs/QUALITY.md": `[Historia](${link})\n`,
          [target]: "# Historyczny plik\n",
        },
      },
      async (rootDir) => {
        const { checkDocumentation } = require("../docs-policy.js");

        assert.deepEqual(checkDocumentation(rootDir).errors, [
          "Forbidden historical reference: docs/QUALITY.md",
        ]);
      },
    );
  });
}

test("reports a broken reference Markdown link definition", async () => {
  await withFixture(
    {
      files: {
        "README.md": "[Brak][brak]\n\n[brak]: docs/missing.md\n",
      },
    },
    async (rootDir) => {
      const { checkDocumentation } = require("../docs-policy.js");

      assert.deepEqual(checkDocumentation(rootDir).errors, [
        "Broken documentation link: README.md",
      ]);
    },
  );
});

test("ignores a GFM footnote definition", async () => {
  await withFixture(
    {
      files: {
        "README.md": "Wskazówka[^1]\n\n[^1]: docs/missing.md\n",
      },
    },
    async (rootDir) => {
      const { checkDocumentation } = require("../docs-policy.js");

      assert.deepEqual(checkDocumentation(rootDir).errors, []);
    },
  );
});

for (const domain of OPERATIONS_DOMAINS) {
  test(`reports a missing required operations domain: ${domain}`, async () => {
    await withFixture(
      {
        files: {
          "docs/OPERATIONS.md": `${OPERATIONS_DOMAINS.filter((item) => item !== domain).join("\n")}\n`,
        },
      },
      async (rootDir) => {
        const { checkDocumentation } = require("../docs-policy.js");

        assert.deepEqual(checkDocumentation(rootDir).errors, [
          `Missing operations domain: ${domain}`,
        ]);
      },
    );
  });
}

test("reports a missing required .env.example key without exposing assignment values", async () => {
  await withFixture(
    {
      files: {
        ".env.example": `${ENVIRONMENT_KEYS.filter((name) => name !== "SUPABASE_SECRET_KEY")
          .map((name) => `${name}=safe-fixture-value`)
          .join("\n")}\n`,
      },
    },
    async (rootDir) => {
      const { checkDocumentation } = require("../docs-policy.js");

      assert.deepEqual(checkDocumentation(rootDir).errors, [
        "Missing .env.example key: SUPABASE_SECRET_KEY",
      ]);
    },
  );
});

test("reports an unexpected .env.example key", async () => {
  await withFixture(
    {
      files: {
        ".env.example": `${ENVIRONMENT_KEYS.map((name) => `${name}=`).join("\n")}\nEXTRA_KEY=\n`,
      },
    },
    async (rootDir) => {
      const { checkDocumentation } = require("../docs-policy.js");

      assert.deepEqual(checkDocumentation(rootDir).errors, [
        "Unexpected .env.example key: EXTRA_KEY",
      ]);
    },
  );
});

for (const name of ["debug_mode", "_INTERNAL"]) {
  test(`reports a shell-valid unexpected .env.example key: ${name}`, async () => {
    await withFixture(
      {
        files: {
          ".env.example": `${ENVIRONMENT_KEYS.map((key) => `${key}=`).join("\n")}\n${name}=\n`,
        },
      },
      async (rootDir) => {
        const { checkDocumentation } = require("../docs-policy.js");

        assert.deepEqual(checkDocumentation(rootDir).errors, [
          `Unexpected .env.example key: ${name}`,
        ]);
      },
    );
  });
}

test("does not accept a required domain as an evil URL suffix", async () => {
  await withFixture(
    {
      files: {
        "docs/OPERATIONS.md": `${OPERATIONS_DOMAINS.map((domain) =>
          domain === "https://www.staging.rysia.org" ? `${domain}.evil` : domain,
        ).join("\n")}\n`,
      },
    },
    async (rootDir) => {
      const { checkDocumentation } = require("../docs-policy.js");

      assert.deepEqual(checkDocumentation(rootDir).errors, [
        "Missing operations domain: https://www.staging.rysia.org",
      ]);
    },
  );
});

test("recognizes a required domain wrapped in Markdown code delimiters", async () => {
  await withFixture(
    {
      files: {
        "docs/OPERATIONS.md": `${OPERATIONS_DOMAINS.map((domain) => `\`${domain}\``).join("\n")}\n`,
      },
    },
    async (rootDir) => {
      const { checkDocumentation } = require("../docs-policy.js");

      assert.deepEqual(checkDocumentation(rootDir).errors, []);
    },
  );
});

test("returns a concise I/O error for an unreadable .env.example", async () => {
  await withFixture({}, async (rootDir) => {
    const environmentExamplePath = path.join(rootDir, ".env.example");
    await fs.rm(environmentExamplePath);
    await fs.mkdir(environmentExamplePath);
    const { checkDocumentation } = require("../docs-policy.js");

    assert.deepEqual(checkDocumentation(rootDir).errors, ["Unable to read .env.example"]);
  });
});

test("reports environment keys even when another documentation error is present", async () => {
  await withFixture(
    {
      files: { ".env.example": "" },
      omittedFiles: ["README.md"],
    },
    async (rootDir) => {
      const { checkDocumentation } = require("../docs-policy.js");

      assert.deepEqual(checkDocumentation(rootDir).errors, [
        "Missing documentation file: README.md",
        ...ENVIRONMENT_KEYS.map((name) => `Missing .env.example key: ${name}`),
      ]);
    },
  );
});

test("rejects a required document symlink outside the repository", async (t) => {
  await withExternalFile(async (externalFile) => {
    await withFixture({}, async (rootDir) => {
      const documentPath = path.join(rootDir, "docs", "SECURITY.md");
      await fs.rm(documentPath);
      if (!(await createSymlinkOrSkip(t, externalFile, documentPath))) {
        return;
      }

      const { checkDocumentation } = require("../docs-policy.js");

      assert.deepEqual(checkDocumentation(rootDir).errors, [
        "Documentation file escapes repository root: docs/SECURITY.md",
      ]);
    });
  });
});

test("rejects a documentation link symlink outside the repository", async (t) => {
  await withExternalFile(async (externalFile) => {
    await withFixture(
      { files: { "README.md": "[Zewnętrzny](linked.md)\n" } },
      async (rootDir) => {
        const linkPath = path.join(rootDir, "linked.md");
        if (!(await createSymlinkOrSkip(t, externalFile, linkPath))) {
          return;
        }

        const { checkDocumentation } = require("../docs-policy.js");

        assert.deepEqual(checkDocumentation(rootDir).errors, [
          "Documentation link escapes repository root: README.md",
        ]);
      },
    );
  });
});

test("rejects an .env.example symlink outside the repository", async (t) => {
  await withExternalFile(async (externalFile) => {
    await withFixture({}, async (rootDir) => {
      const environmentExamplePath = path.join(rootDir, ".env.example");
      await fs.rm(environmentExamplePath);
      if (!(await createSymlinkOrSkip(t, externalFile, environmentExamplePath))) {
        return;
      }

      const { checkDocumentation } = require("../docs-policy.js");

      assert.deepEqual(checkDocumentation(rootDir).errors, [
        "Environment example escapes repository root",
      ]);
    });
  });
});

test("rejects a documentation link to a fixture .env before opening the file", async () => {
  await withFixture(
    {
      files: {
        ".env": "fixture-only-value\n",
        "README.md": "[Środowisko](.env)\n",
      },
    },
    async (rootDir) => {
      const { checkDocumentation } = require("../docs-policy.js");
      const environmentPath = path.join(rootDir, ".env");
      const originalReadFileSync = nodeFs.readFileSync;
      let environmentRead = false;

      nodeFs.readFileSync = function readFileSync(filePath, ...args) {
        if (path.resolve(String(filePath)) === environmentPath) {
          environmentRead = true;
          throw new Error("Fixture .env must not be read");
        }

        return originalReadFileSync.call(this, filePath, ...args);
      };

      let result;

      try {
        result = checkDocumentation(rootDir);
      } finally {
        nodeFs.readFileSync = originalReadFileSync;
      }

      assert.equal(environmentRead, false);

      assert.deepEqual(result.errors, [
        "Documentation link must not resolve to .env: README.md",
      ]);
    },
  );
});

test("rejects a required document symlink to a fixture .env", async (t) => {
  await withFixture({ files: { ".env": "fixture-only-value\n" } }, async (rootDir) => {
    const documentPath = path.join(rootDir, "docs", "SECURITY.md");
    await fs.rm(documentPath);
    if (!(await createSymlinkOrSkip(t, path.join(rootDir, ".env"), documentPath))) {
      return;
    }

    const { checkDocumentation } = require("../docs-policy.js");

    assert.deepEqual(checkDocumentation(rootDir).errors, [
      "Documentation file must not resolve to .env: docs/SECURITY.md",
    ]);
  });
});

test("rejects an .env.example symlink to a fixture .env without reading it", async (t) => {
  await withFixture({ files: { ".env": "fixture-only-value\n" } }, async (rootDir) => {
    const environmentExamplePath = path.join(rootDir, ".env.example");
    await fs.rm(environmentExamplePath);
    if (!(await createSymlinkOrSkip(t, path.join(rootDir, ".env"), environmentExamplePath))) {
      return;
    }

    const { checkDocumentation } = require("../docs-policy.js");

    assert.deepEqual(checkDocumentation(rootDir).errors, [
      "Environment example must not resolve to .env",
    ]);
  });
});

test("accepts a complete fixture with anchored inline and reference Markdown links", async () => {
  await withFixture(
    {
      files: {
        "README.md": "[Architektura](docs/ARCHITECTURE.md#moduly)\n[Jakość][quality]\n\n[quality]: docs/QUALITY.md#bramki\n",
      },
    },
    async (rootDir) => {
    const { checkDocumentation } = require("../docs-policy.js");

    assert.deepEqual(checkDocumentation(rootDir).errors, []);
    },
  );
});

test("CLI exits successfully for a valid fixture", async () => {
  await withFixture({}, async (rootDir) => {
    const result = spawnSync(process.execPath, ["scripts/check-docs.js", rootDir], {
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
  });
});

test("CLI exits with an error for an invalid fixture", async () => {
  await withFixture({ omittedFiles: ["README.md"] }, async (rootDir) => {
    const result = spawnSync(process.execPath, ["scripts/check-docs.js", rootDir], {
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf8",
    });

    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), "Missing documentation file: README.md");
  });
});
