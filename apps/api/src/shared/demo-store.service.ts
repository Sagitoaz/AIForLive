import { Injectable } from "@nestjs/common";
import type { DemoAttempt, DemoContent } from "../common/types";

const studentNames = [
  "Minh", "Lan", "An", "Bình", "Chi", "Dũng", "Giang", "Hà", "Khánh", "Linh",
  "Mai", "Nam", "Oanh", "Phúc", "Quân", "Sơn", "Trang", "Uyên", "Việt", "Yến"
];

const initialConceptMastery = new Map<string, number>([
  ["PYTHON_VARIABLES", 0.78], ["PYTHON_OPERATORS", 0.71], ["PYTHON_IF_ELSE", 0.63],
  ["PYTHON_FOR", 0.58], ["PYTHON_RANGE", 0.42], ["PYTHON_WHILE", 0.39],
  ["PYTHON_LISTS", 0.54], ["PYTHON_FUNCTIONS", 0.31]
]);

@Injectable()
export class DemoStoreService {
  readonly attempts = new Map<string, DemoAttempt>();
  readonly contents = new Map<string, DemoContent>();
  private readonly conceptMasteryByStudent = new Map<string, Map<string, number>>();
  readonly students = studentNames.map((name, index) => ({
    id: index === 0 ? "student-minh" : index === 1 ? "student-lan" : `student-${index + 1}`,
    name,
    nickname: `${name} ${["🌱", "🚀", "✨", "🧩"][index % 4] ?? "🌱"}`,
    avatar: `avatar-${String(index + 1).padStart(2, "0")}`,
    xp: 420 + index * 41,
    streak: 1 + (index % 9),
    progress: Number((0.24 + (index % 8) * 0.075).toFixed(2)),
    needsSupport: index % 5 === 0,
    weakConcept: ["PYTHON_RANGE", "PYTHON_WHILE", "PYTHON_IF_ELSE", "PYTHON_LISTS"][index % 4] ?? "PYTHON_RANGE"
  }));
  reset(): void {
    this.attempts.clear();
    this.contents.clear();
    this.conceptMasteryByStudent.clear();
  }

  getConceptMastery(studentId: string, conceptCode: string, fallback = 0.3): number {
    return this.conceptMasteryByStudent.get(studentId)?.get(conceptCode)
      ?? initialConceptMastery.get(conceptCode)
      ?? fallback;
  }

  setConceptMastery(studentId: string, conceptCode: string, mastery: number): void {
    const studentMastery = this.conceptMasteryByStudent.get(studentId) ?? new Map<string, number>();
    studentMastery.set(conceptCode, mastery);
    this.conceptMasteryByStudent.set(studentId, studentMastery);
  }

  findAttemptByKey(key: string): DemoAttempt | undefined {
    return [...this.attempts.values()].find((attempt) => attempt.idempotencyKey === key);
  }

  attemptHistory(studentId: string, conceptCode: string): DemoAttempt[] {
    return [...this.attempts.values()]
      .filter((attempt) => attempt.studentId === studentId && attempt.conceptCode === conceptCode)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  publishedContents(): DemoContent[] {
    return [...this.contents.values()].filter((content) => content.status === "PUBLISHED");
  }
}
