// src/services/grading/gameScoreUtils.js

export function scoreFromBenchmark(value, levels, inverted = false) {
  // Supports 3-level (low, mid, high) or 4-level (low, mid, high, elite)
  const [low, mid, high, elite] = levels;

  const buckets =
    levels.length >= 4
      ? [
          { cap: low, score: 45 },
          { cap: mid, score: 60 },
          { cap: high, score: 75 },
          { cap: elite, score: 88 },
          { cap: Infinity, score: 95 }
        ]
      : [
          { cap: low, score: 45 },
          { cap: mid, score: 65 },
          { cap: high, score: 80 },
          { cap: Infinity, score: 90 }
        ];

  let score = buckets.find(b => value <= b.cap)?.score ?? buckets[buckets.length - 1].score;

  if (inverted) score = 100 - score;

  return score;
}
