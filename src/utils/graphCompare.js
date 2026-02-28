/**
 * Order-independent molecular graph comparison.
 *
 * For each atom, compute a signature:
 *   label | sorted( neighborLabel:bondOrder:bondStyle, ... )
 *
 * Sort all signatures. Two graphs are equal if their sorted arrays match.
 * This ignores position, drawing order, and IDs.
 */

function buildSignatures(atoms, bonds) {
  const atomMap = new Map();
  atoms.forEach((a) => atomMap.set(a.id, a));

  // adjacency: atomId -> [{ neighborId, order, style }]
  const adj = new Map();
  atoms.forEach((a) => adj.set(a.id, []));

  bonds.forEach((b) => {
    const order = b.order ?? 1;
    const style = b.style ?? "solid";
    if (adj.has(b.from)) adj.get(b.from).push({ neighborId: b.to, order, style });
    if (adj.has(b.to)) adj.get(b.to).push({ neighborId: b.from, order, style });
  });

  const sigs = [];
  atoms.forEach((a) => {
    const neighbors = (adj.get(a.id) || [])
      .map((n) => {
        const neighbor = atomMap.get(n.neighborId);
        const label = neighbor ? neighbor.label : "?";
        return `${label}:${n.order}:${n.style}`;
      })
      .sort();
    sigs.push(`${a.label}|${neighbors.join(",")}`);
  });

  return sigs.sort();
}

export function graphsAreEqual(userAtoms, userBonds, answerAtoms, answerBonds) {
  if (!userAtoms || !answerAtoms) return false;
  if (userAtoms.length !== answerAtoms.length) return false;
  if ((userBonds?.length ?? 0) !== (answerBonds?.length ?? 0)) return false;

  const userSigs = buildSignatures(userAtoms, userBonds ?? []);
  const answerSigs = buildSignatures(answerAtoms, answerBonds ?? []);

  for (let i = 0; i < userSigs.length; i++) {
    if (userSigs[i] !== answerSigs[i]) return false;
  }
  return true;
}
