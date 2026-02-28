import React from "react";
import { Link } from "react-router-dom";
import ExerciseCanvas from "../ExerciseCanvas";
import exercises from "../data/exercises.json";

export default function ChemicalEditorPage() {
  return (
    <div className="exercise-page">
      <nav className="exercise-nav">
        <Link to="/" className="exercise-nav-back">&larr; Back to Home</Link>
        <span className="exercise-nav-title">One Step Reactions</span>
      </nav>

      <ExerciseCanvas exercise={exercises[0]} />
    </div>
  );
}
