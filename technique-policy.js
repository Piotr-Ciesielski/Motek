(function exposeMotekTechniquePolicy(root, factory) {
  const policy = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = policy;
  }
  if (root) {
    root.MotekTechniquePolicy = policy;
  }
})(typeof globalThis === "object" ? globalThis : null, () => {
  const TECHNIQUES = Object.freeze(["knitting", "crochet"]);
  const TECHNIQUE_VALUES = new Set(TECHNIQUES);

  function isValidTechnique(value) {
    return typeof value === "string" && TECHNIQUE_VALUES.has(value);
  }

  function normalizePatternTechnique(value) {
    return isValidTechnique(value) ? value : null;
  }

  function parseTechniqueParam(value) {
    if (value === null || value === undefined) return undefined;
    if (!isValidTechnique(value)) {
      throw new Error("Parametr technique ma niedozwoloną wartość.");
    }
    return value;
  }

  function matchesPatternTechniqueFilter(pattern, technique) {
    return (
      !technique
      || technique === "all"
      || pattern?.technique === technique
    );
  }

  return {
    TECHNIQUES,
    isValidTechnique,
    normalizePatternTechnique,
    parseTechniqueParam,
    matchesPatternTechniqueFilter,
  };
});
