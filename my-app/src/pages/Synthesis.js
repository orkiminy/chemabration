import React, { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { atomFill, atomTextColor, atomRadius } from "../engine/atomColors";
import { loadRules } from "../engine/reactionRules";
import { findPossibleDisconnections, isSimpleMolecule } from "../engine/retroSynthesis";
import SetCanvas from "../setCanvas";
import "../App.css";

const WIDTH = 480;
const HEIGHT = 480;
const GRID_SPACING = 40;
const SNAP_RADIUS = 10;
const ROW_H = GRID_SPACING * Math.sin(Math.PI / 3);

const RING_TEMPLATES = {
  benzene: {
    offsets: [
      { dx: 0, dy: 0 },           { dx: -60, dy: ROW_H },
      { dx: -60, dy: 3 * ROW_H }, { dx: 0, dy: 4 * ROW_H },
      { dx: 60, dy: 3 * ROW_H },  { dx: 60, dy: ROW_H },
    ],
    bonds: [
      { a: 0, b: 1, order: 2 }, { a: 1, b: 2, order: 1 },
      { a: 2, b: 3, order: 2 }, { a: 3, b: 4, order: 1 },
      { a: 4, b: 5, order: 2 }, { a: 5, b: 0, order: 1 },
    ],
  },
  cyclohexane: {
    offsets: [
      { dx: 0, dy: 0 },           { dx: -60, dy: ROW_H },
      { dx: -60, dy: 3 * ROW_H }, { dx: 0, dy: 4 * ROW_H },
      { dx: 60, dy: 3 * ROW_H },  { dx: 60, dy: ROW_H },
    ],
    bonds: Array.from({ length: 6 }, (_, i) => ({ a: i, b: (i + 1) % 6, order: 1 })),
  },
};

export default function Synthesis() {
  const [atoms, setAtoms] = useState([]);
  const [bonds, setBonds] = useState([]);
  const [selectedAtom, setSelectedAtom] = useState(null);
  const [selectedBond, setSelectedBond] = useState(null);
  const [tool, setTool] = useState("pencil");
  const [atomType, setAtomType] = useState("C");
  const [bondStyle, setBondStyle] = useState("solid");
  const [ringType, setRingType] = useState(null);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [dragFrom, setDragFrom] = useState(null);
  const [dragTo, setDragTo] = useState(null);

  // Retrosynthesis state
  const [rules, setRules] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const loadedRef = useRef(false);

  // Interactive retro state
  const [disconnections, setDisconnections] = useState([]); // possible next steps
  const [steps, setSteps] = useState([]); // accumulated path [{atoms, bonds, reagent, ruleName}]
  const [currentTarget, setCurrentTarget] = useState(null); // eslint-disable-line no-unused-vars
  const [pathComplete, setPathComplete] = useState(false);

  // Load rules from Firestore on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadRules().then(r => {
      console.log(`[Synthesis] Loaded ${r.length} rules`);
      setRules(r);
    });
  }, []);

  const handleFindDisconnections = (targetAtoms, targetBonds) => {
    setAnalyzing(true);
    setDisconnections([]);

    setTimeout(() => {
      console.log(`[Synthesis] Finding disconnections for ${targetAtoms.length} atoms, ${targetBonds.length} bonds`);
      const results = findPossibleDisconnections(targetAtoms, targetBonds, rules);
      console.log(`[Synthesis] Found ${results.length} possible disconnections (${results.filter(d => d.verified).length} verified)`);
      setDisconnections(results);
      setAnalyzing(false);
    }, 50);
  };

  const handleStartAnalysis = () => {
    if (atoms.length === 0) return;
    setSteps([{ atoms, bonds, reagent: null, ruleName: "Target" }]);
    setCurrentTarget({ atoms, bonds });
    setPathComplete(false);
    handleFindDisconnections(atoms, bonds);
  };

  const handlePickDisconnection = (disc) => {
    const precursor = disc.precursor;
    const newSteps = [...steps, {
      atoms: precursor.atoms,
      bonds: precursor.bonds,
      reagent: disc.rule.reagent,
      ruleName: disc.rule.name,
    }];
    setSteps(newSteps);
    setCurrentTarget(precursor);

    // Check if precursor is simple
    if (isSimpleMolecule(precursor.atoms, precursor.bonds)) {
      setPathComplete(true);
      setDisconnections([]);
    } else {
      handleFindDisconnections(precursor.atoms, precursor.bonds);
    }
  };

  const handleUndo = () => {
    if (steps.length <= 1) return;
    const newSteps = steps.slice(0, -1);
    const prev = newSteps[newSteps.length - 1];
    setSteps(newSteps);
    setCurrentTarget(prev);
    setPathComplete(false);
    handleFindDisconnections(prev.atoms, prev.bonds);
  };

  const handleReset = () => {
    setSteps([]);
    setCurrentTarget(null);
    setDisconnections([]);
    setPathComplete(false);
  };

  /* ---------- GRID ---------- */
  const gridPoints = useMemo(() => {
    const points = [];
    const rowHeight = GRID_SPACING * Math.sin(Math.PI / 3);
    for (let y = 0; y <= HEIGHT; y += rowHeight) {
      const row = Math.round(y / rowHeight);
      const offset = row % 2 === 0 ? 0 : GRID_SPACING / 2;
      for (let x = 0; x <= WIDTH; x += GRID_SPACING) {
        points.push({ x: x + offset, y });
      }
    }
    return points;
  }, []);

  const snapNearest = (x, y) => {
    let closest = null, minDist = Infinity;
    for (const p of gridPoints) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < minDist) { minDist = d; closest = p; }
    }
    return { snap: closest, dist: minDist };
  };

  /* ---------- HISTORY ---------- */
  const saveHistory = (a, b) => {
    setHistory(h => [...h.slice(-30), { atoms: a, bonds: b }]);
    setFuture([]);
  };

  /* ---------- RING STAMP ---------- */
  const stampRing = (type, baseX, baseY) => {
    const tmpl = RING_TEMPLATES[type];
    const ts = Date.now();
    const newAtoms = [];
    const idMap = {};
    const ringCenter = {
      x: tmpl.offsets.reduce((s, o) => s + baseX + o.dx, 0) / tmpl.offsets.length,
      y: tmpl.offsets.reduce((s, o) => s + baseY + o.dy, 0) / tmpl.offsets.length,
    };
    tmpl.offsets.forEach(({ dx, dy }, i) => {
      const x = baseX + dx, y = baseY + dy;
      const existing = atoms.find(a => Math.round(a.x) === Math.round(x) && Math.round(a.y) === Math.round(y));
      if (existing) { idMap[i] = existing.id; }
      else { idMap[i] = ts + i; newAtoms.push({ id: ts + i, x, y, label: "C" }); }
    });
    const newBonds = tmpl.bonds
      .map((b, i) => ({ id: ts + 100 + i, from: idMap[b.a], to: idMap[b.b], order: b.order, style: "solid", ringCenter }))
      .filter(nb => !bonds.some(eb =>
        (eb.from === nb.from && eb.to === nb.to) || (eb.from === nb.to && eb.to === nb.from)
      ));
    saveHistory(atoms, bonds);
    setAtoms(prev => [...prev, ...newAtoms]);
    setBonds(prev => [...prev, ...newBonds]);
  };

  /* ---------- INTERACTION HANDLERS ---------- */
  const handleCanvasMouseDown = (e) => {
    if (tool === "eraser") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const { snap, dist } = snapNearest(e.clientX - rect.left, e.clientY - rect.top);
    if (!snap || dist > SNAP_RADIUS * 3) return;
    const existingAtom = atoms.find(a => a.x === snap.x && a.y === snap.y);
    setDragFrom({ x: snap.x, y: snap.y, atomId: existingAtom?.id ?? null });
    setDragTo(snap);
  };

  const handleCanvasMouseMove = (e) => {
    if (!dragFrom) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const { snap } = snapNearest(e.clientX - rect.left, e.clientY - rect.top);
    if (snap) setDragTo(snap);
  };

  const handleCanvasMouseUp = (e) => {
    if (!dragFrom) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const { snap } = snapNearest(e.clientX - rect.left, e.clientY - rect.top);
    const end = snap ?? dragTo;
    const wasDrag = end && (Math.hypot(end.x - dragFrom.x, end.y - dragFrom.y) > SNAP_RADIUS);

    if (!wasDrag) {
      if (ringType && end) {
        stampRing(ringType, end.x, end.y);
      } else if (!atoms.some(a => a.x === dragFrom.x && a.y === dragFrom.y)) {
        saveHistory(atoms, bonds);
        setAtoms(prev => [...prev, { id: Date.now(), x: dragFrom.x, y: dragFrom.y, label: atomType }]);
      }
      setSelectedAtom(null);
    } else if (end) {
      let newAtoms = [...atoms];
      let startId = dragFrom.atomId;
      if (!startId) {
        startId = Date.now();
        newAtoms = [...newAtoms, { id: startId, x: dragFrom.x, y: dragFrom.y, label: atomType }];
      }
      let endAtom = newAtoms.find(a => a.x === end.x && a.y === end.y);
      let endId;
      if (endAtom) {
        endId = endAtom.id;
      } else {
        endId = Date.now() + 1;
        newAtoms = [...newAtoms, { id: endId, x: end.x, y: end.y, label: atomType }];
      }
      if (startId !== endId && !bonds.some(b =>
        (b.from === startId && b.to === endId) || (b.from === endId && b.to === startId)
      )) {
        saveHistory(atoms, bonds);
        setAtoms(newAtoms);
        setBonds(prev => [...prev, { id: Date.now() + 2, from: startId, to: endId, order: 1, style: bondStyle }]);
      }
      setSelectedAtom(null);
    }
    setDragFrom(null);
    setDragTo(null);
  };

  const handleAtomMouseDown = (e, atomId) => {
    if (tool === "eraser") return;
    e.stopPropagation();
    const atom = atoms.find(a => a.id === atomId);
    if (atom) setDragFrom({ x: atom.x, y: atom.y, atomId });
  };

  const handleAtomClick = (e, atomId) => {
    e.stopPropagation();
    if (tool === "eraser") {
      saveHistory(atoms, bonds);
      setAtoms(atoms.filter(a => a.id !== atomId));
      setBonds(bonds.filter(b => b.from !== atomId && b.to !== atomId));
      return;
    }
    if (dragFrom) return;
    if (selectedAtom === null) { setSelectedAtom(atomId); return; }
    if (selectedAtom === atomId) { setSelectedAtom(null); return; }
    const exists = bonds.some(b =>
      (b.from === selectedAtom && b.to === atomId) || (b.from === atomId && b.to === selectedAtom)
    );
    if (!exists) {
      saveHistory(atoms, bonds);
      setBonds([...bonds, { id: Date.now(), from: selectedAtom, to: atomId, order: 1, style: bondStyle }]);
    }
    setSelectedAtom(null);
  };

  const handleBondClick = (bondId) => {
    if (tool === "eraser") {
      saveHistory(atoms, bonds);
      const newBonds = bonds.filter(b => b.id !== bondId);
      const connectedIds = new Set();
      newBonds.forEach(b => { connectedIds.add(b.from); connectedIds.add(b.to); });
      setAtoms(atoms.filter(a => connectedIds.has(a.id)));
      setBonds(newBonds);
      return;
    }
    saveHistory(atoms, bonds);
    setBonds(bonds.map(b => b.id === bondId ? { ...b, order: b.order === 3 ? 1 : b.order + 1 } : b));
    setSelectedBond(bondId);
  };

  /* ---------- KEYBOARD SHORTCUTS ---------- */
  useEffect(() => {
    const ATOM_CODES = {
      KeyC: "C", KeyH: "H", KeyO: "O", KeyN: "N",
      KeyF: "F", KeyI: "I", KeyS: "S", KeyP: "P",
      KeyB: "Br", KeyL: "Cl", KeyR: "R", KeyX: "X",
    };
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      if (e.ctrlKey && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        setHistory(h => {
          if (!h.length) return h;
          const prev = h[h.length - 1];
          setFuture(f => [{ atoms, bonds }, ...f]);
          setAtoms(prev.atoms); setBonds(prev.bonds);
          return h.slice(0, -1);
        });
        return;
      }
      if (e.ctrlKey && (e.key === "y" || (e.shiftKey && e.key === "z"))) {
        e.preventDefault();
        setFuture(f => {
          if (!f.length) return f;
          const next = f[0];
          setHistory(h => [...h, { atoms, bonds }]);
          setAtoms(next.atoms); setBonds(next.bonds);
          return f.slice(1);
        });
        return;
      }
      const newLabel = ATOM_CODES[e.code];
      if (!newLabel) return;
      if (selectedAtom !== null) {
        saveHistory(atoms, bonds);
        setAtoms(atoms.map(a => a.id === selectedAtom ? { ...a, label: newLabel } : a));
        setSelectedAtom(null);
        return;
      }
      if (selectedBond !== null) {
        const newStyle = e.code === "KeyW" ? "wedge" : e.code === "KeyD" ? "striped" : null;
        if (newStyle) {
          saveHistory(atoms, bonds);
          setBonds(bonds.map(b => b.id === selectedBond ? { ...b, style: newStyle } : b));
        }
        setSelectedAtom(null);
        return;
      }
      setAtomType(newLabel);
      setTool("pencil");
      setRingType(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedBond, selectedAtom, atoms, bonds]);

  /* ---------- RENDER ---------- */
  return (
    <div className="exercise-page">
      <nav className="exercise-nav">
        <Link to="/" className="exercise-nav-back">&larr; Back to Home</Link>
        <span className="exercise-nav-title">Retrosynthesis</span>
        <span className="exercise-nav-spacer"></span>
      </nav>

      <div style={{ maxWidth: 960, margin: "1.5rem auto", padding: "0 1rem" }}>
        <h2 style={{ color: "#5f021f", marginBottom: "0.5rem" }}>Draw your target molecule</h2>
        <p style={{ color: "#666", marginTop: 0 }}>
          Draw the product you want to synthesize, then click "Analyze Synthesis" to find a path.
        </p>

        <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
          {/* Drawing canvas */}
          <div>
            <div className="exercise-panel-box">
              <div className="exercise-panel-label">Target Product</div>
              <svg
                width={WIDTH}
                height={HEIGHT}
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                style={{ display: "block", maxWidth: "100%", height: "auto", cursor: tool === "eraser" ? "not-allowed" : ringType ? "copy" : "crosshair" }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={() => { setDragFrom(null); setDragTo(null); }}
              >
                {/* Grid */}
                {gridPoints.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#ccc" />
                ))}
                {/* Bonds */}
                {bonds.map(bond => {
                  const a1 = atoms.find(a => a.id === bond.from);
                  const a2 = atoms.find(a => a.id === bond.to);
                  if (!a1 || !a2) return null;
                  const bondHandlers = {
                    onMouseDown: (e) => e.stopPropagation(),
                    onClick: (e) => { e.stopPropagation(); handleBondClick(bond.id); },
                  };
                  if (bond.style === "wedge") {
                    const dx = a2.x - a1.x, dy = a2.y - a1.y;
                    const angle = Math.atan2(dy, dx);
                    const w = 6, perp = angle + Math.PI / 2;
                    return (
                      <polygon key={bond.id}
                        points={`${a1.x},${a1.y} ${a2.x + Math.cos(perp) * w},${a2.y + Math.sin(perp) * w} ${a2.x - Math.cos(perp) * w},${a2.y - Math.sin(perp) * w}`}
                        fill={bond.id === selectedBond ? "red" : "#000"} {...bondHandlers}
                      />
                    );
                  }
                  const bpDx = a2.y - a1.y, bpDy = a2.x - a1.x;
                  const len = Math.sqrt(bpDx * bpDx + bpDy * bpDy) || 1;
                  let offsetX = (bpDx / len) * 4, offsetY = (bpDy / len) * 4;
                  if (bond.ringCenter && (bond.order || 1) > 1) {
                    const midX = (a1.x + a2.x) / 2, midY = (a1.y + a2.y) / 2;
                    const dot = offsetX * (bond.ringCenter.x - midX) + (-offsetY) * (bond.ringCenter.y - midY);
                    if (dot < 0) { offsetX = -offsetX; offsetY = -offsetY; }
                  }
                  return (
                    <g key={bond.id}>
                      <line x1={a1.x} y1={a1.y} x2={a2.x} y2={a2.y} stroke="transparent" strokeWidth="16" {...bondHandlers} />
                      {[...Array(bond.order)].map((_, i) => (
                        <line key={i}
                          x1={a1.x + offsetX * i} y1={a1.y - offsetY * i}
                          x2={a2.x + offsetX * i} y2={a2.y - offsetY * i}
                          stroke={bond.id === selectedBond ? "red" : "#000"} strokeWidth="3"
                          strokeDasharray={bond.style === "striped" ? "6,4" : "0"} pointerEvents="none"
                        />
                      ))}
                    </g>
                  );
                })}
                {/* Atoms */}
                {atoms.map(atom => {
                  const isC = !atom.label || atom.label === "C";
                  return (
                    <g key={atom.id}>
                      <circle cx={atom.x} cy={atom.y} r={atomRadius(atom.label)} fill="transparent"
                        onMouseDown={(e) => handleAtomMouseDown(e, atom.id)}
                        onClick={(e) => handleAtomClick(e, atom.id)}
                      />
                      {(!isC || atom.id === selectedAtom) && (
                        <circle cx={atom.x} cy={atom.y} r={atomRadius(atom.label)}
                          fill={atom.id === selectedAtom ? "red" : atomFill(atom.label)}
                          stroke="#222" strokeWidth="1" pointerEvents="none"
                        />
                      )}
                      {!isC && (
                        <text x={atom.x} y={atom.y + 4} textAnchor="middle" fontSize="12"
                          fill={atomTextColor(atom.label)} pointerEvents="none"
                        >{atom.label}</text>
                      )}
                    </g>
                  );
                })}
                {/* Drag preview */}
                {dragFrom && dragTo && (Math.hypot(dragTo.x - dragFrom.x, dragTo.y - dragFrom.y) > SNAP_RADIUS) && (
                  <line x1={dragFrom.x} y1={dragFrom.y} x2={dragTo.x} y2={dragTo.y}
                    stroke="#999" strokeWidth="2" strokeDasharray="5,3" pointerEvents="none"
                  />
                )}
              </svg>
            </div>

            {/* Toolbar */}
            <div className="exercise-toolbar" style={{ width: WIDTH, boxSizing: "border-box" }}>
              <div className="toolbar-group">
                <button className={`toolbar-btn${tool === "pencil" ? " toolbar-btn-active" : ""}`} onClick={() => { setTool("pencil"); setRingType(null); }}>Pencil</button>
                <button className={`toolbar-btn${tool === "eraser" ? " toolbar-btn-active" : ""}`} onClick={() => { setTool("eraser"); setRingType(null); }}>Eraser</button>
                <button className="toolbar-btn" onClick={() => { saveHistory(atoms, bonds); setAtoms([]); setBonds([]); }}>Clear</button>
                <button className="toolbar-btn" disabled={!history.length} onClick={() => {
                  const prev = history[history.length - 1];
                  setFuture(f => [{ atoms, bonds }, ...f]);
                  setHistory(h => h.slice(0, -1));
                  setAtoms(prev.atoms); setBonds(prev.bonds);
                }}>&#8617; Undo</button>
                <button className="toolbar-btn" disabled={!future.length} onClick={() => {
                  const next = future[0];
                  setHistory(h => [...h, { atoms, bonds }]);
                  setFuture(f => f.slice(1));
                  setAtoms(next.atoms); setBonds(next.bonds);
                }}>&#8618; Redo</button>
              </div>
              <div className="toolbar-group">
                <button className={`toolbar-btn${ringType === "benzene" ? " toolbar-btn-active" : ""}`} onClick={() => { setRingType(r => r === "benzene" ? null : "benzene"); setTool("pencil"); }}>Benzene</button>
                <button className={`toolbar-btn${ringType === "cyclohexane" ? " toolbar-btn-active" : ""}`} onClick={() => { setRingType(r => r === "cyclohexane" ? null : "cyclohexane"); setTool("pencil"); }}>Cyclohex</button>
              </div>
              {tool === "pencil" && !ringType && (
                <div className="toolbar-group">
                  <select className="toolbar-select" value={atomType} onChange={(e) => setAtomType(e.target.value)}>
                    <option value="C">C</option><option value="H">H</option>
                    <option value="O">O</option><option value="N">N</option>
                    <option value="Br">Br</option><option value="Cl">Cl</option>
                    <option value="F">F</option><option value="I">I</option>
                    <option value="S">S</option><option value="P">P</option>
                    <option value="OH">OH</option>
                  </select>
                  <select className="toolbar-select" value={bondStyle} onChange={(e) => setBondStyle(e.target.value)}>
                    <option value="solid">Solid (Line)</option>
                    <option value="wedge">Solid (Wedge)</option>
                    <option value="striped">Dashed (Striped)</option>
                  </select>
                </div>
              )}
              <div className="toolbar-group">
                <button
                  className="toolbar-btn toolbar-btn-check"
                  disabled={atoms.length === 0 || analyzing}
                  onClick={handleStartAnalysis}
                >
                  {analyzing ? "Analyzing..." : "Find Disconnections"}
                </button>
                {steps.length > 1 && (
                  <button className="toolbar-btn" onClick={handleUndo}>Undo Step</button>
                )}
                {steps.length > 0 && (
                  <button className="toolbar-btn" onClick={handleReset}>Reset</button>
                )}
              </div>
            </div>
          </div>

          {/* Results area */}
          <div style={{ flex: 1, minWidth: 300 }}>
            {/* Initial empty state */}
            {steps.length === 0 && !analyzing && (
              <div style={{ padding: "2rem", textAlign: "center", color: "#aaa", border: "2px dashed #ddd", borderRadius: 10, minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p>Draw a target molecule and click "Find Disconnections" to start retrosynthesis.</p>
              </div>
            )}

            {/* Analyzing spinner */}
            {analyzing && (
              <div style={{ padding: "2rem", textAlign: "center", color: "#5f021f", border: "2px dashed #5f021f", borderRadius: 10, minHeight: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p>Analyzing... Finding possible disconnections.</p>
              </div>
            )}

            {/* Accumulated path so far */}
            {steps.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <h3 style={{ color: "#5f021f", marginBottom: "0.5rem" }}>
                  Path so far ({steps.length - 1} step{steps.length - 1 !== 1 ? "s" : ""})
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  {[...steps].reverse().map((step, i) => {
                    const reverseIdx = steps.length - 1 - i;
                    return (
                      <div key={i}>
                        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: "0.5rem", background: reverseIdx === steps.length - 1 ? "#f0fff0" : "#fff" }}>
                          <div style={{ fontSize: "0.75rem", color: "#888", marginBottom: 2 }}>
                            {reverseIdx === 0 ? "Target" : reverseIdx === steps.length - 1 ? "Current (working backwards)" : `Step back ${reverseIdx}`}
                          </div>
                          <div style={{ transform: "scale(0.45)", transformOrigin: "top left", width: 216, height: 216, overflow: "hidden" }}>
                            <SetCanvas atoms={step.atoms} bonds={step.bonds} />
                          </div>
                        </div>
                        {i < steps.length - 1 && (
                          <div style={{ textAlign: "center", padding: "2px 0", fontSize: "0.8rem", color: "#5f021f" }}>
                            &#8593; {step.reagent || ""}
                            <span style={{ color: "#888", fontSize: "0.7rem" }}> ({step.ruleName})</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Path complete */}
            {pathComplete && (
              <div style={{ padding: "1rem", textAlign: "center", color: "#1a6b3a", border: "2px solid #1a6b3a", borderRadius: 10, background: "#f0fff0", marginBottom: "1rem" }}>
                <h3 style={{ margin: "0 0 0.25rem" }}>Path complete!</h3>
                <p style={{ margin: 0 }}>Reached a simple starting material.</p>
              </div>
            )}

            {/* Possible disconnections to choose from */}
            {!analyzing && !pathComplete && disconnections.length > 0 && (
              <div>
                <h3 style={{ color: "#333", marginBottom: "0.5rem" }}>
                  Possible disconnections ({disconnections.length})
                </h3>
                <p style={{ color: "#888", fontSize: "0.85rem", marginTop: 0 }}>
                  Pick a reaction that could have produced this molecule:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {disconnections.map((disc, i) => (
                    <button
                      key={i}
                      onClick={() => handlePickDisconnection(disc)}
                      style={{
                        display: "flex", alignItems: "center", gap: "0.75rem",
                        padding: "0.75rem", border: disc.verified ? "2px solid #1a6b3a" : "1px solid #ddd",
                        borderRadius: 8, background: disc.verified ? "#f0fff0" : "#fff",
                        cursor: "pointer", textAlign: "left", width: "100%",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: "#5f021f" }}>{disc.rule.reagent}</div>
                        <div style={{ fontSize: "0.85rem", color: "#666" }}>{disc.rule.name}</div>
                        <div style={{ fontSize: "0.75rem", color: disc.verified ? "#1a6b3a" : "#c90" }}>
                          {disc.verified ? "Verified ✓" : "Unverified"} — coverage {(disc.coverage * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div style={{ transform: "scale(0.3)", transformOrigin: "top right", width: 144, height: 144, overflow: "hidden" }}>
                        <SetCanvas atoms={disc.precursor.atoms} bonds={disc.precursor.bonds} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No disconnections found */}
            {!analyzing && steps.length > 0 && !pathComplete && disconnections.length === 0 && (
              <div style={{ padding: "1rem", textAlign: "center", color: "#c00", border: "1px solid #fcc", borderRadius: 10, background: "#fff5f5" }}>
                <p style={{ margin: 0 }}>No disconnections found for this molecule. Try undoing the last step.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
