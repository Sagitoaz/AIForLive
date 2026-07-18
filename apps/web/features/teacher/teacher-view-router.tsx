"use client";

import type { MicroLesson } from "@edurecall/shared-types";
import Link from "next/link";
import { useEffect, useState } from "react";
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
  return <EmptyState illustration="activity" title="Chức năng đã được tinh gọn" description="Sản phẩm tập trung vào lớp học, AI soạn bài, kiểm duyệt và đo lường." href="/teacher" action="Về tổng quan" />;
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
  return kind === "FULL_LESSON" ? "Bài học đầy đủ" : "Bài bổ trợ";
}

function ContentStudio() {
  const product = useProduct();
  const [authoringMode, setAuthoringMode] = useState<"course" | "lesson">("course");
  const [view, setView] = useState<StudioView>("library");

  const openLesson = async (id: string) => {
    await product.selectGeneratedLesson(id);
    setView("editor");
  };

  const intro = (
    <header className="page-intro teacher-intro">
      <div>
        <span className="eyebrow">Teacher authoring</span>
        <h1>Từ nhu cầu lớp đến nội dung đã duyệt</h1>
        <p>Chọn lộ trình khóa hoặc bài học, giao AI dựng draft có giải thích, rồi giáo viên sửa và quyết định xuất bản.</p>
      </div>
      <Asset type="illustration" name="illustration-ai-generation" alt="" width={250} height={170} />
    </header>
  );
  const modeTabs = (
    <nav className="tabs" aria-label="Loại nội dung cần soạn">
      <button className={authoringMode === "course" ? "active" : ""} onClick={() => setAuthoringMode("course")}>Tạo lộ trình khóa học</button>
      <button className={authoringMode === "lesson" ? "active" : ""} onClick={() => setAuthoringMode("lesson")}>Tạo bài học</button>
    </nav>
  );

  if (authoringMode === "course") {
    return <div className="page-stack">{intro}{modeTabs}<CoursePlanStudio /></div>;
  }

  return (
    <div className="page-stack">
      {intro}
      {modeTabs}

      <nav className="tabs" aria-label="Khu vực soạn bài">
        <button className={view === "library" ? "active" : ""} onClick={() => setView("library")}>Nội dung</button>
        <button className={view === "brief" ? "active" : ""} onClick={() => setView("brief")}>Brief bài mới</button>
        <button
          className={view === "editor" ? "active" : ""}
          disabled={!product.generatedLesson}
          onClick={() => setView("editor")}
        >
          Biên tập
        </button>
      </nav>

      {product.operation && <div className="provider-notice"><span><strong>{product.operation}</strong><small>Không đóng trang cho đến khi thao tác hoàn tất.</small></span></div>}

      {view === "library" && (
        <ContentLibrary
          items={product.reviewQueue}
          currentId={product.generatedLesson?.id}
          busy={product.busy}
          onCreate={() => setView("brief")}
          onSelect={openLesson}
        />
      )}
      {view === "brief" && <BriefWizard onCreated={() => setView("editor")} />}
      {view === "editor" && (
        product.generatedLesson
          ? <LessonEditor lesson={product.generatedLesson} onBack={() => setView("library")} />
          : <EmptyState illustration="review" title="Chưa chọn nội dung" description="Chọn một bản nháp hoặc tạo brief mới." href="/teacher/studio" action="Về thư viện" />
      )}
    </div>
  );
}

function ContentLibrary({
  items,
  currentId,
  busy,
  onCreate,
  onSelect
}: {
  items: MicroLesson[];
  currentId?: string;
  busy: boolean;
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
          title="Draft và hàng chờ duyệt"
          description="Mỗi bản phải đi qua review trước khi học sinh truy cập."
          action={<button className="button primary small" onClick={onCreate}>Tạo brief</button>}
        />
        {pending.length ? pending.map((item) => (
          <article className="misconception-row" key={item.id}>
            <span className={`severity ${item.status === "REVISION_REQUIRED" ? "red" : "yellow"}`} />
            <div>
              <strong>{item.title}</strong>
              <small>{draftKindLabel(item.draftKind)} · {item.gradeBand ?? item.level} · v{item.version}</small>
            </div>
            <button className="button ghost small" disabled={busy} onClick={() => void onSelect(item.id)}>
              {item.id === currentId ? "Tiếp tục" : "Mở"}
            </button>
          </article>
        )) : <p>Không có draft đang chờ.</p>}
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

function BriefWizard({ onCreated }: { onCreated: () => void }) {
  const product = useProduct();
  const lessons = product.course?.modules.flatMap((module) => module.lessons) ?? [];
  const firstLesson = lessons[0];
  const verifiedSources = product.sources.filter((item) => item.status === "VERIFIED");
  const [step, setStep] = useState(0);
  const [lessonId, setLessonId] = useState(firstLesson?.id ?? "");
  const [brief, setBrief] = useState<GenerationBrief>({
    draftKind: "FULL_LESSON",
    sourceId: verifiedSources[0]?.id,
    conceptCode: firstLesson?.conceptCode ?? "PYTHON_RANGE",
    misconceptionCode: "RANGE_STOP_INCLUDED",
    level: "Mới bắt đầu",
    gradeBand: product.course?.audience || "Lớp 6–9",
    learningObjective: "Đọc đúng start, stop, step và giải thích vì sao stop không thuộc dãy range()",
    durationMinutes: 65,
    provider: "LOCAL_TEMPLATE"
  });

  useEffect(() => {
    if (!brief.sourceId && verifiedSources[0]) {
      setBrief((current) => ({ ...current, sourceId: verifiedSources[0]?.id }));
    }
  }, [brief.sourceId, verifiedSources]);

  const chooseLesson = (id: string) => {
    setLessonId(id);
    const selected = lessons.find((item) => item.id === id);
    if (selected) setBrief((current) => ({ ...current, conceptCode: selected.conceptCode }));
  };
  const chooseKind = (draftKind: GenerationBrief["draftKind"]) => {
    setBrief((current) => ({ ...current, draftKind, durationMinutes: draftKind === "FULL_LESSON" ? 65 : 7 }));
  };
  const canGenerate = Boolean(brief.sourceId && brief.learningObjective?.trim() && brief.durationMinutes);
  const create = async () => {
    await product.generateLesson(brief);
    onCreated();
  };

  return (
    <section className="surface-card generation-form">
      <SectionHeading
        eyebrow={`Bước ${step + 1}/3`}
        title={["Chọn khóa và bài", "Viết learning brief", "Kiểm tra trước khi tạo"][step] ?? "Lesson brief"}
        description="Brief ngắn giúp AI bám đúng phạm vi; giáo viên vẫn sở hữu mục tiêu và quyết định cuối."
      />

      <div className="tabs" aria-label="Các bước lesson brief">
        {["Phạm vi", "Mục tiêu", "Xác nhận"].map((label, index) => (
          <button key={label} className={step === index ? "active" : ""} onClick={() => setStep(index)}>{index + 1}. {label}</button>
        ))}
      </div>

      {step === 0 && (
        <div className="studio-context-grid">
          <div>
            <label><span>Khóa học pilot</span><select disabled value={product.course?.id ?? ""}><option value={product.course?.id ?? ""}>{product.course?.title ?? "Chưa tải khóa học"}</option></select></label>
            <label><span>Bài học đích</span><select value={lessonId} onChange={(event) => chooseLesson(event.target.value)}>{lessons.map((lesson) => <option value={lesson.id} key={lesson.id}>{lesson.code} · {lesson.title}</option>)}</select></label>
          </div>
          <div>
            <label><span>Loại bản nháp</span><select value={brief.draftKind} onChange={(event) => chooseKind(event.target.value as GenerationBrief["draftKind"])}><option value="FULL_LESSON">Bài đầy đủ · 3 pha</option><option value="REMEDIATION">Bài bổ trợ theo misconception</option></select></label>
            <div className="provider-notice"><Asset type="icon" name="ui-info" alt="" width={22} height={22} /><span><strong>{brief.conceptCode}</strong><small>{brief.draftKind === "REMEDIATION" ? brief.misconceptionCode : "Bao phủ lesson objective"}</small></span></div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="studio-context-grid">
          <div>
            <label><span>Nguồn đã xác minh</span><select value={brief.sourceId ?? ""} onChange={(event) => setBrief({ ...brief, sourceId: event.target.value })}>{verifiedSources.map((source) => <option value={source.id} key={source.id}>{source.name}</option>)}</select></label>
            <label><span>Khối lớp</span><input value={brief.gradeBand ?? ""} onChange={(event) => setBrief({ ...brief, gradeBand: event.target.value })} /></label>
            <label><span>Trình độ</span><select value={brief.level} onChange={(event) => setBrief({ ...brief, level: event.target.value })}><option>Mới bắt đầu</option><option>Đang phát triển</option><option>Cần thử thách</option></select></label>
          </div>
          <div>
            <label><span>Mục tiêu học tập</span><textarea value={brief.learningObjective ?? ""} onChange={(event) => setBrief({ ...brief, learningObjective: event.target.value })} /></label>
            <label><span>Thời lượng dự kiến (phút)</span><input type="number" min={3} max={120} value={brief.durationMinutes ?? 0} onChange={(event) => setBrief({ ...brief, durationMinutes: Number(event.target.value) })} /></label>
            <label><span>Provider</span><select value={brief.provider} onChange={(event) => setBrief({ ...brief, provider: event.target.value as GenerationBrief["provider"] })}><option value="LOCAL_TEMPLATE">Local template · 0 USD · không phải LLM</option><option value="EXTERNAL_LLM">External LLM · tính theo token</option></select></label>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="studio-context-grid">
          <div className="evidence-context">
            <div className="context-row"><span>Loại bài</span><strong>{brief.draftKind === "FULL_LESSON" ? "Bài đầy đủ" : "Bài bổ trợ"}</strong></div>
            <div className="context-row"><span>Concept</span><strong>{brief.conceptCode}</strong></div>
            <div className="context-row"><span>Khối lớp</span><strong>{brief.gradeBand}</strong></div>
            <div className="context-row"><span>Thời lượng</span><strong>{brief.durationMinutes} phút</strong></div>
            <div className="context-row"><span>Provider</span><strong>{brief.provider}</strong></div>
          </div>
          <div className="draft-phase-preview">
            {phasePlan.map((item, index) => <div key={item.phase}><span>{index + 1}</span><strong>{item.title}</strong><small>{item.detail}</small></div>)}
          </div>
        </div>
      )}

      {!verifiedSources.length && <div className="analytics-note"><p>Chưa có nguồn VERIFIED. Hãy xác minh một tài liệu trước khi tạo draft.</p></div>}
      {product.error && <p className="game-error">{product.error}</p>}

      <div className="editor-actions">
        <button className="button ghost" disabled={step === 0 || product.busy} onClick={() => setStep((current) => Math.max(0, current - 1))}>Quay lại</button>
        {step < 2 ? (
          <button className="button primary" disabled={product.busy} onClick={() => setStep((current) => Math.min(2, current + 1))}>Tiếp tục →</button>
        ) : (
          <button className="button primary" disabled={!canGenerate || product.busy} onClick={() => void create()}>{product.busy ? "Đang tạo DRAFT…" : "Tạo structured DRAFT"}</button>
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

  useEffect(() => {
    setWorking(lesson);
    setDirty(false);
    setRevisionMode(false);
    setSlide((current) => Math.min(current, lesson.slides.length));
  }, [lesson]);

  const editable = working.status === "DRAFT" || working.status === "REVISION_REQUIRED" || (working.status === "APPROVED" && revisionMode);
  const current = working.slides[slide];
  const change = (next: MicroLesson) => { setWorking(next); setDirty(true); };
  const save = async () => { await product.updateLesson(working); setDirty(false); };
  const requestRevision = async () => { await product.requestLessonRevision(); };
  const checks = [
    { label: "Có nguồn tham chiếu", ok: working.sourceReferences.length > 0 },
    { label: "Đủ ba pha", ok: (working.sections?.length ?? 0) === 3 },
    { label: "Có ví dụ", ok: working.slides.some((item) => item.type === "EXAMPLE") },
    { label: "Có misconception", ok: working.slides.some((item) => item.type === "MISCONCEPTION") },
    { label: "Quiz có một đáp án", ok: working.quiz.correctIndex >= 0 && working.quiz.correctIndex < working.quiz.options.length }
  ];

  return (
    <div className="studio-editor">
      <header className="editor-header">
        <div>
          <span className="eyebrow">{draftKindLabel(working.draftKind)} · Teacher version</span>
          <input aria-label="Tiêu đề nội dung" disabled={!editable} value={working.title} onChange={(event) => change({ ...working, title: event.target.value })} />
        </div>
        <div className="editor-status">
          <StatusPill tone={contentStatusTone(working.status)}>{working.status}</StatusPill>
          <span>v{working.version} · {working.provider}</span>
        </div>
        <div className="editor-actions">
          <button className="button ghost small" onClick={onBack}>Danh sách</button>
          {editable && <button className="button ghost small" disabled={!dirty || product.busy} onClick={() => void save()}>{working.status === "APPROVED" ? "Lưu thành revision" : "Lưu bản sửa"}</button>}
          {(working.status === "DRAFT" || working.status === "REVISION_REQUIRED") && <button className="button dark small" disabled={dirty || product.busy} onClick={() => void product.submitLessonReview()}>Gửi duyệt</button>}
          {working.status === "IN_REVIEW" && <button className="button ghost small" disabled={product.busy} onClick={() => void requestRevision()}>Yêu cầu sửa</button>}
          {working.status === "IN_REVIEW" && <button className="button dark small" disabled={product.busy} onClick={() => void product.approveLesson()}>Phê duyệt</button>}
          {working.status === "APPROVED" && !revisionMode && <button className="button ghost small" disabled={product.busy} onClick={() => setRevisionMode(true)}>Tạo revision</button>}
          {working.status === "APPROVED" && !revisionMode && <button className="button primary small" disabled={product.busy} onClick={() => void product.publishLesson()}>Xuất bản</button>}
        </div>
      </header>

      {!editable && working.status !== "PUBLISHED" && (
        <div className="provider-notice"><Asset type="icon" name="ui-lock" alt="" width={22} height={22} /><span><strong>Phiên bản đang khóa chỉnh sửa.</strong><small>Chọn “Tạo revision/Yêu cầu sửa” để mở một vòng biên tập mới; publish luôn dùng phiên bản đã duyệt.</small></span></div>
      )}
      {working.status === "APPROVED" && revisionMode && (
        <div className="provider-notice"><Asset type="icon" name="ui-info" alt="" width={22} height={22} /><span><strong>Đang tạo revision từ bản đã duyệt.</strong><small>Khi lưu, backend phải chuyển bản này về REVISION_REQUIRED; bản sửa cần review và approve lại trước publish.</small></span></div>
      )}

      <div className="editor-grid">
        <aside className="slide-list">
          <div className="slide-list-head"><strong>Nội dung</strong><span>{working.slides.length} slides</span></div>
          {working.slides.map((item, index) => (
            <button className={slide === index ? "active" : ""} onClick={() => setSlide(index)} key={item.id}>
              <span>{index + 1}</span>
              <div><small>{item.type}</small><strong>{item.title}</strong></div>
            </button>
          ))}
          <button className={slide === working.slides.length ? "active quiz" : "quiz"} onClick={() => setSlide(working.slides.length)}>
            <span>Q</span><div><small>CHECKPOINT</small><strong>Quiz cuối bài</strong></div>
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
          <SectionHeading eyebrow="Pre-publish" title="Kiểm tra bản nháp" />
          {checks.map((check) => <p key={check.label}>{check.ok ? "✓" : "!"} {check.label}</p>)}
          <div className="draft-phase-preview">
            {(working.sections?.length ? working.sections : phasePlan.map((item) => ({ phase: item.phase, title: item.title, durationMinutes: 0, summary: item.detail, activityTypes: [] }))).map((section, index) => (
              <div key={section.phase}><span>{index + 1}</span><strong>{section.title}</strong><small>{section.durationMinutes ? `${section.durationMinutes} phút · ` : ""}{section.summary}</small></div>
            ))}
          </div>
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
function ClassView(){const product=useProduct();const data=product.classData;if(!data)return <TeacherDataLoading label="Đang đồng bộ hồ sơ lớp từ Supabase…"/>;return <div className="page-stack"><SectionHeading eyebrow="1 lớp · dữ liệu thật" title={data.name} description="Hồ sơ có mức năng lực, thiết bị và chất lượng dữ liệu khác nhau."/>{data.students.map((student)=><article className="surface-card student-row" key={student.id}><Asset type="avatar" name={student.avatar??"avatar-01"} alt="" width={44} height={44}/><div><strong>{student.name}</strong><small>{student.goal}</small></div><ProgressBar value={student.mastery*100}/><StatusPill tone={student.needsSupport?"red":"green"}>{student.needsSupport?"Cần hỗ trợ":`${Math.round(student.mastery*100)}%`}</StatusPill><Link href={`/teacher/students/${student.id}`}>Chi tiết →</Link></article>)}</div>}
function HeatmapView(){const data=useProduct().heatmap;if(!data)return <TeacherDataLoading label="Đang tổng hợp knowledge heatmap…"/>;return <div className="page-stack"><SectionHeading eyebrow="Supabase concept states" title="Knowledge heatmap" description="Ô trống được giữ là thiếu dữ liệu, không tự điền số đẹp."/><section className="surface-card full-heatmap"><div className="full-heat-head"><span>Học sinh</span>{data.concepts.map((c)=><span key={c.id}><small>{c.title}</small></span>)}</div>{data.rows.map((row)=><div className="full-heat-row" key={row.studentId}><span>{row.name}</span>{row.values.map((value)=><button disabled key={value.conceptCode} className={value.mastery===null?"missing":value.mastery<.45?"low":value.mastery<.65?"mid":"high"}>{value.mastery===null?"—":`${Math.round(value.mastery*100)}%`}</button>)}</div>)}</section></div>}
function ReviewQueue() {
  const product = useProduct();
  const [editing, setEditing] = useState(false);
  const open = async (id: string) => {
    await product.selectGeneratedLesson(id);
    setEditing(true);
  };

  if (editing && product.generatedLesson) {
    return (
      <div className="page-stack">
        <SectionHeading eyebrow="Human review" title="Biên tập bản đang chọn" description="Chỉ bản APPROVED mới có thể được xuất bản cho học sinh." />
        <LessonEditor lesson={product.generatedLesson} onBack={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <SectionHeading eyebrow="Human review" title="Draft chờ xử lý và nội dung đã xuất bản" description="Trạng thái, version và nội dung được đọc từ GeneratedContent/ContentReview." />
      {product.reviewQueue.length ? (
        <ContentLibrary
          items={product.reviewQueue}
          currentId={product.generatedLesson?.id}
          busy={product.busy}
          onCreate={() => { window.location.href = "/teacher/studio"; }}
          onSelect={open}
        />
      ) : <EmptyState illustration="review" title="Queue trống" description="Tạo một AI draft từ source đã xác minh." href="/teacher/studio" action="Mở studio" />}
    </div>
  );
}

function SourceManager(){const product=useProduct();const [notice,setNotice]=useState("");const upload=async(file?:File)=>{if(!file)return;const form=new FormData();form.append("file",file);const source=await apiFormRequest<{id:string;status:string}>("/content-sources/upload",form);setNotice(`Đã lưu ${source.id} · ${source.status}`);await product.refresh()};return <div className="page-stack"><SectionHeading eyebrow="Grounded generation" title="Nguồn học liệu trên Supabase" description="Pilot nhận TXT; file phải được giáo viên xác minh trước khi AI dùng."/><section className="surface-card upload-panel"><label className="button primary">Chọn tệp TXT<input type="file" accept=".txt,text/plain" onChange={(e)=>void upload(e.target.files?.[0])}/></label>{notice&&<p>{notice}</p>}</section>{product.sources.map((source)=><article className="surface-card resource-card" key={source.id}><div><strong>{source.name}</strong><small>{source.mimeType} · {(source.sizeBytes/1024).toFixed(1)} KB</small></div><StatusPill tone={source.status==="VERIFIED"?"green":"yellow"}>{source.status}</StatusPill>{source.status==="NEEDS_REVIEW"&&<button onClick={()=>void apiRequest(`/content-sources/${source.id}/verify`,{method:"POST",body:"{}"}).then(()=>product.refresh())}>Xác minh</button>}</article>)}</div>}

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
    return <EmptyState illustration="activity" title="Chưa tải được pilot metrics" description={error} />;
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
        eyebrow="Pilot metrics · dữ liệu thật"
        title="Kết quả học và hiệu suất sản xuất nội dung"
        description="Mastery lấy từ history; thời gian và chi phí lấy từ generation jobs, không dùng số hard-code."
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
