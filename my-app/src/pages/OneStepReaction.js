import React from "react";
import { Link } from "react-router-dom";
import ExerciseCanvas from "../ExerciseCanvas";

export default function ChemicalEditorPage() {
  return (
    <div className="exercise-page">
      <nav className="exercise-nav">
        <Link to="/" className="exercise-nav-back">&larr; Back to Home</Link>
        <span className="exercise-nav-title">One Step Reactions</span>
        <span className="exercise-nav-spacer"></span>
      </nav>

      <ExerciseCanvas />
    </div>
  );
}
