import { useMemo } from "react";

export default function SetCanvas({ atoms = [], bonds = [] }) {
  const WIDTH = 480;
  const HEIGHT = 480;
  const GRID_SPACING = 40;
  const ATOM_RADIUS = 12;

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

  return (
    <div style={{ fontFamily: "Arial" }}>
      <svg
        width={WIDTH}
        height={HEIGHT}
        style={{ border: "1px solid #ccc" }}
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

          return [...Array(bond.order || 1)].map((_, i) => (
            <line
              key={bond.id + "-" + i}
              x1={a1.x + offsetX * i}
              y1={a1.y - offsetY * i}
              x2={a2.x + offsetX * i}
              y2={a2.y - offsetY * i}
              stroke="#000"
              strokeWidth="3"
              strokeDasharray={bond.style === "striped" ? "6,4" : "0"}
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
              fill="#5f021f"
            />
            <text
              x={atom.x}
              y={atom.y + 4}
              textAnchor="middle"
              fontSize="12"
              fill="#fff"
            >
              {atom.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
