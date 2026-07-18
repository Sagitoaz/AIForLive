from __future__ import annotations

import csv
import json
import math
import random
from datetime import UTC, datetime, timedelta
from pathlib import Path

SEED = 20260718
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "synthetic"

CONCEPTS = [
    ("PYTHON_VARIABLES", "Biến và kiểu dữ liệu"),
    ("PYTHON_OPERATORS", "Toán tử"),
    ("PYTHON_IF_ELSE", "Điều kiện if/else"),
    ("PYTHON_FOR", "Vòng lặp for"),
    ("PYTHON_RANGE", "Hàm range()"),
    ("PYTHON_WHILE", "Vòng lặp while"),
    ("PYTHON_LISTS", "List và index"),
    ("PYTHON_FUNCTIONS", "Hàm cơ bản"),
]
MISCONCEPTIONS = [
    ("RANGE_STOP_INCLUDED", "PYTHON_RANGE"),
    ("ASSIGNMENT_VS_COMPARISON", "PYTHON_IF_ELSE"),
    ("WHILE_VARIABLE_NOT_UPDATED", "PYTHON_WHILE"),
    ("LIST_INDEX_STARTS_AT_ONE", "PYTHON_LISTS"),
    ("STRING_NUMBER_CONFUSION", "PYTHON_VARIABLES"),
    ("IF_INDENTATION_ERROR", "PYTHON_IF_ELSE"),
    ("FOR_ITERATION_COUNT", "PYTHON_FOR"),
    ("BOOLEAN_LOGIC_CONFUSION", "PYTHON_OPERATORS"),
    ("FUNCTION_RETURN_VS_PRINT", "PYTHON_FUNCTIONS"),
    ("VARIABLE_UPDATE_ORDER", "PYTHON_VARIABLES"),
]
PERSONAS = [
    "Strong and fast",
    "Strong but slow",
    "Weak in range",
    "Weak in while",
    "Weak prerequisite",
    "Frequent hint usage",
    "Inconsistent",
    "Long inactivity",
    "Sparse data",
    "Strong improvement after review",
]
GOALS = [
    "Tạo trò chơi hỏi–đáp",
    "Củng cố tư duy logic",
    "Chuẩn bị CLB Tin học",
    "Học theo tốc độ riêng",
]
DEVICES = ["PERSONAL_COMPUTER", "TABLET", "SHARED_PHONE", "LIBRARY_COMPUTER"]


def sigmoid(value: float) -> float:
    return 1.0 / (1.0 + math.exp(-value))


def write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    rng = random.Random(SEED)
    OUT.mkdir(parents=True, exist_ok=True)
    notice = "SYNTHETIC DATA — NOT REAL EDUONE DATA"

    concepts = [
        {"concept_code": code, "title": title, "order": index + 1, "data_notice": notice}
        for index, (code, title) in enumerate(CONCEPTS)
    ]
    exercises = []
    for concept_index, (concept_code, _) in enumerate(CONCEPTS):
        for local_index in range(6):
            exercises.append(
                {
                    "exercise_id": f"ex-{concept_index + 1:02d}-{local_index + 1:02d}",
                    "concept_code": concept_code,
                    "secondary_concept_code": (CONCEPTS[max(0, concept_index - 1)][0] if local_index == 5 else ""),
                    "difficulty": round(0.22 + local_index * 0.11 + rng.uniform(-0.025, 0.025), 3),
                    "exercise_type": [
                        "MULTIPLE_CHOICE",
                        "PREDICT_OUTPUT",
                        "CODE_ORDER",
                        "BUG_HUNTER",
                        "RANGE_RUNNER",
                        "CHECKPOINT",
                    ][local_index],
                    "data_notice": notice,
                }
            )

    profiles = []
    ground_truth = []
    names = [
        "Minh",
        "Lan",
        "An",
        "Bình",
        "Chi",
        "Dũng",
        "Giang",
        "Hà",
        "Khánh",
        "Linh",
        "Mai",
        "Nam",
        "Oanh",
        "Phúc",
        "Quân",
        "Sơn",
        "Trang",
        "Uyên",
        "Việt",
        "Yến",
    ]
    abilities: dict[tuple[str, str], float] = {}
    for index, name in enumerate(names):
        persona = PERSONAS[index % len(PERSONAS)]
        base = rng.uniform(0.35, 0.82)
        speed = rng.uniform(0.55, 1.45)
        hints = rng.uniform(0.05, 0.35)
        forgetting = rng.uniform(0.08, 0.3)
        consistency = rng.uniform(0.55, 0.95)
        gain = rng.uniform(0.025, 0.09)
        engagement = rng.uniform(0.5, 0.96)
        if persona.startswith("Strong"):
            base = rng.uniform(0.75, 0.9)
        if persona == "Strong but slow":
            speed = 1.55
        if persona == "Frequent hint usage":
            hints = 0.68
        if persona == "Inconsistent":
            consistency = 0.35
        if persona == "Long inactivity":
            forgetting = 0.42
        if persona == "Strong improvement after review":
            gain = 0.14
        student_id = f"student-{index + 1:02d}"
        profiles.append(
            {
                "student_id": student_id,
                "name": name,
                "persona": persona,
                "response_speed": round(speed, 3),
                "hint_usage_rate": round(hints, 3),
                "forgetting_rate": round(forgetting, 3),
                "consistency_score": round(consistency, 3),
                "learning_gain": round(gain, 3),
                "engagement_level": round(engagement, 3),
                "weekly_availability_minutes": rng.choice([60, 90, 120, 150, 180]),
                "grade_level": f"Lớp {6 + index % 4}",
                "learning_goal": GOALS[index % len(GOALS)],
                "device_type": DEVICES[index % len(DEVICES)],
                "shared_device": int(index % 6 == 0),
                "connectivity": (
                    "UNSTABLE" if index % 7 == 0 else "OCCASIONAL_OFFLINE" if index % 5 == 0 else "STABLE"
                ),
                "preferred_session_minutes": [20, 30, 45, 25, 40][index % 5],
                "placement_completed": int(index != 18),
                "profile_quality_flags": "SPARSE_HISTORY" if persona == "Sparse data" else "",
                "data_notice": notice,
            }
        )
        for concept_code, _ in CONCEPTS:
            ability = max(0.08, min(0.96, base + rng.uniform(-0.14, 0.14)))
            if persona == "Weak in range" and concept_code == "PYTHON_RANGE":
                ability = 0.24
            if persona == "Weak in while" and concept_code == "PYTHON_WHILE":
                ability = 0.2
            if persona == "Weak prerequisite" and concept_code in {
                "PYTHON_VARIABLES",
                "PYTHON_OPERATORS",
            }:
                ability = 0.26
            abilities[(student_id, concept_code)] = ability
            ground_truth.append(
                {
                    "student_id": student_id,
                    "concept_code": concept_code,
                    "latent_ability": round(ability, 4),
                    "data_notice": notice,
                }
            )

    attempts: list[dict[str, object]] = []
    events: list[dict[str, object]] = []
    start = datetime(2026, 6, 1, 8, 0, tzinfo=UTC)
    profile_map = {str(row["student_id"]): row for row in profiles}
    misconception_map = {concept: code for code, concept in MISCONCEPTIONS}

    for attempt_index in range(400):
        student_index = attempt_index % 20
        student_id = f"student-{student_index + 1:02d}"
        profile = profile_map[student_id]
        if profile["persona"] == "Sparse data" and attempt_index % 3 != 0:
            student_id = f"student-{(student_index + 1) % 20 + 1:02d}"
            profile = profile_map[student_id]
        exercise = exercises[rng.randrange(len(exercises))]
        concept_code = str(exercise["concept_code"])
        ability = abilities[(student_id, concept_code)]
        difficulty = float(exercise["difficulty"])
        previous = [
            item
            for item in attempts[-100:]
            if item["student_id"] == student_id and item["concept_code"] == concept_code
        ]
        attempt_number = 1 + len(previous)
        used_hint = rng.random() < float(profile["hint_usage_rate"])
        days_since = rng.uniform(0.1, 5.0)
        if profile["persona"] == "Long inactivity" and rng.random() < 0.5:
            days_since = rng.uniform(12.0, 30.0)
        prerequisite = max(0.1, min(1.0, ability + rng.uniform(-0.18, 0.12)))
        forgetting_penalty = days_since * float(profile["forgetting_rate"]) * 0.07
        review_gain = min(0.25, attempt_number * float(profile["learning_gain"]) * 0.08)
        logit = (
            3.0 * (ability - difficulty)
            + 0.8 * (prerequisite - 0.5)
            - forgetting_penalty
            + review_gain
            + (0.2 if used_hint else 0.0)
        )
        noise = rng.gauss(0, 0.32 + (1.0 - float(profile["consistency_score"])) * 0.7)
        probability = sigmoid(logit + noise)
        skipped = rng.random() < (0.025 if profile["persona"] != "Sparse data" else 0.09)
        is_correct = False if skipped else rng.random() < probability
        if attempt_index % 71 == 0:
            is_correct = False  # wrong despite potentially high mastery
        if attempt_index % 83 == 0:
            is_correct = True  # controlled lucky guess
        response_seconds = max(
            0.35,
            rng.lognormvariate(2.8, 0.45) * float(profile["response_speed"]) * (1 + difficulty),
        )
        if attempt_index % 97 == 0:
            response_seconds = 0.45
        if attempt_index % 113 == 0:
            response_seconds = 260.0
        misconception = ""
        if not is_correct and not skipped and rng.random() < 0.64:
            misconception = misconception_map.get(concept_code, "")
        occurred = start + timedelta(hours=attempt_index * 3.2 + rng.uniform(0, 2))
        ingestion_lag_seconds = rng.randint(1, 24)
        quality_flags: list[str] = []
        if attempt_index % 67 == 0:
            ingestion_lag_seconds = rng.randint(3_600, 28_800)
            quality_flags.append("LATE_EVENT")
        if attempt_index % 97 == 0:
            quality_flags.append("IMPLAUSIBLY_FAST")
        if attempt_index % 113 == 0:
            quality_flags.append("LONG_RESPONSE")
        if attempt_index % 89 == 0:
            quality_flags.append("OFFLINE_BATCH")
        if skipped:
            quality_flags.append("SKIPPED")
        received = occurred + timedelta(seconds=ingestion_lag_seconds)
        attempt_id = f"attempt-{attempt_index + 1:04d}"
        attempts.append(
            {
                "attempt_id": attempt_id,
                "student_id": student_id,
                "exercise_id": exercise["exercise_id"],
                "concept_code": concept_code,
                "secondary_concept_code": exercise["secondary_concept_code"],
                "occurred_at": occurred.isoformat(),
                "received_at": received.isoformat(),
                "ingestion_lag_seconds": ingestion_lag_seconds,
                "session_id": f"session-{student_id}-{attempt_index // 20:03d}",
                "lesson_phase": "CHECKPOINT" if exercise["exercise_type"] == "CHECKPOINT" else "PRACTICE",
                "is_correct": int(is_correct),
                "skipped": int(skipped),
                "used_hint": int(used_hint),
                "attempt_number": attempt_number,
                "difficulty": difficulty,
                "response_time_ms": round(response_seconds * 1000),
                "days_since_last_practice": round(days_since, 3),
                "prerequisite_mastery": round(prerequisite, 3),
                "latent_ability": round(ability, 3),
                "probability_correct": round(probability, 4),
                "misconception_code": misconception,
                "connectivity_mode": "OFFLINE_SYNC"
                if "OFFLINE_BATCH" in quality_flags
                else str(profile["connectivity"]),
                "data_quality_flags": "|".join(quality_flags),
                "data_notice": notice,
            }
        )
        events.append(
            {
                "event_id": f"event-{attempt_index + 1:04d}",
                "type": "ATTEMPT_SUBMITTED",
                "student_id": student_id,
                "attempt_id": attempt_id,
                "concept_codes": [concept_code]
                + ([str(exercise["secondary_concept_code"])] if exercise["secondary_concept_code"] else []),
                "occurred_at": occurred.isoformat(),
                "received_at": received.isoformat(),
                "metadata": {
                    "synthetic": True,
                    "data_notice": notice,
                    "lesson_phase": "CHECKPOINT" if exercise["exercise_type"] == "CHECKPOINT" else "PRACTICE",
                    "connectivity_mode": "OFFLINE_SYNC"
                    if "OFFLINE_BATCH" in quality_flags
                    else str(profile["connectivity"]),
                    "data_quality_flags": quality_flags,
                    "ingestion_lag_seconds": ingestion_lag_seconds,
                },
            }
        )

    write_csv(OUT / "student_profiles.csv", profiles)
    write_csv(OUT / "concepts.csv", concepts)
    write_csv(OUT / "exercises.csv", exercises)
    write_csv(OUT / "attempts.csv", attempts)
    write_csv(
        OUT / "misconceptions.csv",
        [
            {"misconception_code": code, "concept_code": concept, "data_notice": notice}
            for code, concept in MISCONCEPTIONS
        ],
    )
    write_csv(OUT / "concept_ground_truth.csv", ground_truth)
    with (OUT / "learning_events.jsonl").open("w", encoding="utf-8") as handle:
        for event in events:
            handle.write(json.dumps(event, ensure_ascii=False) + "\n")
    (OUT / "README.md").write_text(
        f"""# Synthetic pilot dataset

{notice}

- Seed: {SEED}
- Quy mô pilot: 1 lớp, 20 học sinh, 48 bài tập, 400 attempts
- Hồ sơ có khối lớp, mục tiêu, quỹ thời gian, thiết bị dùng chung và chất lượng kết nối khác nhau.
- Dữ liệu không hoàn hảo có kiểm soát: event gửi muộn, offline batch,
  phản hồi quá nhanh/chậm, lượt bỏ qua và học sinh ít dữ liệu.
- Không cố tình làm hỏng khóa chính hoặc nhãn hàng loạt; mỗi bất thường đều có
  `data_quality_flags` để pipeline có thể lọc hoặc giảm trọng số.
- Toàn bộ tên và hành vi là synthetic, không phải dữ liệu thật của EduOne.
""",
        encoding="utf-8",
    )
    print(f"Generated {len(profiles)} students, {len(exercises)} exercises, {len(attempts)} attempts")


if __name__ == "__main__":
    main()
