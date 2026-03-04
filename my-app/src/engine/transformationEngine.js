/**
 * transformationEngine.js
 *
 * Pure JavaScript — no React, no imports outside this module and reactionDescriptors.
 *
 * Takes existing atoms/bonds + a reaction descriptor and returns an array of
 * product structures (one per enantiomer).  Coordinates are irrelevant for
 * checkIsomorphism, so new atoms are placed outward from the ring centroid.
 * SetCanvas auto-centers and snaps to grid anyway.
 */

import { REACTION_DESCRIPTORS } from './reactionDescriptors.js';
import { reactionLevels } from '../data/reactionLevels.js';

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply a reaction to a starting material using a levelId from reactionLevels.
 *
 * @param {number}   levelId  - reaction ID from reactionLevels
 * @param {Array}    atoms    - starting material atoms
 * @param {Array}    bonds    - starting material bonds
 * @returns {Array}  Array of { atoms, bonds } objects, one per enantiomer.
 */
export function applyReaction(levelId, atoms, bonds) {
  const descriptor = REACTION_DESCRIPTORS[levelId];
  if (!descriptor) return [];

  // "lookup" reactions use stored solution data directly (non-standard scaffold)
  if (descriptor.type === 'lookup') {
    const level = reactionLevels.find(l => l.id === levelId);
    if (!level) return [];
    if (level.multiStep) {
      // Return step 1 solution for multi-step reactions
      return level.steps[0].solutions;
    }
    return level.solutions || [];
  }

  const doubleBond = bonds.find(b => b.order >= 2);
  if (!doubleBond) return [];

  const { c2Id, c3Id, methylBondId } = analyzeScaffold(atoms, bonds, doubleBond);

  return descriptor.enantiomers.map(enantiomer =>
    buildProduct(atoms, bonds, enantiomer, descriptor.type, doubleBond, c2Id, c3Id, methylBondId)
  );
}

/**
 * Apply a raw descriptor object to a starting material.
 * Use this when the descriptor comes from Claude (or any external source)
 * rather than from the hardcoded REACTION_DESCRIPTORS map.
 *
 * @param {Array}   atoms      - starting material atoms
 * @param {Array}   bonds      - starting material bonds
 * @param {Object}  descriptor - descriptor in the same format as REACTION_DESCRIPTORS values
 * @returns {Array} Array of { atoms, bonds } objects, one per enantiomer.
 */
export function applyDescriptor(atoms, bonds, descriptor) {
  if (!descriptor || !descriptor.enantiomers) return [];

  const doubleBond = bonds.find(b => b.order >= 2);
  if (!doubleBond) return [];

  const { c2Id, c3Id, methylBondId } = analyzeScaffold(atoms, bonds, doubleBond);

  return descriptor.enantiomers.map(enantiomer =>
    buildProduct(atoms, bonds, enantiomer, descriptor.type || 'standard', doubleBond, c2Id, c3Id, methylBondId)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scaffold Analysis
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Identify c2 (more-substituted carbon), c3 (less-substituted), and the
 * methyl bond ID from the double bond.
 */
function analyzeScaffold(atoms, bonds, doubleBond) {
  const c2Id = findMoreSubstitutedCarbon(atoms, bonds, doubleBond);
  const c3Id = doubleBond.from === c2Id ? doubleBond.to : doubleBond.from;
  const methylBondId = findTerminalSubstituentBond(atoms, bonds, c2Id, c3Id, doubleBond.id);
  return { c2Id, c3Id, methylBondId };
}

/**
 * Returns the atom ID of the more-substituted carbon in the double bond.
 * "More substituted" = more non-H neighbors (excluding the other double-bond carbon).
 */
function findMoreSubstitutedCarbon(atoms, bonds, doubleBond) {
  const ids = [doubleBond.from, doubleBond.to];

  const countSubstituents = (atomId) => {
    const otherId = atomId === doubleBond.from ? doubleBond.to : doubleBond.from;
    return bonds.filter(b => {
      const neighborId = b.from === atomId ? b.to : b.to === atomId ? b.from : null;
      if (neighborId === null || neighborId === otherId) return false;
      const neighbor = atoms.find(a => a.id === neighborId);
      if (!neighbor) return false;
      const lbl = (neighbor.label || 'C').trim();
      return lbl !== 'H';
    }).length;
  };

  const [s0, s1] = ids.map(countSubstituents);
  return s0 >= s1 ? ids[0] : ids[1];
}

/**
 * Returns the bond ID of the terminal substituent attached to c2Id
 * (the methyl group in the standard scaffold).
 * A terminal atom has exactly one bond (the bond to c2Id).
 */
function findTerminalSubstituentBond(atoms, bonds, c2Id, c3Id, doubleBondId) {
  for (const bond of bonds) {
    if (bond.id === doubleBondId) continue;
    const neighborId = bond.from === c2Id ? bond.to : bond.to === c2Id ? bond.from : null;
    if (neighborId === null || neighborId === c3Id) continue;

    // Terminal = degree 1 (only connected to c2Id)
    const degree = bonds.filter(b => b.from === neighborId || b.to === neighborId).length;
    if (degree === 1) return bond.id;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Construction
// ─────────────────────────────────────────────────────────────────────────────

function buildProduct(atoms, bonds, enantiomer, type, doubleBond, c2Id, c3Id, methylBondId) {
  const maxAtomId = Math.max(...atoms.map(a => a.id));
  const maxBondId = Math.max(...bonds.map(b => b.id));

  const c2 = atoms.find(a => a.id === c2Id);
  const c3 = atoms.find(a => a.id === c3Id);

  // Build new bonds array: update double bond and methyl style
  const newBonds = bonds.map(b => {
    if (b.id === doubleBond.id) return { ...b, order: 1 };
    if (b.id === methylBondId && enantiomer.methylStyle !== undefined) {
      return { ...b, style: enantiomer.methylStyle };
    }
    return b;
  });

  const newAtoms = [...atoms];

  if (type === 'bridge') {
    // Epoxidation / Cyclopropanation: one bridging atom bonded to BOTH c2 and c3
    const midPos = midpoint(c2, c3);
    const bridgePos = pushOutward(midPos, computeCentroid(atoms));
    const bridgeAtom = { id: maxAtomId + 1, x: bridgePos.x, y: bridgePos.y, label: enantiomer.bridge.label };
    newAtoms.push(bridgeAtom);
    newBonds.push(
      { id: maxBondId + 1, from: c2Id, to: bridgeAtom.id, order: 1, style: enantiomer.bridge.style },
      { id: maxBondId + 2, from: c3Id, to: bridgeAtom.id, order: 1, style: enantiomer.bridge.style }
    );
  } else {
    // Standard two-atom addition
    const posC2 = pushOutward(c2, computeCentroid(atoms));
    const posC3 = pushOutward(c3, computeCentroid(atoms));

    const newAtomC2 = { id: maxAtomId + 1, x: posC2.x, y: posC2.y, label: enantiomer.atomAtC2.label };
    const newAtomC3 = { id: maxAtomId + 2, x: posC3.x, y: posC3.y, label: enantiomer.atomAtC3.label };
    newAtoms.push(newAtomC2, newAtomC3);
    newBonds.push(
      { id: maxBondId + 1, from: c2Id, to: newAtomC2.id, order: 1, style: enantiomer.atomAtC2.style },
      { id: maxBondId + 2, from: c3Id, to: newAtomC3.id, order: 1, style: enantiomer.atomAtC3.style }
    );

    // Q9 extra atom (CH3 bonded to the O at c2)
    if (enantiomer.extraAtoms) {
      enantiomer.extraAtoms.forEach((extra, i) => {
        const attachId = extra.attachToLabel
          ? newAtoms.find(a => a.label === extra.attachToLabel && a.id > maxAtomId)?.id
          : null;
        if (attachId == null) return;
        const attachAtom = newAtoms.find(a => a.id === attachId);
        const extraPos = pushOutward(attachAtom, c2);
        const extraAtom = { id: maxAtomId + 3 + i, x: extraPos.x, y: extraPos.y, label: extra.label };
        newAtoms.push(extraAtom);
        newBonds.push({ id: maxBondId + 3 + i, from: attachId, to: extraAtom.id, order: 1, style: extra.style });
      });
    }
  }

  return { atoms: newAtoms, bonds: newBonds };
}

// ─────────────────────────────────────────────────────────────────────────────
// Geometry Helpers
// ─────────────────────────────────────────────────────────────────────────────

function computeCentroid(atoms) {
  const n = atoms.length || 1;
  return {
    x: atoms.reduce((s, a) => s + a.x, 0) / n,
    y: atoms.reduce((s, a) => s + a.y, 0) / n,
  };
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph Layout — places atoms with no coordinates onto the hex grid
// ─────────────────────────────────────────────────────────────────────────────

const HEX_DIRS = [
  { dx: 60,  dy: 0   },  // right
  { dx: 30,  dy: -52 },  // upper-right
  { dx: -30, dy: -52 },  // upper-left
  { dx: -60, dy: 0   },  // left
  { dx: -30, dy: 52  },  // lower-left
  { dx: 30,  dy: 52  },  // lower-right
];

/**
 * Assign (x, y) coordinates to atoms that lack them using BFS over the bond graph.
 * SetCanvas will auto-center and snap to the nearest hex grid point anyway.
 *
 * @param {Array} atoms - atoms, may lack x/y
 * @param {Array} bonds - bonds connecting them
 * @returns {Array} atoms with x, y set
 */
export function layoutMolecule(atoms, bonds) {
  if (atoms.length === 0) return atoms;
  const positions = {};
  const usedPositions = new Set();

  const posKey = (x, y) => `${Math.round(x)},${Math.round(y)}`;

  // Start first atom at origin
  positions[atoms[0].id] = { x: 0, y: 0 };
  usedPositions.add(posKey(0, 0));

  const queue = [atoms[0].id];
  const visited = new Set([atoms[0].id]);

  while (queue.length > 0) {
    const atomId = queue.shift();
    const { x, y } = positions[atomId];

    const neighbors = bonds
      .filter(b => b.from === atomId || b.to === atomId)
      .map(b => b.from === atomId ? b.to : b.from)
      .filter(id => !visited.has(id));

    let dirIndex = 0;
    for (const neighborId of neighbors) {
      // Find the next available direction that doesn't collide
      while (dirIndex < HEX_DIRS.length) {
        const { dx, dy } = HEX_DIRS[dirIndex];
        const nx = x + dx;
        const ny = y + dy;
        dirIndex++;
        if (!usedPositions.has(posKey(nx, ny))) {
          positions[neighborId] = { x: nx, y: ny };
          usedPositions.add(posKey(nx, ny));
          break;
        }
      }
      // Fallback: if all directions tried, just offset slightly
      if (!positions[neighborId]) {
        positions[neighborId] = { x: x + 60, y: y + (Object.keys(positions).length * 10) };
      }
      visited.add(neighborId);
      queue.push(neighborId);
    }
  }

  return atoms.map(a => ({
    ...a,
    x: positions[a.id]?.x ?? 0,
    y: positions[a.id]?.y ?? 0,
  }));
}

/** Push a point outward from the centroid by one bond length (~60px). */
function pushOutward(point, centroid) {
  const BOND_LEN = 60;
  const dx = point.x - centroid.x;
  const dy = point.y - centroid.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return {
    x: point.x + (dx / len) * BOND_LEN,
    y: point.y + (dy / len) * BOND_LEN,
  };
}
