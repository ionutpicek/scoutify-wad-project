import React, { useMemo } from "react";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const buildPath = points =>
  points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

export default function LineTrendChart({
  points = [],
  height = 180,
  minValue = 1,
  maxValue = 10,
  autoScale = false,
  color = "#ff681f",
  valueLabel = "Form score",
  emptyLabel = "No form data available yet.",
}) {
  const chart = useMemo(() => {
    const valid = Array.isArray(points)
      ? points
          .map(point => {
            const value = Number(point?.value ?? point?.grade);
            if (!Number.isFinite(value)) return null;
            return {
              ...point,
              value,
            };
          })
          .filter(Boolean)
      : [];
    const hasXAxisLogos = valid.some(point => Boolean(point?.opponentLogoURL));

    const valueMin = valid.length ? Math.min(...valid.map(point => point.value)) : minValue;
    const valueMax = valid.length ? Math.max(...valid.map(point => point.value)) : maxValue;
    const rawRange = Math.max(0, valueMax - valueMin);
    const dynamicPad = rawRange === 0 ? 0.5 : Math.max(0.2, rawRange * 0.25);
    const effectiveMin = autoScale
      ? Math.max(minValue, valueMin - dynamicPad)
      : minValue;
    const effectiveMax = autoScale
      ? Math.min(maxValue, valueMax + dynamicPad)
      : maxValue;
    const safeMax = effectiveMax <= effectiveMin ? effectiveMin + 0.1 : effectiveMax;

    const left = 7;
    const right = 2;
    const top = 6;
    const bottom = hasXAxisLogos ? 24 : 14;
    const width = 100 - left - right;
    const innerHeight = 100 - top - bottom;

    const normalized = valid.map((point, index) => {
      const x = valid.length <= 1 ? left + width / 2 : left + (index / (valid.length - 1)) * width;
      const ratio = clamp((point.value - effectiveMin) / Math.max(0.0001, safeMax - effectiveMin), 0, 1);
      const y = top + (1 - ratio) * innerHeight;
      return {
        ...point,
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
      };
    });

    return {
      points: normalized,
      path: normalized.length ? buildPath(normalized) : "",
      axisMin: effectiveMin,
      axisMax: safeMax,
      hasXAxisLogos,
    };
  }, [autoScale, color, maxValue, minValue, points]);

  if (!chart.points.length) {
    return (
      <div
        style={{
          height,
          border: "1px dashed rgba(17,24,39,0.18)",
          borderRadius: 12,
          display: "grid",
          placeItems: "center",
          color: "#6b7280",
          fontSize: 13,
          background: "#fff",
        }}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height,
        position: "relative",
        border: "1px solid rgba(17,24,39,0.08)",
        borderRadius: 12,
        background: "#fff",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", left: 8, top: 6, fontSize: 11, color: "#6b7280", fontWeight: 600 }}>
        {Number(chart.axisMax).toFixed(1)}
      </div>
      <div
        style={{
          position: "absolute",
          left: 10,
          bottom: chart.hasXAxisLogos ? 34 : 14,
          fontSize: 11,
          color: "#6b7280",
          fontWeight: 600,
        }}
      >
        {Number(chart.axisMin).toFixed(1)}
      </div>
      {chart.hasXAxisLogos ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 16,
            height: 18,
            pointerEvents: "none",
          }}
          aria-hidden="true"
        >
          {chart.points.map((point, index) =>
            point?.opponentLogoURL ? (
              <div
                key={`logo-${index}`}
                style={{
                  position: "absolute",
                  left: `calc(${point.x}% - 9px)`,
                  top: 0,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: "1px solid rgba(17,24,39,0.1)",
                  background: "#fff",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  overflow: "hidden",
                  display: "grid",
                  placeItems: "center",
                }}
                title={point.opponent ? `Opponent: ${point.opponent}` : "Opponent"}
              >
                <img
                  src={point.opponentLogoURL}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", padding: 1 }}
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              </div>
            ) : null
          )}
        </div>
      ) : null}

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
        {[20, 40, 60, 80].map(y => (
          <line
            key={`grid-${y}`}
            x1="0"
            y1={y}
            x2="100"
            y2={y}
            stroke="rgba(17,24,39,0.08)"
            strokeWidth="0.35"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <path
          d={chart.path}
          fill="none"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      >
        {chart.points.map((point, index) => (
          <div
            key={`pt-${index}`}
            title={[
              point.label,
              point.opponent ? `vs ${point.opponent}` : null,
              point.resultOutcome ? `${point.resultOutcome.toUpperCase()} ${point.resultScore || ""}`.trim() : null,
              Number.isFinite(Number(point.rawGrade)) ? `Raw grade ${Number(point.rawGrade).toFixed(1)}` : null,
              `${valueLabel} ${point.value.toFixed(1)}`,
              Number.isFinite(Number(point.resultBonus))
                ? `Result adj ${Number(point.resultBonus) >= 0 ? "+" : ""}${Number(point.resultBonus).toFixed(1)}`
                : null,
            ]
              .filter(Boolean)
              .join(" | ")}
            style={{
              position: "absolute",
              left: `calc(${point.x}% - 5px)`,
              top: `calc(${point.y}% - 5px)`,
              width: 10,
              height: 10,
              borderRadius: "50%",
              background:
                point.resultOutcome === "win"
                  ? "#16a34a"
                  : point.resultOutcome === "loss"
                    ? "#dc2626"
                    : point.resultOutcome === "draw"
                      ? "#f59e0b"
                      : color,
              border: "2px solid #fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.14)",
              pointerEvents: "auto",
            }}
          />
        ))}
      </div>
    </div>
  );
}
