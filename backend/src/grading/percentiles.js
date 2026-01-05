// src/services/grading/percentiles.js
export function percentileRank(value, sortedAsc) {
  if (!sortedAsc || sortedAsc.length === 0) return 0;
  let lo = 0, hi = sortedAsc.length - 1;

  // lower_bound binary search
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (sortedAsc[mid] >= value) hi = mid;
    else lo = mid + 1;
  }
  const idx = sortedAsc[lo] >= value ? lo : sortedAsc.length - 1;
  return sortedAsc.length === 1 ? 1 : idx / (sortedAsc.length - 1);
}
