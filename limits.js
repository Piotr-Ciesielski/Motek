const LIMITS = Object.freeze({
  maxYarnsPerUser: 500,
  maxPatternCatalogRecords: 300,
  maxMatchingVariantsPerPattern: 250,
  maxMatchingRoleRequirements: 8,
  maxMatchingTextLength: 100,
  maxMatchSearchNodes: 25_000,
});

module.exports = LIMITS;
