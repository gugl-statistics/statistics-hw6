"""
Homework 6 - Statistical independence: contingency table, marginal and conditional
frequencies, expected frequencies, chi-square statistic and p-value.
Python 3, standard library only for the computations (scipy only to double check).
Run:  python3 chi2.py
"""
import csv, json, math, random

# ---------------------------------------------------------------- core functions
def contingency(xs, fs):
    """counts n_ij of the pairs (x_i, f_j); returns row labels, column labels, table"""
    rows = sorted(set(xs), key=str)
    cols = sorted(set(fs), key=str)
    ri = {r: i for i, r in enumerate(rows)}
    ci = {c: j for j, c in enumerate(cols)}
    n = [[0] * len(cols) for _ in rows]
    for x, f in zip(xs, fs):
        n[ri[x]][ci[f]] += 1
    return rows, cols, n

def analyse(n):
    r, c = len(n), len(n[0])
    row_tot = [sum(n[i]) for i in range(r)]
    col_tot = [sum(n[i][j] for i in range(r)) for j in range(c)]
    N = sum(row_tot)
    marg_x = [t / N for t in row_tot]                       # marginal relative frequencies of X
    marg_f = [t / N for t in col_tot]                       # marginal relative frequencies of F
    cond_f_given_x = [[n[i][j] / row_tot[i] for j in range(c)] for i in range(r)]   # row profiles
    cond_x_given_f = [[n[i][j] / col_tot[j] for j in range(c)] for i in range(r)]   # column profiles
    E = [[row_tot[i] * col_tot[j] / N for j in range(c)] for i in range(r)]         # expected if independent
    contrib = [[(n[i][j] - E[i][j]) ** 2 / E[i][j] for j in range(c)] for i in range(r)]
    chi2 = sum(map(sum, contrib))
    df = (r - 1) * (c - 1)
    p = chi2_sf(chi2, df)
    V = math.sqrt(chi2 / (N * (min(r, c) - 1)))             # Cramer's V
    resid = [[(n[i][j] - E[i][j]) / math.sqrt(E[i][j]) for j in range(c)] for i in range(r)]
    return dict(N=N, row_tot=row_tot, col_tot=col_tot, marg_x=marg_x, marg_f=marg_f,
                cond_f_given_x=cond_f_given_x, cond_x_given_f=cond_x_given_f,
                expected=E, contrib=contrib, resid=resid, chi2=chi2, df=df, p=p, V=V,
                min_expected=min(map(min, E)))

# ---------------------------------------------------------------- p-value: P(chi2_df > x)
# chi2_df is Gamma(df/2, 2), so P(X > x) = Q(df/2, x/2), the regularized upper incomplete gamma
def chi2_sf(x, df):
    a, z = df / 2, x / 2
    if x <= 0: return 1.0
    if z < a + 1:                      # series for P(a, z), then Q = 1 - P
        term = s = 1 / a
        k = 0
        while abs(term) > 1e-17 * abs(s):
            k += 1
            term *= z / (a + k)
            s += term
        return 1 - s * math.exp(-z + a * math.log(z) - math.lgamma(a))
    # continued fraction for Q(a, z) (modified Lentz)
    tiny = 1e-300
    b = z + 1 - a; C = 1 / tiny; D = 1 / b; h = D
    for i in range(1, 500):
        an = -i * (i - a); b += 2
        D = an * D + b; D = tiny if abs(D) < tiny else D
        C = b + an / C; C = tiny if abs(C) < tiny else C
        D = 1 / D; d = D * C; h *= d
        if abs(d - 1) < 1e-16: break
    return h * math.exp(-z + a * math.log(z) - math.lgamma(a))

def chi2_crit(df, alpha=0.05):
    lo, hi = 0.0, 1000.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if chi2_sf(mid, df) > alpha: lo = mid
        else: hi = mid
    return (lo + hi) / 2

def show(name, rows, cols, n, A):
    print(f"\n=== {name}   (N = {A['N']})")
    w = max(len(str(r)) for r in rows) + 2
    print(" " * w + "".join(f"{str(c):>12}" for c in cols) + f"{'total':>10}")
    for i, r in enumerate(rows):
        print(f"{str(r):<{w}}" + "".join(f"{n[i][j]:>12}" for j in range(len(cols))) + f"{A['row_tot'][i]:>10}")
    print(f"{'total':<{w}}" + "".join(f"{t:>12}" for t in A['col_tot']) + f"{A['N']:>10}")
    print("expected:", [[round(e, 2) for e in row] for row in A["expected"]])
    print("P(F | X):", [[round(p, 4) for p in row] for row in A["cond_f_given_x"]])
    print(f"chi2 = {A['chi2']:.4f}  df = {A['df']}  p = {A['p']:.4e}  critical(5%) = {chi2_crit(A['df']):.4f}  Cramer V = {A['V']:.4f}  min E = {A['min_expected']:.2f}")

# ---------------------------------------------------------------- data
def titanic(path="../data/titanic.csv"):
    with open(path, newline="") as f:
        return list(csv.DictReader(f))

def simulated_hackers(m=600, dependent=False, seed=2026):
    """m hackers: attack technique X and outcome F.
       independent version: P(success) = 0.30 for every technique
       dependent version:   P(success) = 0.45 phishing, 0.30 SQL injection, 0.15 brute force"""
    rnd = random.Random(seed)
    techs = ["Phishing", "SQL injection", "Brute force"]
    p_dep = {"Phishing": 0.45, "SQL injection": 0.30, "Brute force": 0.15}
    xs, fs = [], []
    for _ in range(m):
        t = rnd.choices(techs, weights=[0.40, 0.35, 0.25])[0]
        p = p_dep[t] if dependent else 0.30
        xs.append(t); fs.append("Success" if rnd.random() < p else "Failure")
    return xs, fs

if __name__ == "__main__":
    out = {}
    T = titanic()
    order = {"First": 0, "Second": 1, "Third": 2}
    # 1) class x survived
    xs = [r["class"] for r in T]; fs = ["Survived" if r["survived"] == "1" else "Died" for r in T]
    rows, cols, n = contingency(xs, fs)
    perm = sorted(range(len(rows)), key=lambda i: order[rows[i]]); rows = [rows[i] for i in perm]; n = [n[i] for i in perm]
    cols, n = cols[::-1], [row[::-1] for row in n]                     # Survived, Died
    A = analyse(n); show("Titanic: class x survival", rows, cols, n, A)
    out["titanic_class"] = dict(rows=rows, cols=cols, n=n, **A, crit=chi2_crit(A["df"]))
    # 2) sex x survived
    xs2 = [r["sex"] for r in T]
    r2, c2, n2 = contingency(xs2, fs); c2, n2 = c2[::-1], [row[::-1] for row in n2]
    A2 = analyse(n2); show("Titanic: sex x survival", r2, c2, n2, A2)
    out["titanic_sex"] = dict(rows=r2, cols=c2, n=n2, **A2, crit=chi2_crit(A2["df"]))
    # 3) class x sex (are the two explanatory variables related?)
    r3, c3, n3 = contingency(xs, xs2)
    n3 = [n3[i] for i in perm]; r3 = [r3[i] for i in perm]
    A3 = analyse(n3); show("Titanic: class x sex", r3, c3, n3, A3)
    out["titanic_class_sex"] = dict(rows=r3, cols=c3, n=n3, **A3, crit=chi2_crit(A3["df"]))
    # 4) class x survived within each sex (stratified)
    out["strata"] = {}
    for sex in ["female", "male"]:
        sub = [r for r in T if r["sex"] == sex]
        rr, cc, nn = contingency([r["class"] for r in sub], ["Survived" if r["survived"] == "1" else "Died" for r in sub])
        pp = sorted(range(len(rr)), key=lambda i: order[rr[i]]); rr = [rr[i] for i in pp]; nn = [nn[i][::-1] for i in pp]; cc = cc[::-1]
        AA = analyse(nn); show(f"Titanic, {sex} only: class x survival", rr, cc, nn, AA)
        out["strata"][sex] = dict(rows=rr, cols=cc, n=nn, **AA, crit=chi2_crit(AA["df"]))
    # 5) simulated hackers
    for dep in [False, True]:
        hx, hf = simulated_hackers(dependent=dep)
        rr, cc, nn = contingency(hx, hf)
        o = {"Phishing": 0, "SQL injection": 1, "Brute force": 2}
        pp = sorted(range(len(rr)), key=lambda i: o[rr[i]]); rr = [rr[i] for i in pp]; nn = [nn[i][::-1] for i in pp]; cc = cc[::-1]
        AA = analyse(nn); key = "hackers_dep" if dep else "hackers_indep"
        show(f"Simulated hackers ({'dependent' if dep else 'independent'})", rr, cc, nn, AA)
        out[key] = dict(rows=rr, cols=cc, n=nn, **AA, crit=chi2_crit(AA["df"]))
    # 6) how often does the test reject when the variables ARE independent? (should be ~5%)
    rej = 0; R = 10000
    for k in range(R):
        hx, hf = simulated_hackers(dependent=False, seed=10_000_000 + k)
        _, _, nn = contingency(hx, hf)
        rej += analyse(nn)["p"] < 0.05
    out["type1"] = rej / R
    print(f"\nindependent data, {R} repetitions: rejected at 5% in {rej / R:.3%} of them")
    # power of the test vs sample size for the dependent model
    pw = []
    for m in [30, 60, 100, 200, 400, 600, 1000]:
        rj = 0
        for k in range(1000):
            hx, hf = simulated_hackers(m=m, dependent=True, seed=50_000 + k)
            _, _, nn = contingency(hx, hf)
            if min(map(len, [nn])) and all(sum(nn[i]) > 0 for i in range(len(nn))) and len(nn[0]) == 2:
                rj += analyse(nn)["p"] < 0.05
        pw.append(dict(m=m, power=rj / 1000))
        print(f"dependent data, m = {m:5d}: rejected in {rj / 1000:.1%}")
    out["power"] = pw

    # ---- double check against scipy
    try:
        from scipy.stats import chi2_contingency, chi2 as chi2dist
        for key in ["titanic_class", "titanic_sex", "hackers_indep", "hackers_dep"]:
            s = chi2_contingency(out[key]["n"], correction=False)
            print(f"scipy check {key}: chi2 {s.statistic:.6f} vs {out[key]['chi2']:.6f}   p {s.pvalue:.6e} vs {out[key]['p']:.6e}")
        for x, d in [(0.5, 1), (3.84, 1), (102.889, 2), (5.99, 2), (30, 4)]:
            print(f"sf({x}, {d}): mine {chi2_sf(x, d):.12e}  scipy {chi2dist.sf(x, d):.12e}")
    except ImportError:
        pass
    json.dump(out, open("results.json", "w"), indent=1)
