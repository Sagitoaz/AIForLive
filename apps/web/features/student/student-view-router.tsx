"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Asset } from "@/components/asset";
import { LearningAnimation } from "@/components/learning-animation";
import { EmptyState, Metric, ProgressBar, SectionHeading, StatusPill } from "@/components/ui";
import {
  useProduct,
  type AttemptOutcome,
  type LessonData,
  type LessonPhase,
  type LessonResourceData
} from "@/features/product/product-context";
import { apiRequest } from "@/lib/api";
import { speakVietnamese } from "@/lib/vietnamese-speech";
import styles from "./student-learning.module.css";

type LessonState = "COMPLETED" | "CURRENT" | "NOT_STARTED";

const phaseDetails: Record<LessonPhase, { label: string; description: string; icon: string }> = {
  THEORY: { label: "Lý thuyết", description: "Bài giảng, minh họa và tài liệu", icon: "learning-observe" },
  PRACTICE: { label: "Thực hành", description: "Luyện tập và nhận phản hồi ngay", icon: "nav-review" },
  CHECKPOINT: { label: "Kiểm tra cuối bài", description: "Củng cố trước khi học tiếp", icon: "ui-check" }
};

function StudentPageSkeleton({ cards = 3, label = "Đang tải dữ liệu học tập" }: { cards?: number; label?: string }) {
  return (
    <div className={styles.skeletonPage} aria-label={label} aria-busy="true">
      <div className={styles.skeletonHero}/>
      <div className={styles.skeletonGrid}>
        {Array.from({ length: cards }, (_, index) => <div className={styles.skeletonCard} key={index}/>) }
      </div>
    </div>
  );
}

function asText(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function firstText(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = asText(record[key]);
    if (value) return value;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeResourceUrl(content: Record<string, unknown>): string | null {
  const candidate = firstText(content, ["url", "href", "downloadUrl"]);
  if (!candidate) return null;
  return candidate.startsWith("https://") || candidate.startsWith("/") ? candidate : null;
}

function lessonState(raw: string | undefined): LessonState {
  if (raw === "COMPLETED") return "COMPLETED";
  if (raw === "CURRENT") return "CURRENT";
  return "NOT_STARTED";
}

function lessonStateView(state: LessonState) {
  if (state === "COMPLETED") return { label: "Đã hoàn thành", tone: "green" as const, action: "Xem lại" };
  if (state === "CURRENT") return { label: "Đang học", tone: "yellow" as const, action: "Học tiếp" };
  return { label: "Chưa bắt đầu", tone: "gray" as const, action: "Bắt đầu" };
}

function useLessonRoute(lessonId?: string) {
  const product = useProduct();
  const needsLesson = Boolean(lessonId && product.lesson?.id !== lessonId);
  useEffect(() => {
    if (!lessonId || !needsLesson) return;
    void product.openLesson(lessonId).catch(() => undefined);
  }, [lessonId, needsLesson, product.openLesson]);
  return {
    product,
    lesson: needsLesson ? null : product.lesson,
    loading: needsLesson && !product.error,
    error: needsLesson ? product.error : null
  };
}

export function StudentViewRouter({ path }: { path: string }) {
  const parts = path.split("/").filter(Boolean);
  if (path === "course" || path === "roadmap") return <CourseView/>;
  if (path === "lesson") return <LessonView/>;
  if (parts[0] === "lessons" && parts[1]) {
    if (parts[2] === "practice") return <PracticeView lessonId={parts[1]} phase="PRACTICE"/>;
    if (parts[2] === "checkpoint") return <PracticeView lessonId={parts[1]} phase="CHECKPOINT"/>;
    return <LessonView lessonId={parts[1]}/>;
  }
  if (path === "exercise") return <PracticeView phase="PRACTICE"/>;
  if (path === "reviews") return <ReviewView/>;
  if (path === "micro-lesson") return <MicroLessonView/>;
  if (path === "progress") return <ProgressView/>;
  if (path === "skills") return <SkillsView/>;
  if (path.startsWith("concepts/")) return <ConceptView code={parts[1] ?? ""}/>;
  if (path === "leaderboard") return <LeaderboardView/>;
  if (path === "games") return <GamesView/>;
  if (path === "diagnostic") return <DiagnosticView/>;
  if (path === "profile") return <ProfileView/>;
  return <EmptyState illustration="course-not-found" title="Không tìm thấy trang" description="Luồng học được rút gọn để tập trung vào học bài và cá nhân hóa." href="/student" action="Về hôm nay"/>;
}

function CourseView() {
  const product = useProduct();
  const { course } = product;
  if (!course && (product.busy || product.backgroundLoading)) return <StudentPageSkeleton cards={4} label="Đang tải khóa học"/>;
  if (!course) return <EmptyState illustration="course-not-found" title="Chưa có khóa học" description={product.error ?? "API chưa trả dữ liệu khóa học."}/>;
  return (
    <div className="page-stack">
      <header className="page-intro">
        <div>
          <span className="eyebrow">Khóa học {course.modules.length} module · 3 pha mỗi bài</span>
          <h1>{course.title}</h1>
          <p>{course.description}</p>
          <div className="signal-chips"><span>{course.audience}</span><span>{Math.round(course.durationMinutes / 60)} giờ</span><span>{course.cadence}</span></div>
        </div>
        <Asset type="illustration" name="illustration-personalized-path" alt="Minh họa lộ trình khóa học" width={250} height={170}/>
      </header>
      {course.modules.map((module) => (
        <section className="surface-card" key={module.id}>
          <SectionHeading eyebrow={`Module ${module.order}`} title={module.title} description={module.description}/>
          {module.lessons.map((lesson, index) => {
            const state = lessonState(lesson.status);
            const view = lessonStateView(state);
            return (
              <article className={`${styles.courseLesson} ${state === "CURRENT" ? styles.courseLessonCurrent : state === "COMPLETED" ? styles.courseLessonCompleted : ""}`} key={lesson.id}>
                <span className={styles.lessonOrder}>{state === "COMPLETED" ? "✓" : index + 1}</span>
                <div className={styles.lessonCopy}>
                  <strong>{lesson.title}</strong>
                  <p>{lesson.summary}</p>
                  <small>{lesson.durationMinutes} phút · Lý thuyết → Thực hành → Kiểm tra</small>
                </div>
                <StatusPill tone={view.tone}>{view.label}</StatusPill>
                <div className={styles.lessonActions}>
                  <Link className={`button ${state === "CURRENT" ? "primary" : "ghost"} small`} href={`/student/lessons/${lesson.id}`}>{view.action}</Link>
                </div>
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function resourceIcon(type: string) {
  if (type === "ANIMATION" || type === "VIDEO") return "media-play";
  if (type === "DOCUMENT") return "media-pdf";
  if (type === "LECTURE") return "media-txt";
  return "learning-brain";
}

function resourceTypeLabel(type: string) {
  if (type === "ANIMATION") return "Minh họa tương tác";
  if (type === "VIDEO") return "Video";
  if (type === "DOCUMENT") return "Tài liệu";
  if (type === "LECTURE") return "Bài giảng";
  return type.replaceAll("_", " ");
}

function ResourceCard({ resource, lesson }: { resource: LessonResourceData; lesson: LessonData }) {
  const content = resource.content;
  const body = firstText(content, ["body", "text", "summary", "description", "content", "html"]);
  const duration = firstText(content, ["estimatedMinutes", "durationMinutes"]);
  const format = firstText(content, ["format", "mimeType"]);
  const url = safeResourceUrl(content);
  const animationTemplate = firstText(content, ["animationTemplate", "template", "templateCode"]);
  const animationData = asRecord(content.animationData ?? content.data);
  const isAnimation = resource.type === "ANIMATION" || Boolean(animationTemplate);
  return (
    <article className={styles.resourceCard}>
      <span className={styles.resourceIcon}><Asset type="icon" name={resourceIcon(resource.type)} alt="" width={25} height={25}/></span>
      <div className={styles.resourceBody}>
        <strong>{resource.title}</strong>
        <span className={styles.resourceMeta}>{resourceTypeLabel(resource.type)}{duration ? ` · ${duration} phút` : ""}{format ? ` · ${format}` : ""}</span>
        {body && !isAnimation && <p className={styles.resourceContent}>{body}</p>}
      </div>
      <div className={styles.inlineActions}>
        {resource.type === "LECTURE" && <button className="button ghost small" onClick={() => void speakVietnamese(`${resource.title}. ${body ?? lesson.summary}`)}>Nghe bài</button>}
        {url && <a className="button ghost small" href={url} target="_blank" rel="noreferrer">Mở tài nguyên ↗</a>}
      </div>
      {isAnimation && (
        <div className={styles.animationWrap}>
          <LearningAnimation template={animationTemplate ?? "CODE_HIGHLIGHT"} data={Object.keys(animationData).length ? animationData : content} title={resource.title}/>
        </div>
      )}
    </article>
  );
}

function LessonView({ lessonId }: { lessonId?: string }) {
  const { product, lesson, loading, error } = useLessonRoute(lessonId);
  if (loading || (!lesson && (product.busy || product.backgroundLoading))) return <StudentPageSkeleton cards={3} label={product.operation ?? "Đang mở bài học"}/>;
  if (!lesson) return <div className="page-stack"><EmptyState illustration="course-not-found" title="Chưa tải được bài học" description={error ?? product.error ?? "Hãy thử lại."}/><Link className="button ghost" href="/student/course">← Về khóa học</Link></div>;

  return (
    <div className="page-stack">
      <nav className={styles.breadcrumb} aria-label="Đường dẫn bài học"><Link href="/student/course">Khóa học</Link><span>›</span><span>{lesson.title}</span></nav>
      <header className="lesson-hero">
        <div>
          <span className="eyebrow">{lesson.code} · {lesson.durationMinutes} phút</span>
          <h1>{lesson.title}</h1>
          <p>{lesson.summary}</p>
          <div className="signal-chips">{lesson.objectives.map((item) => <span key={item}>{item}</span>)}</div>
        </div>
        <Asset type="mascot" name="mam-code" alt="Robot Mầm đồng hành trong bài học" width={220} height={190}/>
      </header>

      <div className={styles.phaseGrid} aria-label="Ba pha của bài học">
        {lesson.sections.map((section, index) => {
          const detail = phaseDetails[section.phase];
          const itemCount = section.resources?.length ?? section.activities?.length ?? 0;
          return (
            <article className={styles.phaseCard} key={section.phase}>
              <span className={styles.phaseNumber}>{index + 1}</span>
              <div><h3>{detail.label}</h3><p>{detail.description} · {itemCount} hoạt động</p></div>
              <div className={styles.inlineActions}><a className="button ghost small" href={`#phase-${section.phase.toLowerCase()}`}>Xem phần này ↓</a></div>
            </article>
          );
        })}
      </div>

      {lesson.sections.map((section, index) => {
        const detail = phaseDetails[section.phase];
        const activities = section.activities ?? [];
        return (
          <section className={`surface-card ${styles.phaseSection}`} id={`phase-${section.phase.toLowerCase()}`} key={section.phase}>
            <SectionHeading eyebrow={`${index + 1}/3 · ${detail.label}`} title={section.title} description={detail.description}/>
            {section.phase === "THEORY" ? (
              section.resources?.length
                ? <div className={styles.resourceList}>{section.resources.map((resource) => <ResourceCard resource={resource} lesson={lesson} key={resource.id}/>)}</div>
                : <div className="provider-notice"><Asset type="icon" name="ui-info" alt="" width={22} height={22}/><span>Giáo viên chưa xuất bản tài nguyên lý thuyết cho bài này.</span></div>
            ) : (
              activities.length
                ? <div className={styles.resourceList}>{activities.map((exercise, activityIndex) => <article className={styles.resourceCard} key={exercise.id}><span className={styles.resourceIcon}><Asset type="icon" name={detail.icon} alt="" width={25} height={25}/></span><div className={styles.resourceBody}><strong>{exercise.prompt}</strong><span className={styles.resourceMeta}>Câu {activityIndex + 1}/{activities.length} · {exercise.type.replaceAll("_", " ")} · độ khó {Math.round(exercise.difficulty * 100)}%</span></div><Link className="button ghost small" href={`/student/lessons/${lesson.id}/${section.phase === "CHECKPOINT" ? "checkpoint" : "practice"}`}>{section.phase === "CHECKPOINT" ? "Làm kiểm tra" : "Luyện tập"}</Link></article>)}</div>
                : <div className="provider-notice"><Asset type="icon" name="ui-info" alt="" width={22} height={22}/><span>Phần này chưa có hoạt động được giáo viên duyệt.</span></div>
            )}
            {section.passRule && <p className={styles.helperText}>Điều kiện hoàn thành: đúng ít nhất {section.passRule.minimumCorrect}/{section.passRule.totalQuestions} câu. Kết quả do answer key trên server chấm.</p>}
          </section>
        );
      })}
      <div className={styles.inlineActions}><Link className="button ghost" href="/student/course">← Về khóa học</Link></div>
    </div>
  );
}

function PracticeView({ lessonId, phase }: { lessonId?: string; phase: "PRACTICE" | "CHECKPOINT" }) {
  const { product, lesson, loading, error } = useLessonRoute(lessonId);
  const section = useMemo(() => lesson?.sections.find((item) => item.phase === phase), [lesson, phase]);
  const exercises = useMemo(() => section?.activities ?? [], [section]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [outcomes, setOutcomes] = useState<Record<string, AttemptOutcome>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    setIndex(0); setAnswers({}); setOutcomes({}); setSubmitError(null); startedAt.current = Date.now();
  }, [lesson?.id, phase]);
  useEffect(() => { startedAt.current = Date.now(); }, [index]);

  if (loading || (!lesson && (product.busy || product.backgroundLoading))) return <StudentPageSkeleton cards={2} label={product.operation ?? "Đang mở hoạt động"}/>;
  if (!lesson) return <div className="page-stack"><EmptyState illustration="activity" title="Chưa mở được bài tập" description={error ?? product.error ?? "Bài học chưa sẵn sàng."}/><Link className="button ghost" href="/student/course">← Về khóa học</Link></div>;
  if (!exercises.length) return <div className="page-stack"><EmptyState illustration="activity" title={phase === "CHECKPOINT" ? "Bài chưa có kiểm tra cuối bài" : "Bài chưa có hoạt động thực hành"} description="Supabase chưa có hoạt động ACTIVE được giáo viên duyệt cho pha này."/><div className={styles.inlineActions}><Link className="button ghost" href={`/student/lessons/${lesson.id}`}>← Về bài học</Link><Link className="button primary" href="/student/course">Về khóa học</Link></div></div>;

  const exercise = exercises[index]!;
  const answer = answers[exercise.id] ?? "";
  const outcome = outcomes[exercise.id];
  const options = exercise.content.options ?? [];
  const code = firstText(exercise.content, ["code", "starterCode", "snippet"]);
  const completed = Object.keys(outcomes).length;
  const correct = Object.values(outcomes).filter((item) => item.isCorrect).length;
  const allCompleted = completed === exercises.length;
  const minimumCorrect = section?.passRule?.minimumCorrect ?? exercises.length;
  const passed = phase === "PRACTICE" || correct >= minimumCorrect;
  const nextPhaseExists = lesson.sections.some((item) => item.phase === "CHECKPOINT" && (item.activities?.length ?? 0) > 0);

  const submit = async () => {
    if (!answer || outcome || product.busy) return;
    setSubmitError(null);
    try {
      const value = await product.submitAttempt(exercise, answer, phase as LessonPhase);
      setOutcomes((current) => ({ ...current, [exercise.id]: value }));
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "Không nộp được câu trả lời");
    }
  };

  return (
    <div className="page-stack">
      <nav className={styles.breadcrumb} aria-label="Đường dẫn hoạt động"><Link href="/student/course">Khóa học</Link><span>›</span><Link href={`/student/lessons/${lesson.id}`}>{lesson.title}</Link><span>›</span><span>{phaseDetails[phase].label}</span></nav>
      <header className={`page-intro ${styles.practiceHeader}`}>
        <div><span className="eyebrow">{phaseDetails[phase].label} · dữ liệu chấm trên server</span><h1>{lesson.title}</h1><p>{phase === "CHECKPOINT" ? `Cần đúng ít nhất ${minimumCorrect}/${exercises.length} câu để hoàn thành.` : "Làm từng câu và dùng phản hồi để chuẩn bị cho kiểm tra cuối bài."}</p></div>
        <span className={styles.questionCounter}>Câu {index + 1}/{exercises.length}</span>
      </header>
      <ProgressBar value={(completed / exercises.length) * 100}/>
      <section className={`surface-card ${styles.questionCard}`}>
        <div className="signal-chips"><span>{exercise.type.replaceAll("_", " ")}</span><span>Độ khó {Math.round(exercise.difficulty * 100)}%</span></div>
        <h2>{exercise.prompt}</h2>
        {code && <pre><code>{code}</code></pre>}
        {options.length ? (
          <div className="answer-list">{options.map((option) => <button className={answer === option ? "selected" : ""} disabled={Boolean(outcome)} onClick={() => setAnswers((current) => ({ ...current, [exercise.id]: option }))} key={option}><code>{option}</code></button>)}</div>
        ) : (
          <textarea className={styles.textAnswer} disabled={Boolean(outcome)} value={answer} onChange={(event) => setAnswers((current) => ({ ...current, [exercise.id]: event.target.value }))} placeholder="Nhập câu trả lời hoặc đoạn mã của bạn"/>
        )}
        <button className="button primary" disabled={!answer || Boolean(outcome) || product.busy} onClick={() => void submit()}>{product.busy ? product.operation ?? "Đang chấm…" : outcome ? "Đã ghi nhận" : "Nộp câu trả lời"}</button>
        {submitError && <div className="provider-notice"><Asset type="icon" name="ui-alert" alt="" width={22} height={22}/><span>{submitError}</span></div>}
        {outcome && <div className={`${styles.answerFeedback} ${outcome.isCorrect ? styles.answerCorrect : styles.answerIncorrect}`} role="status"><h3>{outcome.isCorrect ? "Chính xác" : "Chưa đúng"}</h3><p>{outcome.analysis.recommendation.reasons[0] ?? (outcome.isCorrect ? "Hệ thống đã cập nhật mức độ nắm vững." : "Hãy xem lại giải thích trước khi tiếp tục.")}</p><span className={styles.helperText}>Attempt {outcome.attemptId.slice(0, 8)} · mức độ nắm vững mới {Math.round(outcome.analysis.mastery_after * 100)}%</span></div>}
        <div className="action-row">
          <button className="button ghost" disabled={index === 0 || product.busy} onClick={() => setIndex((value) => value - 1)}>← Câu trước</button>
          <button className="button ghost" disabled={!outcome || index === exercises.length - 1 || product.busy} onClick={() => setIndex((value) => value + 1)}>Câu tiếp →</button>
        </div>
      </section>
      {allCompleted && (
        <section className={styles.completionCard}>
          <h2>{phase === "CHECKPOINT" ? (passed ? "Đã hoàn thành kiểm tra cuối bài" : "Cần củng cố thêm trước khi học tiếp") : "Đã hoàn thành phần thực hành"}</h2>
          <p>Bạn trả lời đúng {correct}/{exercises.length} câu. Mỗi kết quả đã được server chấm và lưu vào lộ trình cá nhân.</p>
          <div className={styles.resultActions}>
            <Link className="button ghost" href={`/student/lessons/${lesson.id}`}>Xem lại bài học</Link>
            {phase === "PRACTICE" && nextPhaseExists && <Link className="button primary" href={`/student/lessons/${lesson.id}/checkpoint`}>Làm kiểm tra cuối bài →</Link>}
            <Link className="button primary" href="/student/course">Về khóa học →</Link>
            {phase === "CHECKPOINT" && <Link className="button ghost" href="/student/progress">Xem tiến bộ</Link>}
          </div>
        </section>
      )}
    </div>
  );
}

function ReviewView() {
  const product = useProduct();
  const rows = product.recommendations;
  if (!product.ready && product.busy) return <StudentPageSkeleton cards={2} label="Đang tải đề xuất học tập"/>;
  return <div className="page-stack"><header className="page-intro"><div><span className="eyebrow">Gợi ý có thể giải thích</span><h1>AI đề xuất bước học tiếp theo</h1><p>Mỗi đề xuất có kỹ năng, lý do, phiên bản mô hình và đích học cụ thể được lưu trên Supabase.</p></div></header>{rows.length ? rows.map((row) => <article className="review-card" key={row.id}><div className="review-content"><StatusPill tone={row.status === "ACTIVE" ? "purple" : "gray"}>{row.status === "ACTIVE" ? "Đang áp dụng" : row.status}</StatusPill><h2>{row.conceptTitle}</h2><p>{row.reasons.join(" · ")}</p><small>{row.modelVersion} · ưu tiên {Math.round(row.priorityScore * 100)}%</small><div className="action-row"><Link className="button primary" href={product.generatedLesson?.status === "PUBLISHED" ? "/student/micro-lesson" : product.lesson ? `/student/lessons/${product.lesson.id}/practice` : "/student/course"}>{product.generatedLesson?.status === "PUBLISHED" ? "Mở bài bổ trợ" : "Làm hoạt động tiếp"}</Link></div></div></article>) : <EmptyState illustration="review" title="Chưa có đề xuất" description="Hoàn thành bài đánh giá đầu vào hoặc một bài tập để tạo bằng chứng." href="/student/diagnostic" action="Làm bài đầu vào"/>}</div>;
}

function MicroLessonView() {
  const product = useProduct();
  const lesson = product.generatedLesson;
  const [slide, setSlide] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selections, setSelections] = useState<Record<number, number>>({});
  const [results, setResults] = useState<Record<number, { correct: boolean; masteryAfter: number }>>({});
  if (!lesson || lesson.status !== "PUBLISHED") return <EmptyState illustration="review" title="Chưa có bài bổ trợ được xuất bản" description="Bản nháp AI phải được giáo viên duyệt và xuất bản trước." href="/student/reviews" action="Xem đề xuất"/>;
  const current = lesson.slides[slide];
  const questions = lesson.practiceQuestions?.length ? lesson.practiceQuestions : [lesson.quiz];
  const question = questions[questionIndex]!;
  const selected = selections[questionIndex] ?? null;
  const result = results[questionIndex];
  const allAnswered = Object.keys(results).length === questions.length;
  const correctAnswers = Object.values(results).filter((item) => item.correct).length;
  const submitQuiz = async () => {
    if (selected === null || result || product.busy) return;
    const value = await product.completeQuiz(selected, questionIndex);
    setResults((currentResults) => ({ ...currentResults, [questionIndex]: value }));
  };
  return (
    <div className="page-stack">
      <header className="micro-header"><Link href="/student/reviews">← Đề xuất</Link><div><StatusPill tone="green">Đã xuất bản</StatusPill><strong>{lesson.title}</strong></div><span>{slide + 1}/{lesson.slides.length}</span></header>
      {current && <section className="surface-card"><LearningAnimation template={current.animationTemplate} data={current.animationData} title={current.title}/><div className={styles.resourceBody}><h2>{current.title}</h2><p className={styles.resourceContent}>{current.body}</p>{current.code && <pre><code>{current.code}</code></pre>}<button className="button ghost small" onClick={() => void speakVietnamese(current.narration)}>Nghe bài</button></div></section>}
      <div className="micro-actions"><button className="button ghost" disabled={slide === 0} onClick={() => setSlide((value) => value - 1)}>← Trước</button><button className="button ghost" disabled={slide === lesson.slides.length - 1} onClick={() => setSlide((value) => value + 1)}>Tiếp →</button></div>
      <section className="micro-quiz"><span className="eyebrow">Củng cố · câu {questionIndex + 1}/{questions.length}</span><ProgressBar value={(Object.keys(results).length / questions.length) * 100}/><h2>{question.question}</h2><div className="answer-list">{question.options.map((option, index) => <button className={selected === index ? "selected" : ""} disabled={Boolean(result)} onClick={() => setSelections((currentSelections) => ({ ...currentSelections, [questionIndex]: index }))} key={option}>{option}</button>)}</div><button className="button primary" disabled={selected === null || Boolean(result) || product.busy} onClick={() => void submitQuiz()}>{product.busy ? product.operation ?? "Đang chấm…" : result ? "Đã ghi nhận" : "Kiểm tra"}</button>{result && <div className={`${styles.answerFeedback} ${result.correct ? styles.answerCorrect : styles.answerIncorrect}`}><h3>{result.correct ? "Chính xác" : "Chưa đúng"}</h3><p>{question.explanation} Mức độ nắm vững mới {Math.round(result.masteryAfter * 100)}%.</p>{questionIndex < questions.length - 1 && <button className="button ghost small" onClick={() => setQuestionIndex((value) => value + 1)}>Câu tiếp →</button>}</div>}{allAnswered && <div className={styles.completionCard}><h2>Đã hoàn thành phần củng cố</h2><p>Bạn trả lời đúng {correctAnswers}/{questions.length} câu. Kết quả từng câu đã được lưu trên Supabase.</p><div className={styles.resultActions}><Link className="button primary" href="/student/course">Về khóa học →</Link><Link className="button ghost" href="/student/progress">Xem tiến bộ</Link></div></div>}</section>
    </div>
  );
}

function ProgressView() {
  const product = useProduct();
  const progress = product.progress;
  if (!progress && (product.busy || product.backgroundLoading)) return <StudentPageSkeleton cards={3} label="Đang tổng hợp tiến bộ"/>;
  if (!progress) return <EmptyState illustration="activity" title="Chưa có dữ liệu tiến bộ" description={product.error ?? "Hãy hoàn thành bài đầu vào hoặc một hoạt động học."} href="/student/diagnostic" action="Bắt đầu học"/>;
  const latest = progress.masteryHistory.at(-1);
  const chartData = progress.masteryHistory.map((item) => ({
    week: new Date(`${item.week}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
    mastery: Math.round(item.mastery * 100),
    retention: Math.round(item.retention * 100)
  }));
  const weeklyActivity = product.student?.weeklyActivity ?? [];
  const maxMinutes = Math.max(1, ...weeklyActivity);
  const dayLabels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  return (
    <div className="page-stack">
      <header className="page-intro"><div><span className="eyebrow">Dữ liệu học thật</span><h1>Tiến bộ của bạn</h1><p>Tổng hợp từ lịch sử kỹ năng, bài làm và learning event đang lưu trên Supabase.</p></div><Asset type="illustration" name="illustration-progress" alt="Biểu đồ tiến bộ học tập" width={240} height={160}/></header>
      <div className="metric-grid four"><Metric label="Mức độ nắm vững" value={`${Math.round((latest?.mastery ?? 0) * 100)}%`} note={latest ? `Cập nhật tuần ${new Date(`${latest.week}T00:00:00`).toLocaleDateString("vi-VN")}` : "Chưa có lịch sử"} icon="learning-brain" tone="green"/><Metric label="Khả năng nhớ lại" value={`${Math.round((latest?.retention ?? 0) * 100)}%`} note="Từ lịch sử kỹ năng" icon="learning-recall" tone="blue"/><Metric label="Thời gian học" value={`${progress.studyMinutes} phút`} note="Từ learning event" icon="ui-clock" tone="purple"/><Metric label="Bài đã làm" value={String(progress.exercisesCompleted)} note={`Đúng ${Math.round(progress.reviewAccuracy * 100)}%`} icon="ui-check" tone="yellow"/></div>
      <section className="surface-card chart-card"><SectionHeading eyebrow="Theo tuần" title="Nắm vững và nhớ lại" description="Biểu đồ chỉ dùng các mốc lịch sử do API trả về."/>{chartData.length ? <div className={styles.chartWrap}><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="studentMastery" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4AAA64" stopOpacity={.34}/><stop offset="95%" stopColor="#4AAA64" stopOpacity={0}/></linearGradient><linearGradient id="studentRetention" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#72B9F2" stopOpacity={.3}/><stop offset="95%" stopColor="#72B9F2" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#DCE8DF"/><XAxis dataKey="week"/><YAxis domain={[0, 100]}/><Tooltip/><Area type="monotone" dataKey="mastery" name="Nắm vững" stroke="#348B4E" strokeWidth={3} fill="url(#studentMastery)"/><Area type="monotone" dataKey="retention" name="Nhớ lại" stroke="#4A9BDF" strokeWidth={3} fill="url(#studentRetention)"/></AreaChart></ResponsiveContainer></div> : <div className={styles.emptyChart}>Chưa có đủ hai mốc lịch sử để vẽ biểu đồ. Dữ liệu sẽ xuất hiện sau bài đầu vào hoặc bài tập.</div>}</section>
      <section className="surface-card"><SectionHeading eyebrow="7 ngày gần nhất" title="Nhịp học trong tuần" description={`Mục tiêu ${product.student?.goal.weeklyMinutes ?? 0} phút/tuần`}/>{weeklyActivity.length ? <div className={styles.activityWeek}>{weeklyActivity.map((minutes, index) => <div className={styles.activityDay} key={`${dayLabels[index]}-${index}`}><strong>{minutes}′</strong><div className={styles.activityBarTrack}><span className={styles.activityBar} style={{ height: `${Math.max(3, (minutes / maxMinutes) * 100)}%` }}/></div><span>{dayLabels[index] ?? `N${index + 1}`}</span></div>)}</div> : <div className={styles.emptyChart}>Chưa có hoạt động trong tuần này.</div>}</section>
    </div>
  );
}

function SkillsView() {
  const { concepts, busy } = useProduct();
  if (!concepts.length && busy) return <StudentPageSkeleton cards={4} label="Đang tải bản đồ kỹ năng"/>;
  return <div className="page-stack"><SectionHeading title="Bản đồ kỹ năng" description="Mỗi chỉ số lấy từ trạng thái kỹ năng của bạn trên Supabase."/>{concepts.map((item) => <section className="surface-card" key={item.id}><strong>{item.title}</strong><ProgressBar label="Mức độ nắm vững" value={item.mastery * 100}/><ProgressBar label="Khả năng nhớ lại" value={item.retrievability * 100} color="blue"/></section>)}</div>;
}

function ConceptView({ code }: { code: string }) {
  const product = useProduct();
  const item = product.concepts.find((row) => row.code === code);
  if (!item) return <EmptyState illustration="activity" title="Chưa có dữ liệu kỹ năng" description="Kỹ năng không tồn tại trong khóa học hiện tại."/>;
  const recommendation = product.recommendations.find((row) => row.conceptCode === code);
  return <div className="page-stack"><SectionHeading eyebrow={item.code} title={item.title}/><section className="surface-card"><ProgressBar label="Mức độ nắm vững" value={item.mastery * 100}/><ProgressBar label="Khả năng nhớ lại" value={item.retrievability * 100} color="blue"/><ProgressBar label="Nguy cơ quên" value={item.forgettingRisk * 100} color="orange"/></section>{recommendation && <section className="surface-card"><h2>Vì sao AI chọn bước này?</h2>{recommendation.reasons.map((reason) => <p key={reason}>✓ {reason}</p>)}</section>}</div>;
}

function GamesView() {
  const { games, busy, backgroundLoading } = useProduct();
  if (!games.length && (busy || backgroundLoading)) return <StudentPageSkeleton cards={2} label="Đang tải hoạt động tương tác"/>;
  return <div className="page-stack"><SectionHeading eyebrow="Hoạt động học tương tác" title="Luyện tập như đang học bài" description="Không có game state giả; mỗi phiên được ghi vào GameSession."/>{games.map((game) => <article className="surface-card" key={String(game.id)}><h2>{String(game.title)}</h2><p>{String(game.description)}</p><StatusPill tone="purple">{String(game.type).replaceAll("_", " ")}</StatusPill></article>)}</div>;
}

interface DiagnosticSession { id: string; questions: Array<{ id: string; prompt: string; content: { options?: string[] } }> }
interface DiagnosticResult { diagnosticId: string; status: string; completedQuestions: number; totalQuestions: number; scores: Array<{ exerciseId: string; conceptCode: string; correct: boolean; mastery: number }> }

function DiagnosticView() {
  const product = useProduct();
  const [session, setSession] = useState<DiagnosticSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async () => { setBusy(true); setError(null); try { setSession(await apiRequest<DiagnosticSession>("/diagnostics/start", { method: "POST", body: "{}" })); } catch (cause) { setError(cause instanceof Error ? cause.message : "Không bắt đầu được bài đánh giá"); } finally { setBusy(false); } };
  const complete = async () => {
    if (!session) return;
    setBusy(true); setError(null);
    try {
      for (const [exerciseId, submittedAnswer] of Object.entries(answers)) await apiRequest(`/diagnostics/${session.id}/answer`, { method: "POST", body: JSON.stringify({ exerciseId, submittedAnswer }) });
      setResult(await apiRequest<DiagnosticResult>(`/diagnostics/${session.id}/complete`, { method: "POST", body: "{}" }));
      await product.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không hoàn thành được bài đánh giá"); }
    finally { setBusy(false); }
  };
  if (!session) return <div className="page-stack"><EmptyState illustration="activity" title="Bài đánh giá đầu vào" description="5 câu đã được giáo viên duyệt để khởi tạo mức độ nắm vững và lộ trình."/><button className="button primary" disabled={busy} onClick={() => void start()}>{busy ? "Đang tạo bài…" : "Bắt đầu"}</button>{error && <div className="provider-notice"><Asset type="icon" name="ui-alert" alt="" width={22} height={22}/><span>{error}</span></div>}</div>;
  if (result) {
    const correct = result.scores.filter((score) => score.correct).length;
    return <div className="page-stack"><section className={styles.completionCard}><h2>Đã hoàn thành bài đánh giá đầu vào</h2><p>Bạn trả lời đúng {correct}/{result.totalQuestions} câu. Lộ trình và trạng thái kỹ năng đã được cập nhật trên Supabase.</p><div className={styles.resultActions}><Link className="button primary" href="/student/course">Xem lộ trình →</Link><Link className="button ghost" href="/student/skills">Xem kỹ năng</Link></div></section>{result.scores.map((score) => <section className="surface-card" key={score.exerciseId}><strong>{score.conceptCode}</strong><ProgressBar label="Mức khởi tạo" value={score.mastery * 100}/><StatusPill tone={score.correct ? "green" : "yellow"}>{score.correct ? "Đúng" : "Cần học thêm"}</StatusPill></section>)}</div>;
  }
  return <div className="page-stack"><SectionHeading title="Đánh giá đầu vào" description={`${Object.keys(answers).length}/${session.questions.length} câu đã trả lời`}/>{session.questions.map((question) => <fieldset className="surface-card" disabled={busy} key={question.id}><legend>{question.prompt}</legend>{(question.content.options ?? []).map((option) => <label key={option}><input type="radio" name={question.id} checked={answers[question.id] === option} onChange={() => setAnswers({ ...answers, [question.id]: option })}/>{option}</label>)}</fieldset>)}<button className="button primary" disabled={busy || Object.keys(answers).length < session.questions.length} onClick={() => void complete()}>{busy ? "Đang chấm và tạo lộ trình…" : "Hoàn thành và tạo lộ trình"}</button>{error && <div className="provider-notice"><Asset type="icon" name="ui-alert" alt="" width={22} height={22}/><span>{error}</span></div>}</div>;
}

function ProfileView() {
  const product = useProduct();
  const data = product.student;
  const [goal, setGoal] = useState("");
  const [weeks, setWeeks] = useState(4);
  const [weeklyMinutes, setWeeklyMinutes] = useState(120);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => { if (data) { setGoal(data.goal.objective); setWeeks(data.goal.weeks); setWeeklyMinutes(data.goal.weeklyMinutes); } }, [data]);
  if (!data && product.busy) return <StudentPageSkeleton cards={2} label="Đang tải hồ sơ học tập"/>;
  if (!data) return <EmptyState illustration="activity" title="Chưa có hồ sơ học tập" description={product.error ?? "Supabase chưa trả hồ sơ học sinh."}/>;
  const unchanged = goal.trim() === data.goal.objective && weeks === data.goal.weeks && weeklyMinutes === data.goal.weeklyMinutes;
  const save = async () => {
    if (!goal.trim() || unchanged) return;
    setSaving(true); setNotice(null);
    try { await apiRequest("/students/me/goals", { method: "POST", body: JSON.stringify({ objective: goal.trim(), weeks, weeklyMinutes }) }); await product.refresh(); setNotice("Đã lưu mục tiêu và yêu cầu cập nhật lộ trình."); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "Không lưu được mục tiêu"); }
    finally { setSaving(false); }
  };
  return (
    <div className="page-stack">
      <SectionHeading eyebrow="Hồ sơ cá nhân hóa" title={data.student.nickname} description="Thông tin dưới đây đang được lưu trên Supabase và dùng để điều chỉnh lộ trình."/>
      <div className={styles.profileGrid}>
        <section className={`surface-card ${styles.profileSummary}`}><Asset className={styles.avatar} type="avatar" name={data.student.avatar ?? "avatar-01"} alt={`Ảnh đại diện ${data.student.nickname}`} width={120} height={120}/><h2>{data.student.name}</h2><p>{data.student.nickname}</p><div className={styles.statsGrid}><div><strong>{data.student.xp}</strong><span>XP</span></div><div><strong>{data.student.level}</strong><span>Cấp độ</span></div><div><strong>{data.student.streak}</strong><span>Ngày liên tiếp</span></div></div></section>
        <section className="surface-card"><SectionHeading eyebrow="Mục tiêu" title="Điều chỉnh kế hoạch học" description="Hệ thống dùng mục tiêu và quỹ thời gian để cân đối gợi ý."/><div className={styles.goalForm}><label className={styles.field}><span>Mục tiêu của bạn</span><textarea value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={500}/></label><div className={styles.formRow}><label className={styles.field}><span>Thời gian mục tiêu</span><select value={weeks} onChange={(event) => setWeeks(Number(event.target.value))}><option value={4}>4 tuần</option><option value={6}>6 tuần</option><option value={8}>8 tuần</option><option value={12}>12 tuần</option></select></label><label className={styles.field}><span>Phút học mỗi tuần</span><input type="number" min={30} max={600} step={15} value={weeklyMinutes} onChange={(event) => setWeeklyMinutes(Number(event.target.value))}/></label></div><button className="button primary" disabled={saving || product.busy || !goal.trim() || unchanged} onClick={() => void save()}>{saving ? "Đang lưu…" : unchanged ? "Mục tiêu chưa thay đổi" : "Lưu mục tiêu"}</button>{notice && <div className={styles.saveNote} role="status">{notice}</div>}</div></section>
      </div>
      <section className="surface-card"><SectionHeading eyebrow="Khóa đang học" title={data.course.title} description={`${Math.round(data.course.progress * 100)}% đã hoàn thành · ${data.dueReviews} bài ôn đến hạn`} action={<Link className="button ghost small" href="/student/course">Mở khóa học</Link>}/><ProgressBar value={data.course.progress * 100}/></section>
      <section className="surface-card"><SectionHeading eyebrow="Dấu mốc" title="Huy hiệu đã nhận"/>{data.badges.length ? <div className={styles.badgeList}>{data.badges.map((badge) => <article className={styles.badgeItem} key={badge}><Asset type="badge" name={badge} alt="" width={64} height={64}/><strong>{badge.replace(/^badge-/, "").replaceAll("-", " ")}</strong></article>)}</div> : <div className={styles.emptyChart}>Chưa có huy hiệu. Hãy hoàn thành hoạt động đầu tiên để bắt đầu bộ sưu tập.</div>}</section>
    </div>
  );
}

function LeaderboardView() {
  const product = useProduct();
  const [board, setBoard] = useState<"class" | "mostImproved" | "recallMaster">("mostImproved");
  if (!product.leaderboard && (product.busy || product.backgroundLoading)) return <StudentPageSkeleton cards={2} label="Đang tải bảng ghi nhận"/>;
  if (!product.leaderboard) return <EmptyState illustration="activity" title="Chưa có bảng ghi nhận" description={product.error ?? "Dữ liệu lớp chưa sẵn sàng."}/>;
  if (!product.leaderboard.enabled) return <EmptyState illustration="activity" title="Bảng ghi nhận đang tắt" description="Giáo viên đã tắt tính năng này cho lớp."/>;
  const rows = product.leaderboard.boards[board];
  return <div className="page-stack"><SectionHeading eyebrow="Ghi nhận trong lớp" title="Cùng nhìn lại tiến bộ" description="Chỉ hiển thị nickname và dữ liệu do API trả về."/><div className="tabs"><button className={board === "class" ? "active" : ""} onClick={() => setBoard("class")}>XP</button><button className={board === "mostImproved" ? "active" : ""} onClick={() => setBoard("mostImproved")}>Tiến bộ nhiều</button><button className={board === "recallMaster" ? "active" : ""} onClick={() => setBoard("recallMaster")}>Học đều</button></div><div className={styles.leaderboardList}>{rows.map((row, index) => <article className={styles.leaderboardRow} key={row.id}><span>{index + 1}</span><strong>{row.name}</strong><small>{row.xp} XP</small><small>{Math.round(row.mastery * 100)}% nắm vững</small><small>{row.streak} ngày</small></article>)}</div></div>;
}
