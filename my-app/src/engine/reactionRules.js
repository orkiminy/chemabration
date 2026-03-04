/**
 * reactionRules.js
 *
 * User-defined reaction rule engine.
 * Rules are stored in localStorage and applied deterministically — no API calls.
 *
 * Flow:
 *   1. User draws reactant + product in RuleBuilder → extractDelta() → saveRule()
 *   2. ReactionExplorer calls findRule(reagent) → applyRule() → {products, explanation}
 */

const STORAGE_KEY = 'ia3_reaction_rules';
const GRID_SPACING = 40;
const ROW_H = GRID_SPACING * Math.sin(Math.PI / 3); // ≈ 34.64

// ─── MOLECULE ANALYSIS ────────────────────────────────────────────────────────

/**
 * Find the double bond and return { c2Id (more-substituted), c3Id (less-substituted) }.
 */
function analyzeMolecule(atoms, bonds) {
  const doubleBond = bonds.find(b => b.order >= 2);
  if (!doubleBond) return null;

  const fromId = doubleBond.from;
  const toId = doubleBond.to;

  const subs1 = bonds.filter(b => b.id !== doubleBond.id && (b.from === fromId || b.to === fromId)).length;
  const subs2 = bonds.filter(b => b.id !== doubleBond.id && (b.from === toId || b.to === toId)).length;

  return subs1 >= subs2
    ? { c2Id: fromId, c3Id: toId }
    : { c2Id: toId, c3Id: fromId };
}

// ─── POSITION HELPER ──────────────────────────────────────────────────────────

/**
 * Find the first unoccupied hexagonal grid neighbor of a given atom.
 */
function findOpenNeighbor(atomId, allAtoms) {
  const atom = allAtoms.find(a => a.id === atomId);
  if (!atom) return { x: 100, y: 100 };

  const candidates = [
    { x: atom.x + GRID_SPACING, y: atom.y },
    { x: atom.x - GRID_SPACING, y: atom.y },
    { x: atom.x + 20, y: atom.y + ROW_H },
    { x: atom.x - 20, y: atom.y + ROW_H },
    { x: atom.x + 20, y: atom.y - ROW_H },
    { x: atom.x - 20, y: atom.y - ROW_H },
  ];

  const occupied = new Set(allAtoms.map(a => `${Math.round(a.x)},${Math.round(a.y)}`));

  for (const pos of candidates) {
    const key = `${Math.round(pos.x)},${Math.round(pos.y)}`;
    if (!occupied.has(key) && pos.x >= 0 && pos.y >= 0) return pos;
  }

  return { x: atom.x + GRID_SPACING, y: atom.y + GRID_SPACING };
}

// ─── RULE EXTRACTION ──────────────────────────────────────────────────────────

/**
 * Compare the left (reactant) and right (product) canvases to extract the
 * transformation delta. The right canvas must be a copy of the left with
 * atom IDs preserved — new atoms in the right have new IDs.
 *
 * @returns {Object|null} delta — describes what changed
 */
export function extractDelta(leftAtoms, leftBonds, rightAtoms, rightBonds) {
  const leftIds = new Set(leftAtoms.map(a => a.id));

  const analysis = analyzeMolecule(leftAtoms, leftBonds);
  if (!analysis) return null;

  const { c2Id, c3Id } = analysis;

  // Atoms only in the right canvas (newly drawn additions)
  const addedAtoms = rightAtoms.filter(a => !leftIds.has(a.id));

  const addAtC2 = [];
  const addAtC3 = [];

  addedAtoms.forEach(atom => {
    rightBonds
      .filter(b => b.from === atom.id || b.to === atom.id)
      .forEach(bond => {
        const neighborId = bond.from === atom.id ? bond.to : bond.from;
        if (neighborId === c2Id) addAtC2.push({ label: atom.label || 'C' });
        else if (neighborId === c3Id) addAtC3.push({ label: atom.label || 'C' });
      });
  });

  // Check if C2-C3 bond still exists in the right canvas (and its new order)
  const rightC2C3Bond = rightBonds.find(b =>
    (b.from === c2Id && b.to === c3Id) || (b.from === c3Id && b.to === c2Id)
  );

  const isCleaved = !rightC2C3Bond;

  return {
    type: isCleaved ? 'cleavage' : 'addition',
    addAtC2,
    addAtC3,
    newBondOrder: isCleaved ? null : (rightC2C3Bond ? rightC2C3Bond.order : 1),
  };
}

// ─── X-WILDCARD HELPERS ───────────────────────────────────────────────────────

const HALOGENS = ['Br', 'Cl', 'F', 'I'];

/**
 * Extract the specific halogen from a reagent string (e.g. "HBr" → "Br").
 */
function extractHalogen(reagentStr) {
  const s = reagentStr.toLowerCase();
  if (s.includes('br')) return 'Br';
  if (s.includes('cl')) return 'Cl';
  if (s.includes('fl') || s.match(/\bhf\b/) || s.includes('f2')) return 'F';
  if (s.includes('i2') || s.match(/\bhi\b/)) return 'I';
  return null;
}

/**
 * Check if storedReagent (which contains "X") matches inputReagent by
 * substituting each halogen for X and comparing.
 */
function xWildcardMatches(storedReagent, inputReagent) {
  const stored = storedReagent.toLowerCase().replace(/\s+/g, '');
  if (!stored.includes('x')) return false;
  const input = inputReagent.toLowerCase().replace(/\s+/g, '');
  return HALOGENS.some(hal => {
    const substituted = stored.replace(/x/gi, hal.toLowerCase());
    return substituted === input || substituted.includes(input) || input.includes(substituted);
  });
}

// ─── RULE APPLICATION ─────────────────────────────────────────────────────────

/**
 * Apply a stored rule delta to a drawn molecule.
 * delta.resolvedX (set by findRule) substitutes any 'X' labels in additions.
 *
 * @param {Array}  atoms  - source molecule atoms
 * @param {Array}  bonds  - source molecule bonds
 * @param {Object} delta  - rule object returned by findRule (includes resolvedX)
 * @returns {{ products: Array<{atoms, bonds}>, explanation: string } | null}
 */
export function applyRule(atoms, bonds, delta) {
  const analysis = analyzeMolecule(atoms, bonds);
  if (!analysis) return null;

  const { c2Id, c3Id } = analysis;
  const resolvedX = delta.resolvedX || null;

  // Resolve 'X' to the actual halogen from the reagent (e.g. X → Br)
  const resolveLabel = (label) => (label === 'X' && resolvedX) ? resolvedX : label;

  const clonedAtoms = atoms.map(a => ({ ...a }));
  const clonedBonds = bonds.map(b => ({ ...b }));

  let idCounter = Date.now();

  // Add atoms at C2
  (delta.addAtC2 || []).forEach(({ label }) => {
    const newId = idCounter++;
    const pos = findOpenNeighbor(c2Id, clonedAtoms);
    clonedAtoms.push({ id: newId, label: resolveLabel(label), x: pos.x, y: pos.y });
    clonedBonds.push({ id: idCounter++, from: c2Id, to: newId, order: 1, style: 'solid' });
  });

  // Add atoms at C3
  (delta.addAtC3 || []).forEach(({ label }) => {
    const newId = idCounter++;
    const pos = findOpenNeighbor(c3Id, clonedAtoms);
    clonedAtoms.push({ id: newId, label: resolveLabel(label), x: pos.x, y: pos.y });
    clonedBonds.push({ id: idCounter++, from: c3Id, to: newId, order: 1, style: 'solid' });
  });

  if (delta.type === 'cleavage') {
    // Remove the C2-C3 bond
    const idx = clonedBonds.findIndex(b =>
      (b.from === c2Id && b.to === c3Id) || (b.from === c3Id && b.to === c2Id)
    );
    if (idx >= 0) clonedBonds.splice(idx, 1);

    // BFS from C2 to find its connected fragment
    const adj = new Map(clonedAtoms.map(a => [a.id, []]));
    clonedBonds.forEach(b => {
      adj.get(b.from)?.push(b.to);
      adj.get(b.to)?.push(b.from);
    });

    const frag1 = new Set();
    const queue = [c2Id];
    frag1.add(c2Id);
    while (queue.length) {
      const cur = queue.shift();
      for (const n of (adj.get(cur) || [])) {
        if (!frag1.has(n)) { frag1.add(n); queue.push(n); }
      }
    }

    const frag2 = new Set(clonedAtoms.map(a => a.id).filter(id => !frag1.has(id)));

    return {
      products: [
        {
          atoms: clonedAtoms.filter(a => frag1.has(a.id)),
          bonds: clonedBonds.filter(b => frag1.has(b.from) && frag1.has(b.to)),
        },
        {
          atoms: clonedAtoms.filter(a => frag2.has(a.id)),
          bonds: clonedBonds.filter(b => frag2.has(b.from) && frag2.has(b.to)),
        },
      ],
      explanation: delta.explanation || '',
    };
  }

  // Addition: update the C2=C3 bond order
  if (delta.newBondOrder !== null && delta.newBondOrder !== undefined) {
    const bond = clonedBonds.find(b =>
      (b.from === c2Id && b.to === c3Id) || (b.from === c3Id && b.to === c2Id)
    );
    if (bond) bond.order = delta.newBondOrder;
  }

  return {
    products: [{ atoms: clonedAtoms, bonds: clonedBonds }],
    explanation: delta.explanation || '',
  };
}

// ─── STORAGE ──────────────────────────────────────────────────────────────────

export function saveRule(ruleData) {
  const rules = loadRules();
  rules.push(ruleData);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

export function loadRules() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function deleteRule(index) {
  const rules = loadRules();
  rules.splice(index, 1);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

/**
 * Find a saved rule matching the given reagent string (case-insensitive, whitespace-insensitive).
 * Also handles X wildcard (e.g., stored "HX" matches input "HBr").
 * Returns the full rule object with `resolvedX` attached, or null.
 */
export function findRule(reagentStr) {
  const rules = loadRules();
  const lower = reagentStr.toLowerCase().replace(/\s+/g, '');

  // Exact / substring match first
  const exact = rules.find(r => {
    const rLower = (r.reagent || '').toLowerCase().replace(/\s+/g, '');
    return rLower === lower || lower.includes(rLower) || rLower.includes(lower);
  });
  if (exact) return { ...exact, resolvedX: extractHalogen(reagentStr) };

  // X-wildcard match (e.g., stored "HX" matches "HBr")
  const wildcard = rules.find(r => xWildcardMatches(r.reagent || '', reagentStr));
  if (wildcard) return { ...wildcard, resolvedX: extractHalogen(reagentStr) };

  return null;
}
