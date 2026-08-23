const path = require("node:path");
const { checkDocumentation } = require("../docs-policy.js");

const rootDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, "..");
const { errors } = checkDocumentation(rootDir);

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
}
