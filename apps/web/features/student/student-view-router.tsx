"use client";

import type { FinalAssessment, LessonSection } from "@edurecall/shared-types";
import Link from "next/link";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Asset } from "@/components/asset";
import { EmptyState, Metric, ProgressBar, SectionHeading, StatusPill } from "@/components/ui";
import { useDemo } from "@/features/demo/demo-context";
import { concepts, games, genericStudentPages, learners } from "@/lib/demo-data";
import { speakVietnamese, vietnameseSpeechMessage } from "@/lib/vietnamese-speech";
import { GamePlayer } from "./game-player";

export function StudentViewRouter({ path }: { path: string }) {
  if (path === "onboarding") return <GoalOnboarding />;
  if (path === "diagnostic") return <Diagnostic />;
  if (path === "diagnostic/result") return <DiagnosticResult />;
  if (path === "roadmap") return <Roadmap />;
  if (path === "course") return <CourseDetail />;
  if (path === "lesson") return <LessonPlayer />;
  if (path === "exercise") return <RangeExercise />;
  if (path === "reviews") return <DueReviews />;
  if (path === "micro-lesson") return <MicroLessonPlayer />;
  if (path === "games") return <GameCenter />;
  if (path.startsWith("games/")) return <GamePlayer slug={path.split("/")[1] ?? "range-runner"} />;
  if (path === "progress") return <ProgressPage />;
  if (path.startsWith("concepts/")) return <ConceptDetail code={path.split("/")[1] ?? "PYTHON_RANGE"} />;
  if (path === "achievements") return <Achievements />;
  if (path === "leaderboard") return <Leaderboard />;
  if (path === "profile") return <Profile />;
  const page = genericStudentPages[path] ?? genericStudentPages.course!;
  return <GenericStudentPage {...page} />;
}

function PageIntro({ eyebrow, title, description, illustration }: { eyebrow: string; title: string; description: string; illustration?: string }) {
  return (
    <header className="page-intro">
      <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      {illustration && <Asset type="illustration" name={`illustration-${illustration}`} alt="" width={230} height={150} />}
    </header>
  );
}

function GoalOnboarding() {
  const [goal, setGoal] = useState("mini-game");
  const [minutes, setMinutes] = useState(120);
  const [saved, setSaved] = useState(false);
  return (
    <div className="page-stack narrow">
      <PageIntro eyebrow="Thiết lập lộ trình" title="Sau 4 tuần, Minh muốn tạo gì?" description="Mục tiêu và quỹ thời gian là signal của recommendation engine." illustration="personalized-path" />
      <section className="surface-card onboarding-form">
        <h2>1. Chọn sản phẩm đích</h2>
        <div className="choice-grid three">
          {[["mini-game", "Mini game", "game-asset-05"], ["story", "Truyện tương tác", "game-asset-06"], ["quiz", "Quiz thông minh", "game-asset-07"]].map(([value, label, asset]) => (
            <button className={goal === value ? "choice-card selected" : "choice-card"} onClick={() => setGoal(value ?? "mini-game")} key={value}><Asset type="game" name={asset ?? "game-asset-05"} alt="" width={120} height={86} /><strong>{label}</strong><span>{goal === value ? "✓ Đã chọn" : "Chọn mục tiêu"}</span></button>
          ))}
        </div>
        <h2>2. Thời gian mỗi tuần</h2>
        <label className="range-field"><span><strong>{minutes} phút</strong><small>{Math.round(minutes / 4)} phút / buổi, 4 buổi</small></span><input aria-label="Số phút học mỗi tuần" type="range" min="60" max="240" step="30" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></label>
        <button className="button primary" onClick={() => setSaved(true)}>Tạo learning path</button>
        {saved && <div className="success-note"><Asset type="icon" name="ui-check" alt="" width={24} height={24} />Đã tạo lộ trình 4 tuần · {minutes} phút/tuần · mục tiêu {goal}. <Link href="/student/diagnostic">Làm diagnostic →</Link></div>}
      </section>
    </div>
  );
}

function Diagnostic() {
  const questions = [
    { concept: "Biến", question: "Sau `x = 3`, giá trị của x là gì?", code: "x = 3", options: ["3", "x", "0"], correct: 0 },
    { concept: "range()", question: "Dãy nào do range(1, 5) tạo ra?", code: "list(range(1, 5))", options: ["[1, 2, 3, 4]", "[1, 2, 3, 4, 5]", "[0, 1, 2, 3, 4]"], correct: 0 },
    { concept: "List", question: "Index của phần tử đầu tiên?", code: "colors = ['xanh', 'vàng']", options: ["0", "1", "-1"], correct: 0 }
  ];
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const current = questions[index];
  if (!current) return <DiagnosticResult score={answers.filter((answer, position) => answer === questions[position]?.correct).length} />;
  const choose = (answer: number) => {
    setAnswers((items) => [...items, answer]);
    setIndex((value) => value + 1);
  };
  return (
    <div className="page-stack narrow">
      <PageIntro eyebrow={`Diagnostic · ${index + 1}/${questions.length}`} title="Tìm điểm bắt đầu phù hợp" description="Kết quả chỉ dùng để tạo lộ trình, không phải điểm xếp loại." illustration="diagnostic" />
      <ProgressBar value={(index / questions.length) * 100} />
      <section className="question-card">
        <StatusPill tone="green">{current.concept}</StatusPill>
        <h2>{current.question}</h2>
        <pre><code>{current.code}</code></pre>
        <div className="answer-list">{current.options.map((option, optionIndex) => <button onClick={() => choose(optionIndex)} key={option}><span>{String.fromCharCode(65 + optionIndex)}</span><code>{option}</code></button>)}</div>
        <p className="privacy-caption"><Asset type="icon" name="ui-shield" alt="" width={18} height={18} /> Một câu sai không đủ để kết luận misconception.</p>
      </section>
    </div>
  );
}

function DiagnosticResult({ score = 2 }: { score?: number }) {
  return (
    <div className="page-stack narrow">
      <PageIntro eyebrow="Diagnostic hoàn tất" title="Minh đã có nền tảng tốt để bắt đầu" description={`${score}/3 câu đúng. Hệ thống đề xuất ưu tiên range() và while trước khi vào hàm.`} illustration="success" />
      <section className="surface-card result-grid">
        <div className="result-score"><span>Mastery đầu vào</span><strong>54%</strong><small>Không phải điểm số</small></div>
        <div className="result-bars"><ProgressBar label="Biến & dữ liệu" value={78} /><ProgressBar label="Điều kiện" value={63} color="blue" /><ProgressBar label="range()" value={42} color="orange" /><ProgressBar label="while" value={39} color="purple" /></div>
      </section>
      <div className="next-step-card"><Asset type="mascot" name="mam-guide" alt="Mầm chỉ đường" width={130} height={120} /><div><span className="eyebrow">Bước tiếp theo</span><h2>Lộ trình 4 tuần đã sẵn sàng</h2><p>Bắt đầu bằng nhiệm vụ ngắn để xác nhận điểm yếu range().</p></div><Link className="button primary" href="/student/roadmap">Mở learning path →</Link></div>
    </div>
  );
}

function Roadmap() {
  const demo = useDemo();
  return (
    <div className="page-stack">
      <PageIntro eyebrow="Personalized roadmap · v1" title="Đường đến mini game đầu tiên" description="Lộ trình cập nhật sau mỗi checkpoint nhưng không khóa học viên vào một nhánh duy nhất." illustration="personalized-path" />
      <div className="roadmap-layout">
        <section className="roadmap-map">
          <Asset type="background" name="background-roadmap" alt="" width={900} height={1000} className="map-bg" />
          {concepts.map((concept, index) => {
            const state = index < 4 ? "done" : index === 4 ? "current" : "locked";
            const mastery = concept.code === "PYTHON_RANGE" ? Math.round(demo.mastery * 100) : concept.mastery;
            return (
              <Link href={state === "locked" ? "/student/concepts/PYTHON_RANGE" : index === 4 ? "/student/exercise" : `/student/concepts/${concept.code}`} className={`roadmap-mission ${state} side-${index % 2}`} key={concept.code}>
                <span className="mission-index">{index + 1}</span><span className="mission-icon"><Asset type="icon" name={concept.icon} alt="" width={38} height={38} /></span><span className="mission-copy"><small>{state === "done" ? "HOÀN THÀNH" : state === "current" ? "NHIỆM VỤ HIỆN TẠI" : "CHƯA MỞ KHÓA"}</small><strong>{concept.title}</strong><em>{state === "locked" ? "Cần prerequisite" : `${mastery}% mastery`}</em></span>
              </Link>
            );
          })}
          <Asset type="mascot" name="mam-guide" alt="Mầm đứng cạnh nhiệm vụ hiện tại" width={130} height={120} className="map-mascot" />
        </section>
        <aside className="roadmap-legend"><h3>Vì sao range() là bước tiếp theo?</h3><ul><li><span className="dot green" />Mastery for đã đủ ngưỡng 55%</li><li><span className="dot yellow" />range chỉ ở {Math.round(demo.mastery * 100)}%</li><li><span className="dot red" />Stop included lặp lại 3 lần</li><li><span className="dot blue" />Còn 15 phút trong phiên học</li></ul><Link href="/student/exercise" className="button primary full">Bắt đầu nhiệm vụ</Link></aside>
      </div>
    </div>
  );
}

function CourseDetail() {
  return (
    <div className="page-stack">
      <PageIntro eyebrow="Khóa học đang tham gia" title="Python cơ bản cho học sinh" description="10 lesson · 50 exercise · 4 game · 12 giờ dự kiến" illustration="skill-mastery" />
      <div className="course-hero-card"><Asset type="cover" name="course-cover-01" alt="Bìa khóa Python" width={300} height={190} /><div><StatusPill tone="green">46% hoàn thành</StatusPill><h2>Tự viết mini game sau 4 tuần</h2><ProgressBar value={46} /><Link href="/student/lesson" className="button primary">Tiếp tục lesson 5 →</Link></div></div>
      <div className="module-list">{["Khởi động", "Ra quyết định", "Lặp thông minh", "Dữ liệu & hàm"].map((title, index) => <article key={title}><span>{index + 1}</span><div><strong>{title}</strong><small>{["3/3 lesson", "2/2 lesson", "1/3 lesson", "0/2 lesson"][index]}</small></div><ProgressBar value={[100, 100, 33, 0][index] ?? 0} /><Link href={index <= 2 ? "/student/lesson" : "/student/roadmap"}>{index <= 2 ? "Mở" : "Khóa"}</Link></article>)}</div>
    </div>
  );
}

function LessonPlayer() {
  const [step, setStep] = useState(0);
  const steps = [
    { title: "Vạch dừng", body: "Hãy tưởng tượng robot đi tới biển STOP. Biển báo là nơi dừng, không phải một ô được ghé.", code: "range(start, stop)" },
    { title: "Đọc dãy", body: "Bắt đầu ở 1, tăng 1 sau mỗi lượt và chỉ đi khi số hiện tại nhỏ hơn 5.", code: "list(range(1, 5))\n# [1, 2, 3, 4]" },
    { title: "Tự kiểm tra", body: "Giờ hãy làm một câu ngắn để hệ thống kiểm tra cách bạn hiểu stop.", code: "range(1, 5)" }
  ];
  const current = steps[step] ?? steps[0];
  return (
    <div className="lesson-layout">
      <aside className="lesson-sidebar"><Link href="/student/course">← Khóa học</Link><span className="eyebrow">Lesson 5/10</span><h2>Khám phá range()</h2>{steps.map((item, index) => <button className={index === step ? "active" : index < step ? "done" : ""} onClick={() => setStep(index)} key={item.title}><span>{index < step ? "✓" : index + 1}</span>{item.title}</button>)}</aside>
      <section className="lesson-stage"><div className="lesson-visual"><Asset type="illustration" name="illustration-code-challenge" alt="Robot đi qua dãy số" width={560} height={300} /></div><span className="eyebrow">{step + 1} · Khái niệm</span><h1>{current?.title}</h1><p>{current?.body}</p><pre><code>{current?.code}</code></pre><div className="lesson-actions"><button className="button ghost" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>← Trước</button>{step < steps.length - 1 ? <button className="button primary" onClick={() => setStep((value) => value + 1)}>Tiếp tục →</button> : <Link className="button primary" href="/student/exercise">Làm bài tập →</Link>}</div></section>
    </div>
  );
}

function RangeExercise() {
  const demo = useDemo();
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const answers = ["1, 2, 3, 4", "1, 2, 3, 4, 5", "0, 1, 2, 3, 4"];
  const check = async () => {
    if (selected === null) return;
    setChecked(true);
    if (selected === 1) await demo.submitRangeMistake();
  };
  return (
    <div className="page-stack exercise-page">
      <div className="exercise-top"><Link href="/student/lesson">← Lesson range()</Link><ProgressBar value={72} /><span>8 / 11 XP</span></div>
      <section className="exercise-workspace">
        <div className="exercise-prompt">
          <StatusPill tone="purple">Predict Output</StatusPill>
          <h1>Đoạn code sẽ in ra dãy nào?</h1>
          <p>Đọc từng tham số của range trước khi chọn.</p>
          <pre className="code-window"><span className="window-dots">● ● ●</span><code>{"for number in range(1, 5):\n    print(number)"}</code></pre>
          <div className="answer-list large">
            {answers.map((answer, index) => {
              const state = checked ? (index === 0 ? "correct" : index === selected ? "incorrect" : "") : selected === index ? "selected" : "";
              return <button className={state} onClick={() => !checked && setSelected(index)} key={answer}><span>{String.fromCharCode(65 + index)}</span><code>{answer}</code>{state === "correct" && <em>Đáp án đúng</em>}{state === "incorrect" && <em>Đáp án của Minh</em>}</button>;
            })}
          </div>
          {!checked && <button className="button primary" disabled={selected === null || demo.busy} onClick={check}>{demo.busy ? "Đang phân tích..." : "Kiểm tra đáp án"}</button>}
        </div>
        <aside className="hint-panel"><Asset type="mascot" name={checked && selected === 1 ? "mam-error" : "mam-thinking"} alt="Mầm suy nghĩ" width={160} height={150} /><h3>Gợi ý</h3><p>Stop giống một biển báo. Robot dừng khi <code>number == 5</code>.</p><button onClick={() => setSelected(1)}>Demo lỗi “có cả số 5”</button></aside>
      </section>
      {checked && (
        <section className={selected === 0 ? "feedback-card correct" : "feedback-card incorrect"}>
          <Asset type="icon" name={selected === 0 ? "ui-check" : "ui-alert"} alt="" width={38} height={38} />
          <div><span className="eyebrow">{selected === 0 ? "Chính xác" : "Đã tìm thấy pattern"}</span><h2>{selected === 0 ? "Stop không thuộc dãy" : demo.analysis?.diagnosis.misconception_code ?? "RANGE_STOP_INCLUDED"}</h2><p>{selected === 0 ? "range(1, 5) dừng trước 5." : "Bạn đã đưa stop vào dãy. Đây là evidence phù hợp với rule đã đăng ký, không phải suy đoán của LLM."}</p>{demo.analysis && <div className="evidence-list">{demo.analysis.diagnosis.evidence.map((item) => <span key={item}>✓ {item}</span>)}</div>}</div>
          <Link className="button dark" href={selected === 0 ? "/student/roadmap" : "/student/reviews"}>{selected === 0 ? "Tiếp tục" : "Xem recommendation"} →</Link>
        </section>
      )}
    </div>
  );
}

function DueReviews() {
  const demo = useDemo();
  return (
    <div className="page-stack">
      <PageIntro eyebrow="Spaced review" title="Ôn đúng lúc, không ôn mọi thứ" description="Scheduler dùng retrievability và stability; recommendation chọn hoạt động phù hợp." illustration="spaced-review" />
      {demo.analysis ? (
        <div className="review-grid">
          <article className="review-card urgent"><div className="review-asset"><Asset type="illustration" name="illustration-micro-lesson" alt="Bài ôn range" width={240} height={150} /></div><div className="review-content"><div><StatusPill tone="red">Đến hạn hôm nay</StatusPill><StatusPill tone="purple">MICRO_LESSON</StatusPill></div><h2>Stop không thuộc range()</h2><p>{demo.analysis.recommendation.reasons.join(" · ")}</p><div className="review-signals"><span>Mastery <strong>{Math.round(demo.mastery * 100)}%</strong></span><span>Retrievability <strong>{Math.round(demo.analysis.retrievability * 100)}%</strong></span><span>Ước tính <strong>5 phút</strong></span></div>{demo.lesson?.status === "PUBLISHED" ? <Link className="button primary" href="/student/micro-lesson">Bắt đầu bài ôn →</Link> : <Link className="button dark" href="/teacher/studio">Nhờ teacher tạo bài ôn →</Link>}</div></article>
          <article className="review-card"><div className="review-asset"><Asset type="illustration" name="illustration-game-center" alt="Game luyện while" width={220} height={140} /></div><div className="review-content"><StatusPill tone="blue">Ngày mai</StatusPill><h2>Bug Hunter: vòng lặp while</h2><p>Một game 4 phút để kiểm tra biến điều kiện có được cập nhật.</p><Link className="button ghost" href="/student/games/bug-hunter">Xem game</Link></div></article>
        </div>
      ) : (
        <EmptyState illustration="review" title="Chưa có recommendation từ attempt mới" description="Làm câu range để tạo evidence, cập nhật mastery và lịch ôn thật." href="/student/exercise" action="Làm câu range()" />
      )}
    </div>
  );
}

function NumberSequence({ values }: { values: string[] }) {
  return <div className="number-sequence">{values.map((value, index) => <span className={value.includes("stop") || value === "5" ? "stop" : ""} style={{ animationDelay: `${index * 120}ms` }} key={`${value}-${index}`}>{value}</span>)}</div>;
}

function MicroLessonPlayer() {
  const demo = useDemo();
  return demo.lesson && demo.lesson.status === "PUBLISHED"
    ? <ThreePartPlayer />
    : <EmptyState illustration="review" title="Bài ôn chưa được xuất bản" description="Học sinh chỉ thấy nội dung PUBLISHED. Hãy chuyển sang teacher, tạo, chỉnh sửa, approve và publish." href="/teacher/studio" action="Mở Teacher studio" />;
}

// FEATURE-016 — every published lesson is played as three ordered parts.
function ThreePartPlayer() {
  const demo = useDemo();
  const lesson = demo.lesson!;
  const sections = deriveClientSections(lesson);
  const theory = sections.find((section) => section.type === "THEORY");
  const practice = sections.find((section) => section.type === "PRACTICE");
  const final = sections.find((section) => section.type === "FINAL_ASSESSMENT");

  const [part, setPart] = useState<"THEORY" | "PRACTICE" | "FINAL_ASSESSMENT">("THEORY");
  const [slide, setSlide] = useState(0);
  const [theoryDone, setTheoryDone] = useState(false);
  const [practiceDone, setPracticeDone] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<number | null>(null);
  const [quizResult, setQuizResult] = useState<{ correct: boolean; masteryAfter: number } | null>(null);
  const [finalAnswers, setFinalAnswers] = useState<Record<string, number>>({});
  const [finalResult, setFinalResult] = useState<FinalGrade | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [speechNotice, setSpeechNotice] = useState("");

  const status = (target: typeof part) => {
    if (target === "THEORY") return theoryDone ? "COMPLETED" : part === "THEORY" ? "IN_PROGRESS" : "NOT_STARTED";
    if (target === "PRACTICE") return practiceDone ? "COMPLETED" : !theoryDone ? "LOCKED" : part === "PRACTICE" ? "IN_PROGRESS" : "NOT_STARTED";
    return finalResult?.passed ? "COMPLETED" : finalResult ? "FAILED" : !practiceDone ? "LOCKED" : "IN_PROGRESS";
  };
  const lessonComplete = Boolean(finalResult?.passed) && theoryDone && practiceDone;

  const current = lesson.slides[slide];
  const speak = async () => {
    if (!current) return;
    setSpeaking(true);
    setSpeechNotice("Đang đọc bằng giọng tiếng Việt...");
    setSpeechNotice(vietnameseSpeechMessage(await speakVietnamese(current.narration)));
    setSpeaking(false);
  };
  const answerQuiz = async () => {
    if (selectedQuiz === null) return;
    setQuizResult(await demo.completeQuiz(selectedQuiz));
    setPracticeDone(true);
  };
  const submitFinal = () => {
    if (!final?.assessment) return;
    setFinalResult(gradeClientAssessment(final.assessment, finalAnswers));
  };

  const steps: Array<{ key: typeof part; label: string }> = [
    { key: "THEORY", label: "1. Lý thuyết" },
    { key: "PRACTICE", label: "2. Thực hành" },
    { key: "FINAL_ASSESSMENT", label: "3. Kiểm tra cuối bài" }
  ];

  return (
    <div className="micro-player">
      <header className="micro-header"><Link href="/student/reviews">← Bài ôn</Link><div><StatusPill tone="green">PUBLISHED</StatusPill><strong>{lesson.title}</strong></div><span>{lessonComplete ? "Đã hoàn thành" : "Đang học"}</span></header>

      <nav className="three-part-stepper" aria-label="Ba phần của bài học">
        {steps.map((step) => {
          const state = status(step.key);
          const locked = state === "LOCKED";
          return (
            <button
              key={step.key}
              className={`stepper-item ${part === step.key ? "active" : ""} ${state.toLowerCase()}`}
              disabled={locked}
              onClick={() => !locked && setPart(step.key)}
            >
              <strong>{step.label}</strong>
              <StatusPill tone={state === "COMPLETED" ? "green" : state === "FAILED" ? "red" : state === "LOCKED" ? "gray" : "yellow"}>
                {state === "COMPLETED" ? "Đã hoàn thành" : state === "FAILED" ? "Chưa đạt" : state === "LOCKED" ? "Đã khóa" : state === "IN_PROGRESS" ? "Đang học" : "Chưa bắt đầu"}
              </StatusPill>
            </button>
          );
        })}
      </nav>

      {part === "THEORY" && (
        <>
          <div className="micro-progress">{lesson.slides.map((item, index) => <button aria-label={`Mở slide ${index + 1}`} className={index <= slide ? "active" : ""} onClick={() => setSlide(index)} key={item.id} />)}</div>
          <section className="micro-stage">
            <div className="micro-visual"><Asset type="mascot" name={slide === 2 ? "mam-error" : slide === 3 ? "mam-celebrate" : "mam-code"} alt="Robot Mầm" width={210} height={190} />{current && <NumberSequence values={(current.animationData.values as string[] | undefined) ?? ["1", "2", "3", "4", "stop"]} />}</div>
            <article className="micro-copy">{current && <><span className="eyebrow">{current.type} · {current.animationTemplate}</span><h1>{current.title}</h1><p>{current.body}</p>{current.code && <pre><code>{current.code}</code></pre>}<button className="narration-button" disabled={speaking} onClick={speak}><Asset type="icon" name="media-audio" alt="" width={22} height={22} /> {speaking ? "Đang đọc..." : "Nghe tiếng Việt"}</button>{speechNotice && <small className="speech-notice" role="status">{speechNotice}</small>}</>}</article>
          </section>
          {theory?.resources?.some((resource) => resource.type === "VIDEO" || resource.type === "DOCUMENT") && (
            <section className="theory-resources"><span className="eyebrow">Tài nguyên lý thuyết</span>{theory.resources.filter((resource) => resource.type === "VIDEO" || resource.type === "DOCUMENT").map((resource) => <div className="resource-row" key={resource.id}><StatusPill tone="purple">{resource.type}</StatusPill><strong>{resource.title}</strong>{resource.durationSeconds ? <small>{resource.durationSeconds}s · không tự phát</small> : null}</div>)}</section>
          )}
          <div className="micro-actions">
            <button className="button ghost" disabled={slide === 0} onClick={() => setSlide((value) => value - 1)}>← Trước</button>
            {slide < lesson.slides.length - 1
              ? <button className="button primary" onClick={() => setSlide((value) => value + 1)}>Tiếp tục →</button>
              : <button className="button primary" onClick={() => { setTheoryDone(true); setPart("PRACTICE"); }}>Hoàn thành lý thuyết →</button>}
          </div>
        </>
      )}

      {part === "PRACTICE" && (
        <section id="quiz" className="micro-quiz">
          <span className="eyebrow">Thực hành</span>
          {(practice?.activities ?? []).filter((activity) => activity.type !== "MULTIPLE_CHOICE").map((activity) => (
            <div className="practice-activity" key={activity.id}><StatusPill tone="purple">{activity.type}</StatusPill><strong>{activity.title}</strong><p>{activity.instructions}</p>{activity.starterCode && <pre><code>{activity.starterCode}</code></pre>}{activity.solution && <details><summary>Lời giải</summary><pre><code>{activity.solution}</code></pre></details>}</div>
          ))}
          <h2>{lesson.quiz.question}</h2>
          <div className="answer-list">{lesson.quiz.options.map((option, index) => <button className={selectedQuiz === index ? "selected" : ""} disabled={Boolean(quizResult)} onClick={() => setSelectedQuiz(index)} key={option}><span>{String.fromCharCode(65 + index)}</span><code>{option}</code></button>)}</div>
          {!quizResult
            ? <button className="button primary" disabled={selectedQuiz === null || demo.busy} onClick={answerQuiz}>Kiểm tra & cập nhật mastery</button>
            : <div className={quizResult.correct ? "quiz-result correct" : "quiz-result incorrect"}><Asset type="mascot" name={quizResult.correct ? "mam-celebrate" : "mam-thinking"} alt="" width={110} height={100} /><div><h3>{quizResult.correct ? "Chính xác! +40 XP" : "Chưa đúng, xem lại rồi tiếp tục"}</h3><p>{lesson.quiz.explanation}</p><strong>Mastery {Math.round(demo.masteryBeforeReview * 100)}% → {Math.round(quizResult.masteryAfter * 100)}%</strong></div><button className="button primary" onClick={() => setPart("FINAL_ASSESSMENT")}>Vào kiểm tra cuối bài →</button></div>}
        </section>
      )}

      {part === "FINAL_ASSESSMENT" && final?.assessment && (
        <section className="final-assessment">
          <span className="eyebrow">Kiểm tra cuối bài · điểm đạt {Math.round(final.assessment.passingScore * 100)}%</span>
          {final.assessment.questions.map((question, index) => (
            <div className="assessment-question" key={question.id}>
              <strong>Câu {index + 1}. {question.prompt}</strong>
              {question.options
                ? <div className="answer-list">{question.options.map((option, optionIndex) => <button className={finalAnswers[question.id] === optionIndex ? "selected" : ""} disabled={Boolean(finalResult)} onClick={() => setFinalAnswers((current) => ({ ...current, [question.id]: optionIndex }))} key={option}><span>{String.fromCharCode(65 + optionIndex)}</span><code>{option}</code></button>)}</div>
                : <p className="assessment-open"><em>Câu tự luận ngắn — nộp để xem đáp án mẫu.</em></p>}
              {finalResult && <small className={finalResult.perQuestion[question.id] ? "correct" : "incorrect"}>{finalResult.perQuestion[question.id] ? "✓ Đúng" : "✕ Chưa đúng"} · {question.explanation}</small>}
            </div>
          ))}
          {!finalResult
            ? <button className="button primary" onClick={submitFinal}>Nộp bài kiểm tra</button>
            : (
              <div className={finalResult.passed ? "assessment-result passed" : "assessment-result failed"}>
                <h3>{finalResult.passed ? `Đạt! ${Math.round(finalResult.score * 100)}%` : `Chưa đạt · ${Math.round(finalResult.score * 100)}%`}</h3>
                <div className="skill-breakdown">{finalResult.skillResults.map((skill) => <div key={skill.conceptCode} className={skill.weak ? "weak" : "ok"}><strong>{skill.conceptCode}</strong><ProgressBar value={Math.round(skill.scoreRatio * 100)} color={skill.weak ? "orange" : "green"} /></div>)}</div>
                {finalResult.passed
                  ? <p className="success-note">Bài học đã hoàn thành. Mastery đã được cập nhật.</p>
                  : (
                    <div className="recommendation-block">
                      <strong>Đề xuất ôn tập theo kỹ năng yếu:</strong>
                      <ul>{finalResult.skillResults.filter((skill) => skill.weak).map((skill) => <li key={skill.conceptCode}>Ôn lại Lý thuyết và luyện thêm Thực hành cho <code>{skill.conceptCode}</code>.</li>)}</ul>
                      <div className="micro-actions"><button className="button ghost" onClick={() => setPart("THEORY")}>Học lại Lý thuyết</button><button className="button primary" onClick={() => { setFinalResult(null); setFinalAnswers({}); }}>Làm lại kiểm tra</button></div>
                    </div>
                  )}
              </div>
            )}
          {lessonComplete && <Link href="/student/progress" className="button ghost">Xem tiến bộ →</Link>}
        </section>
      )}
    </div>
  );
}

interface FinalGrade {
  passed: boolean;
  score: number;
  perQuestion: Record<string, boolean>;
  skillResults: Array<{ conceptCode: string; scoreRatio: number; weak: boolean }>;
}

function gradeClientAssessment(assessment: FinalAssessment, answers: Record<string, number>): FinalGrade {
  let earned = 0;
  let total = 0;
  const perQuestion: Record<string, boolean> = {};
  const skillTotals = new Map<string, { earned: number; total: number }>();
  for (const question of assessment.questions) {
    total += question.points;
    const bucket = skillTotals.get(question.conceptCode) ?? { earned: 0, total: 0 };
    bucket.total += question.points;
    const correct = typeof question.correctIndex === "number" && answers[question.id] === question.correctIndex;
    perQuestion[question.id] = correct;
    if (correct) {
      earned += question.points;
      bucket.earned += question.points;
    }
    skillTotals.set(question.conceptCode, bucket);
  }
  const score = total > 0 ? earned / total : 0;
  const skillResults = [...skillTotals.entries()].map(([conceptCode, value]) => {
    const scoreRatio = value.total > 0 ? value.earned / value.total : 0;
    return { conceptCode, scoreRatio, weak: scoreRatio < assessment.passingScore };
  });
  return { passed: score >= assessment.passingScore, score, perQuestion, skillResults };
}

/** Build a display-ready three-part structure from a lesson, deriving one from legacy slides/quiz when absent. */
function deriveClientSections(lesson: NonNullable<ReturnType<typeof useDemo>["lesson"]>): LessonSection[] {
  if (lesson.sections && lesson.sections.length > 0) return lesson.sections;
  return [
    { id: "theory", type: "THEORY" as const, title: "Lý thuyết", order: 1, isRequired: true, reviewStatus: "APPROVED" as const, resources: [] },
    { id: "practice", type: "PRACTICE" as const, title: "Thực hành", order: 2, isRequired: true, reviewStatus: "APPROVED" as const, activities: [] },
    {
      id: "final",
      type: "FINAL_ASSESSMENT" as const,
      title: "Kiểm tra cuối bài",
      order: 3,
      isRequired: true,
      reviewStatus: "APPROVED" as const,
      assessment: {
        id: "assessment-legacy",
        title: "Kiểm tra cuối bài",
        passingScore: 0.7,
        skillCoverage: [lesson.conceptCode],
        questions: [
          { id: "legacy-q1", type: "MULTIPLE_CHOICE" as const, conceptCode: lesson.conceptCode, prompt: lesson.quiz.question, options: lesson.quiz.options, correctIndex: lesson.quiz.correctIndex, points: 100, explanation: lesson.quiz.explanation }
        ]
      }
    }
  ];
}

function GameCenter() {
  return (
    <div className="page-stack">
      <PageIntro eyebrow="Học bằng nhiệm vụ" title="Game center" description="Mỗi game luyện một khái niệm và trả về learning event thật." illustration="game-center" />
      <div className="game-grid">{games.map((game, index) => <Link href={`/student/games/${game.slug}`} className={`game-card ${game.color}`} key={game.slug}><span className="game-level">Level {index + 1}</span><Asset type="game" name={game.asset} alt={game.title} width={260} height={170} /><h2>{game.title}</h2><p>{game.description}</p><span className="xp-reward">+{game.xp} XP <em>Chơi →</em></span></Link>)}</div>
    </div>
  );
}

function ProgressPage() {
  const demo = useDemo();
  const history = [
    { week: "W0", mastery: 31, retention: 42 },
    { week: "W1", mastery: 37, retention: 47 },
    { week: "W2", mastery: 43, retention: 52 },
    { week: "W3", mastery: 49, retention: 57 },
    { week: "W4", mastery: Math.round(54 + (demo.mastery - 0.42) * 40), retention: 66 }
  ];
  return (
    <div className="page-stack">
      <PageIntro eyebrow="4 tuần gần nhất" title="Tiến bộ không chỉ là tổng điểm" description="Theo dõi mastery, khả năng nhớ lại, consistency và sản phẩm đã tạo." illustration="progress" />
      <div className="metric-grid four"><Metric label="Mastery gain" value="+27%" note="Từ diagnostic" icon="learning-brain" /><Metric label="Recall accuracy" value="76%" note="+11% sau ôn" icon="learning-recall" tone="blue" /><Metric label="Thời gian học" value="237′" note="Mục tiêu 240′" icon="ui-clock" tone="purple" /><Metric label="Hoạt động" value="38" note="7 game session" icon="nav-game" tone="orange" /></div>
      <section className="surface-card chart-card"><SectionHeading eyebrow="Mastery & retention" title="Hiểu tốt hơn, nhớ lâu hơn" description="Hai đường đo hai hiện tượng khác nhau." /><div className="chart-wrap" aria-label="Biểu đồ mastery và retention"><ResponsiveContainer width="100%" height={320}><AreaChart data={history}><defs><linearGradient id="mastery" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4AAA64" stopOpacity={0.35}/><stop offset="95%" stopColor="#4AAA64" stopOpacity={0}/></linearGradient><linearGradient id="retention" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#72B9F2" stopOpacity={0.3}/><stop offset="95%" stopColor="#72B9F2" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#DCE8DF"/><XAxis dataKey="week"/><YAxis domain={[0, 100]}/><Tooltip/><Area type="monotone" dataKey="mastery" stroke="#348B4E" strokeWidth={3} fill="url(#mastery)"/><Area type="monotone" dataKey="retention" stroke="#4A9BDF" strokeWidth={3} fill="url(#retention)"/></AreaChart></ResponsiveContainer></div></section>
      {demo.quizCompleted && <div className="before-after"><Asset type="illustration" name="illustration-skill-mastery" alt="" width={250} height={170} /><div><span className="eyebrow">Review impact · range()</span><h2>{Math.round(demo.masteryBeforeReview * 100)}% <span>→</span> {Math.round(demo.mastery * 100)}%</h2><p>Interval tiếp theo tăng từ 1 ngày lên 5 ngày sau câu trả lời đúng.</p></div></div>}
    </div>
  );
}

function ConceptDetail({ code }: { code: string }) {
  const demo = useDemo();
  const concept = concepts.find((item) => item.code === code) ?? concepts[4];
  const mastery = concept.code === "PYTHON_RANGE" ? Math.round(demo.mastery * 100) : concept.mastery;
  const reasons = demo.analysis?.recommendation.reasons ?? ["Chưa có attempt mới để sinh recommendation", "Làm câu range để tạo evidence thật"];
  return (
    <div className="page-stack">
      <PageIntro eyebrow="Concept intelligence" title={concept.title} description="Tách riêng mức hiểu, khả năng nhớ và evidence của lỗi gần đây." illustration="skill-mastery" />
      <div className="concept-layout">
        <section className="surface-card concept-gauges"><div className="big-gauge" style={{ "--value": `${mastery * 3.6}deg` } as React.CSSProperties}><span><strong>{mastery}%</strong><small>mastery</small></span></div><div><ProgressBar label="Retrievability" value={(demo.analysis?.retrievability ?? 0.48) * 100} color="blue" /><ProgressBar label="Forgetting risk" value={(demo.analysis?.forgetting_risk ?? 0.52) * 100} color="orange" /><ProgressBar label="Next attempt" value={44} color="purple" /></div></section>
        <section className="surface-card evidence-panel"><SectionHeading eyebrow="Recommendation explainability" title="Vì sao hệ thống chọn bước này?" />{reasons.map((reason, index) => <div className="reason-row" key={reason}><span>{index + 1}</span><p>{reason}</p></div>)}<div className="model-note"><Asset type="icon" name="ai-evidence" alt="" width={28} height={28} /><div><strong>{demo.analysis?.diagnosis.rule_id ?? "Chưa có rule match"}</strong><small>{demo.analysis?.mode ?? "Chờ learning event"}</small></div></div></section>
      </div>
      <section className="surface-card"><SectionHeading eyebrow="Evidence" title={demo.analysis?.diagnosis.misconception_code ?? "Không kết luận từ bằng chứng yếu"} description="Rule chỉ match khi submitted sequence có stop còn expected sequence không có." />{demo.analysis ? <div className="evidence-code"><pre><code>submitted = [1, 2, 3, 4, 5]</code></pre><pre><code>expected = [1, 2, 3, 4]</code></pre><strong>confidence {Math.round(demo.analysis.diagnosis.confidence * 100)}%</strong></div> : <EmptyState illustration="activity" title="Chưa có evidence" description="Một attempt mới sẽ được lưu và phân tích có idempotency." href="/student/exercise" action="Tạo attempt" />}</section>
    </div>
  );
}

function Achievements() {
  const names = ["Mầm đầu tiên", "Chuỗi 7 ngày", "Thợ săn bug", "Range rider", "Recall master", "Bạn học tốt", "Tốc độ xanh", "Không bỏ cuộc", "Code order", "Nhà dự đoán", "Vạch dừng", "Loop hero", "List keeper", "Function maker", "Checkpoint", "Most improved", "Consistency", "Early bird", "Night learner", "Review ready", "Explorer", "Teacher pick", "Zero hint", "Pilot finisher"];
  return (
    <div className="page-stack"><PageIntro eyebrow="6/24 đã mở" title="Tủ thành tựu" description="Badge ghi nhận thói quen, tiến bộ và khả năng nhớ—không chỉ tổng XP." illustration="success" /><div className="achievement-grid">{names.map((name, index) => <article className={index >= 6 ? "locked" : ""} key={name}><Asset type="badge" name={`badge-${String(index + 1).padStart(2, "0")}`} alt={name} width={110} height={110} /><strong>{name}</strong><small>{index >= 6 ? "Chưa mở khóa" : `Nhận ngày ${12 + index}/07`}</small></article>)}</div></div>
  );
}

function Leaderboard() {
  const [tab, setTab] = useState<"xp" | "improved" | "recall">("improved");
  const sorted = [...learners].sort((left, right) => tab === "xp" ? right.xp - left.xp : tab === "improved" ? right.improvement - left.improvement : right.streak - left.streak);
  return (
    <div className="page-stack"><PageIntro eyebrow="Python Explorers" title="Cùng tiến bộ, không chỉ cùng đua điểm" description="Chỉ hiển thị nickname; giáo viên có thể tắt leaderboard." illustration="leaderboard" /><div className="tabs">{[["xp", "Tổng XP"], ["improved", "Most improved"], ["recall", "Recall master"]].map(([value, label]) => <button className={tab === value ? "active" : ""} onClick={() => setTab(value as typeof tab)} key={value}>{label}</button>)}</div><div className="leaderboard-layout"><div className="podium">{sorted.slice(0, 3).map((learner, index) => <div className={`place place-${index + 1}`} key={learner.id}><span>{index + 1}</span><Asset type="avatar" name={`avatar-${String(learners.indexOf(learner) + 1).padStart(2, "0")}`} alt={learner.nickname} width={80} height={80} /><strong>{learner.nickname}</strong><small>{tab === "xp" ? `${learner.xp} XP` : tab === "improved" ? `+${learner.improvement}%` : `${learner.streak} ngày`}</small></div>)}</div><div className="ranking-list">{sorted.slice(3, 12).map((learner, index) => <div className={learner.name === "Minh" ? "me" : ""} key={learner.id}><span>{index + 4}</span><img src={learner.avatar} alt=""/><strong>{learner.nickname}</strong><em>{tab === "xp" ? `${learner.xp} XP` : tab === "improved" ? `+${learner.improvement}%` : `${learner.streak} ngày`}</em></div>)}</div></div></div>
  );
}

function Profile() {
  const demo = useDemo();
  const [reduced, setReduced] = useState(false);
  return (
    <div className="page-stack"><PageIntro eyebrow="Hồ sơ học tập" title="Minh 🌱" description="Thông tin phục vụ personalization trong pilot synthetic." illustration="progress" /><div className="profile-layout"><section className="surface-card profile-card"><Asset type="avatar" name="avatar-01" alt="Minh" width={120} height={120}/><h2>Minh 🌱</h2><p>minh@edurecall.local</p><StatusPill tone="green">Synthetic learner</StatusPill><div><strong>{demo.xp}</strong><span>XP</span><strong>7</strong><span>streak</span></div></section><section className="surface-card settings-card"><h2>Mục tiêu & trải nghiệm</h2><label><span>Mục tiêu</span><input defaultValue="Tự viết một mini game Python sau 4 tuần" /></label><label><span>Thời gian mỗi tuần</span><select defaultValue="120"><option value="90">90 phút</option><option value="120">120 phút</option><option value="180">180 phút</option></select></label><label className="toggle-row"><span><strong>Giảm chuyển động</strong><small>Ưu tiên trải nghiệm ít animation</small></span><input type="checkbox" checked={reduced} onChange={(event) => setReduced(event.target.checked)} /></label><button className="button primary" onClick={() => alert("Đã lưu cài đặt demo")}>Lưu thay đổi</button></section></div></div>
  );
}

function GenericStudentPage({ eyebrow, title, description, illustration }: { eyebrow: string; title: string; description: string; illustration: string }) {
  return <div className="page-stack"><PageIntro eyebrow={eyebrow} title={title} description={description} illustration={illustration} /><section className="surface-card"><SectionHeading title="Hoạt động đang sẵn sàng" description="Trang này dùng dữ liệu ngoài component và liên kết tới luồng demo chính." /><div className="action-row"><Link href="/student/roadmap" className="button primary">Mở learning path</Link><Link href="/student/exercise" className="button ghost">Làm câu range()</Link></div></section></div>;
}
