// ===================================================================
// main.js - builds every table on the page from the raw data
// ===================================================================
const $ = (id) => document.getElementById(id);
const pct = (x) => (100 * x).toFixed(1) + "%";
const f2 = (x) => x.toFixed(2);
const pfmt = (p) => (p >= 0.001 ? p.toFixed(4) : p.toExponential(2).replace("e", "·10^"));

function seg(el, onChange) {
  const btns = [...el.querySelectorAll("button")];
  btns.forEach((b) => (b.onclick = () => { btns.forEach((x) => x.classList.toggle("on", x === b)); onChange && onChange(b.dataset.v); }));
  return { get: () => el.querySelector("button.on").dataset.v };
}

// generic table: cell(i, j) gives the inner cell, rowTot(i) / colTot(j) / corner optional
function tableHTML(rows, cols, cell, opt = {}) {
  let h = `<tr><th>${opt.corner || ""}</th>${cols.map((c) => `<th class="num">${c}</th>`).join("")}${opt.rowTot ? `<th class="num">${opt.rowTotLabel || "total"}</th>` : ""}</tr>`;
  rows.forEach((r, i) => {
    h += `<tr><td>${r}</td>${cols.map((_, j) => `<td class="num"${opt.style ? ` style="${opt.style(i, j)}"` : ""}>${cell(i, j)}</td>`).join("")}${opt.rowTot ? `<td class="num tot">${opt.rowTot(i)}</td>` : ""}</tr>`;
  });
  if (opt.colTot) h += `<tr class="totrow"><td>${opt.colTotLabel || "total"}</td>${cols.map((_, j) => `<td class="num">${opt.colTot(j)}</td>`).join("")}${opt.rowTot ? `<td class="num">${opt.grand}</td>` : ""}</tr>`;
  return h;
}
const resColor = (r) => {
  const a = Math.min(Math.abs(r) / 6, 1) * 0.55;
  return r > 0 ? `background:rgba(255,138,31,${a})` : `background:rgba(92,200,245,${a})`;
};

function resultText(A, extra = "") {
  const crit = chi2Crit(A.df);
  const reject = A.p < 0.05;
  let warn = "";
  if (A.minE < 1 || A.smallE > 0.2) warn = `\n<span class="bad">warning: ${A.minE < 1 ? "an expected count is below 1" : "more than 20% of the expected counts are below 5"} (min E = ${f2(A.minE)}), the χ² approximation is not reliable</span>`;
  return `χ² = <span class="k">${A.chi2.toFixed(3)}</span>, df = ${A.df}, critical value (5%) = ${crit.toFixed(3)}, p-value = <span class="k">${pfmt(A.p)}</span>, Cramér's V = ${A.V.toFixed(3)}, N = ${A.N}\n` +
    (reject ? `<span class="ok">p &lt; 0.05: reject H₀, the variables are dependent (associated)</span>` : `<span class="s">p ≥ 0.05: no evidence against independence (H₀ not rejected)</span>`) + warn + extra;
}

function distPlot(canvas, A) {
  const crit = chi2Crit(A.df);
  const xmax = Math.max(crit * 2.2, Math.min(A.chi2 * 1.15, crit * 4));
  const ymax = A.df <= 2 ? 0.55 : chi2Pdf(Math.max(A.df - 2, 0.01), A.df) * 1.2;
  const xs = [], ys = [];
  for (let k = 0; k <= 200; k++) { const x = crit + ((xmax - crit) * k) / 200; xs.push(x); ys.push(chi2Pdf(x, A.df)); }
  const shade = xs.map((x, k) => [x, 0, x + (xmax - crit) / 200, ys[k]]);
  const series = [
    { type: "rects", rects: shade, color: COLORS.orange, alpha: 0.6 },
    { type: "fn", f: (x) => Math.min(chi2Pdf(x, A.df), ymax * 2), color: COLORS.sky, width: 2.5 },
  ];
  if (A.chi2 <= xmax) series.push({ type: "vline", x: A.chi2, color: COLORS.white, width: 2.5 });
  plot(canvas, { x: [0, xmax], y: [0, ymax], xlabel: A.chi2 > xmax ? `χ²  (observed χ² = ${A.chi2.toFixed(1)} is far to the right)` : "χ²", series });
}

// =================================================== sections 3 and 4: Titanic class x survival
const T = contingency(TITANIC.class, TITANIC.survived);
const TA = analyse(T.n);
function drawTitanic() {
  const { rows, cols, n } = T, A = TA;
  $("t-obs").innerHTML = tableHTML(rows, cols, (i, j) => n[i][j], { corner: "class \\ outcome", rowTot: (i) => A.rowTot[i], colTot: (j) => A.colTot[j], grand: A.N });
  $("t-margx").innerHTML = `<tr><th>class</th><th class="num">n<sub>i·</sub></th><th class="num">n<sub>i·</sub>/N</th></tr>` +
    rows.map((r, i) => `<tr><td>${r}</td><td class="num">${A.rowTot[i]}</td><td class="num">${A.margX[i].toFixed(4)}</td></tr>`).join("");
  $("t-margf").innerHTML = `<tr><th>outcome</th><th class="num">n<sub>·j</sub></th><th class="num">n<sub>·j</sub>/N</th></tr>` +
    cols.map((c, j) => `<tr><td>${c}</td><td class="num">${A.colTot[j]}</td><td class="num">${A.margF[j].toFixed(4)}</td></tr>`).join("");
  $("t-fx").innerHTML = tableHTML(rows, cols, (i, j) => A.condFgivenX[i][j].toFixed(4), { rowTot: () => "1", colTot: (j) => A.margF[j].toFixed(4), colTotLabel: "marginal", grand: "1" });
  $("t-xf").innerHTML = tableHTML(rows, cols, (i, j) => A.condXgivenF[i][j].toFixed(4), { rowTot: (i) => A.margX[i].toFixed(4), rowTotLabel: "marginal", colTot: () => "1", grand: "1" });
  $("t-exp").innerHTML = tableHTML(rows, cols, (i, j) => `${f2(A.E[i][j])} <span class="dim">(obs. ${n[i][j]})</span>`, { rowTot: (i) => A.rowTot[i], colTot: (j) => A.colTot[j], grand: A.N });
  $("t-contrib").innerHTML = tableHTML(rows, cols, (i, j) => A.contrib[i][j].toFixed(3), { corner: "(n − E)²/E", rowTot: (i) => A.contrib[i].reduce((a, b) => a + b).toFixed(3), colTot: (j) => A.contrib.reduce((a, r) => a + r[j], 0).toFixed(3), grand: A.chi2.toFixed(3) });
  $("t-resid").innerHTML = tableHTML(rows, cols, (i, j) => (A.resid[i][j] > 0 ? "+" : "") + A.resid[i][j].toFixed(2), { corner: "(n − E)/√E", style: (i, j) => resColor(A.resid[i][j]) });
  $("t-result").innerHTML = resultText(A);
  const sj = cols.indexOf("Survived");
  plot($("t-chart"), {
    x: [-0.6, rows.length - 0.4], y: [0, 1], xticks: 3, yticks: 5,
    series: [
      { type: "bars", x: rows.map((_, i) => i), y: rows.map((_, i) => A.condFgivenX[i][sj]), w: 0.55, color: COLORS.orange, alpha: 0.9 },
      { type: "hline", y: A.margF[sj], color: COLORS.white, dash: [6, 4], width: 2 },
    ],
    xlabels: rows,
  });
  distPlot($("t-dist"), A);
}

// =================================================== section 5: explorer
const VARS = { class: "class", sex: "sex", survived: "survived", embarked: "port of embarkation", alone: "travelling alone", age: "age group" };
for (const [k, v] of Object.entries(VARS)) {
  $("ex-x").insertAdjacentHTML("beforeend", `<option value="${k}">${v}</option>`);
  $("ex-f").insertAdjacentHTML("beforeend", `<option value="${k}">${v}</option>`);
}
$("ex-x").value = "sex"; $("ex-f").value = "survived";
const exView = seg($("ex-view"), drawExplorer);
const PALETTE = [COLORS.orange, COLORS.sky, COLORS.white, "#6ee7a8", "#a78bfa", COLORS.grey];
function drawExplorer() {
  const xk = $("ex-x").value, fk = $("ex-f").value;
  if (xk === fk) { $("ex-table").innerHTML = ""; $("ex-result").innerHTML = `<span class="bad">choose two different variables</span>`; return; }
  const { rows, cols, n } = contingency(TITANIC[xk], TITANIC[fk]);
  const A = analyse(n), v = exView.get();
  const corner = `${VARS[xk]} \\ ${VARS[fk]}`;
  if (v === "obs") $("ex-table").innerHTML = tableHTML(rows, cols, (i, j) => n[i][j], { corner, rowTot: (i) => A.rowTot[i], colTot: (j) => A.colTot[j], grand: A.N });
  if (v === "row") $("ex-table").innerHTML = tableHTML(rows, cols, (i, j) => pct(A.condFgivenX[i][j]), { corner, rowTot: () => "100%", colTot: (j) => pct(A.margF[j]), colTotLabel: "marginal", grand: "100%" });
  if (v === "col") $("ex-table").innerHTML = tableHTML(rows, cols, (i, j) => pct(A.condXgivenF[i][j]), { corner, rowTot: (i) => pct(A.margX[i]), rowTotLabel: "marginal", colTot: () => "100%", grand: "100%" });
  if (v === "exp") $("ex-table").innerHTML = tableHTML(rows, cols, (i, j) => `${f2(A.E[i][j])} <span class="dim">(obs. ${n[i][j]})</span>`, { corner, rowTot: (i) => A.rowTot[i], colTot: (j) => A.colTot[j], grand: A.N });
  if (v === "res") $("ex-table").innerHTML = tableHTML(rows, cols, (i, j) => (A.resid[i][j] > 0 ? "+" : "") + A.resid[i][j].toFixed(2), { corner, style: (i, j) => resColor(A.resid[i][j]) });
  // grouped bars: P(F = f_j | X = x_i) for each row, plus the marginal as dashed lines
  const k = cols.length, w = 0.8 / k;
  const series = cols.map((c, j) => ({ type: "bars", x: rows.map((_, i) => i - 0.4 + w * (j + 0.5)), y: rows.map((_, i) => A.condFgivenX[i][j]), w: w * 0.92, color: PALETTE[j % PALETTE.length], alpha: 0.85 }));
  cols.forEach((c, j) => series.push({ type: "hline", y: A.margF[j], color: PALETTE[j % PALETTE.length], dash: [5, 4], width: 1.5 }));
  plot($("ex-chart"), { x: [-0.6, rows.length - 0.4], y: [0, 1], series, xlabels: rows });
  $("ex-legend").innerHTML = cols.map((c, j) => `<span><i style="background:${PALETTE[j % PALETTE.length]}"></i>P(${c} | row)</span>`).join("") + `<span>dashed: marginal frequency (what every bar would be under independence)</span>`;
  $("ex-result").innerHTML = resultText(A);
}
["ex-x", "ex-f"].forEach((id) => ($(id).onchange = drawExplorer));

// =================================================== section 6: hackers
function smallTable(id, D) {
  const A = analyse(D.n);
  $(id).innerHTML = tableHTML(D.rows, D.cols, (i, j) => `${D.n[i][j]} <span class="dim">(E ${f2(A.E[i][j])})</span>`, { rowTot: (i) => `${A.rowTot[i]} <span class="dim">(${pct(A.condFgivenX[i][0])} succ.)</span>`, colTot: (j) => A.colTot[j], grand: A.N });
  $(id + "-r").innerHTML = resultText(A);
}
smallTable("h-ind", PY.hackers_indep);
smallTable("h-dep", PY.hackers_dep);
$("h-power").innerHTML = `<tr><th>m (hackers)</th>${PY.power.map((r) => `<th class="num">${r.m}</th>`).join("")}</tr>` +
  `<tr><td>dependence detected (p &lt; 0.05), 1,000 samples</td>${PY.power.map((r) => `<td class="num">${pct(r.power)}</td>`).join("")}</tr>`;

let seed = 1;
function runSim() {
  const m = +$("s-m").value, d = +$("s-d").value;
  $("s-mv").textContent = m; $("s-dv").textContent = d.toFixed(2);
  const S = simulateHackers(m, d, seed);
  $("s-probs").innerHTML = `true success probabilities: phishing ${S.p[0].toFixed(3)}, SQL injection ${S.p[1].toFixed(3)}, brute force ${S.p[2].toFixed(3)} → the variables are ${d === 0 ? '<span class="s">independent</span>' : '<span class="k">dependent</span>'}`;
  const { rows, cols, n } = contingency(S.xs, S.fs);
  const A = analyse(n);
  $("s-table").innerHTML = tableHTML(rows, cols, (i, j) => `${n[i][j]} <span class="dim">(E ${f2(A.E[i][j])})</span>`, { rowTot: (i) => `${A.rowTot[i]} <span class="dim">(${pct(A.condFgivenX[i][cols.indexOf("Success")])} succ.)</span>`, colTot: (j) => A.colTot[j], grand: A.N });
  $("s-result").innerHTML = resultText(A);
  distPlot($("s-dist"), A);
}
$("s-run").onclick = () => { seed++; runSim(); };
$("s-m").oninput = runSim;
$("s-d").oninput = runSim;
$("s-rep").onclick = () => {
  const m = +$("s-m").value, d = +$("s-d").value;
  let rej = 0;
  for (let k = 0; k < 1000; k++) {
    const S = simulateHackers(m, d, 100000 + seed * 1000 + k);
    const t = contingency(S.xs, S.fs);
    if (t.cols.length === 2 && t.rows.length === 3 && analyse(t.n).p < 0.05) rej++;
  }
  seed++;
  $("s-result").innerHTML += `\n\n1,000 new samples with m = ${m}, strength ${d.toFixed(2)}: independence rejected in <span class="k">${pct(rej / 1000)}</span> of them ` +
    (d === 0 ? "(should be about 5%: these are false alarms)" : "(this is the power of the test)");
};

// =================================================== section 7: strata
function strata(id, D) {
  const A = analyse(D.n);
  $(id).innerHTML = tableHTML(D.rows, D.cols, (i, j) => D.n[i][j], { rowTot: (i) => `${A.rowTot[i]} <span class="dim">(${pct(A.condFgivenX[i][0])} surv.)</span>`, colTot: (j) => A.colTot[j], grand: A.N });
  $(id + "-r").innerHTML = resultText(A);
}
strata("c-f", PY.strata.female);
strata("c-m", PY.strata.male);

// =================================================== section 8: calculator
let calc = [[136, 80], [87, 97], [119, 372]];
function drawCalc() {
  const r = calc.length, c = calc[0].length;
  let h = `<tr><th></th>${calc[0].map((_, j) => `<th class="num">F = ${j + 1}</th>`).join("")}</tr>`;
  calc.forEach((row, i) => { h += `<tr><td>X = ${i + 1}</td>${row.map((v, j) => `<td><input type="number" min="0" step="1" value="${v}" data-i="${i}" data-j="${j}"></td>`).join("")}</tr>`; });
  $("cc-table").innerHTML = h;
  $("cc-table").querySelectorAll("input").forEach((inp) => (inp.oninput = () => { calc[+inp.dataset.i][+inp.dataset.j] = Math.max(0, +inp.value || 0); calcResult(); }));
  calcResult();
}
function calcResult() {
  const A = analyse(calc);
  const rows = calc.map((_, i) => `X = ${i + 1}`), cols = calc[0].map((_, j) => `F = ${j + 1}`);
  if (A.rowTot.some((t) => t === 0) || A.colTot.some((t) => t === 0)) {
    $("cc-exp").innerHTML = ""; $("cc-result").innerHTML = `<span class="bad">every row and column needs at least one observation</span>`; return;
  }
  $("cc-exp").innerHTML = tableHTML(rows, cols, (i, j) => `${f2(A.E[i][j])} <span class="dim">(${pct(A.condFgivenX[i][j])} of row)</span>`, { corner: "expected E", rowTot: (i) => A.rowTot[i], colTot: (j) => A.colTot[j], grand: A.N });
  $("cc-result").innerHTML = resultText(A);
}
$("cc-addr").onclick = () => { calc.push(calc[0].map(() => 10)); drawCalc(); };
$("cc-delr").onclick = () => { if (calc.length > 2) { calc.pop(); drawCalc(); } };
$("cc-addc").onclick = () => { calc.forEach((r) => r.push(10)); drawCalc(); };
$("cc-delc").onclick = () => { if (calc[0].length > 2) { calc.forEach((r) => r.pop()); drawCalc(); } };
$("cc-ind").onclick = () => { calc = [[20, 30, 50], [40, 60, 100], [8, 12, 20]]; drawCalc(); };
$("cc-tit").onclick = () => { calc = [[136, 80], [87, 97], [119, 372]]; drawCalc(); };

// =================================================== init
drawTitanic();
drawExplorer();
runSim();
drawCalc();
let rt;
window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { drawTitanic(); drawExplorer(); runSim(); }, 150); });
const links = [...document.querySelectorAll("nav.toc a")];
const obs = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id)); });
}, { rootMargin: "-40% 0px -55% 0px" });
document.querySelectorAll("main section").forEach((s) => obs.observe(s));
