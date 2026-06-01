"use client";

interface Snapshot {
  id: string;
  numericValue?: number;
  createdAt: number;
}

interface PriceGraphProps {
  snapshots: Snapshot[];
}

export function PriceGraph({ snapshots }: PriceGraphProps) {
  const priced = snapshots
    .filter((s) => s.numericValue !== undefined)
    .sort((a, b) => a.createdAt - b.createdAt);

  if (priced.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Price graph requires at least 2 data points.
      </p>
    );
  }

  const values = priced.map((s) => s.numericValue!);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const lowestIdx = values.indexOf(minVal);

  const W = 480;
  const H = 120;
  const PAD = { top: 16, right: 16, bottom: 24, left: 48 };

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const valRange = maxVal - minVal || 1;

  function x(i: number) {
    return PAD.left + (i / (priced.length - 1)) * plotW;
  }

  function y(v: number) {
    return PAD.top + plotH - ((v - minVal) / valRange) * plotH;
  }

  const polyline = priced.map((s, i) => `${x(i)},${y(s.numericValue!)}`).join(" ");

  const yTicks = [minVal, minVal + valRange / 2, maxVal].map((v, i) => ({
    v,
    y: y(v),
  }));

  return (
    <div className="rounded-md border border-input p-2 overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-full" style={{ maxHeight: 140 }}>
        {/* Y axis labels */}
        {yTicks.map((t, i) => (
          <text
            key={i}
            x={PAD.left - 4}
            y={t.y + 4}
            textAnchor="end"
            fontSize={10}
            className="fill-muted-foreground"
          >
            ${t.v.toFixed(2)}
          </text>
        ))}

        {/* Gridlines */}
        {yTicks.map((t, i) => (
          <line
            key={i}
            x1={PAD.left}
            y1={t.y}
            x2={W - PAD.right}
            y2={t.y}
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={1}
          />
        ))}

        {/* Price line */}
        <polyline
          points={polyline}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.8}
        />

        {/* Data points */}
        {priced.map((s, i) => (
          <circle
            key={s.id}
            cx={x(i)}
            cy={y(s.numericValue!)}
            r={3}
            fill="currentColor"
            opacity={0.8}
          />
        ))}

        {/* Lowest price annotation */}
        <circle
          cx={x(lowestIdx)}
          cy={y(minVal)}
          r={5}
          fill="none"
          stroke="#22c55e"
          strokeWidth={2}
        />
        <text
          x={x(lowestIdx)}
          y={y(minVal) - 8}
          textAnchor="middle"
          fontSize={9}
          fill="#22c55e"
        >
          Lowest
        </text>

        {/* X axis — just first and last date */}
        <text
          x={PAD.left}
          y={H - 4}
          textAnchor="start"
          fontSize={9}
          className="fill-muted-foreground"
        >
          {new Date(priced[0].createdAt).toLocaleDateString()}
        </text>
        <text
          x={W - PAD.right}
          y={H - 4}
          textAnchor="end"
          fontSize={9}
          className="fill-muted-foreground"
        >
          {new Date(priced[priced.length - 1].createdAt).toLocaleDateString()}
        </text>
      </svg>
    </div>
  );
}
