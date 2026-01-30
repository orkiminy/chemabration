import { useState } from "react";
import reactionsData from "./data/reactions.json";

export default function ReactionArrow() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const current = reactionsData[currentIndex];

  const nextReaction = () => {
    setCurrentIndex((prev) => (prev + 1) % reactionsData.length);
  };

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
          {current.top}
        </div>
        <div style={{ fontSize: "28px", fontWeight: "bold" }}>→</div>
        <div style={{ fontWeight: "bold", fontSize: "20px", marginTop: "5px" }}>
          {current.bottom}
        </div>
      </div>
    </div>
  );
}
