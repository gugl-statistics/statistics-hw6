# Writes js/results.js for the web page: the Python results + the Titanic columns used by the explorer.
import csv, json
out = json.load(open("results.json"))
T = list(csv.DictReader(open("../data/titanic.csv", newline="")))
def age_group(a):
    if a == "": return "unknown"
    a = float(a)
    return "child (<18)" if a < 18 else "adult (18-59)" if a < 60 else "senior (60+)"
cols = {
    "class": [r["class"] for r in T],
    "sex": [r["sex"] for r in T],
    "survived": ["Survived" if r["survived"] == "1" else "Died" for r in T],
    "embarked": [r["embark_town"] or "unknown" for r in T],
    "alone": ["alone" if r["alone"] == "True" else "with family" for r in T],
    "age": [age_group(r["age"]) for r in T],
}
with open("../js/results.js", "w") as f:
    f.write("// numbers produced by code/chi2.py, and the Titanic columns (data/titanic.csv) used by the explorer\n")
    f.write("const PY = " + json.dumps(out) + ";\n")
    f.write("const TITANIC = " + json.dumps(cols) + ";\n")
