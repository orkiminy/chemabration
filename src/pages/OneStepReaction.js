import React, { useState } from "react";
import ChemicalCanvas from "../ChemicalCanvas";
import ReactionTemplate from "../addingReaction";
import SetCanvas from "../setCanvas";
import ExerciseCanvas from "../ExerciseCanvas"; // <-- import the new exercise component

export default function ChemicalEditorPage() {
  const [tool, setTool] = useState("pencil");
  const canvasRef1 = React.useRef();
  const canvasRef2 = React.useRef();

  return (
    <div style={{ padding: "20px" }}>
      <h1>One Step Reactions</h1>

      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>

        {/* Exercise component for comparison */}
        <ExerciseCanvas exerciseId={1} />
      </div>
    </div>
  );
}
