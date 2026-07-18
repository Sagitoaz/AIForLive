from app.schemas.personalization import DiagnosisResult
from app.services.recommendation import RecommendationEngine


def diagnosis() -> DiagnosisResult:
    return DiagnosisResult(
        status="MATCHED",
        concept_code="PYTHON_RANGE",
        misconception_code="RANGE_STOP_INCLUDED",
        confidence=0.95,
        source="DOMAIN_RULE",
        rule_id="range-stop-rule-v1",
        evidence=["stop included"],
    )


def test_repeated_misconception_selects_micro_lesson() -> None:
    result = RecommendationEngine().recommend(
        mastery=0.42,
        forgetting_risk=0.61,
        recent_error_rate=0.7,
        prerequisite_mastery=0.72,
        course_progress=0.35,
        repeated_misconception_count=3,
        next_attempt_probability=0.38,
        available_minutes=15,
        diagnosis=diagnosis(),
        event_id="event-1",
        model_version="bkt-v1",
    )
    assert result.action == "MICRO_LESSON"
    assert result.evidence["ruleId"] == "range-stop-rule-v1"
    assert any("3" in reason for reason in result.reasons)


def test_weak_prerequisite_takes_priority() -> None:
    result = RecommendationEngine().recommend(
        mastery=0.6,
        forgetting_risk=0.3,
        recent_error_rate=0.4,
        prerequisite_mastery=0.3,
        course_progress=0.2,
        repeated_misconception_count=0,
        next_attempt_probability=0.6,
        available_minutes=15,
        diagnosis=diagnosis(),
        event_id="event-2",
        model_version="bkt-v1",
    )
    assert result.action == "PREREQUISITE_REVIEW"
