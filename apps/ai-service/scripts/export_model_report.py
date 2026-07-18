from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
METRICS = ROOT / "ml" / "artifacts" / "evaluation.json"
OUTPUT = ROOT / "ml" / "artifacts" / "evaluation-summary.md"


def main() -> None:
    data = json.loads(METRICS.read_text(encoding="utf-8"))
    rows = ["# Model evaluation", "", "SYNTHETIC DATA — NOT REAL EDUONE DATA", ""]
    for name in ["accuracy", "precision", "recall", "f1", "roc_auc", "brier_score"]:
        rows.append(f"- {name}: {data[name]}")
    OUTPUT.write_text("\n".join(rows) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
