import { useState } from "react";
import reactionsData from "./data/reactions.json";

export default function ReactionArrow({ top, bottom }) {
  // Fallback: if no props passed, cycle through reactions.json (old behavior)
  const [currentIndex, setCurrentIndex] = useState(0);
  const current = reactionsData[currentIndex];

  const displayTop = top !== undefined ? top : current.top;
  const displayBottom = bottom !== undefined ? bottom : current.bottom;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "40px",
      fontFamily: "Arial",
      padding: "10px",
      border: "1px solid #ccc",
      borderRadius: "8px",
      background: "#f7f7f7",
      justifyContent: "center"
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontWeight: "bold", fontSize: "20px", marginBottom: "5px" }}>
          {displayTop}
        </div>
        <div style={{ fontSize: "28px", fontWeight: "bold" }}>→</div>
        <div style={{ fontWeight: "bold", fontSize: "20px", marginTop: "5px" }}>
          {displayBottom}
        </div>
      </div>
    </div>
  );
}
