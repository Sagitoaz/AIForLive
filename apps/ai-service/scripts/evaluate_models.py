from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "ml" / "artifacts" / "evaluation.json"


def main() -> None:
    if not REPORT.exists():
        raise SystemExit("Evaluation missing. Run npm run ai:train first.")
    metrics = json.loads(REPORT.read_text(encoding="utf-8"))
    required = ["accuracy", "precision", "recall", "f1", "roc_auc", "brier_score"]
    missing = [name for name in required if name not in metrics]
    if missing:
        raise SystemExit(f"Missing evaluation metrics: {', '.join(missing)}")
    if metrics.get("data_notice") != "SYNTHETIC DATA — NOT REAL EDUONE DATA":
        raise SystemExit("Synthetic data notice is missing")
    print(json.dumps({name: metrics[name] for name in required}, indent=2))


if __name__ == "__main__":
    main()
