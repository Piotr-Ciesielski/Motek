const { maxMatchSearchNodes } = require("../limits");
const { ANY_MATERIAL, matchesMaterialRule } = require("../material-policy");

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

module.exports = {
  scorePattern,
  selectMatchingYarns,
};
