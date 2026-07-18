from app.services.forgetting import ExponentialForgettingModel


def test_retrievability_decreases_with_elapsed_time() -> None:
    model = ExponentialForgettingModel()
    early = model.calculate(
        elapsed_days=1,
        stability=3,
        previous_recall_quality=0.8,
        consecutive_successes=1,
        recent_failures=0,
    )
    late = model.calculate(
        elapsed_days=8,
        stability=3,
        previous_recall_quality=0.8,
        consecutive_successes=1,
        recent_failures=0,
    )
    assert late.retrievability < early.retrievability
    assert late.forgetting_risk > early.forgetting_risk


def test_successes_extend_stability() -> None:
    model = ExponentialForgettingModel()
    base = model.calculate(
        elapsed_days=2,
        stability=2,
        previous_recall_quality=0.8,
        consecutive_successes=0,
        recent_failures=0,
    )
    reviewed = model.calculate(
        elapsed_days=2,
        stability=2,
        previous_recall_quality=0.8,
        consecutive_successes=4,
        recent_failures=0,
    )
    assert reviewed.stability_after > base.stability_after
