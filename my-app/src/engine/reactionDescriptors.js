/**
 * reactionDescriptors.js
 *
 * Pure data — no logic, no imports.
 *
 * Each descriptor describes how to transform the starting material into the
 * product(s) for a given reaction.  The shapes were derived directly from
 * the solution data in reactionLevels.js.
 *
 * Types:
 *   "standard" — two new atoms added to c2 and c3 (the double-bond carbons)
 *   "bridge"   — one new atom bonded to BOTH c2 and c3 (epoxide, cyclopropane)
 *   "lookup"   — non-standard scaffold; engine returns stored solutions as-is
 *
 * Bond styles (app convention):
 *   "wedge"   — filled triangle, bond coming toward viewer (out of page)
 *   "striped" — dashed line, bond going away from viewer (into page)
 *   "solid"   — flat bond (no defined 3D orientation)
 */

export const REACTION_DESCRIPTORS = {

  // ── 1. CATALYTIC HYDROGENATION ──────────────────────────────────────────
  // Syn addition. Both H atoms arrive on the same face.
  // Methyl pushed to opposite face.
  // Only 1 enantiomer stored in the data (the "striped H / wedge methyl" version).
  1: {
    type: 'standard',
    enantiomers: [
      {
        methylStyle: 'wedge',
        atomAtC2: { label: 'H', style: 'striped' },
        atomAtC3: { label: 'H', style: 'striped' },
      },
    ],
  },

  // ── 2. HALOGENATION ─────────────────────────────────────────────────────
  // Anti addition. Br atoms on opposite faces.
  // Methyl is anti to the Br at C2.
  2: {
    type: 'standard',
    enantiomers: [
      {
        methylStyle: 'wedge',
        atomAtC2: { label: 'Br', style: 'striped' },
        atomAtC3: { label: 'Br', style: 'wedge' },
      },
      {
        methylStyle: 'striped',
        atomAtC2: { label: 'Br', style: 'wedge' },
        atomAtC3: { label: 'Br', style: 'striped' },
      },
    ],
  },

  // ── 3. OXYHALOGENATION ──────────────────────────────────────────────────
  // Anti addition. OH (nucleophile) to more-substituted C2. Br to C3.
  // Methyl anti to OH at C2.
  3: {
    type: 'standard',
    enantiomers: [
      {
        methylStyle: 'wedge',
        atomAtC2: { label: 'OH', style: 'striped' },
        atomAtC3: { label: 'Br', style: 'wedge' },
      },
      {
        methylStyle: 'striped',
        atomAtC2: { label: 'OH', style: 'wedge' },
        atomAtC3: { label: 'Br', style: 'striped' },
      },
    ],
  },

  // ── 4. ALKOXYHALOGENATION ───────────────────────────────────────────────
  // Anti addition. OCH3 to more-substituted C2. Br to C3.
  4: {
    type: 'standard',
    enantiomers: [
      {
        methylStyle: 'wedge',
        atomAtC2: { label: 'OCH3', style: 'striped' },
        atomAtC3: { label: 'Br', style: 'wedge' },
      },
      {
        methylStyle: 'striped',
        atomAtC2: { label: 'OCH3', style: 'wedge' },
        atomAtC3: { label: 'Br', style: 'striped' },
      },
    ],
  },

  // ── 5. HYDROHALOGENATION (HBr) ──────────────────────────────────────────
  // Markovnikov. Br to more-substituted C2. H to C3.
  // Carbocation intermediate → mixture of stereoisomers → all solid bonds.
  // Note: the stored data has a duplicate bond 107 (data bug). We generate
  // the clean version with solid bonds only.
  5: {
    type: 'standard',
    enantiomers: [
      {
        methylStyle: 'solid',
        atomAtC2: { label: 'Br', style: 'solid' },
        atomAtC3: { label: 'H', style: 'solid' },
      },
    ],
  },

  // ── 6. CATALYTIC HYDRATION ──────────────────────────────────────────────
  // Markovnikov. OH to more-substituted C2. H to C3.
  // Mixture → all solid bonds.
  6: {
    type: 'standard',
    enantiomers: [
      {
        methylStyle: 'solid',
        atomAtC2: { label: 'OH', style: 'solid' },
        atomAtC3: { label: 'H', style: 'solid' },
      },
    ],
  },

  // ── 7. ADDITION OF ALCOHOLS ─────────────────────────────────────────────
  // Markovnikov. OCH3 to more-substituted C2. H to C3.
  // Mixture → all solid bonds.
  7: {
    type: 'standard',
    enantiomers: [
      {
        methylStyle: 'solid',
        atomAtC2: { label: 'OCH3', style: 'solid' },
        atomAtC3: { label: 'H', style: 'solid' },
      },
    ],
  },

  // ── 8. OXYMERCURATION-REDUCTION ─────────────────────────────────────────
  // Markovnikov + anti addition. OH to more-substituted C2. H to C3.
  // Stored solution has all solid bonds (drawn as mixture in the data).
  8: {
    type: 'standard',
    enantiomers: [
      {
        methylStyle: 'solid',
        atomAtC2: { label: 'OH', style: 'solid' },
        atomAtC3: { label: 'H', style: 'solid' },
      },
    ],
  },

  // ── 9. ALKOXYMERCURATION-REDUCTION ──────────────────────────────────────
  // Markovnikov + anti. OCH3 to C2 as O–CH3 split across two atoms.
  // H to C3. All solid bonds.
  // Extra atom: CH3 connected to the O at C2.
  9: {
    type: 'standard',
    enantiomers: [
      {
        methylStyle: 'solid',
        atomAtC2: { label: 'O', style: 'solid' },
        atomAtC3: { label: 'H', style: 'solid' },
        extraAtoms: [
          { attachToLabel: 'O', label: 'CH3', style: 'solid' },
        ],
      },
    ],
  },

  // ── 10. HYDROBORATION-OXIDATION ─────────────────────────────────────────
  // Anti-Markovnikov + syn addition. H to more-substituted C2. OH to C3.
  // Methyl opposite to H at C2.
  10: {
    type: 'standard',
    enantiomers: [
      {
        methylStyle: 'striped',
        atomAtC2: { label: 'H', style: 'wedge' },
        atomAtC3: { label: 'OH', style: 'wedge' },
      },
      {
        methylStyle: 'wedge',
        atomAtC2: { label: 'H', style: 'striped' },
        atomAtC3: { label: 'OH', style: 'striped' },
      },
    ],
  },

  // ── 11. EPOXIDATION ─────────────────────────────────────────────────────
  // Syn addition. Bridge O atom bonded to both C2 and C3.
  // Methyl pushed opposite to the O.
  11: {
    type: 'bridge',
    enantiomers: [
      {
        methylStyle: 'striped',
        bridge: { label: 'O', style: 'wedge' },
      },
      {
        methylStyle: 'wedge',
        bridge: { label: 'O', style: 'striped' },
      },
    ],
  },

  // ── 13. DIHYDROXYLATION ─────────────────────────────────────────────────
  // Syn addition. OH added to both C2 and C3 on the same face.
  // Methyl opposite to OHs.
  13: {
    type: 'standard',
    enantiomers: [
      {
        methylStyle: 'striped',
        atomAtC2: { label: 'OH', style: 'wedge' },
        atomAtC3: { label: 'OH', style: 'wedge' },
      },
      {
        methylStyle: 'wedge',
        atomAtC2: { label: 'OH', style: 'striped' },
        atomAtC3: { label: 'OH', style: 'striped' },
      },
    ],
  },

  // ── 14. CYCLOPROPANATION ────────────────────────────────────────────────
  // Syn addition. Bridge CH2 atom bonded to both C2 and C3.
  14: {
    type: 'bridge',
    enantiomers: [
      {
        methylStyle: 'striped',
        bridge: { label: 'CH2', style: 'wedge' },
      },
      {
        methylStyle: 'wedge',
        bridge: { label: 'CH2', style: 'striped' },
      },
    ],
  },

  // ── 15. RADICAL HYDROHALOGENATION ───────────────────────────────────────
  // Anti-Markovnikov. H to more-substituted C2. Br to C3.
  // Radical mechanism → mixture → all solid bonds.
  15: {
    type: 'standard',
    enantiomers: [
      {
        methylStyle: 'solid',
        atomAtC2: { label: 'H', style: 'solid' },
        atomAtC3: { label: 'Br', style: 'solid' },
      },
    ],
  },

  // ── 16, 17, 18 ── Non-standard scaffolds → use stored solutions ──────────
  16: { type: 'lookup' },
  17: { type: 'lookup' },
  18: { type: 'lookup' },

  // ── 19, 20 ── Multi-step Ozonolysis → use stored solutions ───────────────
  19: { type: 'lookup' },
  20: { type: 'lookup' },
};
