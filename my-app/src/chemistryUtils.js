/**
 * chemistryUtils.js
 * Updated to strictly check for Bond Style (Solid vs Striped)
 */

function buildGraph(atoms, bonds) {
  const adjList = new Map();

  // Initialize atoms
  atoms.forEach(atom => {
    adjList.set(atom.id, {
      label: atom.label || "C", 
      connections: []
    });
  });

  // Add connections
  bonds.forEach(bond => {
    const fromNode = adjList.get(bond.from);
    const toNode = adjList.get(bond.to);
    
    // Default to "solid" if undefined so we don't crash on older data
    const style = bond.style || "solid"; 

    if (fromNode && toNode) {
      fromNode.connections.push({ 
        neighborId: bond.to, 
        order: bond.order, 
        style: style 
      });
      toNode.connections.push({ 
        neighborId: bond.from, 
        order: bond.order, 
        style: style 
      });
    }
  });

  return adjList;
}

// Expand any OH single-atom into an O atom + H atom + bond, so that
// drawing OH as one node is equivalent to drawing O connected to H.
function normalizeOH(atoms, bonds) {
  let nextId = Math.max(0, ...atoms.map(a => a.id)) + 10000;
  let newAtoms = atoms.map(a => a.label === 'OH' ? { ...a, label: 'O' } : a);
  let newBonds = [...bonds];
  atoms.forEach(a => {
    if (a.label === 'OH') {
      const hId = nextId++;
      newAtoms.push({ id: hId, x: a.x, y: a.y, label: 'H' });
      newBonds.push({ id: nextId++, from: a.id, to: hId, order: 1, style: 'solid' });
    }
  });
  return { atoms: newAtoms, bonds: newBonds };
}

function rawIsomorphism(userAtoms, userBonds, solutionAtoms, solutionBonds) {
  if (userAtoms.length !== solutionAtoms.length) return false;
  if (userBonds.length !== solutionBonds.length) return false;

  const userGraph = buildGraph(userAtoms, userBonds);
  const solGraph = buildGraph(solutionAtoms, solutionBonds);

  // 2. Generate canonical signatures
  function getSignatures(graph) {
    let currentSigs = new Map();
    
    // Init: Signature is just the label (e.g. "C", "Br")
    for (const [id, node] of graph.entries()) {
      currentSigs.set(id, node.label);
    }

    // Iterate to blend neighbor info into the signature
    const refine = (sigs) => {
      const nextSigs = new Map();
      for (const [id, node] of graph.entries()) {
        const neighborSigs = node.connections.map(conn => {
          return `${conn.order}(${conn.style})-${sigs.get(conn.neighborId)}`;
        }).sort().join("|");
        nextSigs.set(id, `[${node.label}:${neighborSigs}]`);
      }
      return nextSigs;
    };
    for (let i = 0; i < 3; i++) {
      currentSigs = refine(currentSigs);
    }

    return Array.from(currentSigs.values()).sort();
  }

  const userFingerprint = getSignatures(userGraph);
  const solFingerprint = getSignatures(solGraph);

  // 3. Compare
  return JSON.stringify(userFingerprint) === JSON.stringify(solFingerprint);
}

export function checkIsomorphism(userAtoms, userBonds, solutionAtoms, solutionBonds) {
  // Try direct match first
  if (rawIsomorphism(userAtoms, userBonds, solutionAtoms, solutionBonds)) return true;
  // Try with OH normalized to O+H on both sides so either representation is accepted
  const u = normalizeOH(userAtoms, userBonds);
  const s = normalizeOH(solutionAtoms, solutionBonds);
  return rawIsomorphism(u.atoms, u.bonds, s.atoms, s.bonds);
}