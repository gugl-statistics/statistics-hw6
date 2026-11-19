// ===================================================================
// chi2.js - contingency table, frequencies, expected counts, chi-square test
// ===================================================================

// order the categories in a sensible way (known orders first, then alphabetical)
const ORDER = ["First", "Second", "Third", "Survived", "Died", "female", "male", "Success", "Failure",
  "child (<18)", "adult (18-59)", "senior (60+)", "Southampton", "Cherbourg", "Queenstown", "with family", "alone", "unknown"];
const byOrder = (a, b) => {
  const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  return String(a).localeCompare(String(b));
};

// counts n[i][j] of the pairs (x, f)
function contingency(xs, fs) {
  const rows = [...new Set(xs)].sort(byOrder), cols = [...new Set(fs)].sort(byOrder);
  const ri = new Map(rows.map((r, i) => [r, i])), ci = new Map(cols.map((c, j) => [c, j]));
  const n = rows.map(() => cols.map(() => 0));
  for (let k = 0; k < xs.length; k++) n[ri.get(xs[k])][ci.get(fs[k])]++;
  return { rows, cols, n };
}

function analyse(n) {
  const r = n.length, c = n[0].length;
  const rowTot = n.map((row) => row.reduce((a, b) => a + b, 0));
  const colTot = n[0].map((_, j) => n.reduce((a, row) => a + row[j], 0));
  const N = rowTot.reduce((a, b) => a + b, 0);
  const E = n.map((row, i) => row.map((_, j) => (rowTot[i] * colTot[j]) / N));
  let chi2 = 0;
  const contrib = n.map((row, i) => row.map((v, j) => { const e = E[i][j]; const q = e > 0 ? (v - e) ** 2 / e : 0; chi2 += q; return q; }));
  const resid = n.map((row, i) => row.map((v, j) => (E[i][j] > 0 ? (v - E[i][j]) / Math.sqrt(E[i][j]) : 0)));
  const df = (r - 1) * (c - 1);
  return {
    N, rowTot, colTot, E, contrib, resid, chi2, df,
    p: df > 0 ? chi2Sf(chi2, df) : NaN,
    V: Math.min(r, c) > 1 ? Math.sqrt(chi2 / (N * (Math.min(r, c) - 1))) : NaN,
    margX: rowTot.map((t) => t / N), margF: colTot.map((t) => t / N),
    condFgivenX: n.map((row, i) => row.map((v) => (rowTot[i] ? v / rowTot[i] : 0))),
    condXgivenF: n.map((row) => row.map((v, j) => (colTot[j] ? v / colTot[j] : 0))),
    minE: Math.min(...E.flat()), smallE: E.flat().filter((e) => e < 5).length / (r * c),
  };
}

// ---------- p-value of the chi-square test: P(chi2_df > x) = Q(df/2, x/2)
// log Gamma with the Lanczos approximation (g = 7, 9 terms)
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
function lgamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  x -= 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
function chi2Sf(x, df) {
  const a = df / 2, z = x / 2;
  if (x <= 0) return 1;
  const pre = Math.exp(-z + a * Math.log(z) - lgamma(a));
  if (z < a + 1) {                        // series for the lower part P(a, z)
    let term = 1 / a, s = term;
    for (let k = 1; k < 1000 && Math.abs(term) > 1e-17 * Math.abs(s); k++) { term *= z / (a + k); s += term; }
    return Math.max(0, 1 - s * pre);
  }
  const tiny = 1e-300;                    // continued fraction for Q(a, z), modified Lentz
  let b = z + 1 - a, C = 1 / tiny, D = 1 / b, h = D;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    D = an * D + b; if (Math.abs(D) < tiny) D = tiny;
    C = b + an / C; if (Math.abs(C) < tiny) C = tiny;
    D = 1 / D;
    const d = D * C;
    h *= d;
    if (Math.abs(d - 1) < 1e-16) break;
  }
  return h * pre;
}
// density of the chi-square distribution (for the plot)
function chi2Pdf(x, df) {
  if (x <= 0) return df === 2 ? 0.5 : df < 2 ? Infinity : 0;
  const a = df / 2;
  return Math.exp((a - 1) * Math.log(x) - x / 2 - a * Math.log(2) - lgamma(a));
}
function chi2Crit(df, alpha = 0.05) {
  let lo = 0, hi = 1000;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (chi2Sf(m, df) > alpha) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

// ---------- simulated hackers (same model as code/chi2.py)
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// strength d in [0, 1]: success probabilities move from 0.30 for all to 0.45 / 0.30 / 0.15
function simulateHackers(m, d, seed) {
  const rng = makeRng(seed), xs = [], fs = [];
  const techs = ["Phishing", "SQL injection", "Brute force"], w = [0.40, 0.35, 0.25];
  const p = [0.30 + 0.15 * d, 0.30, 0.30 - 0.15 * d];
  for (let k = 0; k < m; k++) {
    const u = rng();
    const t = u < w[0] ? 0 : u < w[0] + w[1] ? 1 : 2;
    xs.push(techs[t]);
    fs.push(rng() < p[t] ? "Success" : "Failure");
  }
  return { xs, fs, p };
}

if (typeof module !== "undefined") module.exports = { contingency, analyse, chi2Sf, chi2Pdf, chi2Crit, lgamma, simulateHackers };
