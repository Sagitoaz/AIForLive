from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.schemas.personalization import AttemptObservation, DiagnosisResult


@dataclass(frozen=True)
class LoadedRule:
    rule_id: str
    misconception_code: str
    strategy: str
    confidence: float
    evidence: list[str]


class DomainRuleEngine:
    def __init__(self, domains_dir: Path) -> None:
        self.domains_dir = domains_dir

    def _load(self, domain_code: str) -> list[LoadedRule]:
        rule_path = self.domains_dir / domain_code / "diagnosis-rules.json"
        if not rule_path.exists():
            return []
        raw: list[dict[str, Any]] = json.loads(rule_path.read_text(encoding="utf-8"))
        return [
            LoadedRule(
                rule_id=str(item["id"]),
                misconception_code=str(item["misconceptionCode"]),
                strategy=str(item["strategy"]),
                confidence=float(item["confidence"]),
                evidence=[str(value) for value in item["evidenceTemplates"]],
            )
            for item in raw
        ]

    @staticmethod
    def _matches(strategy: str, attempt: AttemptObservation) -> bool:
        submitted = attempt.submitted_answer or ""
        expected = attempt.expected_answer or ""
        if strategy == "SEQUENCE_CONTAINS_EXCLUSIVE_STOP":
            if attempt.stop_value is None:
                return False
            submitted_numbers = {int(value) for value in re.findall(r"-?\d+", submitted)}
            expected_numbers = {int(value) for value in re.findall(r"-?\d+", expected)}
            return attempt.stop_value in submitted_numbers and attempt.stop_value not in expected_numbers
        if strategy == "TOKEN_SINGLE_EQUALS_IN_CONDITION":
            return bool(re.search(r"\bif\b[^\n]*?(?<![=!<>])=(?!=)", submitted))
        if strategy == "FIRST_ITEM_SELECTED_WITH_INDEX_ONE":
            return submitted.strip() in {"1", "[1]"} and expected.strip() in {"0", "[0]"}
        return False

    def diagnose(
        self, domain_code: str, concept_code: str, attempt: AttemptObservation
    ) -> DiagnosisResult:
        if attempt.is_correct or attempt.skipped:
            return DiagnosisResult(
                status="NEED_MORE_EVIDENCE",
                concept_code=concept_code,
                misconception_code=None,
                confidence=0.2,
                source="FALLBACK",
                rule_id=None,
                evidence=["A misconception is not inferred from this observation alone."],
            )
        for rule in self._load(domain_code):
            if self._matches(rule.strategy, attempt):
                return DiagnosisResult(
                    status="MATCHED",
                    concept_code=concept_code,
                    misconception_code=rule.misconception_code,
                    confidence=rule.confidence,
                    source="DOMAIN_RULE",
                    rule_id=rule.rule_id,
                    evidence=rule.evidence,
                )
        return DiagnosisResult(
            status="UNKNOWN",
            concept_code=concept_code,
            misconception_code=None,
            confidence=0.3,
            source="FALLBACK",
            rule_id=None,
            evidence=["No registered deterministic domain rule matched the submitted evidence."],
        )
