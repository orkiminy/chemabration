import React, { useState, useEffect, useMemo } from "react";
import SetCanvas from "./setCanvas";
import ReactionArrow from "./addingReaction";
import { reactionLevels } from "./data/reactionLevels.js"; 
import { checkIsomorphism } from "./chemistryUtils";

// --- FIREBASE IMPORTS ---
import { db, auth } from './firebase'; 
import { doc, setDoc, getDoc, onAuthStateChanged } from "firebase/firestore"; 

export default function ExerciseCanvas() {
  /* ---------- CONSTANTS ---------- */
  const WIDTH = 480;
  const HEIGHT = 480;
  const GRID_SPACING = 40;
  const ATOM_RADIUS = 12;
  const SNAP_RADIUS = 10;

  /* ---------- STATE ---------- */
  const [levelIndex, setLevelIndex] = useState(() => Math.floor(Math.random() * reactionLevels.length));
  const [questionCount, setQuestionCount] = useState(1);
  const [user, setUser] = useState(null); // Track the logged-in student

  const [atoms, setAtoms] = useState([]);
  const [bonds, setBonds] = useState([]);
  const [selectedAtom, setSelectedAtom] = useState(null);
  const [selectedBond, setSelectedBond] = useState(null);
  const [tool, setTool] = useState("pencil");
  const [atomType, setAtomType] = useState("C"); 
  const [bondStyle, setBondStyle] = useState("solid");
  const [feedback, setFeedback] = useState("");

  const currentLevel = reactionLevels[levelIndex];

  /* ---------- FIREBASE: PERSISTENCE LOGIC ---------- */

  // 1. Listen for when the student logs in
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadProgress(currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Load progress from the cloud
  const loadProgress = async (uid) => {
    try {
      const studentRef = doc(db, "students", uid);
      const docSnap = await getDoc(studentRef);

      if (docSnap.exists() && docSnap.data().questionCount) {
        setQuestionCount(docSnap.data().questionCount);
      }
    } catch (error) {
      console.error("Error loading progress:", error);
    }
  };

  // 3. Save progress to the cloud
  const saveProgress = async (newCount) => {
    if (user) {
      try {
        const studentRef = doc(db, "students", user.uid);
        await setDoc(studentRef, { 
          questionCount: newCount,
          lastActive: new Date()
        }, { merge: true });
      } catch (error) {
        console.error("Error saving progress:", error);
      }
    }
  };

  /* ---------- HELPER: RANDOMIZER ---------- */
  const getRandomLevelIndex = (currentIndex) => {
    const total = reactionLevels.length;
    if (total <= 1) return 0;
    let nextIndex;
    do {
      nextIndex = Math.floor(Math.random() * total);
    } while (nextIndex === currentIndex);
    return nextIndex;
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

  /* ---------- INTERACTION HANDLERS ---------- */
  const handleCanvasClick = (e) => {
    if (tool !== "pencil") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let closest = null;
    let minDist = Infinity;
    for (const p of gridPoints) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < minDist) { minDist = d; closest = p; }
    }
    const snap = minDist <= SNAP_RADIUS ? closest : null;
    
    if (!snap) return;
    if (atoms.some(a => a.x === snap.x && a.y === snap.y)) return;

    setAtoms([...atoms, { id: Date.now(), x: snap.x, y: snap.y, label: atomType }]);
    setSelectedAtom(null);
    setFeedback(""); 
  };

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

    const exists = bonds.some(b => 
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

  const handleBondClick = (bondId) => {
    if (tool === "eraser") {
      setBonds(bonds.filter(b => b.id !== bondId));
      return;
    }
    setBonds(bonds.map(b =>
      b.id === bondId ? { ...b, order: b.order === 3 ? 1 : b.order + 1 } : b
    ));
    setSelectedBond(bondId);
  };

  /* ---------- CHECK ANSWER ---------- */
  const checkAnswer = () => {
    let possibleSolutions = [];
    if (currentLevel.solutions) possibleSolutions = currentLevel.solutions;
    else if (currentLevel.solution) possibleSolutions = [currentLevel.solution];

    const matchFound = possibleSolutions.some((sol) => {
      if (!sol || !sol.atoms) return false; 
      return checkIsomorphism(atoms, bonds, sol.atoms, sol.bonds);
    });

    if (matchFound) {
      setFeedback("✅ Correct! Next question...");
      
      const nextCount = questionCount + 1;
      
      // Save to Firebase Cloud
      saveProgress(nextCount);

      setTimeout(() => {
        const nextIndex = getRandomLevelIndex(levelIndex);
        setLevelIndex(nextIndex);
        setQuestionCount(nextCount);
        setAtoms([]); 
        setBonds([]);
        setFeedback("");
      }, 1500);

    } else {
      setFeedback("❌ Incorrect. Check regiochemistry and stereochemistry!");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontFamily: "Arial" }}>
      <div style={{marginLeft: 20}}>
        <h2>Question #{questionCount}: {currentLevel.title}</h2>
        <p style={{color: "#666"}}>{currentLevel.description}</p>
        {!user && <p style={{color: "red"}}>⚠️ Not logged in. Progress won't be saved.</p>}
      </div>

      <div style={{ display: "flex", gap: "20px" }}>
        <SetCanvas atoms={currentLevel.question.atoms} bonds={currentLevel.question.bonds} />
        <ReactionArrow key={currentLevel.id} text={currentLevel.reagents} />

        <div>
          <svg
            width={WIDTH}
            height={HEIGHT}
            style={{ border: "1px solid #ccc", cursor: tool === "eraser" ? "not-allowed" : "crosshair" }}
            onClick={handleCanvasClick}
          >
            {gridPoints.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#ccc" />
            ))}

            {bonds.map(bond => {
              const a1 = atoms.find(a => a.id === bond.from);
              const a2 = atoms.find(a => a.id === bond.to);
              if (!a1 || !a2) return null;

              if (bond.style === "wedge") {
                const dx = a2.x - a1.x;
                const dy = a2.y - a1.y;
                const angle = Math.atan2(dy, dx);
                const width = 6; 
                const p1x = a1.x;
                const p1y = a1.y;
                const perp = angle + Math.PI / 2;
                const p2x = a2.x + Math.cos(perp) * width;
                const p2y = a2.y + Math.sin(perp) * width;
                const p3x = a2.x - Math.cos(perp) * width;
                const p3y = a2.y - Math.sin(perp) * width;

                return (
                  <polygon
                    key={bond.id}
                    points={`${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}`}
                    fill={bond.id === selectedBond ? "red" : "#000"}
                    onClick={(e) => { e.stopPropagation(); handleBondClick(bond.id); }}
                  />
                );
              }

              const dx = a2.y - a1.y;
              const dy = a2.x - a1.x;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              const offsetX = (dx / len) * 6;
              const offsetY = (dy / len) * 6;

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
                  onClick={(e) => { e.stopPropagation(); handleBondClick(bond.id); }}
                />
              ));
            })}

            {atoms.map(atom => (
              <g key={atom.id}>
                <circle
                  cx={atom.x}
                  cy={atom.y}
                  r={ATOM_RADIUS}
                  fill={atom.id === selectedAtom ? "red" : "#5f021f"}
                  onClick={(e) => { e.stopPropagation(); handleAtomClick(atom.id); }}
                />
                <text x={atom.x} y={atom.y + 4} textAnchor="middle" fontSize="12" fill="#fff" pointerEvents="none">
                  {atom.label}
                </text>
              </g>
            ))}
          </svg>

          <div style={{ marginTop: "10px", padding: "10px", background: "#222", color: "#fff", display: "flex", gap: "10px", alignItems: "center" }}>
            <button onClick={() => setTool("pencil")}>Pencil</button>
            <button onClick={() => setTool("eraser")}>Eraser</button>
            <button onClick={() => { setAtoms([]); setBonds([]); }}>Clear</button>
            
            <select value={atomType} onChange={(e) => setAtomType(e.target.value)}>
              <option value="C">C</option>
              <option value="H">H</option>
              <option value="O">O</option>
              <option value="N">N</option>
              <option value="Br">Br</option>
              <option value="Cl">Cl</option>
              <option value="OH">OH</option>
            </select>

            <select value={bondStyle} onChange={(e) => setBondStyle(e.target.value)}>
              <option value="solid">Solid (Line)</option>
              <option value="wedge">Solid (Wedge)</option>
              <option value="striped">Dashed (Striped)</option>
            </select>
            
            <button onClick={checkAnswer} style={{ background: "#4CAF50", color: "white", marginLeft: "auto" }}>
              Check Answer
            </button>
          </div>
          <div style={{ marginTop: 10, fontWeight: "bold" }}>{feedback}</div>
        </div>
      </div>
    </div>
  );
}