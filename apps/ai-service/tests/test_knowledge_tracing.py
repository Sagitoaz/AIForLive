from app.schemas.personalization import AttemptObservation
from app.services.knowledge_tracing import BayesianKnowledgeTracer


def attempt(*, correct: bool, hint: bool = False, skipped: bool = False) -> AttemptObservation:
    return AttemptObservation(
        is_correct=correct,
        used_hint=hint,
        attempt_number=1,
        difficulty=0.45,
        response_time_ms=12_500,
        skipped=skipped,
    )


def test_independent_correct_answer_increases_mastery() -> None:
    update = BayesianKnowledgeTracer().update(0.42, attempt(correct=True))
    assert update.mastery_after > update.mastery_before


def test_hint_correct_answer_increases_less() -> None:
    tracer = BayesianKnowledgeTracer()
    independent = tracer.update(0.42, attempt(correct=True))
    hinted = tracer.update(0.42, attempt(correct=True, hint=True))
    assert 0.42 < hinted.mastery_after < independent.mastery_after


def test_incorrect_answer_reduces_but_never_zero() -> None:
    update = BayesianKnowledgeTracer().update(0.72, attempt(correct=False))
    assert 0 < update.mastery_after < update.mastery_before


def test_single_correct_never_reaches_one() -> None:
    update = BayesianKnowledgeTracer().update(0.92, attempt(correct=True))
    assert update.mastery_after < 1


def test_values_always_bounded() -> None:
    tracer = BayesianKnowledgeTracer()
    for prior in [0, 0.01, 0.5, 0.99, 1]:
        for correct in [True, False]:
            update = tracer.update(prior, attempt(correct=correct))
            assert 0 <= update.mastery_after <= 1


def test_low_confidence_has_smaller_effect() -> None:
    tracer = BayesianKnowledgeTracer()
    normal = tracer.update(0.42, attempt(correct=True))
    skipped = tracer.update(0.42, attempt(correct=True, skipped=True))
    assert abs(skipped.mastery_after - 0.42) < abs(normal.mastery_after - 0.42)
