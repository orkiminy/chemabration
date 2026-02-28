import React, { useState, useEffect, useMemo } from "react";
import SetCanvas from "./setCanvas";
import ReactionArrow from "./addingReaction";
import correctStructure from "./data/correctStructure.json";
import { graphsAreEqual } from "./utils/graphCompare";

export default function ExerciseCanvas({ exercise }) {
  /* ---------- CONSTANTS ---------- */
  const WIDTH = 480;
  const HEIGHT = 480;
  const GRID_SPACING = 40;
  const SNAP_RADIUS = 10;

  /* ---------- EXERCISE DATA (with fallback to correctStructure) ---------- */
  const givenData = exercise ? exercise.given : correctStructure;
  const answerData = exercise ? exercise.answer : correctStructure;
  const reagentTop = exercise ? exercise.reagents.top : undefined;
  const reagentBottom = exercise ? exercise.reagents.bottom : undefined;

  /* ---------- STATE ---------- */
  const [atoms, setAtoms] = useState([]);
  const [bonds, setBonds] = useState([]);
  const [selectedAtom, setSelectedAtom] = useState(null);
  const [selectedBond, setSelectedBond] = useState(null);
  const [tool, setTool] = useState("pencil");
  const [atomType, setAtomType] = useState("C");
  const [bondStyle, setBondStyle] = useState("solid");
  const [feedback, setFeedback] = useState(null);

  /* Clear feedback when user modifies canvas */
  useEffect(() => {
    if (feedback) setFeedback(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atoms, bonds]);

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

  /* ---------- SNAP ---------- */
  const findSnapPoint = (x, y) => {
    let closest = null;
    let minDist = Infinity;
    for (const p of gridPoints) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < minDist) {
        minDist = d;
        closest = p;
      }
    }
    return minDist <= SNAP_RADIUS ? closest : null;
  };

  /* ---------- CANVAS CLICK ---------- */
  const handleCanvasClick = (e) => {
    if (tool !== "pencil") return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const snap = findSnapPoint(x, y);
    if (!snap) return;

    if (atoms.some(a => a.x === snap.x && a.y === snap.y)) return;

    setAtoms([...atoms, { id: Date.now(), x: snap.x, y: snap.y, label: atomType }]);
    setSelectedAtom(null);
  };

  /* ---------- ATOM CLICK ---------- */
  const handleAtomClick = (atomId) => {
    if (tool === "eraser") {
      setAtoms(atoms.filter(a => a.id !== atomId));
      setBonds(bonds.filter(b => b.from !== atomId && b.to !== atomId));
      return;
    }

    if (selectedAtom === null) {
      setSelectedAtom(atomId);
      return;
    }

    if (selectedAtom === atomId) {
      setSelectedAtom(null);
      return;
    }

    const exists = bonds.some(
      b =>
        (b.from === selectedAtom && b.to === atomId) ||
        (b.from === atomId && b.to === selectedAtom)
    );

    if (!exists) {
      setBonds([...bonds, {
        id: Date.now(),
        from: selectedAtom,
        to: atomId,
        order: 1,
        style: bondStyle,
      }]);
    }

    setSelectedAtom(null);
  };

  /* ---------- BOND CLICK ---------- */
  const handleBondClick = (bondId) => {
    if (tool === "eraser") {
      setBonds(bonds.filter(b => b.id !== bondId));
      return;
    }

    setBonds(
      bonds.map(b =>
        b.id === bondId
          ? { ...b, order: b.order === 3 ? 1 : b.order + 1 }
          : b
      )
    );
    setSelectedBond(bondId);
  };

  /* ---------- DELETE ---------- */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Delete" && selectedBond) {
        setBonds(prev => prev.filter(b => b.id !== selectedBond));
        setSelectedBond(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedBond]);

  /* ---------- CHECK ANSWER ---------- */
  const checkAnswer = () => {
    if (atoms.length === 0) {
      setFeedback({ type: "error", message: "Draw your answer first!" });
      return;
    }

    if (atoms.length !== answerData.atoms.length) {
      setFeedback({
        type: "error",
        message: `Incorrect: expected ${answerData.atoms.length} atoms, you drew ${atoms.length}.`
      });
      return;
    }

    if (bonds.length !== answerData.bonds.length) {
      setFeedback({
        type: "error",
        message: `Incorrect: expected ${answerData.bonds.length} bonds, you drew ${bonds.length}.`
      });
      return;
    }

    if (graphsAreEqual(atoms, bonds, answerData.atoms, answerData.bonds)) {
      setFeedback({ type: "success", message: "Correct!" });
    } else {
      setFeedback({ type: "error", message: "Incorrect: check your atom types and bond connections." });
    }
  };

  /* ---------- HELPERS ---------- */
  const atomRadius = (label) => (label && label.length > 1 ? 18 : 12);

  /* ---------- RENDER ---------- */
  return (
    <div>
      {/* Feedback banner */}
      {feedback && (
        <div className={`feedback-banner ${feedback.type === "success" ? "feedback-success" : "feedback-error"}`}>
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", fontWeight: "bold", fontSize: 16, color: "inherit" }}
          >
            &times;
          </button>
        </div>
      )}

      <div className="exercise-layout">
        {/* Left: Given structure */}
        <div className="exercise-panel">
          <div className="exercise-panel-box">
            <div className="exercise-panel-label">Given Structure</div>
            <SetCanvas atoms={givenData.atoms} bonds={givenData.bonds} />
          </div>
        </div>

        {/* Middle: Reagent arrow */}
        <div className="exercise-panel" style={{ display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "center" }}>
          <div className="exercise-panel-box">
            <div className="exercise-panel-label">Reagent</div>
            <div style={{ padding: "10px" }}>
              <ReactionArrow top={reagentTop} bottom={reagentBottom} />
            </div>
          </div>
        </div>

        {/* Right: Editable canvas */}
        <div className="exercise-panel">
          <div className="exercise-panel-box">
            <div className="exercise-panel-label">Your Answer</div>
            <svg
              width={WIDTH}
              height={HEIGHT}
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              style={{ display: "block", maxWidth: "100%", height: "auto" }}
              onClick={handleCanvasClick}
            >
              {/* GRID */}
              {gridPoints.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#ccc" />
              ))}

              {/* BONDS */}
              {bonds.map(bond => {
                const a1 = atoms.find(a => a.id === bond.from);
                const a2 = atoms.find(a => a.id === bond.to);
                if (!a1 || !a2) return null;

                const dx = a2.y - a1.y;
                const dy = a2.x - a1.x;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const offsetX = (dx / len) * 4;
                const offsetY = (dy / len) * 4;

                return [...Array(bond.order)].map((_, i) => (
                  <line
                    key={bond.id + "-" + i}
                    x1={a1.x + offsetX * i}
                    y1={a1.y - offsetY * i}
                    x2={a2.x + offsetX * i}
                    y2={a2.y - offsetY * i}
                    stroke={bond.id === selectedBond ? "red" : "#000"}
                    strokeWidth="3"
                    strokeDasharray={bond.style === "striped" ? "6,4" : "0"}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBondClick(bond.id);
                    }}
                  />
                ));
              })}

              {/* ATOMS */}
              {atoms.map(atom => (
                <g key={atom.id}>
                  <circle
                    cx={atom.x}
                    cy={atom.y}
                    r={atomRadius(atom.label)}
                    fill={atom.id === selectedAtom ? "red" : "#5f021f"}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAtomClick(atom.id);
                    }}
                  />
                  <text
                    x={atom.x}
                    y={atom.y + 4}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#fff"
                    pointerEvents="none"
                  >
                    {atom.label}
                  </text>
                </g>
              ))}
            </svg>

            {/* TOOLBAR */}
            <div className="exercise-toolbar">
              <div className="toolbar-group">
                <button
                  className={`toolbar-btn${tool === "pencil" ? " toolbar-btn-active" : ""}`}
                  onClick={() => setTool("pencil")}
                >
                  Pencil
                </button>
                <button
                  className={`toolbar-btn${tool === "eraser" ? " toolbar-btn-active" : ""}`}
                  onClick={() => setTool("eraser")}
                >
                  Eraser
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => { setAtoms([]); setBonds([]); }}
                >
                  Clear
                </button>
              </div>

              {tool === "pencil" && (
                <div className="toolbar-group">
                  <select className="toolbar-select" value={atomType} onChange={(e) => setAtomType(e.target.value)}>
                    <option value="C">C</option>
                    <option value="H">H</option>
                    <option value="O">O</option>
                    <option value="N">N</option>
                    <option value="Br">Br</option>
                    <option value="Cl">Cl</option>
                    <option value="F">F</option>
                    <option value="I">I</option>
                    <option value="S">S</option>
                    <option value="P">P</option>
                  </select>
                  <select className="toolbar-select" value={bondStyle} onChange={(e) => setBondStyle(e.target.value)}>
                    <option value="solid">Solid</option>
                    <option value="striped">Striped</option>
                  </select>
                </div>
              )}

              <div className="toolbar-group">
                <button className="toolbar-btn toolbar-btn-check" onClick={checkAnswer}>
                  Check Answer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

