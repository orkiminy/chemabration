import React, { useState, useEffect, useMemo } from "react";
import SetCanvas from "./setCanvas";
import ReactionArrow from "./addingReaction";
import correctStructure from "./data/correctStructure.json"; // <-- your answer JSON

export default function ExerciseCanvas() {
  /* ---------- CONSTANTS ---------- */
  const WIDTH = 480;
  const HEIGHT = 480;
  const GRID_SPACING = 40;
  const ATOM_RADIUS = 12;
  const SNAP_RADIUS = 10;

  /* ---------- STATE ---------- */
  const [atoms, setAtoms] = useState([]);
  const [bonds, setBonds] = useState([]);
  const [selectedAtom, setSelectedAtom] = useState(null);
  const [selectedBond, setSelectedBond] = useState(null);
  const [tool, setTool] = useState("pencil");
  const [atomType, setAtomType] = useState("C");
  const [bondStyle, setBondStyle] = useState("solid");

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
        setBonds(bonds.filter(b => b.id !== selectedBond));
        setSelectedBond(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedBond, bonds]);

  /* ---------- CHECK ANSWER ---------- */
  const checkAnswer = () => {
    if (atoms.length !== correctStructure.atoms.length ||
        bonds.length !== correctStructure.bonds.length) {
      alert("Incorrect: number of atoms or bonds does not match.");
      return;
    }

    for (let i = 0; i < atoms.length; i++) {
      if (atoms[i].label !== correctStructure.atoms[i].label) {
        alert("Incorrect: atom labels do not match.");
        return;
      }
    }

    for (let i = 0; i < bonds.length; i++) {
      const userBond = bonds[i];
      const correctBond = correctStructure.bonds[i];
      if (userBond.from !== correctBond.from ||
          userBond.to !== correctBond.to ||
          userBond.style !== correctBond.style) {
        alert("Incorrect: bonds do not match.");
        return;
      }
    }

    alert("Correct! 🎉");
  };

  /* ---------- RENDER ---------- */
  return (
    <div style={{ display: "flex", gap: "20px", fontFamily: "Arial" }}>
      {/* Left: given structure from JSON */}
      <SetCanvas atoms={correctStructure.atoms} bonds={correctStructure.bonds} />

      {/* Middle: reaction instruction */}
      <ReactionArrow />

      {/* Right: editable canvas */}
      <div>
        <svg
          width={WIDTH}
          height={HEIGHT}
          style={{ border: "1px solid #ccc" }}
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
                r={ATOM_RADIUS}
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
        <div style={{
          marginTop: "10px",
          padding: "10px",
          background: "#222",
          color: "#fff",
          display: "flex",
          gap: "10px",
          alignItems: "center"
        }}>
          <button onClick={() => setTool("pencil")}>Pencil</button>
          <button onClick={() => setTool("eraser")}>Eraser</button>
          <button onClick={() => { setAtoms([]); setBonds([]); }}>Clear</button>
          <button onClick={checkAnswer}>Check Answer</button>

          {tool === "pencil" && (
            <>
              <select value={atomType} onChange={(e) => setAtomType(e.target.value)}>
                <option value="C">C</option>
                <option value="H">H</option>
              </select>
              <select value={bondStyle} onChange={(e) => setBondStyle(e.target.value)}>
                <option value="solid">Solid</option>
                <option value="striped">Striped</option>
              </select>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
