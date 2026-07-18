from datetime import UTC, datetime

from app.schemas.personalization import AnalyzeEventRequest
from app.services.personalization import PersonalizationService


def request(event_id: str = "event-demo") -> AnalyzeEventRequest:
    return AnalyzeEventRequest.model_validate(
        {
            "event_id": event_id,
            "student_id": "student-minh",
            "domain_code": "python-foundations",
            "course_id": "course-python",
            "concept_code": "PYTHON_RANGE",
            "current_state": {"mastery": 0.42, "stability": 2.3, "retrievability": 0.48},
            "attempt": {
                "is_correct": False,
                "used_hint": False,
                "attempt_number": 1,
                "difficulty": 0.45,
                "response_time_ms": 12_500,
                "submitted_answer": "1,2,3,4,5",
                "expected_answer": "1,2,3,4",
                "stop_value": 5,
            },
            "recent_history": [
                {
                    "is_correct": False,
                    "used_hint": False,
                    "occurred_at": datetime.now(UTC).isoformat(),
                    "misconception_code": "RANGE_STOP_INCLUDED",
                },
                {
                    "is_correct": False,
                    "used_hint": False,
                    "occurred_at": datetime.now(UTC).isoformat(),
                    "misconception_code": "RANGE_STOP_INCLUDED",
                },
            ],
        }
    )


def test_aggregate_analysis_returns_explainable_result() -> None:
    result = PersonalizationService().analyze(request())
    assert result.mastery_after < result.mastery_before
    assert result.diagnosis.misconception_code == "RANGE_STOP_INCLUDED"
    assert result.recommendation.action == "MICRO_LESSON"
    assert result.recommended_interval_days >= 1


def test_duplicate_event_is_idempotent() -> None:
    service = PersonalizationService()
    first = service.analyze(request("same-event"))
    second = service.analyze(request("same-event"))
    assert first is second


def test_validation_rejects_out_of_range_mastery() -> None:
    payload = request().model_dump(mode="json")
    payload["current_state"]["mastery"] = 1.5
    try:
        AnalyzeEventRequest.model_validate(payload)
    except ValueError:
        return
    raise AssertionError("Invalid mastery should be rejected")
