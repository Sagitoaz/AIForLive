"use client";

import type { MicroLesson } from "@edurecall/shared-types";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Asset } from "@/components/asset";
import { LearningAnimation } from "@/components/learning-animation";
import { EmptyState, Metric, ProgressBar, SectionHeading, StatusPill } from "@/components/ui";
import { CoursePlanStudio } from "@/features/teacher/course-plan-studio";
import { ModelRegistryView, RecommendationDetailView, StudentDetailView } from "@/features/teacher/student-evidence-view";
import { type GenerationBrief, useProduct } from "@/features/product/product-context";
import { apiFormRequest, apiRequest } from "@/lib/api";
import { speakVietnamese } from "@/lib/vietnamese-speech";

export function TeacherViewRouter({ path }: { path: string }) {
  if (path === "studio" || path === "editor") return <ContentStudio />;
  if (path === "classes") return <ClassView />;
  if (path === "heatmap") return <HeatmapView />;
  if (path === "reviews" || path === "review-history") return <ReviewQueue />;
  if (path === "sources" || path === "upload") return <SourceManager />;
  if (path.startsWith("students/")) return <StudentDetailView id={path.split("/")[1] ?? ""} />;
  if (path.startsWith("recommendations/")) return <RecommendationDetailView id={path.split("/")[1] ?? ""} />;
  if (path === "analytics") return <AnalyticsView />;
  if (path === "models") return <ModelRegistryView />;
  if (path === "course-builder" || path === "exercises") return <CourseBuilder />;
  if (path === "leaderboard") return <LeaderboardSettings />;
  return <EmptyState illustration="activity" title="Chức năng đã được tinh gọn" description="Sản phẩm tập trung vào lớp học, soạn nội dung có hỗ trợ, kiểm duyệt và đo lường." href="/teacher" action="Về tổng quan" />;
}

type StudioView = "library" | "brief" | "editor";

const pendingContentStatuses = new Set(["DRAFT", "IN_REVIEW", "REVISION_REQUIRED", "APPROVED"]);

function contentStatusTone(status: string): "green" | "yellow" | "red" | "blue" | "purple" | "gray" {
  if (status === "PUBLISHED") return "green";
  if (status === "APPROVED") return "blue";
  if (status === "IN_REVIEW") return "purple";
  if (status === "REVISION_REQUIRED" || status === "REJECTED") return "red";
  if (status === "ARCHIVED") return "gray";
  return "yellow";
}

function draftKindLabel(kind?: MicroLesson["draftKind"]): string {
  return kind === "FULL_LESSON" ? "Khung bài học 3 pha" : "Bài bổ trợ";
}

function contentStatusLabel(status: string): string {
  return ({
    DRAFT: "Bản nháp",
    IN_REVIEW: "Đang chờ duyệt",
    REVISION_REQUIRED: "Cần chỉnh sửa",
    APPROVED: "Đã phê duyệt",
    PUBLISHED: "Đã xuất bản",
    REJECTED: "Đã từ chối",
    ARCHIVED: "Đã lưu trữ"
  } as Record<string, string>)[status] ?? status;
}

function contentProviderLabel(provider: MicroLesson["provider"] | GenerationBrief["provider"]): string {
  return provider === "EXTERNAL_LLM"
    ? "External LLM · chỉ dùng khi máy chủ đã cấu hình"
    : "Local Template · khung xác định · 0 USD · không phải LLM";
}

function slideTypeLabel(type: string): string {
  return ({
    CONCEPT: "Khái niệm",
    EXAMPLE: "Ví dụ",
    MISCONCEPTION: "Hiểu nhầm",
    PRACTICE: "Thực hành",
    SUMMARY: "Tóm tắt"
  } as Record<string, string>)[type] ?? type;
}

const workflowStages = [
  { status: "DRAFT", label: "Bản nháp" },
  { status: "IN_REVIEW", label: "Chờ duyệt" },
  { status: "APPROVED", label: "Đã duyệt" },
  { status: "PUBLISHED", label: "Xuất bản" }
] as const;

function ContentWorkflow({ status }: { status: string }) {
  const normalizedStatus = status === "REVISION_REQUIRED" ? "DRAFT" : status;
  const activeIndex = Math.max(0, workflowStages.findIndex((item) => item.status === normalizedStatus));
  const nextAction = ({
    DRAFT: "Tiếp theo: kiểm tra bản nháp, lưu thay đổi rồi gửi duyệt.",
    REVISION_REQUIRED: "Tiếp theo: sửa theo phản hồi, lưu lại rồi gửi duyệt lần nữa.",
    IN_REVIEW: "Tiếp theo: REVIEWER/OWNER không phải người tạo sẽ yêu cầu sửa hoặc phê duyệt.",
    APPROVED: "Tiếp theo: người kiểm duyệt xuất bản đúng phiên bản đã được phê duyệt.",
    PUBLISHED: "Hoàn tất: học sinh chỉ truy cập được phiên bản đã xuất bản.",
    REJECTED: "Bản này đã bị từ chối; cần tạo một bản nháp mới nếu muốn tiếp tục."
  } as Record<string, string>)[status] ?? "Kiểm tra trạng thái trước khi tiếp tục.";

  return (
    <section className="workflow-guide" aria-label="Quy trình kiểm duyệt nội dung">
      <div className="workflow-steps">
        {workflowStages.map((item, index) => (
          <div className={index < activeIndex || status === "PUBLISHED" ? "completed" : index === activeIndex ? "active" : ""} key={item.status}>
            <span>{index < activeIndex || status === "PUBLISHED" ? "✓" : index + 1}</span>
            <strong>{item.label}</strong>
          </div>
        ))}
      </div>
      <p>{nextAction}</p>
    </section>
  );
}

function ContentStudio() {
  const product = useProduct();
  const [authoringMode, setAuthoringMode] = useState<"course" | "lesson">("lesson");
  const [view, setView] = useState<StudioView>("library");
  const classRoles = product.identity?.classRoles ?? [];
  const canAuthor = classRoles.includes("OWNER") || classRoles.includes("INSTRUCTOR");

  const openLesson = async (id: string) => {
    await product.selectGeneratedLesson(id);
    setView("editor");
  };

  const intro = (
    <header className="page-intro teacher-intro">
      <div>
        <span className="eyebrow">Soạn nội dung có kiểm duyệt</span>
        <h1>Chọn đúng việc cần làm, rồi đi từng bước</h1>
        <p>Tạo khung bài học từ nguồn đã xác minh hoặc lập một bản kế hoạch từ catalog. Mọi đầu ra đều là bản nháp để giáo viên kiểm tra trước khi xuất bản.</p>
      </div>
      <Asset type="illustration" name="illustration-ai-generation" alt="" width={250} height={170} />
    </header>
  );
  const modeTabs = (
    <nav className="tabs" aria-label="Loại nội dung cần soạn">
      <button className={authoringMode === "lesson" ? "active" : ""} onClick={() => setAuthoringMode("lesson")}>Tạo bài học hoặc bài bổ trợ</button>
      <button className={authoringMode === "course" ? "active" : ""} onClick={() => setAuthoringMode("course")}>Lập kế hoạch khóa học</button>
    </nav>
  );

  if (authoringMode === "course") {
    return <div className="page-stack teacher-authoring">{intro}{modeTabs}<CoursePlanStudio /></div>;
  }

  return (
    <div className="page-stack teacher-authoring">
      {intro}
      {modeTabs}

      <nav className="tabs" aria-label="Khu vực soạn bài">
        <button className={view === "brief" ? "active" : ""} disabled={!canAuthor} onClick={() => setView("brief")}>1. Tạo bản nháp</button>
        <button className={view === "library" ? "active" : ""} onClick={() => setView("library")}>2. Thư viện bài</button>
        <button
          className={view === "editor" ? "active" : ""}
          disabled={!product.generatedLesson}
          onClick={() => setView("editor")}
        >
          3. Biên tập & duyệt
        </button>
      </nav>

      {product.operation && <div className="provider-notice"><span><strong>{product.operation}</strong><small>Không đóng trang cho đến khi thao tác hoàn tất.</small></span></div>}

      {view === "library" && (
        <ContentLibrary
          items={product.reviewQueue}
          currentId={product.generatedLesson?.id}
          busy={product.busy}
          canCreate={canAuthor}
          onCreate={() => setView("brief")}
          onSelect={openLesson}
        />
      )}
      {view === "brief" && (canAuthor
        ? <BriefWizard onCreated={() => setView("editor")} />
        : <EmptyState illustration="review" title="Tài khoản chỉ kiểm duyệt" description="REVIEWER mở bản trong thư viện để yêu cầu sửa, phê duyệt hoặc xuất bản; không tạo bản nháp mới." />)}
      {view === "editor" && (
        product.generatedLesson
          ? <LessonEditor lesson={product.generatedLesson} onBack={() => setView("library")} />
          : <EmptyState illustration="review" title="Chưa chọn nội dung" description="Chọn một bản nháp hoặc tạo bản mới từ nguồn đã xác minh." href="/teacher/studio" action="Về thư viện" />
      )}
    </div>
  );
}

function ContentLibrary({
  items,
  currentId,
  busy,
  canCreate,
  onCreate,
  onSelect
}: {
  items: MicroLesson[];
  currentId?: string;
  busy: boolean;
  canCreate: boolean;
  onCreate: () => void;
  onSelect: (id: string) => Promise<void>;
}) {
  const pending = items.filter((item) => pendingContentStatuses.has(item.status));
  const published = items.filter((item) => item.status === "PUBLISHED");

  return (
    <div className="analytics-grid">
      <section className="surface-card misconception-list">
        <SectionHeading
          eyebrow={`${pending.length} bản cần xử lý`}
          title="Bản nháp và hàng chờ duyệt"
          description="Mỗi bản phải được giáo viên kiểm duyệt trước khi học sinh truy cập."
          action={<button className="button primary small" disabled={!canCreate} onClick={onCreate}>Tạo bản nháp mới</button>}
        />
        {pending.length ? pending.map((item) => (
          <article className="misconception-row" key={item.id}>
            <span className={`severity ${item.status === "REVISION_REQUIRED" ? "red" : "yellow"}`} />
            <div>
              <strong>{item.title}</strong>
              <small>{draftKindLabel(item.draftKind)} · {item.gradeBand ?? item.level} · v{item.version}</small>
              <StatusPill tone={contentStatusTone(item.status)}>{contentStatusLabel(item.status)}</StatusPill>
            </div>
            <button className="button ghost small" disabled={busy} onClick={() => void onSelect(item.id)}>
              {item.id === currentId ? "Tiếp tục" : "Mở"}
            </button>
          </article>
        )) : <p>Không có bản nháp đang chờ.</p>}
      </section>

      <section className="surface-card misconception-list">
        <SectionHeading
          eyebrow={`${published.length} phiên bản`}
          title="Đã xuất bản"
          description="Nội dung học sinh đang có thể truy cập."
        />
        {published.length ? published.map((item) => (
          <article className="misconception-row" key={item.id}>
            <span className="severity" style={{ background: "#4AAA64" }} />
            <div>
              <strong>{item.title}</strong>
              <small>{item.totalDurationMinutes ?? "—"} phút · {item.reuseCount} lượt reuse · v{item.version}</small>
              <StatusPill tone="green">{contentStatusLabel(item.status)}</StatusPill>
            </div>
            <button className="button ghost small" disabled={busy} onClick={() => void onSelect(item.id)}>Xem</button>
          </article>
        )) : <p>Chưa có nội dung được xuất bản.</p>}
      </section>
    </div>
  );
}

const phasePlan = [
  { phase: "THEORY", title: "1. Lý thuyết", detail: "Bài giảng, ví dụ, video hoặc tài liệu" },
  { phase: "PRACTICE", title: "2. Thực hành", detail: "Code, dự đoán, trắc nghiệm và sửa lỗi" },
  { phase: "CHECKPOINT", title: "3. Kiểm tra", detail: "Câu mới để củng cố và cập nhật lộ trình" }
] as const;

interface MisconceptionChoice {
  id: string;
  code: string;
  title: string;
  description: string;
  severity: string;
}

function BriefWizard({ onCreated }: { onCreated: () => void }) {
  const product = useProduct();
  const lessons = useMemo(
    () => product.course?.modules.flatMap((module) => module.lessons) ?? [],
    [product.course]
  );
  const firstLesson = lessons[0];
  const verifiedSources = useMemo(
    () => product.sources.filter((item) => item.status === "VERIFIED" && item.courseId === product.course?.id),
    [product.course?.id, product.sources]
  );
  const [step, setStep] = useState(0);
  const [lessonId, setLessonId] = useState("");
  const [misconceptions, setMisconceptions] = useState<MisconceptionChoice[]>([]);
  const [misconceptionLoading, setMisconceptionLoading] = useState(false);
  const [misconceptionError, setMisconceptionError] = useState("");
  const [brief, setBrief] = useState<GenerationBrief>({
    draftKind: "FULL_LESSON",
    sourceId: verifiedSources[0]?.id,
    conceptCode: undefined,
    misconceptionCode: undefined,
    level: "Mới bắt đầu",
    gradeBand: "Lớp 6–9",
    learningObjective: "Giải thích được ý tưởng cốt lõi và áp dụng trong một tình huống mới",
    durationMinutes: 65,
    provider: "LOCAL_TEMPLATE"
  });

  useEffect(() => {
    const currentLesson = lessons.find((item) => item.id === lessonId);
    if (currentLesson) return;
    if (!firstLesson) {
      setLessonId("");
      setBrief((current) => ({ ...current, conceptCode: undefined, misconceptionCode: undefined }));
      return;
    }
    setLessonId(firstLesson.id);
    setBrief((current) => ({
      ...current,
      conceptCode: firstLesson.conceptCode,
      misconceptionCode: undefined,
      gradeBand: current.gradeBand === "Lớp 6–9" ? product.course?.audience ?? current.gradeBand : current.gradeBand
    }));
  }, [firstLesson, lessonId, lessons, product.course?.audience]);

  useEffect(() => {
    if (verifiedSources.some((source) => source.id === brief.sourceId)) return;
    setBrief((current) => ({ ...current, sourceId: verifiedSources[0]?.id }));
  }, [brief.sourceId, verifiedSources]);

  useEffect(() => {
    const conceptCode = brief.conceptCode;
    if (brief.draftKind !== "REMEDIATION" || !conceptCode) {
      setMisconceptions([]);
      setMisconceptionError("");
      return;
    }
    let active = true;
    setMisconceptions([]);
    setMisconceptionLoading(true);
    setMisconceptionError("");
    void apiRequest<MisconceptionChoice[]>(`/teacher/concepts/${encodeURIComponent(conceptCode)}/misconceptions`)
      .then((items) => {
        if (!active) return;
        setMisconceptions(items);
        setBrief((current) => {
          if (current.draftKind !== "REMEDIATION" || current.conceptCode !== conceptCode) return current;
          const selectedExists = items.some((item) => item.code === current.misconceptionCode);
          return { ...current, misconceptionCode: selectedExists ? current.misconceptionCode : items[0]?.code };
        });
      })
      .catch((cause) => {
        if (active) setMisconceptionError(cause instanceof Error ? cause.message : "Không tải được danh sách hiểu nhầm");
      })
      .finally(() => { if (active) setMisconceptionLoading(false); });
    return () => { active = false; };
  }, [brief.conceptCode, brief.draftKind]);

  const selectedLesson = lessons.find((item) => item.id === lessonId);
  const selectedSource = verifiedSources.find((item) => item.id === brief.sourceId);
  const chooseLesson = (id: string) => {
    const selected = lessons.find((item) => item.id === id);
    setLessonId(selected?.id ?? "");
    setBrief((current) => ({
      ...current,
      conceptCode: selected?.conceptCode,
      misconceptionCode: undefined
    }));
  };
  const chooseKind = (draftKind: GenerationBrief["draftKind"]) => {
    setBrief((current) => ({
      ...current,
      draftKind,
      durationMinutes: draftKind === "FULL_LESSON" ? 65 : 7,
      misconceptionCode: draftKind === "REMEDIATION" ? misconceptions[0]?.code : undefined
    }));
  };
  const scopeReady = Boolean(product.course?.id && lessonId && brief.conceptCode && selectedSource);
  const detailsReady = Boolean(
    brief.learningObjective?.trim()
    && brief.gradeBand?.trim()
    && brief.durationMinutes
    && brief.durationMinutes >= 3
    && brief.durationMinutes <= 120
    && (brief.draftKind === "FULL_LESSON" || brief.misconceptionCode)
  );
  const canGenerate = scopeReady && detailsReady;
  const create = async () => {
    try {
      await product.generateLesson(brief);
      onCreated();
    } catch {
      // ProductContext exposes the server error next to the form.
    }
  };

  return (
    <section className="surface-card generation-form">
      <SectionHeading
        eyebrow={`Bước ${step + 1}/3`}
        title={["Chọn bài, nguồn và loại bản nháp", "Mô tả mục tiêu cần tạo", "Xác nhận trước khi tạo"][step] ?? "Tạo bản nháp"}
        description="Mỗi bước cho biết đầu vào nào sẽ được dùng. Local Template chỉ dựng khung xác định; giáo viên vẫn kiểm tra và quyết định xuất bản."
      />

      <div className="tabs" aria-label="Các bước tạo bản nháp">
        {["Phạm vi & nguồn", "Mục tiêu & cách tạo", "Xác nhận"].map((label, index) => (
          <button
            key={label}
            className={step === index ? "active" : ""}
            disabled={(index > 0 && !scopeReady) || (index > 1 && !detailsReady)}
            onClick={() => setStep(index)}
          >
            {index + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="studio-context-grid">
          <div>
            <label><span>Khóa học đang được phân công</span><select disabled value={product.course?.id ?? ""}><option value={product.course?.id ?? ""}>{product.course?.title ?? "Đang tải khóa học…"}</option></select></label>
            <label><span>Bài học đích</span><select disabled={!lessons.length} value={lessonId} onChange={(event) => chooseLesson(event.target.value)}><option value="">Chọn một bài học</option>{lessons.map((lesson) => <option value={lesson.id} key={lesson.id}>{lesson.code} · {lesson.title}</option>)}</select></label>
            <label><span>Nguồn học liệu đã xác minh</span><select disabled={!verifiedSources.length} value={brief.sourceId ?? ""} onChange={(event) => setBrief({ ...brief, sourceId: event.target.value })}><option value="">Chọn nguồn VERIFIED</option>{verifiedSources.map((source) => <option value={source.id} key={source.id}>{source.name}</option>)}</select></label>
            <Link className="text-link source-cta" href="/teacher/sources">Xem, tải lên hoặc xác minh nguồn →</Link>
          </div>
          <div>
            <label><span>Đầu ra cần tạo</span><select value={brief.draftKind} onChange={(event) => chooseKind(event.target.value as GenerationBrief["draftKind"])}><option value="FULL_LESSON">Khung bài học 3 pha để giáo viên hoàn thiện</option><option value="REMEDIATION">Bài bổ trợ theo hiểu nhầm đã đăng ký</option></select></label>
            {brief.draftKind === "REMEDIATION" && (
              <label><span>Hiểu nhầm cần xử lý · {brief.conceptCode ?? "—"}</span><select disabled={misconceptionLoading || !misconceptions.length} value={brief.misconceptionCode ?? ""} onChange={(event) => setBrief({ ...brief, misconceptionCode: event.target.value })}><option value="">{misconceptionLoading ? "Đang tải…" : "Chọn một hiểu nhầm đã đăng ký"}</option>{misconceptions.map((item) => <option value={item.code} key={item.id}>{item.title} · {item.code}</option>)}</select></label>
            )}
            <div className="provider-notice"><Asset type="icon" name="ui-info" alt="" width={22} height={22} /><span><strong>{selectedLesson ? `${selectedLesson.code} · ${selectedLesson.title}` : "Chưa chọn bài học"}</strong><small>{brief.draftKind === "REMEDIATION" ? brief.misconceptionCode ?? "Cần chọn một hiểu nhầm có thật" : "Khung bài học không tự gắn một hiểu nhầm giả"}</small></span></div>
            {misconceptionError && <p className="game-error" role="alert">{misconceptionError}</p>}
            {brief.draftKind === "REMEDIATION" && !misconceptionLoading && brief.conceptCode && !misconceptions.length && !misconceptionError && <div className="analytics-note"><p>Khái niệm này chưa có hiểu nhầm đã đăng ký; chưa thể tạo bài bổ trợ cho đến khi có dữ liệu phù hợp.</p></div>}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="studio-context-grid">
          <div>
            <label><span>Khối lớp</span><input maxLength={80} value={brief.gradeBand ?? ""} onChange={(event) => setBrief({ ...brief, gradeBand: event.target.value })} /></label>
            <label><span>Trình độ hiện tại</span><select value={brief.level} onChange={(event) => setBrief({ ...brief, level: event.target.value })}><option>Mới bắt đầu</option><option>Đang phát triển</option><option>Cần thử thách</option></select></label>
            <label><span>Thời lượng dự kiến (phút)</span><input type="number" min={3} max={120} value={brief.durationMinutes ?? 0} onChange={(event) => setBrief({ ...brief, durationMinutes: Number(event.target.value) })} /></label>
          </div>
          <div>
            <label><span>Mục tiêu học tập giáo viên muốn học sinh đạt được</span><textarea maxLength={300} value={brief.learningObjective ?? ""} onChange={(event) => setBrief({ ...brief, learningObjective: event.target.value })} /></label>
            <label><span>Cách dựng bản nháp</span><select value={brief.provider} onChange={(event) => setBrief({ ...brief, provider: event.target.value as GenerationBrief["provider"] })}><option value="LOCAL_TEMPLATE">Local Template · khung xác định · 0 USD · không phải LLM</option><option value="EXTERNAL_LLM">External LLM · cần credential máy chủ · tính theo token</option></select></label>
            <div className="provider-notice"><Asset type="icon" name="ui-info" alt="" width={22} height={22} /><span><strong>{contentProviderLabel(brief.provider)}</strong><small>{brief.provider === "LOCAL_TEMPLATE" ? "Đầu ra là khung có cấu trúc để giáo viên hoàn thiện, không phải bài do LLM viết." : "Nếu máy chủ chưa cấu hình provider, yêu cầu sẽ dừng với lỗi rõ ràng và không tự giả thành LLM."}</small></span></div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="studio-context-grid">
          <div className="evidence-context">
            <div className="context-row"><span>Đầu ra</span><strong>{brief.draftKind === "FULL_LESSON" ? "Khung bài học 3 pha" : "Bài bổ trợ"}</strong></div>
            <div className="context-row"><span>Bài đích</span><strong>{selectedLesson?.title ?? "—"}</strong></div>
            <div className="context-row"><span>Concept</span><strong>{brief.conceptCode ?? "—"}</strong></div>
            {brief.draftKind === "REMEDIATION" && <div className="context-row"><span>Hiểu nhầm cần xử lý</span><strong>{brief.misconceptionCode ?? "—"}</strong></div>}
            <div className="context-row"><span>Nguồn VERIFIED</span><strong>{selectedSource?.name ?? "—"}</strong></div>
            <div className="context-row"><span>Khối lớp</span><strong>{brief.gradeBand}</strong></div>
            <div className="context-row"><span>Thời lượng</span><strong>{brief.durationMinutes} phút</strong></div>
            <div className="context-row"><span>Provider</span><strong>{contentProviderLabel(brief.provider)}</strong></div>
          </div>
          <div className="draft-phase-preview">
            {phasePlan.map((item, index) => <div key={item.phase}><span>{index + 1}</span><strong>{item.title}</strong><small>{item.detail}</small></div>)}
          </div>
        </div>
      )}

      {!lessons.length && <div className="analytics-note"><p>Khóa học chưa tải xong hoặc chưa có bài hoạt động. Không có concept mặc định được gửi thay thế.</p></div>}
      {!verifiedSources.length && <div className="analytics-note source-required-note"><p>Chưa có nguồn VERIFIED. <Link href="/teacher/sources">Mở nguồn học liệu để tải lên, xem nội dung trích xuất và xác minh →</Link></p></div>}
      {product.error && <p className="game-error" role="alert">{product.error}</p>}

      <div className="editor-actions wizard-actions">
        <button className="button ghost" disabled={step === 0 || product.busy} onClick={() => setStep((current) => Math.max(0, current - 1))}>Quay lại</button>
        {step < 2 ? (
          <button className="button primary" disabled={product.busy || !scopeReady || (step === 1 && !detailsReady)} onClick={() => setStep((current) => Math.min(2, current + 1))}>Tiếp tục →</button>
        ) : (
          <button className="button primary" disabled={!canGenerate || product.busy} onClick={() => void create()}>{product.busy ? "Đang tạo bản nháp…" : "Tạo và lưu bản nháp"}</button>
        )}
      </div>
    </section>
  );
}

function LessonEditor({ lesson, onBack }: { lesson: MicroLesson; onBack: () => void }) {
  const product = useProduct();
  const [working, setWorking] = useState(lesson);
  const [slide, setSlide] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [revisionMode, setRevisionMode] = useState(false);
  const editingStartedAt = useRef<number | null>(null);
  const classRoles = product.identity?.classRoles ?? [];
  const canAuthor = classRoles.includes("OWNER") || classRoles.includes("INSTRUCTOR");
  const canReview = classRoles.includes("OWNER") || classRoles.includes("REVIEWER");
  const isDraftAuthor = Boolean(working.requestedBy && product.identity?.id === working.requestedBy.id);

  useEffect(() => {
    setWorking(lesson);
    setDirty(false);
    setRevisionMode(false);
    editingStartedAt.current = null;
    setSlide((current) => Math.min(current, lesson.slides.length));
  }, [lesson]);

  const editable = canAuthor && (working.status === "DRAFT" || working.status === "REVISION_REQUIRED" || (working.status === "APPROVED" && revisionMode));
  const current = working.slides[slide];
  const change = (next: MicroLesson) => {
    if (editingStartedAt.current === null) editingStartedAt.current = Date.now();
    setWorking(next);
    setDirty(true);
  };
  const save = async () => {
    const editingSeconds = editingStartedAt.current === null
      ? 0
      : Math.max(1, Math.round((Date.now() - editingStartedAt.current) / 1_000));
    await product.updateLesson(working, editingSeconds);
    editingStartedAt.current = null;
    setDirty(false);
  };
  const requestRevision = async () => { await product.requestLessonRevision(); };
  const checks = [
    { label: "Có nguồn tham chiếu", ok: working.sourceReferences.length > 0 },
    { label: "Đủ ba pha", ok: (working.sections?.length ?? 0) === 3 },
    { label: "Có ví dụ", ok: working.slides.some((item) => item.type === "EXAMPLE") },
    { label: "Có phần xử lý hiểu nhầm", ok: working.slides.some((item) => item.type === "MISCONCEPTION") },
    { label: "Quiz có một đáp án", ok: working.quiz.correctIndex >= 0 && working.quiz.correctIndex < working.quiz.options.length }
  ];

  return (
    <div className="studio-editor teacher-authoring">
      <header className="editor-header">
        <div>
          <span className="eyebrow">{draftKindLabel(working.draftKind)} · phiên bản giáo viên</span>
          <input aria-label="Tiêu đề nội dung" disabled={!editable} value={working.title} onChange={(event) => change({ ...working, title: event.target.value })} />
        </div>
        <div className="editor-status">
          <StatusPill tone={contentStatusTone(working.status)}>{contentStatusLabel(working.status)}</StatusPill>
          <span>v{working.version} · {contentProviderLabel(working.provider)} · tạo {Math.max(0, Math.round((working.generationMs ?? 0) / 1_000))}s · giáo viên sửa {working.teacherEditingSeconds ?? 0}s</span>
          {working.generationTrace && (
            <span title={`Prompt hash: ${working.generationTrace.promptHash}`}>
              {working.generationTrace.model} · {working.generationTrace.promptTokens + working.generationTrace.completionTokens} tokens · trace {working.generationTrace.promptHash.slice(0, 8)}
            </span>
          )}
        </div>
        <div className="editor-actions">
          <button className="button ghost small" onClick={onBack}>Danh sách</button>
          {editable && <button className="button ghost small" disabled={!dirty || product.busy} onClick={() => void save()}>{working.status === "APPROVED" ? "Lưu thành bản cần duyệt lại" : "Lưu bản sửa"}</button>}
          {canAuthor && (working.status === "DRAFT" || working.status === "REVISION_REQUIRED") && <button className="button dark small" disabled={dirty || product.busy} onClick={() => void product.submitLessonReview()}>Gửi duyệt</button>}
          {canReview && !isDraftAuthor && working.status === "IN_REVIEW" && <button className="button ghost small" disabled={product.busy} onClick={() => void requestRevision()}>Yêu cầu sửa</button>}
          {canReview && !isDraftAuthor && working.status === "IN_REVIEW" && <button className="button dark small" disabled={product.busy} onClick={() => void product.approveLesson()}>Phê duyệt</button>}
          {canAuthor && working.status === "APPROVED" && !revisionMode && <button className="button ghost small" disabled={product.busy} onClick={() => setRevisionMode(true)}>Tạo bản chỉnh sửa</button>}
          {canReview && !isDraftAuthor && working.status === "APPROVED" && !revisionMode && <button className="button primary small" disabled={product.busy} onClick={() => void product.publishLesson()}>Xuất bản</button>}
        </div>
      </header>

      {!editable && working.status !== "PUBLISHED" && (
        <div className="provider-notice"><Asset type="icon" name="ui-lock" alt="" width={22} height={22} /><span><strong>Phiên bản đang khóa chỉnh sửa.</strong><small>Chọn “Tạo bản chỉnh sửa/Yêu cầu sửa” để mở một vòng biên tập mới; thao tác xuất bản luôn dùng phiên bản đã duyệt.</small></span></div>
      )}
      {working.status === "APPROVED" && revisionMode && (
        <div className="provider-notice"><Asset type="icon" name="ui-info" alt="" width={22} height={22} /><span><strong>Đang tạo bản chỉnh sửa từ nội dung đã duyệt.</strong><small>Khi lưu, máy chủ chuyển nội dung về “Cần chỉnh sửa”; bản mới phải được duyệt lại trước khi xuất bản.</small></span></div>
      )}

      <ContentWorkflow status={working.status} />
      {working.status === "IN_REVIEW" && (
        <div className="provider-notice"><Asset type="icon" name="ui-shield" alt="" width={22} height={22}/><span><strong>Tách người soạn và người duyệt.</strong><small>Tài khoản đã tạo bản nháp không thể tự phê duyệt. Khi demo, đăng xuất và chọn Cô Linh (Reviewer) để kiểm tra, yêu cầu sửa hoặc phê duyệt.</small></span></div>
      )}
      {working.status === "APPROVED" && (
        <div className="provider-notice"><Asset type="icon" name="ui-info" alt="" width={22} height={22}/><span><strong>Chỉ OWNER/REVIEWER khác người tạo được xuất bản.</strong><small>Server kiểm tra quyền và lưu reviewer, thời gian, quyết định trong audit trail.</small></span></div>
      )}

      <div className="editor-grid">
        <aside className="slide-list">
          <div className="slide-list-head"><strong>Nội dung</strong><span>{working.slides.length} trang</span></div>
          {working.slides.map((item, index) => (
            <button className={slide === index ? "active" : ""} onClick={() => setSlide(index)} key={item.id}>
              <span>{index + 1}</span>
              <div><small>{slideTypeLabel(item.type)}</small><strong>{item.title}</strong></div>
            </button>
          ))}
          <button className={slide === working.slides.length ? "active quiz" : "quiz"} onClick={() => setSlide(working.slides.length)}>
            <span>Q</span><div><small>Kiểm tra</small><strong>Câu hỏi cuối bài</strong></div>
          </button>
        </aside>

        <section className="editor-canvas">
          {current ? (
            <>
              <div className="canvas-preview">
                <div className="preview-stage"><LearningAnimation compact template={current.animationTemplate} data={current.animationData} title={current.title} /></div>
                <div><StatusPill tone="purple">{current.animationTemplate}</StatusPill><h2>{current.title}</h2><p>{current.body}</p>{current.code && <pre><code>{current.code}</code></pre>}</div>
              </div>
              <div className="editor-fields">
                <label><span>Tiêu đề slide</span><input disabled={!editable} value={current.title} onChange={(event) => change({ ...working, slides: working.slides.map((item, index) => index === slide ? { ...item, title: event.target.value } : item) })} /></label>
                <label><span>Nội dung</span><textarea disabled={!editable} value={current.body} onChange={(event) => change({ ...working, slides: working.slides.map((item, index) => index === slide ? { ...item, body: event.target.value } : item) })} /></label>
                <label><span>Lời đọc tiếng Việt</span><textarea disabled={!editable} value={current.narration} onChange={(event) => change({ ...working, slides: working.slides.map((item, index) => index === slide ? { ...item, narration: event.target.value } : item) })} /></label>
                <button className="button ghost" onClick={() => void speakVietnamese(current.narration)}>Nghe thử lời đọc</button>
              </div>
            </>
          ) : <QuizEditor lesson={working} editable={editable} onChange={change} />}
        </section>

        <aside className="validation-panel">
          <SectionHeading eyebrow="Kiểm tra tự động" title="Cấu trúc bản nháp" description="Đây là tín hiệu hỗ trợ, không thay thế việc giáo viên đọc và kiểm duyệt nội dung." />
          {checks.map((check) => <p className={check.ok ? "check-ok" : "check-warning"} key={check.label}>{check.ok ? "✓" : "!"} {check.label}</p>)}
          <div className="draft-phase-preview">
            {(working.sections?.length ? working.sections : phasePlan.map((item) => ({ phase: item.phase, title: item.title, durationMinutes: 0, summary: item.detail, activityTypes: [] }))).map((section, index) => (
              <div key={section.phase}><span>{index + 1}</span><strong>{section.title}</strong><small>{section.durationMinutes ? `${section.durationMinutes} phút · ` : ""}{section.summary}</small></div>
            ))}
          </div>
          <div className="analytics-note advisory-note"><p>Trước khi phê duyệt, giáo viên vẫn cần kiểm tra độ chính xác, độ tuổi, nguồn tham chiếu và đáp án.</p></div>
          {dirty && <div className="analytics-note"><p>Đang có thay đổi chưa lưu. Hãy lưu trước khi gửi duyệt.</p></div>}
        </aside>
      </div>
    </div>
  );
}

function QuizEditor({ lesson, editable, onChange }: { lesson: MicroLesson; editable: boolean; onChange: (lesson: MicroLesson) => void }) {
  return (
    <div className="quiz-editor">
      <span className="eyebrow">Kiểm tra cuối bài</span>
      <label><span>Câu hỏi</span><textarea disabled={!editable} value={lesson.quiz.question} onChange={(event) => onChange({ ...lesson, quiz: { ...lesson.quiz, question: event.target.value } })} /></label>
      {lesson.quiz.options.map((option, index) => (
        <label className="quiz-option-edit" key={`${index}-${option}`}>
          <input disabled={!editable} type="radio" name="correct-answer" checked={lesson.quiz.correctIndex === index} onChange={() => onChange({ ...lesson, quiz: { ...lesson.quiz, correctIndex: index } })} />
          <input disabled={!editable} value={option} onChange={(event) => onChange({ ...lesson, quiz: { ...lesson.quiz, options: lesson.quiz.options.map((item, itemIndex) => itemIndex === index ? event.target.value : item) } })} />
        </label>
      ))}
      <label><span>Giải thích sau khi trả lời</span><textarea disabled={!editable} value={lesson.quiz.explanation} onChange={(event) => onChange({ ...lesson, quiz: { ...lesson.quiz, explanation: event.target.value } })} /></label>
    </div>
  );
}

function TeacherDataLoading({ label }: { label: string }) { return <div className="loading-page" role="status"><div className="skeleton skeleton-title"/><div className="skeleton-grid"><div className="skeleton skeleton-card"/><div className="skeleton skeleton-card"/></div><p>{label}</p></div>; }
function ClassView(){const product=useProduct();const data=product.classData;if(!data)return <TeacherDataLoading label="Đang đồng bộ hồ sơ lớp từ Supabase…"/>;return <div className="page-stack"><SectionHeading eyebrow="1 lớp · fixture synthetic" title={data.name} description="Hồ sơ mô phỏng có mức năng lực, thiết bị và chất lượng dữ liệu khác nhau; không phải dữ liệu trẻ em thật."/>{data.students.map((student)=><article className="surface-card student-row" key={student.id}><Asset type="avatar" name={student.avatar??"avatar-01"} alt="" width={44} height={44}/><div><strong>{student.name}</strong><small>{student.goal}</small></div><ProgressBar value={student.mastery*100}/><StatusPill tone={student.needsSupport?"red":"green"}>{student.needsSupport?"Cần hỗ trợ":`${Math.round(student.mastery*100)}%`}</StatusPill><Link href={`/teacher/students/${student.id}`}>Chi tiết →</Link></article>)}</div>}
function HeatmapView(){const data=useProduct().heatmap;if(!data)return <TeacherDataLoading label="Đang tổng hợp knowledge heatmap…"/>;return <div className="page-stack"><SectionHeading eyebrow="Supabase concept states" title="Knowledge heatmap" description="Ô trống được giữ là thiếu dữ liệu, không tự điền số đẹp."/><section className="surface-card full-heatmap"><div className="full-heat-head"><span>Học sinh</span>{data.concepts.map((c)=><span key={c.id}><small>{c.title}</small></span>)}</div>{data.rows.map((row)=><div className="full-heat-row" key={row.studentId}><span>{row.name}</span>{row.values.map((value)=><button disabled key={value.conceptCode} className={value.mastery===null?"missing":value.mastery<.45?"low":value.mastery<.65?"mid":"high"}>{value.mastery===null?"—":`${Math.round(value.mastery*100)}%`}</button>)}</div>)}</section></div>}
function ReviewQueue() {
  const product = useProduct();
  const [editing, setEditing] = useState(false);
  const classRoles = product.identity?.classRoles ?? [];
  const canAuthor = classRoles.includes("OWNER") || classRoles.includes("INSTRUCTOR");
  const open = async (id: string) => {
    await product.selectGeneratedLesson(id);
    setEditing(true);
  };

  if (editing && product.generatedLesson) {
    return (
      <div className="page-stack teacher-authoring">
        <SectionHeading eyebrow="Giáo viên kiểm duyệt" title="Biên tập bản đang chọn" description="Chỉ phiên bản đã được phê duyệt mới có thể xuất bản cho học sinh." />
        <LessonEditor lesson={product.generatedLesson} onBack={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="page-stack teacher-authoring">
      <SectionHeading eyebrow="Giáo viên kiểm duyệt" title="Bản nháp chờ xử lý và nội dung đã xuất bản" description="Trạng thái, phiên bản và lịch sử quyết định đều được lưu để truy vết." />
      {product.reviewQueue.length ? (
        <ContentLibrary
          items={product.reviewQueue}
          currentId={product.generatedLesson?.id}
          busy={product.busy}
          canCreate={canAuthor}
          onCreate={() => { window.location.href = "/teacher/studio"; }}
          onSelect={open}
        />
      ) : <EmptyState illustration="review" title="Hàng chờ đang trống" description="Tạo một bản nháp từ nguồn đã xác minh để bắt đầu." href="/teacher/studio" action="Mở khu soạn nội dung" />}
    </div>
  );
}

function sourceStatusLabel(status: string): string {
  return ({
    NEEDS_REVIEW: "Cần xem và xác minh",
    VERIFIED: "Đã xác minh",
    PENDING_EXTRACTION: "Đang trích xuất",
    REJECTED: "Đã từ chối"
  } as Record<string, string>)[status] ?? status;
}

function SourceManager() {
  const product = useProduct();
  const [notice, setNotice] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const upload = async (file?: File) => {
    if (!file) return;
    if (!product.course?.id) {
      setNotice("Hãy chờ khóa học được tải trước khi thêm nguồn.");
      return;
    }
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("courseId", product.course.id);
      const source = await apiFormRequest<{ id: string; status: string }>("/content-sources/upload", form);
      setNotice(`Đã lưu nguồn ở trạng thái ${sourceStatusLabel(source.status)}. Hãy mở bản xem trước trước khi xác minh.`);
      await product.refresh();
      setPreviewId(source.id);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Không tải được tệp lên");
    }
  };

  const verify = async (id: string) => {
    try {
      await apiRequest(`/content-sources/${id}/verify`, { method: "POST", body: "{}" });
      setNotice("Đã xác minh nguồn. Nguồn này hiện có thể được dùng để dựng bản nháp.");
      await product.refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Không xác minh được nguồn");
    }
  };

  return (
    <div className="page-stack teacher-authoring source-manager">
      <SectionHeading
        eyebrow="Nguồn có kiểm chứng"
        title="Xem nội dung trước khi cho phép tạo bản nháp"
        description="Pilot hiện nhận TXT. Nút xác minh chỉ xuất hiện sau khi mở phần văn bản đã trích xuất."
        action={<Link className="button ghost small" href="/teacher/studio">← Quay lại tạo bài</Link>}
      />
      <section className="surface-card upload-panel">
        <div>
          <strong>1. Tải tài liệu TXT</strong>
          <p>Tệp được lưu và trích xuất trên máy chủ; công cụ tạo bản nháp chưa được phép dùng cho đến khi giáo viên xác minh.</p>
        </div>
        <label className="button primary">Chọn tệp TXT<input type="file" accept=".txt,text/plain" onChange={(event) => void upload(event.target.files?.[0])} /></label>
        {notice && <p className="source-notice" role="status">{notice}</p>}
      </section>

      <section className="source-review-list">
        {product.sources.filter((source) => source.courseId === product.course?.id).map((source) => {
          const expanded = previewId === source.id;
          return (
            <article className="surface-card source-review-card" key={source.id}>
              <header>
                <div>
                  <strong>{source.name}</strong>
                  <small>{source.mimeType} · {(source.sizeBytes / 1_024).toFixed(1)} KB · mã kiểm tra {source.checksum.slice(0, 10)}…</small>
                </div>
                <StatusPill tone={source.status === "VERIFIED" ? "green" : "yellow"}>{sourceStatusLabel(source.status)}</StatusPill>
                <button className="button ghost small" onClick={() => setPreviewId(expanded ? null : source.id)}>{expanded ? "Đóng bản xem trước" : "2. Xem nội dung"}</button>
              </header>
              {expanded && (
                <div className="source-preview-panel">
                  <div className="provider-notice"><Asset type="icon" name="ui-info" alt="" width={22} height={22} /><span><strong>Văn bản công cụ tạo bản nháp sẽ nhận</strong><small>Đọc và đối chiếu trước khi xác minh; mã kiểm tra giúp truy vết đúng phiên bản nguồn.</small></span></div>
                  <pre className="source-preview"><code>{source.extractedPreview || "Chưa có văn bản trích xuất."}</code></pre>
                  {source.status === "NEEDS_REVIEW" && <button className="button primary" onClick={() => void verify(source.id)}>3. Tôi đã xem · Xác minh nguồn</button>}
                </div>
              )}
            </article>
          );
        })}
        {!product.sources.length && <EmptyState illustration="course-not-found" title="Chưa có nguồn học liệu" description="Tải một tệp TXT để bắt đầu quy trình xem và xác minh." />}
      </section>
    </div>
  );
}

interface MasteryAnalytics {
  series: number[];
  labels: string[];
  change: number;
}

interface ContentProductionAnalytics {
  generated: number;
  published: number;
  averageGenerationMs: number;
  averageTeacherEditingSeconds: number;
  reuseCount: number;
  estimatedCostUsd: number;
  providers: string[];
}

interface RetentionAnalytics {
  averageRetrievability: number;
  dueIn24Hours: number;
  successfulReviews: number;
  intervals: { oneDay: number; threeDays: number; sevenDays: number };
}

interface TeacherAnalyticsData {
  mastery: MasteryAnalytics;
  content: ContentProductionAnalytics;
  retention: RetentionAnalytics;
}

function formatDuration(milliseconds: number): string {
  if (!milliseconds) return "Chưa có dữ liệu";
  if (milliseconds < 1_000) return `${Math.round(milliseconds)} ms`;
  const seconds = Math.round(milliseconds / 1_000);
  if (seconds < 60) return `${seconds} giây`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function AnalyticsView() {
  const [data, setData] = useState<TeacherAnalyticsData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<MasteryAnalytics>("/teacher/analytics/mastery"),
      apiRequest<ContentProductionAnalytics>("/teacher/analytics/content-production"),
      apiRequest<RetentionAnalytics>("/teacher/analytics/retention")
    ]).then(([mastery, content, retention]) => {
      if (active) setData({ mastery, content, retention });
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Không tải được analytics");
    });
    return () => { active = false; };
  }, []);

  if (error) {
    return <EmptyState illustration="activity" title="Chưa tải được chỉ số prototype" description={error} />;
  }
  if (!data) {
    return <div className="surface-card"><p>Đang tổng hợp lịch sử học và generation jobs…</p></div>;
  }

  const masteryRows = data.mastery.labels.map((label, index) => ({
    label: label.slice(5),
    mastery: Math.round((data.mastery.series[index] ?? 0) * 100)
  }));
  const productionRows = [
    { label: "Đã tạo", value: data.content.generated },
    { label: "Đã xuất bản", value: data.content.published },
    { label: "Tái sử dụng", value: data.content.reuseCount }
  ];
  const retentionRows = [
    { label: "1 ngày", value: data.retention.intervals.oneDay },
    { label: "2–3 ngày", value: data.retention.intervals.threeDays },
    { label: "Trên 3 ngày", value: data.retention.intervals.sevenDays }
  ];
  const latestMastery = data.mastery.series.at(-1) ?? 0;

  return (
    <div className="page-stack">
      <SectionHeading
        eyebrow="Prototype metrics · fixture synthetic"
        title="Tín hiệu mô hình và hiệu suất sản xuất nội dung"
        description="Mastery là replay synthetic để kiểm tra hệ thống, không phải kết quả pilot; thời gian và chi phí lấy từ generation jobs đã lưu."
      />

      <div className="metric-grid four">
        <Metric
          label="Mastery gần nhất"
          value={`${Math.round(latestMastery * 100)}%`}
          note={`${data.mastery.change >= 0 ? "+" : ""}${Math.round(data.mastery.change * 100)} điểm`}
          icon="learning-brain"
        />
        <Metric
          label="Retrievability"
          value={`${Math.round(data.retention.averageRetrievability * 100)}%`}
          note={`${data.retention.dueIn24Hours} lịch ôn trong 24h`}
          icon="learning-recall"
          tone="blue"
        />
        <Metric
          label="Nội dung xuất bản"
          value={`${data.content.published}/${data.content.generated}`}
          note={`${data.content.reuseCount} lượt tái sử dụng`}
          icon="teacher-course"
          tone="purple"
        />
        <Metric
          label="Chi phí AI ước tính"
          value={`$${data.content.estimatedCostUsd.toFixed(4)}`}
          note={data.content.providers.join(", ") || "Chưa có provider"}
          icon="ai-cost"
          tone="orange"
        />
      </div>

      <div className="analytics-grid">
        <section className="surface-card chart-card">
          <SectionHeading eyebrow="Learning outcome" title="Mastery theo thời gian" />
          {masteryRows.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={masteryRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DCE8DF" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => [`${String(value)}%`, "Mastery"]} />
                <Line type="monotone" dataKey="mastery" stroke="#348B4E" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p>Chưa có ConceptStateHistory để vẽ xu hướng.</p>}
        </section>

        <section className="surface-card chart-card">
          <SectionHeading eyebrow="Content workflow" title="Draft, publish và reuse" />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={productionRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DCE8DF" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#4AAA64" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      <div className="analytics-grid">
        <section className="surface-card">
          <SectionHeading eyebrow="Production measurement" title="Thời gian giáo viên và hệ thống" />
          <div className="context-row"><span>Generation trung bình</span><strong>{formatDuration(data.content.averageGenerationMs)}</strong></div>
          <div className="context-row"><span>Giáo viên chỉnh sửa trung bình</span><strong>{formatDuration(data.content.averageTeacherEditingSeconds * 1_000)}</strong></div>
          <div className="context-row"><span>Tỉ lệ publish</span><strong>{data.content.generated ? Math.round(data.content.published / data.content.generated * 100) : 0}%</strong></div>
          <div className="context-row"><span>Provider đã dùng</span><strong>{data.content.providers.join(", ") || "—"}</strong></div>
        </section>

        <section className="surface-card chart-card">
          <SectionHeading eyebrow="Spaced review" title="Phân bổ khoảng ôn" />
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={retentionRows} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#DCE8DF" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="label" width={75} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#72B9F2" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="context-row"><span>Review hoàn thành</span><strong>{Math.round(data.retention.successfulReviews * 100)}%</strong></div>
        </section>
      </div>

      <div className="analytics-note">
        <Asset type="icon" name="ui-info" alt="" width={24} height={24} />
        <p><strong>Giới hạn diễn giải:</strong> dashboard chưa có manual baseline cùng scope, review seconds riêng hoặc quality-adjusted time; vì vậy chưa thể tuyên bố phần trăm giảm thời gian soạn bài.</p>
      </div>
    </div>
  );
}
function CourseBuilder(){const {course}=useProduct();if(!course)return <TeacherDataLoading label="Đang tải cấu trúc khóa học…"/>;return <div className="page-stack"><SectionHeading eyebrow="Course structure" title={course.title} description="12 bài × 3 pha từ Supabase."/>{course.modules.map((module)=><section className="surface-card" key={module.id}><h2>{module.title}</h2>{module.lessons.map((lesson)=><p key={lesson.id}><strong>{lesson.code}</strong> · {lesson.title} · {lesson.durationMinutes} phút</p>)}</section>)}</div>}
function LeaderboardSettings(){const product=useProduct();if(!product.classData)return <TeacherDataLoading label="Đang tải thiết lập lớp…"/>;const enabled=product.classData.leaderboardEnabled;const save=(value:boolean)=>apiRequest("/teacher/leaderboard/settings",{method:"PATCH",body:JSON.stringify({enabled:value})}).then(()=>product.refresh());return <div className="page-stack"><SectionHeading title="Leaderboard có quyền tắt" description="Chỉ dùng nickname, không hiển thị email."/><section className="surface-card"><label className="toggle-row"><span><strong>Bật leaderboard</strong><small>Hiện tại: {enabled?"Đang bật":"Đang tắt"}</small></span><input type="checkbox" checked={enabled} onChange={(e)=>void save(e.target.checked)}/></label></section></div>}
