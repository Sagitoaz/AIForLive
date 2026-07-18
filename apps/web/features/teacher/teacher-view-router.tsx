"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Asset } from "@/components/asset";
import { EmptyState, Metric, ProgressBar, SectionHeading, StatusPill } from "@/components/ui";
import { useDemo } from "@/features/demo/demo-context";
import { concepts, genericTeacherPages, learners } from "@/lib/demo-data";
import { apiFormRequest, apiRequest } from "@/lib/api";
import { speakVietnamese, vietnameseSpeechMessage } from "@/lib/vietnamese-speech";

export function TeacherViewRouter({ path }: { path: string }) {
  if (path === "studio" || path === "editor") return <ContentStudio />;
  if (path === "classes" || path.startsWith("classes/")) return <ClassDetail />;
  if (path === "heatmap") return <KnowledgeHeatmap />;
  if (path === "gaps") return <GapAnalysis />;
  if (path === "misconceptions") return <MisconceptionGroups />;
  if (path.startsWith("students/")) return <StudentDetail id={path.split("/")[1] ?? "student-minh"} />;
  if (path.startsWith("recommendations/")) return <RecommendationDetail />;
  if (path === "timeline") return <EventTimeline />;
  if (path === "concept-graph") return <ConceptGraph />;
  if (path === "sources" || path === "upload") return <SourceManager showUpload={path === "upload"} />;
  if (path === "jobs") return <GenerationJobs />;
  if (path === "reviews") return <ReviewQueue />;
  if (path === "review-history") return <ReviewHistory />;
  if (path === "analytics" || path === "content-analytics") return <TeacherAnalytics />;
  if (path === "models") return <ModelStatus />;
  if (path === "exercises") return <ExerciseManager />;
  if (path === "course-builder") return <CourseBuilder />;
  if (path === "leaderboard") return <LeaderboardSettings />;
  const page = genericTeacherPages[path] ?? genericTeacherPages.classes!;
  return <GenericTeacherPage {...page} />;
}

function PageIntro({ eyebrow, title, description, illustration, action }: { eyebrow: string; title: string; description: string; illustration?: string; action?: React.ReactNode }) {
  return <header className="page-intro teacher-intro"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p>{action}</div>{illustration && <Asset type="illustration" name={`illustration-${illustration}`} alt="" width={230} height={150}/>}</header>;
}

function formatMeasuredDuration(durationMs?: number): string {
  if (!durationMs || durationMs <= 0) return "Chưa đo";
  if (durationMs < 1_000) return `${Math.max(1, Math.round(durationMs))} ms`;
  const totalSeconds = durationMs / 1_000;
  if (totalSeconds < 60) {
    const rounded = Math.round(totalSeconds * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} giây`;
  }
  const roundedSeconds = Math.round(totalSeconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function workflowDurationMs(lesson: ReturnType<typeof useDemo>["lesson"]): number {
  if (!lesson) return 0;
  return Math.max(0, lesson.generationMs ?? 0) + Math.max(0, lesson.teacherEditingSeconds ?? 0) * 1_000;
}

function ContentStudio() {
  const demo = useDemo();
  const [activeSlide, setActiveSlide] = useState(0);
  const [draft, setDraft] = useState(demo.lesson);
  const [speaking, setSpeaking] = useState(false);
  const [speechNotice, setSpeechNotice] = useState("");
  useEffect(() => setDraft(demo.lesson), [demo.lesson]);
  const slide = draft?.slides[activeSlide];

  if (!draft) {
    return (
      <div className="page-stack">
        <PageIntro eyebrow="AI content studio" title="Soạn bài nhanh, giáo viên giữ quyền quyết định" description="AI tạo bản nháp 3 pha từ nguồn đã xác minh; giáo viên sửa, duyệt rồi mới cho học sinh nhìn thấy." illustration="ai-generation"/>
        <div className="studio-context-grid">
          <section className="surface-card evidence-context"><SectionHeading eyebrow={demo.analysis ? "Recommendation context" : "Course plan context"} title={demo.analysis ? "Minh · PYTHON_RANGE" : "Bài 8/12 · Khám phá range()"}/>{demo.analysis ? <><div className="context-row"><span>Misconception</span><strong>{demo.analysis.diagnosis.misconception_code}</strong></div><div className="context-row"><span>Rule</span><strong>{demo.analysis.diagnosis.rule_id}</strong></div><div className="context-row"><span>Mastery</span><strong>{Math.round(demo.mastery * 100)}%</strong></div><div className="context-row"><span>Forgetting risk</span><strong>{Math.round(demo.analysis.forgetting_risk * 100)}%</strong></div><div className="evidence-list">{demo.analysis.diagnosis.evidence.map((item) => <span key={item}>✓ {item}</span>)}</div></> : <><div className="context-row"><span>Đối tượng</span><strong>Lớp 6–9 · mới bắt đầu</strong></div><div className="context-row"><span>Thời lượng</span><strong>65 phút</strong></div><div className="context-row"><span>Prerequisite</span><strong>Vòng lặp for · mastery ≥ 55%</strong></div><div className="context-row"><span>Đầu ra</span><strong>Đọc đúng start, stop, step</strong></div><div className="provider-notice"><Asset type="icon" name="ui-info" alt="" width={22} height={22}/><span><strong>Không cần chờ học sinh làm sai.</strong><small>Giáo viên có thể soạn bài gốc từ syllabus; evidence chỉ cần khi tạo bài bổ trợ cá nhân.</small></span></div></>}</section>
          <section className="surface-card generation-form"><SectionHeading eyebrow="Generation settings" title="Bài học 3 pha · 65 phút"/><label><span>Source đã xác minh</span><select><option>Python handbook nội bộ · bản 1.3 · VERIFIED</option></select></label><label><span>Khối lớp</span><select><option>Lớp 6–9</option><option>Lớp 9–12</option></select></label><label><span>Provider</span><select disabled><option>FPT AI khi có cấu hình · Local template khi offline</option></select></label><label><span>Learning objective</span><textarea defaultValue="Đọc đúng start, stop, step; dự đoán dãy và sửa lỗi lệch một đơn vị"/></label><div className="draft-phase-preview">{[["1", "Lý thuyết", "Bài giảng · video · tài liệu"], ["2", "Thực hành", "Code · trắc nghiệm · sửa lỗi"], ["3", "Kiểm tra", "Câu mới · cập nhật lộ trình"]].map(([number, title, detail]) => <div key={number}><span>{number}</span><strong>{title}</strong><small>{detail}</small></div>)}</div><div className="provider-notice"><Asset type="icon" name="ui-shield" alt="" width={22} height={22}/><span><strong>AI chỉ tạo DRAFT.</strong><small>Nguồn phải VERIFIED; JSON qua validation; giáo viên duyệt trước khi publish. Không chạy HTML hoặc JavaScript do model sinh.</small></span></div><button className="button primary full" disabled={demo.busy} onClick={() => demo.generateLesson("FULL_LESSON")}>{demo.busy ? "Đang grounding & validate..." : "Tạo bản nháp bài học →"}</button>{demo.analysis && <button className="button ghost full" disabled={demo.busy} onClick={() => demo.generateLesson("REMEDIATION")}>Tạo bài bổ trợ 7 phút từ evidence</button>}</section>
        </div>
      </div>
    );
  }

  const patchSlide = (field: "title" | "body" | "narration", value: string) => {
    setDraft((current) => current ? { ...current, slides: current.slides.map((item, index) => index === activeSlide ? { ...item, [field]: value } : item) } : current);
  };
  const save = async () => { if (draft) await demo.updateLesson(draft); };
  const speak = async () => {
    if (!slide) return;
    setSpeaking(true);
    setSpeechNotice("Đang đọc bằng giọng tiếng Việt...");
    const result = await speakVietnamese(slide.narration);
    setSpeechNotice(vietnameseSpeechMessage(result));
    setSpeaking(false);
  };
  return (
    <div className="studio-editor">
      <header className="editor-header"><div><span className="eyebrow">{draft.draftKind === "FULL_LESSON" ? "Lesson draft editor" : "Remediation draft editor"}</span><input aria-label="Tiêu đề bài học" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })}/></div><div className="editor-status"><StatusPill tone={draft.status === "PUBLISHED" ? "green" : draft.status === "APPROVED" ? "blue" : "yellow"}>{draft.status}</StatusPill><span>v{draft.version} · {draft.totalDurationMinutes ?? 7} phút · {draft.provider === "LOCAL_TEMPLATE" ? "Local template" : "FPT · DeepSeek-V4-Flash"}</span></div><div className="editor-actions"><button className="button ghost small" disabled={demo.busy || draft.status === "PUBLISHED"} onClick={save}>Lưu bản sửa</button>{draft.status === "DRAFT" && <button className="button dark small" disabled={demo.busy} onClick={demo.approveLesson}>Duyệt nội dung</button>}{draft.status === "APPROVED" && <button className="button primary small" disabled={demo.busy} onClick={demo.publishLesson}>Xuất bản</button>}{draft.status === "PUBLISHED" && <Link className="button primary small" href="/student/micro-lesson">Mở student view →</Link>}</div></header>
      <div className="editor-grid">
        <aside className="slide-list"><div className="slide-list-head"><strong>Nội dung AI</strong><span>{draft.slides.length} slide</span></div>{draft.sections?.map((section, index) => <div className="editor-phase" key={section.phase}><span>{index + 1}</span><div><strong>{section.title}</strong><small>{section.durationMinutes} phút · {section.activityTypes.join(" · ")}</small></div></div>)}{draft.slides.map((item, index) => <button className={index === activeSlide ? "active" : ""} onClick={() => setActiveSlide(index)} key={item.id}><span>{index + 1}</span><div><small>{item.type}</small><strong>{item.title}</strong></div></button>)}<button className={activeSlide === draft.slides.length ? "active quiz" : "quiz"} onClick={() => setActiveSlide(draft.slides.length)}><span>Q</span><div><small>CHECKPOINT</small><strong>Knowledge check</strong></div></button></aside>
        <section className="editor-canvas">
          {slide ? <><div className="canvas-preview"><div className="preview-stage"><Asset type="mascot" name={slide.type === "MISCONCEPTION" ? "mam-error" : "mam-code"} alt="" width={150} height={140}/><div className="preview-numbers">{((slide.animationData.values as string[] | undefined) ?? ["1", "2", "3", "4", "STOP"]).map((value) => <span key={value}>{value}</span>)}</div></div><div><StatusPill tone="purple">{slide.animationTemplate}</StatusPill><h2>{slide.title}</h2><p>{slide.body}</p>{slide.code && <pre><code>{slide.code}</code></pre>}</div></div><div className="editor-fields"><label><span>Slide title</span><input value={slide.title} onChange={(event) => patchSlide("title", event.target.value)}/></label><label><span>Body</span><textarea value={slide.body} onChange={(event) => patchSlide("body", event.target.value)}/></label><label><span>Narration</span><textarea value={slide.narration} onChange={(event) => patchSlide("narration", event.target.value)}/></label><button className="narration-button" disabled={speaking} onClick={speak}><Asset type="icon" name="media-audio" alt="" width={20} height={20}/> {speaking ? "Đang đọc..." : "Nghe slide này"}</button>{speechNotice && <small className="speech-notice" role="status">{speechNotice}</small>}</div></> : <QuizEditor lesson={draft} update={setDraft}/>}
        </section>
        <aside className="validation-panel"><SectionHeading eyebrow="Validation" title="Chờ giáo viên duyệt"/>{["Đủ 3 pha theo đúng thứ tự", "Có objective và thời lượng", "Có ví dụ + lỗi thường gặp", "Checkpoint có 1 đáp án đúng", "Không raw HTML / remote URL", "Nguồn VERIFIED và có checksum", "Ngôn ngữ phù hợp lớp 6–9"].map((item) => <div className="validation-row" key={item}><Asset type="icon" name="ui-check" alt="" width={18} height={18}/><span>{item}</span></div>)}<div className="cost-box"><span>Generation</span><strong>{draft.provider === "EXTERNAL_LLM" ? "FPT AI · theo billing" : "Local template · 0 USD"}</strong><small>{formatMeasuredDuration(draft.generationMs)} · đo tại trình duyệt · prompt v2</small></div><div className="diff-box"><span>Teacher review</span><strong>{draft.version > 1 ? `${draft.version - 1} lần chỉnh` : "Chưa chỉnh"}</strong><small>{draft.teacherEditingSeconds ? `${formatMeasuredDuration(draft.teacherEditingSeconds * 1_000)} giáo viên xử lý` : "Bắt đầu đo khi tạo draft"}</small></div></aside>
      </div>
    </div>
  );
}

function QuizEditor({ lesson, update }: { lesson: NonNullable<ReturnType<typeof useDemo>["lesson"]>; update: React.Dispatch<React.SetStateAction<ReturnType<typeof useDemo>["lesson"]>> }) {
  return <div className="quiz-editor"><span className="eyebrow">Generated quiz</span><label><span>Câu hỏi</span><textarea value={lesson.quiz.question} onChange={(event) => update({ ...lesson, quiz: { ...lesson.quiz, question: event.target.value } })}/></label>{lesson.quiz.options.map((option, index) => <label className="quiz-option-edit" key={`${option}-${index}`}><input type="radio" name="correct-answer" checked={lesson.quiz.correctIndex === index} onChange={() => update({ ...lesson, quiz: { ...lesson.quiz, correctIndex: index } })}/><input value={option} onChange={(event) => update({ ...lesson, quiz: { ...lesson.quiz, options: lesson.quiz.options.map((item, itemIndex) => itemIndex === index ? event.target.value : item) } })}/></label>)}<label><span>Giải thích</span><textarea value={lesson.quiz.explanation} onChange={(event) => update({ ...lesson, quiz: { ...lesson.quiz, explanation: event.target.value } })}/></label><div className="success-note"><Asset type="icon" name="ui-check" alt="" width={20} height={20}/>Quiz hợp lệ: đúng một đáp án.</div></div>;
}

function ClassDetail() {
  const [filter, setFilter] = useState("all");
  const visible = learners.filter((learner, index) => filter === "all" || (filter === "support" ? index % 5 === 0 : learner.streak >= 8));
  return <div className="page-stack"><PageIntro eyebrow="Python Explorers · PY-01" title="20 học viên, 20 nhịp học khác nhau" description="Pilot một lớp trong 4–6 tuần; không dùng model cho xếp loại hay kỷ luật." illustration="class-dashboard"/><div className="tabs"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Tất cả 20</button><button className={filter === "support" ? "active" : ""} onClick={() => setFilter("support")}>Cần hỗ trợ</button><button className={filter === "consistent" ? "active" : ""} onClick={() => setFilter("consistent")}>Consistent</button></div><section className="surface-card student-table"><div className="table-head"><span>Học viên</span><span>Tiến độ</span><span>Mastery</span><span>Streak</span><span>Điểm yếu</span><span/></div>{visible.map((learner, index) => <div className="table-row" key={learner.id}><span><img src={learner.avatar} alt=""/><strong>{learner.nickname}</strong></span><span><ProgressBar value={32 + (index % 8) * 7}/></span><span>{43 + (index % 7) * 6}%</span><span>{learner.streak} ngày</span><span><StatusPill tone={index % 5 === 0 ? "red" : "yellow"}>{learner.weak}</StatusPill></span><span><Link href={`/teacher/students/${learner.id}`}>Chi tiết →</Link></span></div>)}</section></div>;
}

function KnowledgeHeatmap() {
  const demo = useDemo();
  const [selected, setSelected] = useState<{ student: string; concept: string; value: number } | null>(null);
  return <div className="page-stack"><PageIntro eyebrow="Knowledge heatmap" title="Nhìn cả lớp theo từng concept" description="Click một ô để xem mastery, retrievability và signal liên quan." illustration="knowledge-graph"/><section className="surface-card full-heatmap"><div className="full-heat-head"><span>Học viên</span>{concepts.map((concept) => <span title={concept.title} key={concept.code}><Asset type="icon" name={concept.icon} alt="" width={28} height={28}/><small>{concept.title}</small></span>)}</div>{learners.map((learner, row) => <div className="full-heat-row" key={learner.id}><span><img src={learner.avatar} alt=""/>{learner.name}</span>{concepts.map((concept, column) => { const value = row === 0 && concept.code === "PYTHON_RANGE" ? Math.round(demo.mastery * 100) : 22 + ((row * 13 + column * 17) % 71); return <button className={value < 45 ? "low" : value < 65 ? "mid" : "high"} onClick={() => setSelected({ student: learner.name, concept: concept.title, value })} key={concept.code}>{value}%</button>; })}</div>)}</section>{selected && <div className="heat-detail"><Asset type="icon" name="ai-evidence" alt="" width={34} height={34}/><div><strong>{selected.student} · {selected.concept}</strong><span>Mastery {selected.value}% · Retrievability {Math.max(18, selected.value - 8)}%</span></div><Link href="/teacher/recommendations/latest" className="button ghost small">Xem evidence</Link><button aria-label="Đóng" onClick={() => setSelected(null)}>×</button></div>}</div>;
}

function GapAnalysis() {
  return <div className="page-stack"><PageIntro eyebrow="Concept gap analysis" title="Ưu tiên lỗ hổng có ảnh hưởng lan truyền" description="Kết hợp average mastery, số học viên và prerequisite importance." illustration="knowledge-graph"/><div className="gap-list">{[["PYTHON_WHILE", 39, 9, 82], ["PYTHON_RANGE", 42, 7, 76], ["PYTHON_FUNCTIONS", 46, 6, 90], ["PYTHON_LISTS", 54, 4, 58]].map(([code, mastery, students, impact], index) => <article key={String(code)}><span className="gap-rank">{index + 1}</span><Asset type="icon" name={concepts.find((item) => item.code === code)?.icon ?? "concept-loop"} alt="" width={46} height={46}/><div><strong>{code}</strong><small>{students} học viên dưới ngưỡng</small></div><div><ProgressBar label="Mastery lớp" value={Number(mastery)} color="orange"/></div><div><ProgressBar label="Prerequisite impact" value={Number(impact)} color="purple"/></div><Link href="/teacher/misconceptions">Phân tích →</Link></article>)}</div></div>;
}

function MisconceptionGroups() {
  const groups = [
    { code: "RANGE_STOP_INCLUDED", concept: "PYTHON_RANGE", students: 7, attempts: 18, confidence: 95, rule: "range-stop-rule-v1" },
    { code: "WHILE_VARIABLE_NOT_UPDATED", concept: "PYTHON_WHILE", students: 5, attempts: 12, confidence: 91, rule: "while-update-rule-v1" },
    { code: "LIST_INDEX_STARTS_AT_ONE", concept: "PYTHON_LISTS", students: 4, attempts: 8, confidence: 92, rule: "list-index-rule-v1" },
    { code: "FUNCTION_RETURN_VS_PRINT", concept: "PYTHON_FUNCTIONS", students: 3, attempts: 6, confidence: 78, rule: "return-print-rule-v1" }
  ];
  return <div className="page-stack"><PageIntro eyebrow="Hybrid diagnosis" title="Nhóm học viên theo lỗi có evidence" description="Rule đã biết được ưu tiên; pattern không khớp có thể trả UNKNOWN." illustration="teacher-review"/><div className="misconception-cards">{groups.map((group, index) => <article key={group.code}><div className="group-top"><span className={`severity ${index === 0 ? "red" : index === 1 ? "orange" : "yellow"}`}/><StatusPill tone="purple">DOMAIN_RULE</StatusPill><small>{group.confidence}% confidence</small></div><h2>{group.code}</h2><p>{group.concept} · {group.rule}</p><div className="group-metrics"><span><strong>{group.students}</strong>học viên</span><span><strong>{group.attempts}</strong>attempt</span><span><strong>{index === 0 ? 4 : 1}</strong>reuse</span></div><div className="avatar-stack">{learners.slice(index, index + group.students).map((learner) => <img src={learner.avatar} alt={learner.name} title={learner.name} key={learner.id}/>)}</div><div className="card-actions"><Link href="/teacher/recommendations/latest" className="button ghost small">Xem evidence</Link><Link href="/teacher/studio" className="button dark small">Tạo / tái dùng bài</Link></div></article>)}</div></div>;
}

function StudentDetail({ id }: { id: string }) {
  const demo = useDemo();
  const student = learners.find((item) => item.id === id) ?? learners[0];
  return <div className="page-stack"><PageIntro eyebrow="Student intelligence" title={`${student?.name} · hành trình cá nhân`} description="Giải thích từ dữ liệu, không gắn nhãn cố định cho người học." illustration="progress"/><div className="student-detail-grid"><section className="surface-card student-profile-summary"><img src={student?.avatar} alt=""/><h2>{student?.nickname}</h2><p>Mục tiêu: mini game sau 4 tuần</p><div><strong>{student?.xp}</strong><span>XP</span><strong>{student?.streak}</strong><span>streak</span></div><StatusPill tone="yellow">Cần theo dõi range()</StatusPill></section><section className="surface-card"><SectionHeading eyebrow="Concept state" title="Mastery khác retrievability"/>{concepts.map((concept) => { const value = concept.code === "PYTHON_RANGE" ? Math.round(demo.mastery * 100) : concept.mastery; return <div className="dual-progress" key={concept.code}><strong>{concept.title}</strong><ProgressBar label="Mastery" value={value}/><ProgressBar label="Recall" value={Math.max(18, value - 8)} color="blue"/></div>; })}</section></div><section className="before-after"><Asset type="illustration" name="illustration-spaced-review" alt="" width={250} height={170}/><div><span className="eyebrow">Trước / sau ôn range()</span><h2>{Math.round(demo.masteryBeforeReview * 100)}% <span>→</span> {Math.round(demo.mastery * 100)}%</h2><p>{demo.quizCompleted ? "Quiz đúng; review interval đã đổi thành 5 ngày." : "Chưa hoàn thành micro-lesson được duyệt."}</p></div><Link href="/teacher/timeline" className="button ghost">Learning timeline →</Link></section></div>;
}

function RecommendationDetail() {
  const demo = useDemo();
  if (!demo.analysis) return <EmptyState illustration="activity" title="Chưa có recommendation" description="Tạo attempt range trước để xem evidence." href="/student/exercise" action="Tạo attempt"/>;
  const target = demo.analysis.recommendation.target;
  const candidateScores = (demo.analysis.recommendation.evidence.candidateScores ?? {}) as Record<string, number>;
  return <div className="page-stack"><PageIntro eyebrow="Per-student recommendation log" title={`${demo.analysis.recommendation.action} · ưu tiên ${Math.round(demo.analysis.recommendation.priority_score * 100)}%`} description="Minh nhận một activity ID cụ thể; reason được dựng từ signal/rule, không do LLM bịa." illustration="teacher-review"/>{target && <section className="recommendation-target"><Asset type="icon" name="ai-spark" alt="" width={34} height={34}/><div><span className="eyebrow">Đích được chọn</span><h2>{target.title}</h2><p>{target.id} · {target.phase} · {target.estimated_minutes} phút · độ khó {target.difficulty ?? "theo bài"}</p></div><StatusPill tone="purple">{target.type}</StatusPill></section>}<div className="recommendation-detail"><section className="surface-card"><SectionHeading eyebrow="Candidate signal log" title="Công thức ưu tiên"/>{[["Knowledge gap", candidateScores.knowledgeGap ?? 1 - demo.mastery, 35], ["Forgetting risk", candidateScores.forgettingRisk ?? demo.analysis.forgetting_risk, 25], ["Recent error rate", candidateScores.recentErrorRate ?? 0.7, 20], ["Prerequisite gap", candidateScores.prerequisiteGap ?? 0.28, 10], ["Course relevance", candidateScores.courseRelevance ?? 0.88, 10]].map(([label, value, weight]) => <div className="weighted-signal" key={String(label)}><span>{label}</span><ProgressBar value={Number(value) * 100}/><strong>× {weight}%</strong></div>)}<div className="event-log-mini"><strong>{demo.learningLog.length} learning event trong phiên</strong>{demo.learningLog.slice(-3).map((event) => <small key={event.id}>{event.phase} · {event.activityId} · {event.isCorrect ? "đúng" : "sai"}</small>)}</div></section><section className="surface-card"><SectionHeading eyebrow="Evidence chain" title={demo.analysis.diagnosis.misconception_code ?? demo.analysis.diagnosis.status}/><div className="evidence-list">{demo.analysis.diagnosis.evidence.map((item) => <span key={item}>✓ {item}</span>)}</div>{demo.analysis.recommendation.reasons.map((reason, index) => <div className="reason-row" key={reason}><span>{index + 1}</span><p>{reason}</p></div>)}<div className="model-note"><strong>{demo.analysis.diagnosis.rule_id ?? "Không có rule kết luận"}</strong><small>{demo.analysis.mode} · {String(demo.analysis.recommendation.evidence.modelVersion ?? "bkt-v1")}</small></div></section></div><Link href="/teacher/studio" className="button primary">Tạo bài bổ trợ từ evidence →</Link></div>;
}

function EventTimeline() {
  const demo = useDemo();
  const events = [
    ["08:42", "ATTEMPT_SUBMITTED", "Minh chọn dãy có cả số 5", "red"],
    ["08:42", "DOMAIN_RULE_MATCHED", "RANGE_STOP_INCLUDED · 95% confidence", "purple"],
    ["08:42", "STATE_UPDATED", `Mastery 42% → ${Math.round(demo.mastery * 100)}%`, "blue"],
    ["08:42", "RECOMMENDATION_CREATED", "MICRO_LESSON · priority 0.87", "yellow"],
    ["09:05", "CONTENT_GENERATED", demo.lesson ? `${demo.lesson.provider} · ${demo.lesson.status}` : "Chưa tạo", "green"]
  ];
  return <div className="page-stack"><PageIntro eyebrow="Learning event timeline" title="Một attempt, toàn bộ dấu vết" description="Correlation ID nối lưu event, phân tích, state update và recommendation." illustration="progress"/><section className="surface-card timeline">{events.map(([time, type, detail, tone], index) => <div className="timeline-event" key={String(type)}><span className={`timeline-dot ${tone}`}>{index + 1}</span><time>{time}</time><div><strong>{type}</strong><p>{detail}</p><small>correlation: demo-range-event-01</small></div></div>)}</section></div>;
}

function ConceptGraph() {
  return <div className="page-stack"><PageIntro eyebrow="Domain plugin graph" title="Prerequisite quyết định thứ tự hợp lý" description="Đồ thị được nạp từ domains/python-foundations, không hard-code trong core service." illustration="knowledge-graph"/><section className="concept-graph"><svg viewBox="0 0 900 520" role="img" aria-label="Đồ thị prerequisite Python"><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#8ED49E"/></marker></defs>{[[150,100,330,100],[330,100,510,100],[150,100,330,260],[330,260,510,260],[330,100,510,400],[510,100,710,240],[330,260,710,240]].map((line, index) => <line x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} markerEnd="url(#arrow)" key={index}/>)}</svg>{concepts.map((concept, index) => { const positions = [[70,55],[280,55],[500,55],[280,215],[500,215],[500,355],[680,355],[700,195]]; const position = positions[index] ?? [0,0]; return <div className="graph-node" style={{ left: position[0], top: position[1] }} key={concept.code}><Asset type="icon" name={concept.icon} alt="" width={34} height={34}/><strong>{concept.title}</strong><small>{concept.code}</small></div>; })}</section></div>;
}

function SourceManager({ showUpload }: { showUpload: boolean }) {
  const [uploaded, setUploaded] = useState<{ id: string; name: string; sizeBytes: number; mimeType: string; status: "PENDING_EXTRACTION" | "NEEDS_REVIEW" | "VERIFIED" } | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const select = async (file?: File) => {
    if (!file) return;
    const allowed = ["text/plain", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation"];
    if (!allowed.includes(file.type) || file.size > 15 * 1024 * 1024) {
      setError("Chỉ nhận TXT, PDF, DOCX, PPTX tối đa 15 MB.");
      setUploaded(null);
      return;
    }
    setError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      setUploaded(await apiFormRequest("/content-sources/upload", form));
    } catch {
      setError("Không tải được lên API. Tài liệu chưa được lưu và chưa được dùng để sinh bài.");
    } finally {
      setUploading(false);
    }
  };
  const verify = async () => {
    if (!uploaded) return;
    try {
      setUploaded(await apiRequest(`/content-sources/${uploaded.id}/verify`, { method: "POST" }));
    } catch {
      setError("Chưa thể xác minh nguồn. Chỉ TXT đã tách văn bản mới được duyệt trong prototype.");
    }
  };
  const sources = [{ name: "Python handbook nội bộ · bản 1.3.txt", type: "TXT", detail: "Trích đoạn thật · checksum SHA-256", used: 12, status: "VERIFIED" }, { name: "Lesson plan vòng lặp.pdf", type: "PDF", detail: "Đã kiểm tra MIME · chờ worker tách chữ", used: 0, status: "PENDING_EXTRACTION" }, { name: "Slide minh họa range.pptx", type: "PPTX", detail: "Đã kiểm tra MIME · chờ worker tách chữ", used: 0, status: "PENDING_EXTRACTION" }];
  return <div className="page-stack"><PageIntro eyebrow="Content source manager" title="Nguồn vào an toàn, context có truy vết" description="Tài liệu chỉ vào prompt sau khi tách nội dung và giáo viên xác minh; MIME hợp lệ chưa đồng nghĩa với nguồn đã dùng được." illustration="upload"/>{showUpload && <section className="upload-zone"><Asset type="illustration" name="illustration-upload" alt="Tải tài liệu" width={250} height={170}/><h2>Tải tài liệu tham khảo</h2><p>TXT · PDF · DOCX · PPTX, tối đa 15 MB. Prototype tách TXT trực tiếp; định dạng nhị phân chờ worker.</p><label className="button primary">{uploading ? "Đang tải..." : "Chọn tài liệu"}<input disabled={uploading} type="file" accept=".txt,.pdf,.docx,.pptx" onChange={(event) => void select(event.target.files?.[0])}/></label>{error && <p className="game-error">{error}</p>}{uploaded && <div className="uploaded-source"><Asset type="icon" name="ui-check" alt="" width={22} height={22}/><div><strong>{uploaded.name}</strong><small>{(uploaded.sizeBytes / 1024).toFixed(1)} KB · {uploaded.mimeType}</small></div><StatusPill tone={uploaded.status === "VERIFIED" ? "green" : uploaded.status === "NEEDS_REVIEW" ? "yellow" : "gray"}>{uploaded.status}</StatusPill>{uploaded.status === "NEEDS_REVIEW" && <button className="button dark small" onClick={verify}>Xác minh nguồn</button>}</div>}</section>}<section className="surface-card source-list"><SectionHeading eyebrow="1 nguồn dùng được · 2 nguồn đang chờ" title="Source library" action={!showUpload && <Link href="/teacher/upload" className="button primary small">Upload tài liệu</Link>}/>{sources.map((source, index) => <article key={source.name}><Asset type="icon" name={`media-${source.type.toLowerCase()}`} alt="" width={34} height={34}/><div><strong>{source.name}</strong><small>{source.type} · source-{index + 1}</small></div><span>{source.detail}</span><span>{source.used} lần dùng</span><StatusPill tone={source.status === "VERIFIED" ? "green" : "gray"}>{source.status}</StatusPill><button disabled={source.status !== "VERIFIED"} onClick={() => alert(`Verified source: ${source.name}`)}>Xem nguồn</button></article>)}</section></div>;
}

function GenerationJobs() {
  const demo = useDemo();
  return <div className="page-stack"><PageIntro eyebrow="Content pipeline" title="Generation jobs" description="Mỗi job có provider, prompt version, validation, duration và cost." illustration="ai-generation"/><section className="surface-card job-table"><div className="table-head"><span>Job</span><span>Context</span><span>Provider</span><span>Duration</span><span>Cost</span><span>Status</span></div>{demo.lesson ? <div className="table-row"><span>job-{demo.lesson.id.slice(-6)}</span><span>PYTHON_RANGE</span><span>{demo.lesson.provider}</span><span>{formatMeasuredDuration(demo.lesson.generationMs)}</span><span>{demo.lesson.provider === "EXTERNAL_LLM" ? "Theo FPT" : "$0.00"}</span><span><StatusPill tone="green">COMPLETED</StatusPill></span></div> : <EmptyState illustration="activity" title="Chưa có generation job" description="Tạo micro-lesson từ recommendation context." href="/teacher/studio" action="Mở studio"/>}</section></div>;
}

function ReviewQueue() {
  const demo = useDemo();
  return <div className="page-stack"><PageIntro eyebrow="Human review queue" title="Không có nội dung AI tự xuất bản" description="Student endpoint chỉ trả PUBLISHED; review decision có audit trail." illustration="teacher-review"/>{demo.lesson && demo.lesson.status !== "PUBLISHED" ? <article className="queue-card"><Asset type="illustration" name="illustration-micro-lesson" alt="" width={230} height={150}/><div><StatusPill tone={demo.lesson.status === "APPROVED" ? "blue" : "yellow"}>{demo.lesson.status}</StatusPill><h2>{demo.lesson.title}</h2><p>PYTHON_RANGE · RANGE_STOP_INCLUDED · {demo.lesson.slides.length} slides · 1 quiz</p><span>{demo.lesson.provider} · {demo.lesson.provider === "EXTERNAL_LLM" ? "FPT billing" : "$0.00"} · v{demo.lesson.version}</span></div><Link className="button primary" href="/teacher/studio">Mở editor →</Link></article> : <EmptyState illustration="review" title={demo.lesson?.status === "PUBLISHED" ? "Queue đã sạch" : "Chưa có bản nháp"} description={demo.lesson?.status === "PUBLISHED" ? "Micro-lesson đã xuất bản cho Minh." : "Tạo nội dung từ recommendation trước."} href={demo.lesson?.status === "PUBLISHED" ? "/student/micro-lesson" : "/teacher/studio"} action={demo.lesson?.status === "PUBLISHED" ? "Mở student view" : "Tạo bản nháp"}/>}</div>;
}

function ReviewHistory() {
  const demo = useDemo();
  const statuses = demo.lesson ? ["GENERATING", "DRAFT", ...(demo.lesson.status === "APPROVED" || demo.lesson.status === "PUBLISHED" ? ["APPROVED"] : []), ...(demo.lesson.status === "PUBLISHED" ? ["PUBLISHED"] : [])] : [];
  return <div className="page-stack"><PageIntro eyebrow="Version & audit" title="Lịch sử kiểm duyệt" description="Ai sửa gì, từ trạng thái nào sang trạng thái nào." illustration="teacher-review"/>{statuses.length ? <section className="surface-card timeline">{statuses.map((status, index) => <div className="timeline-event" key={status}><span className="timeline-dot green">{index + 1}</span><time>09:{String(10 + index * 4).padStart(2, "0")}</time><div><strong>{status}</strong><p>{status === "DRAFT" ? `${demo.lesson?.provider ?? "Provider"} output đã qua schema validation` : status === "APPROVED" ? "Cô Mai kiểm tra code, narration và quiz" : status === "PUBLISHED" ? "Nội dung hiển thị cho Minh" : "Generation job bắt đầu"}</p><small>version {Math.max(1, index)} · actor {index < 2 ? "system" : "teacher@edurecall.local"}</small></div></div>)}</section> : <EmptyState illustration="activity" title="Chưa có lịch sử" description="Tạo và duyệt một micro-lesson để sinh audit trail." href="/teacher/studio" action="Mở studio"/>}</div>;
}

function TeacherAnalytics() {
  const demo = useDemo();
  const mastery = [{ week: "W0", mastery: 41, retention: 46 }, { week: "W1", mastery: 45, retention: 50 }, { week: "W2", mastery: 49, retention: 54 }, { week: "W3", mastery: 53, retention: 59 }, { week: "W4", mastery: 58, retention: 64 }];
  const content = [{ name: "Draft", value: demo.lesson ? 1 : 0 }, { name: "Approved", value: demo.lesson?.status === "APPROVED" ? 1 : 0 }, { name: "Published", value: demo.lesson?.status === "PUBLISHED" ? 1 : 0 }, { name: "Reused", value: demo.lesson?.reuseCount ?? 0 }];
  const measuredWorkflow = formatMeasuredDuration(workflowDurationMs(demo.lesson));
  const timingNote = demo.lesson
    ? `${formatMeasuredDuration(demo.lesson.generationMs)} tạo draft + ${formatMeasuredDuration((demo.lesson.teacherEditingSeconds ?? 0) * 1_000)} giáo viên xử lý`
    : "Tạo draft để bắt đầu đo";
  return <div className="page-stack"><PageIntro eyebrow="Pilot analytics" title="Hiệu quả học và hiệu suất sản xuất nội dung" description="Không diễn giải metric synthetic thành tác động giáo dục đã được chứng minh." illustration="class-dashboard"/><div className="metric-grid four"><Metric label="Mastery lớp" value="58%" note="+17 điểm từ W0" icon="learning-brain"/><Metric label="Retention" value="64%" note="+18 điểm" icon="learning-recall" tone="blue"/><Metric label="Content time" value={measuredWorkflow} note={timingNote} icon="ui-clock" tone="purple"/><Metric label="AI cost" value={demo.lesson?.provider === "EXTERNAL_LLM" ? "Theo FPT" : "$0.00"} note={demo.lesson?.provider === "EXTERNAL_LLM" ? "FPT AI billing" : "Local fallback"} icon="ai-cost" tone="orange"/></div><section className="before-after"><Asset type="illustration" name="illustration-ai-generation" alt="" width={250} height={170}/><div><span className="eyebrow">Mốc tham chiếu và số đo demo</span><h2>45 giờ/bài đầy đủ <span>·</span> {measuredWorkflow}/micro-lesson</h2><p>Brief nêu khoảng 40–50 giờ cho một bài học hoàn chỉnh. Prototype chỉ đo workflow của micro-lesson 5 phút nên hai số chưa tương đương; pilot phải đo hai bài cùng phạm vi trước khi báo cáo mức giảm.</p></div></section><div className="analytics-grid"><section className="surface-card chart-card"><SectionHeading eyebrow="Learning outcome" title="Mastery & retention"/><div className="chart-wrap"><ResponsiveContainer width="100%" height={300}><LineChart data={mastery}><CartesianGrid strokeDasharray="3 3" stroke="#DCE8DF"/><XAxis dataKey="week"/><YAxis domain={[0,100]}/><Tooltip/><Legend/><Line type="monotone" dataKey="mastery" stroke="#348B4E" strokeWidth={3}/><Line type="monotone" dataKey="retention" stroke="#72B9F2" strokeWidth={3}/></LineChart></ResponsiveContainer></div></section><section className="surface-card chart-card"><SectionHeading eyebrow="Content workflow" title="Draft → reuse"/><div className="chart-wrap"><ResponsiveContainer width="100%" height={300}><BarChart data={content}><CartesianGrid strokeDasharray="3 3" stroke="#DCE8DF"/><XAxis dataKey="name"/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="value" fill="#4AAA64" radius={[8,8,0,0]}/></BarChart></ResponsiveContainer></div></section></div><div className="analytics-note"><Asset type="icon" name="ui-info" alt="" width={26} height={26}/><p><strong>Giới hạn diễn giải:</strong> số đo thời gian chỉ phản ánh phiên demo trên thiết bị hiện tại; dữ liệu training và dashboard đều synthetic. Pilot thật cần consent, baseline, feedback giáo viên/học sinh, calibration và retraining trước khi kết luận.</p></div></div>;
}

function ModelStatus() {
  return <div className="page-stack"><PageIntro eyebrow="Personalization intelligence" title="Model status & giới hạn" description="Phân biệt thuật toán tracking, model dự đoán và LLM content." illustration="ai-generation"/><div className="model-card-grid"><article><div><Asset type="icon" name="ai-bkt" alt="" width={42} height={42}/><StatusPill tone="green">ACTIVE</StatusPill></div><h2>Bayesian Knowledge Tracing</h2><p>Posterior mastery theo student-concept; confidence điều chỉnh bởi hint, difficulty, response time và skipped.</p><dl><dt>Version</dt><dd>bkt-v1</dd><dt>Artifact</dt><dd>Không cần</dd><dt>Output</dt><dd>mastery [0,1]</dd></dl></article><article><div><Asset type="icon" name="ai-model" alt="" width={42} height={42}/><StatusPill tone="green">ARTIFACT</StatusPill></div><h2>Next-attempt logistic regression</h2><p>Split theo student; không random row split. Chỉ phục vụ prototype.</p><dl><dt>Accuracy</dt><dd>0.6703</dd><dt>ROC-AUC</dt><dd>0.5691</dd><dt>Brier</dt><dd>0.2169</dd></dl></article><article><div><Asset type="icon" name="learning-recall" alt="" width={42} height={42}/><StatusPill tone="blue">REPLACEABLE</StatusPill></div><h2>Exponential forgetting</h2><p>Tính retrievability từ elapsed time và stability; interface sẵn sàng cho FSRS.</p><dl><dt>Formula</dt><dd>exp(-t / S)</dd><dt>Scheduler</dt><dd>Target recall 82%</dd></dl></article><article><div><Asset type="icon" name="ai-spark" alt="" width={42} height={42}/><StatusPill tone="green">ACTIVE</StatusPill></div><h2>FPT content provider</h2><p>DeepSeek-V4-Flash tạo structured draft; schema validator và giáo viên chặn trước publish.</p><dl><dt>Fallback</dt><dd>Local template</dd><dt>Human review</dt><dd>Bắt buộc</dd></dl></article></div><section className="model-warning"><Asset type="illustration" name="illustration-error" alt="" width={230} height={150}/><div><span className="eyebrow">SYNTHETIC DATA</span><h2>Không dùng model để xếp loại hoặc kỷ luật</h2><p>Cần calibrate và đánh giá fairness bằng dữ liệu pilot có consent trước mọi quyết định thật.</p></div><Link href="/design-system" className="button ghost">Xem model card trong source</Link></section></div>;
}

function ExerciseManager() {
  const [type, setType] = useState("ALL");
  const rows = Array.from({ length: 12 }, (_, index) => ({ code: `EX-${String(index + 1).padStart(2,"0")}`, concept: concepts[index % concepts.length]?.code ?? "PYTHON_RANGE", type: ["MULTIPLE_CHOICE", "CODE_ORDER", "PREDICT_OUTPUT", "BUG_HUNTER"][index % 4] ?? "MULTIPLE_CHOICE", difficulty: 25 + (index % 6) * 11, attempts: 21 + index * 3 }));
  return <div className="page-stack"><PageIntro eyebrow="50 hoạt động" title="Exercise manager" description="Bài tập liên kết nhiều concept qua ExerciseConcept, có difficulty và version." illustration="code-challenge"/><div className="tabs">{["ALL", "MULTIPLE_CHOICE", "CODE_ORDER", "BUG_HUNTER"].map((item) => <button className={type === item ? "active" : ""} onClick={() => setType(item)} key={item}>{item}</button>)}</div><section className="surface-card student-table"><div className="table-head"><span>Code</span><span>Concept</span><span>Type</span><span>Difficulty</span><span>Attempts</span><span/></div>{rows.filter((row) => type === "ALL" || row.type === type).map((row) => <div className="table-row" key={row.code}><span><strong>{row.code}</strong></span><span>{row.concept}</span><span><StatusPill tone="purple">{row.type}</StatusPill></span><span><ProgressBar value={row.difficulty}/></span><span>{row.attempts}</span><span><button onClick={() => alert(`Mở editor ${row.code}`)}>Chỉnh sửa</button></span></div>)}</section></div>;
}

function CourseBuilder() {
  const modules = [{ title: "Khởi động", lessons: ["Biến và dữ liệu", "Toán tử", "Checkpoint 1"] }, { title: "Ra quyết định", lessons: ["if/else", "Bug Hunter"] }, { title: "Lặp thông minh", lessons: ["for", "range()", "while"] }, { title: "Dữ liệu & hàm", lessons: ["List & index", "Hàm cơ bản"] }];
  return <div className="page-stack"><PageIntro eyebrow="Course builder" title="Python cơ bản cho học sinh" description="Core learning platform dùng module, concept và prerequisite tổng quát." illustration="knowledge-graph"/><div className="course-builder">{modules.map((module, index) => <section key={module.title}><header><span>{index + 1}</span><div><strong>{module.title}</strong><small>{module.lessons.length} lesson</small></div><button aria-label={`Tùy chọn ${module.title}`}>•••</button></header>{module.lessons.map((lesson, lessonIndex) => <article key={lesson}><span>⠿</span><Asset type="icon" name={concepts[(index * 2 + lessonIndex) % concepts.length]?.icon ?? "concept-variable"} alt="" width={28} height={28}/><strong>{lesson}</strong><StatusPill tone={index < 2 ? "green" : "gray"}>{index < 2 ? "PUBLISHED" : "DRAFT"}</StatusPill><button onClick={() => alert(`Mở lesson ${lesson}`)}>Chỉnh</button></article>)}</section>)}</div></div>;
}

function LeaderboardSettings() {
  const [enabled, setEnabled] = useState(true);
  const [boards, setBoards] = useState({ xp: true, improved: true, consistent: true, recall: true });
  return <div className="page-stack"><PageIntro eyebrow="Gamification settings" title="Cạnh tranh tích cực và có quyền tắt" description="Không lộ email; dùng nickname và nhiều cách ghi nhận tiến bộ." illustration="leaderboard"/><section className="surface-card settings-card"><label className="toggle-row big"><span><strong>Bật leaderboard cho lớp</strong><small>Khi tắt, XP cá nhân và badge vẫn hoạt động.</small></span><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)}/></label><h2>Các bảng được hiển thị</h2>{Object.entries({ xp: "Tổng XP", improved: "Most improved", consistent: "Consistent learner", recall: "Recall master" }).map(([key, label]) => <label className="toggle-row" key={key}><span><strong>{label}</strong><small>{key === "xp" ? "Điểm hoạt động tích lũy" : "Đo theo thay đổi hoặc thói quen"}</small></span><input type="checkbox" disabled={!enabled} checked={boards[key as keyof typeof boards]} onChange={(event) => setBoards((current) => ({ ...current, [key]: event.target.checked }))}/></label>)}<button className="button primary" onClick={() => alert("Đã lưu leaderboard settings")}>Lưu cấu hình</button></section></div>;
}

function GenericTeacherPage({ eyebrow, title, description, illustration }: { eyebrow: string; title: string; description: string; illustration: string }) {
  return <div className="page-stack"><PageIntro eyebrow={eyebrow} title={title} description={description} illustration={illustration}/><section className="surface-card"><SectionHeading title="Workspace đã kết nối" description="Đi tiếp vào luồng evidence → generate → review → publish."/><div className="action-row"><Link href="/teacher/recommendations/latest" className="button ghost">Xem recommendation</Link><Link href="/teacher/studio" className="button primary">Mở content studio</Link></div></section></div>;
}
