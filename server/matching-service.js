const { maxMatchSearchNodes } = require("../limits");
const { ANY_MATERIAL, matchesMaterialRule } = require("../material-policy");
const { diagnoseVariant, matchVariant } = require("../matching-policy");

class MatchingComplexityError extends RangeError {
  constructor() {
    super("Dopasowanie jest zbyt złożone. Zmniejsz magazyn lub wybierz prostszy wzór.");
    this.status = 503;
  }
}

function yarnMatchesLegacyMaterials(yarn, materials) {
  if (materials.includes(ANY_MATERIAL)) {
    return Array.isArray(yarn.materials) && yarn.materials.length > 0;
  }
  return matchesMaterialRule(yarn.materials, {
    material_match: "any",
    materials,
  });
}

function scorePattern(pattern, yarns) {
  if (Array.isArray(pattern.requirements) && pattern.requirements.length > 0) {
    const allocation = allocateRequirementYarns(pattern.requirements, yarns);
    if (!allocation) {
      return {
        total: 0,
        doable: false,
        totalLength: 0,
        totalWeight: 0,
        matchedYarns: 0,
      };
    }

    const requiredLength = pattern.requirements.reduce(
      (sum, requirement) => sum + requirement.metersNeeded,
      0,
    );
    const requiredWeight = pattern.requirements.reduce(
      (sum, requirement) => sum + requirement.gramsNeeded,
      0,
    );
    const totalLength = allocation.flat().reduce((sum, yarn) => sum + yarn.length, 0);
    const totalWeight = allocation.flat().reduce((sum, yarn) => sum + yarn.weight, 0);
    const lengthScore = Math.min(totalLength / requiredLength, 1);
    const weightScore = Math.min(totalWeight / requiredWeight, 1);
    const total = Math.round(lengthScore * 40 + weightScore * 25 + 25 + 10);

    return {
      total,
      doable: true,
      totalLength,
      totalWeight,
      matchedYarns: allocation.flat().length,
    };
  }

  const materials = Array.isArray(pattern.materials) ? pattern.materials : [];
  const weightClasses = Array.isArray(pattern.weightClasses) ? pattern.weightClasses : [];
  const totalLength = yarns.reduce((sum, yarn) => sum + yarn.length, 0);
  const totalWeight = yarns.reduce((sum, yarn) => sum + yarn.weight, 0);
  const matchedYarns = yarns.filter(
    (yarn) => yarnMatchesLegacyMaterials(yarn, materials)
      && weightClasses.includes(yarn.weightClass),
  ).length;
  const lengthScore = Math.min(totalLength / pattern.metersNeeded, 1);
  const weightScore = Math.min(totalWeight / pattern.gramsNeeded, 1);
  const materialScore = Math.min(matchedYarns / pattern.yarnsNeeded, 1);
  const colorScore = pattern.colors === "dowolny" ? 1 : 0.8;
  const total = Math.round(lengthScore * 40 + weightScore * 25 + materialScore * 25 + colorScore * 10);
  const doable = totalLength >= pattern.metersNeeded
    && totalWeight >= pattern.gramsNeeded
    && matchedYarns >= pattern.yarnsNeeded;
  return { total, doable, totalLength, totalWeight, matchedYarns };
}

function allocateRequirementYarns(requirements, yarns) {
  for (const requirement of requirements) {
    const eligible = yarns.filter(
      (yarn) => yarnMatchesLegacyMaterials(yarn, requirement.materials)
        && requirement.weightClasses.includes(yarn.weightClass),
    );
    const availableLength = eligible.reduce((sum, yarn) => sum + yarn.length, 0);
    const availableWeight = eligible.reduce((sum, yarn) => sum + yarn.weight, 0);

    if (eligible.length < requirement.yarnsNeeded
      || availableLength < requirement.metersNeeded
      || availableWeight < requirement.gramsNeeded) {
      return null;
    }
  }

  let searchNodes = 0;

  function visit() {
    searchNodes += 1;
    if (searchNodes > maxMatchSearchNodes) throw new MatchingComplexityError();
  }

  function choose(index, used, allocation) {
    visit();
    if (index === requirements.length) return allocation;

    const requirement = requirements[index];
    const eligible = yarns.filter(
      (yarn, yarnIndex) => !used.has(yarnIndex)
        && yarnMatchesLegacyMaterials(yarn, requirement.materials)
        && requirement.weightClasses.includes(yarn.weightClass),
    );

    const remainingLength = new Array(eligible.length + 1).fill(0);
    const remainingWeight = new Array(eligible.length + 1).fill(0);
    for (let candidate = eligible.length - 1; candidate >= 0; candidate -= 1) {
      remainingLength[candidate] = remainingLength[candidate + 1] + eligible[candidate].length;
      remainingWeight[candidate] = remainingWeight[candidate + 1] + eligible[candidate].weight;
    }

    function chooseGroup(start, group, length, weight) {
      visit();
      if (group.length + eligible.length - start < requirement.yarnsNeeded
        || length + remainingLength[start] < requirement.metersNeeded
        || weight + remainingWeight[start] < requirement.gramsNeeded) {
        return null;
      }
      if (group.length >= requirement.yarnsNeeded
        && length >= requirement.metersNeeded
        && weight >= requirement.gramsNeeded) {
        const nextUsed = new Set(used);
        group.forEach((yarn) => nextUsed.add(yarns.indexOf(yarn)));
        const result = choose(index + 1, nextUsed, [...allocation, group]);
        if (result) return result;
      }

      for (let candidate = start; candidate < eligible.length; candidate += 1) {
        const result = chooseGroup(
          candidate + 1,
          [...group, eligible[candidate]],
          length + eligible[candidate].length,
          weight + eligible[candidate].weight,
        );
        if (result) return result;
      }
      return null;
    }

    return chooseGroup(0, [], 0, 0);
  }

  return choose(0, new Set(), []);
}

function selectMatchingYarns(pattern, yarns) {
  const requirements = Array.isArray(pattern.requirements) && pattern.requirements.length > 0
    ? pattern.requirements
    : [{
        yarnsNeeded: pattern.yarnsNeeded,
        metersNeeded: pattern.metersNeeded,
        gramsNeeded: pattern.gramsNeeded,
        materials: pattern.materials,
        weightClasses: pattern.weightClasses,
      }];
  const eligible = yarns.filter((yarn) => requirements.some(
    (requirement) => yarnMatchesLegacyMaterials(yarn, requirement.materials)
      && requirement.weightClasses.includes(yarn.weightClass),
  ));

  return { yarns: eligible, limited: false };
}

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
  scorePattern,
  selectMatchingYarns,
};
