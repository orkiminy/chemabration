import { readFileSync } from "fs";

const rules = JSON.parse(readFileSync(new URL('./test-rules.json', import.meta.url), 'utf-8'));
console.log(`Loaded ${rules.length} rules: ${rules.map(r=>r.name).join(', ')}\n`);

const nitration = rules.find(r => r.name === "Nitration");

// Analyze Nitration result structure
console.log("=== NITRATION RESULT (before processing) ===");
console.log("Atoms:", nitration.resultAtoms.length, nitration.resultAtoms.map(a => `${a.id}(${a.label||'C'})`).join(', '));
console.log("Bonds:", nitration.resultBonds.length);

// Find connected components (same logic as largestComponent)
const adj = new Map(nitration.resultAtoms.map(a => [a.id, []]));
nitration.resultBonds.forEach(b => {
  adj.get(b.from)?.push(b.to);
  adj.get(b.to)?.push(b.from);
});

const visited = new Set();
const components = [];
for (const a of nitration.resultAtoms) {
  if (visited.has(a.id)) continue;
  const comp = [];
  const queue = [a.id];
  visited.add(a.id);
  while (queue.length) {
    const id = queue.shift();
    comp.push(id);
    for (const n of (adj.get(id) || [])) {
      if (!visited.has(n)) { visited.add(n); queue.push(n); }
    }
  }
  components.push(comp);
}

console.log(`\nComponents: ${components.length}`);
components.forEach((comp, i) => {
  const atoms = comp.map(id => {
    const a = nitration.resultAtoms.find(x => x.id === id);
    return `${a.label||'C'}`;
  });
  console.log(`  Component ${i+1} (${comp.length} atoms): [${atoms.join(', ')}]`);
});

// Show the main product's structure
const largest = components.reduce((a, b) => a.length > b.length ? a : b);
const keepIds = new Set(largest);
const mainAtoms = nitration.resultAtoms.filter(a => keepIds.has(a.id));
const mainBonds = nitration.resultBonds.filter(b => keepIds.has(b.from) && keepIds.has(b.to));

console.log(`\n=== MAIN PRODUCT (${mainAtoms.length} atoms) ===`);
console.log("Labels:", mainAtoms.map(a => a.label || 'C'));
console.log("Bonds:");
mainBonds.forEach(b => {
  const from = mainAtoms.find(a => a.id === b.from);
  const to = mainAtoms.find(a => a.id === b.to);
  console.log(`  ${from?.label||'C'}(${b.from}) → ${to?.label||'C'}(${b.to}) order=${b.order||1}`);
});

// Now simulate a target molecule (benzene + NO2 + chain)
// This is what the precursor at step 2 looks like
console.log("\n=== SIMULATED TARGET (nitrobenzene + chain) ===");
const targetAtoms = [
  {id:1, x:160, y:138, label:'C'},  // ring
  {id:2, x:100, y:173, label:'C'},  // ring
  {id:3, x:100, y:242, label:'C'},  // ring
  {id:4, x:160, y:277, label:'C'},  // ring
  {id:5, x:220, y:242, label:'C'},  // ring
  {id:6, x:220, y:173, label:'C'},  // ring
  {id:7, x:280, y:138, label:'C'},  // chain C
  {id:8, x:340, y:173, label:'C'},  // chain C
  {id:9, x:340, y:138, label:'O'},  // C=O
  {id:10, x:60, y:138, label:'N'},  // N
  {id:11, x:40, y:100, label:'O'},  // N-O
  {id:12, x:40, y:173, label:'O'},  // N-O
];
const targetBonds = [
  {id:101, from:1, to:2, order:1.5}, // ring
  {id:102, from:2, to:3, order:1.5}, // ring
  {id:103, from:3, to:4, order:1.5}, // ring
  {id:104, from:4, to:5, order:1.5}, // ring
  {id:105, from:5, to:6, order:1.5}, // ring
  {id:106, from:6, to:1, order:1.5}, // ring
  {id:107, from:6, to:7, order:1},   // ring→chain
  {id:108, from:7, to:8, order:1},   // chain
  {id:109, from:9, to:7, order:2},   // C=O
  {id:110, from:10, to:1, order:1},  // N→ring
  {id:111, from:11, to:10, order:1}, // O→N (both single in precursor)
  {id:112, from:10, to:12, order:1}, // N→O (both single in precursor)
];

console.log("Target labels:", targetAtoms.map(a => a.label));
console.log("Target bonds:", targetBonds.length);

// Try matching manually
console.log("\n=== MANUAL MATCH ATTEMPT ===");
// Result main product: 6C(ring) + R + N + 2O = 10 atoms
// Target: 6C(ring) + 2C(chain) + O + N + 2O = 12 atoms

// R needs to match a C bonded to a ring C
// N needs to match N bonded to a ring C
// O needs to match O bonded to N

// Check: which target ring C atoms have external non-ring bonds?
console.log("Ring C with external bonds:");
for (const atom of targetAtoms.filter(a => a.id <= 6)) {
  const externalBonds = targetBonds.filter(b => {
    const otherId = b.from === atom.id ? b.to : b.to === atom.id ? b.from : null;
    return otherId && otherId > 6; // non-ring
  });
  if (externalBonds.length > 0) {
    externalBonds.forEach(b => {
      const otherId = b.from === atom.id ? b.to : b.from;
      const other = targetAtoms.find(a => a.id === otherId);
      console.log(`  Ring C(${atom.id}) → ${other.label}(${otherId})`);
    });
  }
}

// Check: in the result, which ring C has R and which has N?
console.log("\nResult ring C external bonds:");
for (const atom of mainAtoms.filter(a => (a.label||'C') === 'C')) {
  const ringBonds = mainBonds.filter(b => {
    const otherId = b.from === atom.id ? b.to : b.to === atom.id ? b.from : null;
    if (!otherId) return false;
    const other = mainAtoms.find(a => a.id === otherId);
    return other && (other.label||'C') !== 'C' && other.label !== 'R'; // non-C, non-R neighbors
  });
  const rBonds = mainBonds.filter(b => {
    const otherId = b.from === atom.id ? b.to : b.to === atom.id ? b.from : null;
    if (!otherId) return false;
    const other = mainAtoms.find(a => a.id === otherId);
    return other && (other.label === 'R' || other.label === "R'" || other.label === "R''");
  });
  if (ringBonds.length > 0 || rBonds.length > 0) {
    [...ringBonds, ...rBonds].forEach(b => {
      const otherId = b.from === atom.id ? b.to : b.from;
      const other = mainAtoms.find(a => a.id === otherId);
      console.log(`  Ring C(${atom.id}) → ${other.label}(${otherId})`);
    });
  }
}

console.log("\n=== KEY QUESTION ===");
console.log("R in result is bonded to ring C that is how many hops from N's ring C?");

// Find R's ring C and N's ring C in result
const rAtom = mainAtoms.find(a => a.label === 'R');
const nAtom = mainAtoms.find(a => a.label === 'N');
const rBond = mainBonds.find(b => b.from === rAtom?.id || b.to === rAtom?.id);
const rRingC = rBond ? (rBond.from === rAtom.id ? rBond.to : rBond.from) : null;
const nBond = mainBonds.find(b => (b.from === nAtom?.id || b.to === nAtom?.id) &&
  mainAtoms.find(a => a.id === (b.from === nAtom.id ? b.to : b.from))?.label === 'C');
const nRingC = nBond ? (nBond.from === nAtom.id ? nBond.to : nBond.from) : null;

console.log(`R bonded to ring C ${rRingC}`);
console.log(`N bonded to ring C ${nRingC}`);

// Count ring hops
const ringAdj = new Map();
mainBonds.filter(b => {
  const fa = mainAtoms.find(a => a.id === b.from);
  const ta = mainAtoms.find(a => a.id === b.to);
  return fa && ta && (fa.label||'C') === 'C' && (ta.label||'C') === 'C' && b.order === 1.5;
}).forEach(b => {
  if (!ringAdj.has(b.from)) ringAdj.set(b.from, []);
  if (!ringAdj.has(b.to)) ringAdj.set(b.to, []);
  ringAdj.get(b.from).push(b.to);
  ringAdj.get(b.to).push(b.from);
});

// BFS from R's ring C to N's ring C
if (rRingC && nRingC) {
  const q = [{id: rRingC, dist: 0}];
  const v = new Set([rRingC]);
  let found = false;
  while (q.length) {
    const {id, dist} = q.shift();
    if (id === nRingC) {
      console.log(`Ring distance R→N: ${dist} hops (${dist === 2 ? 'meta' : dist === 1 ? 'ortho' : 'para'})`);
      found = true;
      break;
    }
    for (const n of (ringAdj.get(id) || [])) {
      if (!v.has(n)) { v.add(n); q.push({id: n, dist: dist+1}); }
    }
  }
  if (!found) console.log("R and N ring C not connected via ring bonds!");
}

process.exit(0);
