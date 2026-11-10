// Converts raw minigame results into tournament points.
//
// Points are placement-based so every minigame is worth the same no matter
// how its raw scores are scaled: 1st place earns 100, last place (with a
// non-zero score) earns 30, and a zero score earns nothing.

export const MAX_POINTS = 100;
export const MIN_POINTS = 30;
export const PERFECT_BONUS = 25;

/**
 * @param {Record<string,{raw:number,label?:string,perfect?:boolean}>} results
 * @param {string[]} pids participants
 * @param {{double?:boolean, finalDouble?:boolean, goldenId?:string, underdogIds?:Set<string>}} ctx
 */
export function scoreRound(results, pids, ctx = {}) {
  const rows = pids.map((id) => {
    const r = results[id] || {};
    const raw = Number.isFinite(r.raw) ? r.raw : 0;
    return { id, raw, label: String(r.label ?? raw), perfect: !!r.perfect };
  });
  rows.sort((a, b) => b.raw - a.raw);

  const n = rows.length;
  let rank = 0;
  rows.forEach((row, i) => {
    if (i === 0 || row.raw !== rows[i - 1].raw) rank = i + 1;
    row.rank = rank;
    let base = 0;
    if (row.raw > 0) {
      base = n <= 1 ? MAX_POINTS : Math.round(MIN_POINTS + ((MAX_POINTS - MIN_POINTS) * (n - rank)) / (n - 1));
    }
    if (row.perfect && row.raw > 0) base += PERFECT_BONUS;
    let mult = 1;
    const tags = [];
    if (ctx.double) { mult *= 2; tags.push('×2'); }
    if (ctx.finalDouble) { mult *= 2; tags.push('Final ×2'); }
    if (ctx.goldenId === row.id) { mult *= 3; tags.push('Golden ×3'); }
    if (ctx.underdogIds && ctx.underdogIds.has(row.id)) { mult *= 1.5; tags.push('Underdog ×1.5'); }
    row.mult = mult;
    row.tags = tags;
    row.points = Math.round(base * mult);
  });
  return rows;
}

// Competition ranking ("1, 2, 2, 4") on a sorted list.
export function assignRanks(list, key = 'score') {
  let rank = 0;
  list.forEach((row, i) => {
    if (i === 0 || row[key] !== list[i - 1][key]) rank = i + 1;
    row.rank = rank;
  });
  return list;
}
