from pathlib import Path

from app.schemas.personalization import AttemptObservation
from app.services.diagnosis import DomainRuleEngine

DOMAINS = Path(__file__).resolve().parents[3] / "domains"


def test_range_stop_rule_matches_with_evidence() -> None:
    result = DomainRuleEngine(DOMAINS).diagnose(
        "python-foundations",
        "PYTHON_RANGE",
        AttemptObservation(
            is_correct=False,
            used_hint=False,
            attempt_number=1,
            difficulty=0.45,
            response_time_ms=12_500,
            submitted_answer="1, 2, 3, 4, 5",
            expected_answer="1, 2, 3, 4",
            stop_value=5,
        ),
    )
    assert result.status == "MATCHED"
    assert result.misconception_code == "RANGE_STOP_INCLUDED"
    assert result.rule_id == "range-stop-rule-v1"
    assert len(result.evidence) >= 2


def test_unknown_is_not_invented() -> None:
    result = DomainRuleEngine(DOMAINS).diagnose(
        "python-foundations",
        "PYTHON_RANGE",
        AttemptObservation(
            is_correct=False,
            used_hint=False,
            attempt_number=1,
            difficulty=0.45,
            response_time_ms=12_500,
            submitted_answer="I do not know",
            expected_answer="1, 2, 3, 4",
            stop_value=5,
        ),
    )
    assert result.status == "UNKNOWN"
    assert result.misconception_code is None
