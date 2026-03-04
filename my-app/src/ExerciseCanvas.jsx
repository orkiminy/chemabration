import React, { useState, useEffect, useMemo } from "react";
import SetCanvas from "./setCanvas";
import ReactionArrow from "./addingReaction";
import { reactionLevels } from "./data/reactionLevels.js";
import { checkIsomorphism } from "./chemistryUtils";
import { applyReaction, applyDescriptor } from "./engine/transformationEngine.js";

// --- FIREBASE IMPORTS ---
import { db } from './firebase';
import { doc, setDoc, getDoc, collection, addDoc, serverTimestamp, increment } from "firebase/firestore";
import { useAuth } from './contexts/AuthContext';

export default function ExerciseCanvas({ exerciseType = "OneStepReaction" }) {
  /* ---------- CONSTANTS ---------- */
  const WIDTH = 480;
  const HEIGHT = 480;
  const GRID_SPACING = 40;
  const ATOM_RADIUS = 12;
  const SNAP_RADIUS = 10;

  /* ---------- STATE ---------- */
  const [levelIndex, setLevelIndex] = useState(() => Math.floor(Math.random() * reactionLevels.length));
  const [questionCount, setQuestionCount] = useState(1);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());

  const [atoms, setAtoms] = useState([]);
  const [bonds, setBonds] = useState([]);
  const [selectedAtom, setSelectedAtom] = useState(null);
  const [selectedBond, setSelectedBond] = useState(null);
  const [tool, setTool] = useState("pencil");
  const [atomType, setAtomType] = useState("C");
  const [bondStyle, setBondStyle] = useState("solid");
  const [feedback, setFeedback] = useState(null);

  // Multi-step state
  const [currentStep, setCurrentStep] = useState(0);
  const [intermediateResult, setIntermediateResult] = useState(null);

  // Show Answer state
  const [showAnswer, setShowAnswer] = useState(false);
  const [answerProducts, setAnswerProducts] = useState([]);
  const [answerEnantiomerIndex, setAnswerEnantiomerIndex] = useState(0);

const { user } = useAuth();
  const currentLevel = reactionLevels[levelIndex];

  /* Clear feedback when user modifies canvas */
  useEffect(() => {
    if (feedback) setFeedback(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atoms, bonds]);

  /* ---------- FIREBASE: PERSISTENCE LOGIC ---------- */

  useEffect(() => {
    if (user) {
      loadProgress(user.uid);
    }
  }, [user]);

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

  const saveProgress = async (newCount, isCorrect) => {
    if (!user) return;
    try {
      const studentRef = doc(db, "students", user.uid);
      const updateData = {
        questionCount: newCount,
        lastActive: new Date(),
      };
      if (isCorrect) {
        updateData.correctCount = increment(1);
      }
      await setDoc(studentRef, updateData, { merge: true });
    } catch (error) {
      console.error("Error saving progress:", error);
    }
  };

  const saveAttempt = async (isCorrect) => {
    if (!user) return;
    try {
      const timeTaken = Math.round((Date.now() - questionStartTime) / 1000);
      const attemptsRef = collection(db, "students", user.uid, "attempts");
      await addDoc(attemptsRef, {
        levelId: currentLevel.id,
        levelTitle: currentLevel.title,
        levelIndex: levelIndex,
        correct: isCorrect,
        timestamp: serverTimestamp(),
        timeTaken: timeTaken,
        exerciseType: exerciseType,
      });
    } catch (error) {
      console.error("Error saving attempt:", error);
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

  /* ---------- DELETE KEY ---------- */
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

  /* ---------- SHOW ANSWER ---------- */
  const handleShowAnswer = () => {
    if (showAnswer) {
      setShowAnswer(false);
      return;
    }
    let products;
    if (currentLevel.multiStep && currentLevel.steps) {
      // For multi-step: show the current step's stored solution
      products = currentLevel.steps[currentStep].solutions || [];
    } else {
      products = applyReaction(currentLevel.id, currentLevel.question.atoms, currentLevel.question.bonds);
    }
    setAnswerProducts(products);
    setAnswerEnantiomerIndex(0);
    setShowAnswer(true);
  };

/* ---------- CHECK ANSWER ---------- */
  const advanceToNextQuestion = () => {
    const nextCount = questionCount + 1;
    saveAttempt(true);
    saveProgress(nextCount, true);

    setTimeout(() => {
      const nextIndex = getRandomLevelIndex(levelIndex);
      setLevelIndex(nextIndex);
      setQuestionCount(nextCount);
      setAtoms([]);
      setBonds([]);
      setFeedback(null);
      setCurrentStep(0);
      setIntermediateResult(null);
      setQuestionStartTime(Date.now());
      setShowAnswer(false);
      setAnswerProducts([]);
      setAnswerEnantiomerIndex(0);
    }, 1500);
  };

  const checkAnswer = () => {
    if (atoms.length === 0) {
      setFeedback({ type: "error", message: "Draw your answer first!" });
      return;
    }

    // Multi-step question
    if (currentLevel.multiStep && currentLevel.steps) {
      const step = currentLevel.steps[currentStep];
      const matchFound = step.solutions.some((sol) => {
        if (!sol || !sol.atoms) return false;
        return checkIsomorphism(atoms, bonds, sol.atoms, sol.bonds);
      });

      if (matchFound && currentStep < currentLevel.steps.length - 1) {
        // Step correct, but more steps remain
        setIntermediateResult({ atoms: [...atoms], bonds: [...bonds] });
        setCurrentStep(currentStep + 1);
        setAtoms([]);
        setBonds([]);
        setFeedback({ type: "success", message: `Step ${currentStep + 1} correct! Now complete step ${currentStep + 2}...` });
      } else if (matchFound) {
        // Final step correct — advance
        setFeedback({ type: "success", message: "Correct! All steps complete. Next question..." });
        advanceToNextQuestion();
      } else {
        setFeedback({ type: "error", message: `Incorrect. Check step ${currentStep + 1}!` });
        saveAttempt(false);
      }
      return;
    }

    // Single-step question (unchanged)
    let possibleSolutions = [];
    if (currentLevel.solutions) possibleSolutions = currentLevel.solutions;
    else if (currentLevel.solution) possibleSolutions = [currentLevel.solution];

    const matchFound = possibleSolutions.some((sol) => {
      if (!sol || !sol.atoms) return false;
      return checkIsomorphism(atoms, bonds, sol.atoms, sol.bonds);
    });

    if (matchFound) {
      setFeedback({ type: "success", message: "Correct! Next question..." });
      advanceToNextQuestion();
    } else {
      setFeedback({ type: "error", message: "Incorrect. Check regiochemistry and stereochemistry!" });
      saveAttempt(false);
    }
  };

  /* ---------- HELPERS ---------- */
  const atomRadius = (label) => (label && label.length > 1 ? 18 : ATOM_RADIUS);

  /* ---------- RENDER ---------- */
  return (
    <div>
      {/* Question header */}
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ color: "#5f021f", margin: 0 }}>
          Question #{questionCount}: {currentLevel.title}
          {currentLevel.multiStep && currentLevel.steps && (
            <span style={{ fontSize: "0.7em", fontWeight: "normal", marginLeft: 12, color: "#888" }}>
              Step {currentStep + 1} of {currentLevel.steps.length}
            </span>
          )}
        </h2>
        <p style={{ color: "#666", margin: "4px 0 0" }}>
          {currentLevel.multiStep && currentLevel.steps
            ? currentLevel.steps[currentStep].description || currentLevel.description
            : currentLevel.description}
        </p>
      </div>

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
        {/* Given structure */}
        <div className="exercise-panel">
          <div className="exercise-panel-box">
            <div className="exercise-panel-label">Given Structure</div>
            <SetCanvas atoms={currentLevel.question.atoms} bonds={currentLevel.question.bonds} />
          </div>
        </div>

        {/* Step 1 arrow */}
        <div className="exercise-panel" style={{ display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "center" }}>
          <div className="exercise-panel-box">
            <div className="exercise-panel-label">
              {currentLevel.multiStep ? "Step 1" : "Reagent"}
            </div>
            <div style={{ padding: "10px" }}>
              <ReactionArrow
                key={`${currentLevel.id}-step0`}
                text={currentLevel.multiStep && currentLevel.steps
                  ? currentLevel.steps[0].reagents
                  : currentLevel.reagents}
              />
            </div>
          </div>
        </div>

        {/* For multi-step on step 2+: show intermediate + step 2 arrow before the drawing canvas */}
        {currentLevel.multiStep && currentStep > 0 && intermediateResult && (
          <>
            <div className="exercise-panel">
              <div className="exercise-panel-box">
                <div className="exercise-panel-label" style={{ color: "green" }}>Intermediate ✓</div>
                <SetCanvas atoms={intermediateResult.atoms} bonds={intermediateResult.bonds} />
              </div>
            </div>
            <div className="exercise-panel" style={{ display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "center" }}>
              <div className="exercise-panel-box">
                <div className="exercise-panel-label">Step 2</div>
                <div style={{ padding: "10px" }}>
                  <ReactionArrow
                    key={`${currentLevel.id}-step${currentStep}`}
                    text={currentLevel.steps[currentStep].reagents}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Right: Editable canvas */}
        <div className="exercise-panel">
          <div className="exercise-panel-box">
            <div className="exercise-panel-label">Your Answer</div>
            <svg
              width={WIDTH}
              height={HEIGHT}
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              style={{ display: "block", maxWidth: "100%", height: "auto", cursor: tool === "eraser" ? "not-allowed" : "crosshair" }}
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

                if (bond.style === "wedge") {
                  const dx = a2.x - a1.x;
                  const dy = a2.y - a1.y;
                  const angle = Math.atan2(dy, dx);
                  const width = 6;
                  const perp = angle + Math.PI / 2;
                  const p2x = a2.x + Math.cos(perp) * width;
                  const p2y = a2.y + Math.sin(perp) * width;
                  const p3x = a2.x - Math.cos(perp) * width;
                  const p3y = a2.y - Math.sin(perp) * width;

                  return (
                    <polygon
                      key={bond.id}
                      points={`${a1.x},${a1.y} ${p2x},${p2y} ${p3x},${p3y}`}
                      fill={bond.id === selectedBond ? "red" : "#000"}
                      onClick={(e) => { e.stopPropagation(); handleBondClick(bond.id); }}
                    />
                  );
                }

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
                    onClick={(e) => { e.stopPropagation(); handleBondClick(bond.id); }}
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
                    onClick={(e) => { e.stopPropagation(); handleAtomClick(atom.id); }}
                  />
                  {atom.label && atom.label !== "C" && (
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
                  )}
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
                    <option value="OH">OH</option>
                    <option value="Ph">Ph</option>
                    <option value="CH3">CH3</option>
                  </select>
                  <select className="toolbar-select" value={bondStyle} onChange={(e) => setBondStyle(e.target.value)}>
                    <option value="solid">Solid (Line)</option>
                    <option value="wedge">Solid (Wedge)</option>
                    <option value="striped">Dashed (Striped)</option>
                  </select>
                </div>
              )}

              <div className="toolbar-group">
                <button className="toolbar-btn toolbar-btn-check" onClick={checkAnswer}>
                  Check Answer
                </button>
                <button
                  className="toolbar-btn"
                  style={{ opacity: 0.75 }}
                  onClick={handleShowAnswer}
                >
                  {showAnswer ? "Hide Answer" : "Show Answer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Answer panel — shown when Show Answer is clicked */}
      {showAnswer && answerProducts.length > 0 && (
        <div style={{ marginTop: "1.5rem", borderTop: "2px solid #5f021f", paddingTop: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
            <span style={{ fontWeight: "bold", color: "#5f021f" }}>Correct Answer:</span>
            {answerProducts.length > 1 && (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {answerProducts.map((_, i) => (
                  <button
                    key={i}
                    className={`toolbar-btn${answerEnantiomerIndex === i ? " toolbar-btn-active" : ""}`}
                    onClick={() => setAnswerEnantiomerIndex(i)}
                  >
                    Enantiomer {String.fromCharCode(65 + i)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <SetCanvas
            atoms={answerProducts[answerEnantiomerIndex].atoms}
            bonds={answerProducts[answerEnantiomerIndex].bonds}
          />
        </div>
      )}

    </div>
  );
}
