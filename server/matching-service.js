const { diagnoseVariant, matchVariant } = require("../matching-policy");

function evaluateMatchingVariants(variants, yarns, matcher = matchVariant) {
  let limited = false;
  const matches = [];

  for (const variant of variants) {
    try {
      const outcome = matcher(variant, yarns);
      if (outcome.doable) matches.push({ variant, outcome });
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      limited = true;
    }
  }

  return { matches, limited };
}

const SOFT_DIAGNOSTIC_REASONS = new Set([
  "QUANTITY",
  "COLOR",
  "SKEIN_COUNT",
  "STRAND_COUNT",
  "DISTINCT_COLORS",
]);

function diagnosticRank(outcome) {
  return outcome.reasons.reduce((rank, reason) => {
    if (!SOFT_DIAGNOSTIC_REASONS.has(reason.code)) {
      rank.hardCount += 1;
      return rank;
    }
    const required = Number(reason.required);
    const available = Number(reason.available);
    const shortage = Number.isFinite(required) && required > 0
      ? Math.max(0, Math.min(1, (required - available) / required))
      : 1;
    rank.softShortage += shortage;
    rank.softCount += 1;
    return rank;
  }, { hardCount: 0, softShortage: 0, softCount: 0 });
}

function compareDiagnosticRanks(left, right) {
  return left.hardCount - right.hardCount
    || left.softShortage - right.softShortage
    || left.softCount - right.softCount;
}

function isCloserDiagnostic(candidate, current) {
  if (current === null) return true;
  const candidatePossible = candidate.outcome.status === "possible_unknown_material";
  const currentPossible = current.outcome.status === "possible_unknown_material";
  if (candidatePossible !== currentPossible) return candidatePossible;
  return compareDiagnosticRanks(
    diagnosticRank(candidate.outcome),
    diagnosticRank(current.outcome),
  ) < 0;
}

function evaluateMatchingVariantsWithDiagnostics(
  variants,
  yarns,
  { matcher = matchVariant, diagnostician = diagnoseVariant } = {},
) {
  let limited = false;
  const matches = [];
  let diagnostic = null;

  for (const variant of variants) {
    try {
      const strictOutcome = matcher(variant, yarns);
      if (strictOutcome.doable) {
        matches.push({ variant, outcome: strictOutcome });
        continue;
      }

      const outcome = diagnostician(variant, yarns, { strictOutcome });
      if (outcome.status === "full_match") {
        matches.push({ variant, outcome });
        continue;
      }
      const candidate = { variant, outcome };
      if (isCloserDiagnostic(candidate, diagnostic)) diagnostic = candidate;
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      limited = true;
    }
  }

  return { matches, diagnostic, limited };
}

module.exports = {
  evaluateMatchingVariantsWithDiagnostics,
  evaluateMatchingVariants,
};
