from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    service_name: str = "EduRecall Personalization AI"
    version: str = "0.1.0"
    model_version: str = "bkt-v1"
    root_dir: Path = Path(__file__).resolve().parents[4]

    @property
    def domains_dir(self) -> Path:
        return self.root_dir / "domains"

    @property
    def artifact_path(self) -> Path:
        configured = os.getenv("MODEL_ARTIFACT_PATH")
        if configured:
            return Path(configured)
        return self.root_dir / "apps" / "ai-service" / "ml" / "artifacts" / "next_attempt_model.joblib"


settings = Settings()
