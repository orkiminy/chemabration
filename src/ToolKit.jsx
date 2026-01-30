import React from "react";

function ToolKit({ tool, setTool, createHexagon, clearAll }) {
  return (
    <div
      style={{
        display: "flex",
        padding: "10px",
        background: "#222",
        color: "#fff",
        alignItems: "center",
        gap: "10px",
      }}
    >
      <span>Tool:</span>
      <button
        onClick={() => setTool("pencil")}
        style={{ background: tool === "pencil" ? "#555" : "#888", color: "#fff" }}
      >
        Pencil
      </button>
      <button
        onClick={() => setTool("eraser")}
        style={{ background: tool === "eraser" ? "#555" : "#888", color: "#fff" }}
      >
        Eraser
      </button>
      <button
        onClick={createHexagon}
        style={{ background: "#888", color: "#fff" }}
      >
        Hexagon
      </button>
      <button
        onClick={clearAll}
        style={{ background: "#888", color: "#fff" }}
      >
        Clear All
      </button>
    </div>
  );
}

export default ToolKit;
