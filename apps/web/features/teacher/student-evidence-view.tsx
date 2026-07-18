"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Asset } from "@/components/asset";
import { EmptyState, Metric, ProgressBar, SectionHeading, StatusPill } from "@/components/ui";
import { apiRequest } from "@/lib/api";

interface StudentConceptState {
  code: string;
  title: string;
  mastery: number;
  retrievability: number;
  forgettingRisk: number;
  updatedAt: string;
}

interface StudentAttempt {
  id: string;
  exerciseCode: string;
  isCorrect: boolean;
  usedHint: boolean;
  score: number;
  diagnosis: {
    ruleId?: string | null;
    confidence?: number;
    misconception?: { code?: string; title?: string } | null;
  } | null;
  createdAt: string;
}

interface TeacherStudent {
  id: string;
  profileId: string;
  name: string;
  nickname?: string | null;
  avatar?: string | null;
  xp: number;
  level: number;
  streak: number;
  goal?: string | null;
  weeklyAvailabilityMinutes: number;
  conceptStates: StudentConceptState[];
  timeline: StudentAttempt[];
  beforeAfter: { beforeReview: number | null; afterReview: number | null };
}

interface RecommendationEvidence {
  id: string;
  attemptId?: string | null;
  type: string;
  valueJson: unknown;
  explanation: string;
  createdAt?: string;
  attempt?: {
    id?: string;
    isCorrect?: boolean;
    usedHint?: boolean;
    score?: number;
    createdAt?: string;
  } | null;
}

interface RecommendationTarget {
  type?: string | null;
  id?: string | null;
  phase?: string | null;
  estimatedMinutes?: number | null;
}

export interface TeacherRecommendation {
  id: string;
  studentId?: string;
  student?: { id: string; name: string };
  conceptCode: string;
  action: string;
  priorityScore: number;
  target: RecommendationTarget;
  reasons: unknown;
  candidateLog: unknown;
  evidence: RecommendationEvidence[];
  status: string;
  modelVersion: string;
  createdAt?: string;
}

interface ModelEvaluation {
  id: string;
  datasetName: string;
  splitStrategy: string;
  metricsJson: unknown;
  limitations: string;
  dataNotice: string;
  evaluatedAt: string;
}

interface ModelSummary {
  code: string;
  version: string;
  status: string;
  algorithm: string;
  trainedAt: string;
  evaluation: ModelEvaluation | null;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function displayValue(value: unknown): string {
  if (typeof value === "number") {
    return value >= 0 && value <= 1 ? `${Math.round(value * 100)}%` : String(Math.round(value * 100) / 100);
  }
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(displayValue).join(", ");
  const entries = Object.entries(record(value)).filter(([, item]) => ["string", "number", "boolean"].includes(typeof item));
  return entries.length ? entries.map(([key, item]) => `${key}: ${displayValue(item)}`).join(" · ") : "Có bản ghi";
}

function recommendationTone(status: string): "green" | "yellow" | "red" | "blue" | "purple" | "gray" {
  if (status === "COMPLETED") return "green";
  if (status === "ACTIVE") return "blue";
  if (status === "DISMISSED" || status === "EXPIRED") return "gray";
  return "yellow";
}

function RecommendationEvidenceView({ recommendation }: { recommendation: TeacherRecommendation }) {
  const reasons = strings(recommendation.reasons);
  const log = record(recommendation.candidateLog);
  const candidateScores = Object.entries(record(log.candidateScores));
  const selectedBecause = typeof log.selectedBecause === "string" ? log.selectedBecause : recommendation.action;
  const signalRows = [
    ["Mastery", log.mastery],
    ["Nguy cơ quên", log.forgettingRisk],
    ["Xác suất đúng lượt tới", log.nextAttemptProbability],
    ["Rule", log.ruleId],
    ["Model", log.modelVersion ?? recommendation.modelVersion]
  ].filter((row): row is [string, unknown] => row[1] !== undefined && row[1] !== null);

  return (
    <div className="page-stack">
      <div className="metric-grid four">
        <Metric label="Độ ưu tiên" value={`${Math.round(recommendation.priorityScore * 100)}/100`} note={selectedBecause} icon="ai-personalization" />
        <Metric label="Concept" value={recommendation.conceptCode} note={recommendation.action} icon="learning-brain" tone="blue" />
        <Metric label="Thời lượng" value={`${recommendation.target.estimatedMinutes ?? "—"} phút`} note={recommendation.target.phase ?? "Chưa có phase"} icon="ui-clock" tone="purple" />
        <Metric label="Model" value={recommendation.modelVersion} note="Version được lưu cùng log" icon="ai-explain" tone="orange" />
      </div>

      <div className="recommendation-detail">
        <section className="surface-card">
          <SectionHeading eyebrow="Why this next" title="Vì sao hệ thống chọn bước này?" description="Lý do được lưu cùng recommendation để giáo viên có thể kiểm tra." />
          {reasons.length ? reasons.map((reason) => <p key={reason}>✓ {reason}</p>) : <p>Chưa có lý do dạng văn bản trong bản ghi này.</p>}
          <div className="context-row"><span>Hoạt động đích</span><strong>{recommendation.target.type ?? "—"}</strong></div>
          <div className="context-row"><span>Mã nội dung</span><strong>{recommendation.target.id ?? "—"}</strong></div>
          <div className="context-row"><span>Trạng thái</span><StatusPill tone={recommendationTone(recommendation.status)}>{recommendation.status}</StatusPill></div>
        </section>

        <section className="surface-card">
          <SectionHeading eyebrow="Candidate scoring" title="Các signal đã được cân nhắc" description="Điểm cao hơn làm tăng mức ưu tiên; đây không phải nhãn cố định cho học sinh." />
          {candidateScores.length ? candidateScores.map(([label, value]) => {
            const score = typeof value === "number" ? value : 0;
            return (
              <div className="weighted-signal" key={label}>
                <span>{label}</span>
                <ProgressBar value={Math.max(0, Math.min(100, score * 100))} />
                <strong>{typeof value === "number" ? `${Math.round(value * 100)}%` : "—"}</strong>
              </div>
            );
          }) : <p>Log cũ chưa có candidateScores.</p>}
          {signalRows.map(([label, value]) => <div className="context-row" key={label}><span>{label}</span><strong>{displayValue(value)}</strong></div>)}
        </section>
      </div>

      <section className="surface-card student-table">
        <SectionHeading eyebrow="Recommendation evidence" title="Bằng chứng gắn với từng attempt" description="Mỗi hàng chỉ ra nguồn signal và diễn giải; không hiển thị blob JSON thô." />
        <div className="table-head"><span>Loại</span><span>Attempt</span><span>Kết quả</span><span>Gợi ý</span><span>Giá trị</span><span>Diễn giải</span></div>
        {recommendation.evidence.length ? recommendation.evidence.map((item) => (
          <div className="table-row" key={item.id}>
            <span>{item.type}</span>
            <span>{item.attemptId?.slice(0, 8) ?? "—"}</span>
            <span>{item.attempt?.isCorrect === undefined ? "—" : item.attempt.isCorrect ? "Đúng" : "Sai"}</span>
            <span>{item.attempt?.usedHint === undefined ? "—" : item.attempt.usedHint ? "Có" : "Không"}</span>
            <span>{displayValue(item.valueJson)}</span>
            <span>{item.explanation || "—"}</span>
          </div>
        )) : <p>Recommendation này chưa liên kết RecommendationEvidence riêng.</p>}
      </section>
    </div>
  );
}

export function StudentDetailView({ id }: { id: string }) {
  const [data, setData] = useState<{ student: TeacherStudent; recommendations: TeacherRecommendation[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setError("");
    void Promise.all([
      apiRequest<TeacherStudent>(`/teacher/students/${id}`),
      apiRequest<TeacherRecommendation[]>(`/teacher/students/${id}/recommendations`)
    ]).then(([student, recommendations]) => {
      if (active) setData({ student, recommendations });
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Không tải được hồ sơ học sinh");
    });
    return () => { active = false; };
  }, [id]);

  if (error) return <EmptyState illustration="activity" title="Không tải được hồ sơ học sinh" description={error} />;
  if (!data) return <div className="surface-card"><p>Đang tải tiến độ và recommendation logs…</p></div>;

  const { student, recommendations } = data;
  const mastery = student.conceptStates.length
    ? student.conceptStates.reduce((sum, item) => sum + item.mastery, 0) / student.conceptStates.length
    : 0;
  const before = student.beforeAfter.beforeReview;
  const after = student.beforeAfter.afterReview;
  const delta = before !== null && after !== null ? after - before : null;

  return (
    <div className="page-stack">
      <SectionHeading eyebrow="Hồ sơ học tập có bằng chứng" title={student.name} description="Tiến độ, attempt và đề xuất lấy trực tiếp từ API giáo viên." />
      <div className="metric-grid four">
        <Metric label="Mastery trung bình" value={`${Math.round(mastery * 100)}%`} note={`${student.conceptStates.length} concept có dữ liệu`} icon="learning-brain" />
        <Metric label="XP" value={String(student.xp)} note={`Cấp ${student.level}`} icon="gamify-xp" tone="yellow" />
        <Metric label="Chuỗi học" value={`${student.streak} ngày`} note="Từ hồ sơ học sinh" icon="gamify-streak" tone="orange" />
        <Metric label="Quỹ thời gian" value={`${student.weeklyAvailabilityMinutes} phút`} note="Mỗi tuần" icon="ui-clock" tone="blue" />
      </div>

      <div className="student-detail-grid">
        <aside className="surface-card student-profile-summary">
          <Asset type="avatar" name={student.avatar ?? "avatar-01"} alt="" width={100} height={100} />
          <h2>{student.nickname || student.name}</h2>
          <p>{student.goal || "Chưa cập nhật mục tiêu học tập"}</p>
          <div><strong>{recommendations.length}</strong><span>đề xuất</span><strong>{student.timeline.length}</strong><span>attempt</span></div>
        </aside>
        <section className="surface-card">
          <SectionHeading eyebrow="Concept state" title="Mức nắm vững và khả năng nhớ" description="Ô thiếu dữ liệu được giữ nguyên, không nội suy điểm đẹp." />
          {student.conceptStates.length ? student.conceptStates.map((item) => (
            <div className="dual-progress" key={item.code}>
              <strong>{item.title}</strong>
              <ProgressBar label={`Mastery ${Math.round(item.mastery * 100)}%`} value={item.mastery * 100} />
              <ProgressBar label={`Nhớ lại ${Math.round(item.retrievability * 100)}%`} value={item.retrievability * 100} color="blue" />
            </div>
          )) : <p>Học sinh chưa có concept state.</p>}
        </section>
      </div>

      <section className="surface-card">
        <SectionHeading eyebrow="Before / after" title="Thay đổi sau lần ôn range()" description="So sánh đúng hai mốc lịch sử mà API cung cấp; không suy rộng thành tác động nhân quả." />
        <div className="analytics-grid">
          <div className="context-row"><span>Trước ôn</span><strong>{before === null ? "Chưa có mốc" : `${Math.round(before * 100)}%`}</strong></div>
          <div className="context-row"><span>Sau ôn</span><strong>{after === null ? "Chưa có mốc" : `${Math.round(after * 100)}%`}</strong></div>
        </div>
        <p>{delta === null ? "Cần đủ hai mốc ConceptStateHistory để so sánh." : `Chênh lệch quan sát: ${delta >= 0 ? "+" : ""}${Math.round(delta * 100)} điểm phần trăm.`}</p>
      </section>

      <section className="surface-card student-table">
        <SectionHeading eyebrow="Explainable recommendations" title="Nhật ký đề xuất cá nhân" description="Mở từng log để xem lý do, candidate scores và evidence gắn với attempt." />
        <div className="table-head"><span>Concept</span><span>Hành động</span><span>Ưu tiên</span><span>Thời lượng</span><span>Model</span><span>Chi tiết</span></div>
        {recommendations.length ? recommendations.map((item) => (
          <div className="table-row" key={item.id}>
            <span>{item.conceptCode}</span><span>{item.action}</span><span>{Math.round(item.priorityScore * 100)}/100</span>
            <span>{item.target.estimatedMinutes ?? "—"} phút</span><span>{item.modelVersion}</span>
            <Link href={`/teacher/recommendations/${item.id}`}>Xem evidence →</Link>
          </div>
        )) : <p>Chưa có recommendation log cho học sinh này.</p>}
      </section>

      <section className="surface-card student-table">
        <SectionHeading eyebrow="Attempt timeline" title="Hoạt động gần đây" description="Kết quả, hint và diagnosis được giữ tách biệt để tránh gắn nhãn từ một lần sai." />
        <div className="table-head"><span>Thời gian</span><span>Bài tập</span><span>Kết quả</span><span>Hint</span><span>Diagnosis</span><span>Điểm</span></div>
        {student.timeline.length ? student.timeline.map((item) => (
          <div className="table-row" key={item.id}>
            <span>{new Date(item.createdAt).toLocaleString("vi-VN")}</span><span>{item.exerciseCode}</span>
            <span>{item.isCorrect ? "Đúng" : "Sai"}</span><span>{item.usedHint ? "Có" : "Không"}</span>
            <span>{item.diagnosis?.misconception?.code ?? item.diagnosis?.ruleId ?? "Không match rule"}</span><span>{Math.round(item.score * 100)}%</span>
          </div>
        )) : <p>Chưa có attempt trong timeline.</p>}
      </section>
    </div>
  );
}

export function RecommendationDetailView({ id }: { id: string }) {
  const [data, setData] = useState<TeacherRecommendation | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void apiRequest<TeacherRecommendation>(`/teacher/recommendations/${id}`).then((response) => {
      if (active) setData(response);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Không tải được recommendation log");
    });
    return () => { active = false; };
  }, [id]);

  if (error) return <EmptyState illustration="activity" title="Không tải được recommendation" description={error} />;
  if (!data) return <div className="surface-card"><p>Đang tải lý do và evidence…</p></div>;
  return (
    <div className="page-stack">
      <SectionHeading
        eyebrow={`Recommendation ${data.id.slice(0, 8)}`}
        title={`${data.student?.name ?? "Học sinh"} · ${data.conceptCode}`}
        description="Bản ghi có version model, candidate scores và evidence để giáo viên kiểm tra quyết định."
        action={data.student && <Link className="button ghost small" href={`/teacher/students/${data.student.id}`}>Về hồ sơ</Link>}
      />
      <RecommendationEvidenceView recommendation={data} />
    </div>
  );
}

export function ModelRegistryView() {
  const [models, setModels] = useState<ModelSummary[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void apiRequest<{ models: ModelSummary[] }>("/teacher/analytics/models").then((response) => {
      if (active) setModels(response.models);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Không tải được model registry");
    });
    return () => { active = false; };
  }, []);

  if (error) return <EmptyState illustration="activity" title="Không tải được model registry" description={error} />;
  if (!models) return <div className="surface-card"><p>Đang tải version và evaluation…</p></div>;
  return (
    <div className="page-stack">
      <SectionHeading eyebrow="Model governance" title="Model registry và giới hạn đánh giá" description="Chỉ hiển thị metric đã lưu; không biến evaluation trên dữ liệu tổng hợp thành cam kết chất lượng thực địa." />
      <div className="model-card-grid">
        {models.map((model) => {
          const metrics = Object.entries(record(model.evaluation?.metricsJson));
          return (
            <article key={`${model.code}-${model.version}`}>
              <div><StatusPill tone={model.status === "ACTIVE" ? "green" : "gray"}>{model.status}</StatusPill><span>{model.version}</span></div>
              <h2>{model.code}</h2><p>{model.algorithm}</p>
              <dl>
                <dt>Huấn luyện</dt><dd>{new Date(model.trainedAt).toLocaleDateString("vi-VN")}</dd>
                <dt>Dataset</dt><dd>{model.evaluation?.datasetName ?? "Chưa đánh giá"}</dd>
                <dt>Split</dt><dd>{model.evaluation?.splitStrategy ?? "—"}</dd>
                {metrics.map(([label, value]) => <><dt key={`${label}-key`}>{label}</dt><dd key={`${label}-value`}>{displayValue(value)}</dd></>)}
              </dl>
              {model.evaluation?.limitations && <p><strong>Giới hạn:</strong> {model.evaluation.limitations}</p>}
              {model.evaluation?.dataNotice && <p><strong>Dữ liệu:</strong> {model.evaluation.dataNotice}</p>}
            </article>
          );
        })}
      </div>
    </div>
  );
}
