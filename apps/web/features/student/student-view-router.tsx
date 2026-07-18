"use client";

import Link from "next/link";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Asset } from "@/components/asset";
import { EmptyState, Metric, ProgressBar, SectionHeading, StatusPill } from "@/components/ui";
import { useDemo } from "@/features/demo/demo-context";
import { concepts, games, genericStudentPages, learners, pythonCourse } from "@/lib/demo-data";
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
              <Link href={state === "locked" ? "/student/concepts/PYTHON_RANGE" : index === 4 ? "/student/lesson" : `/student/concepts/${concept.code}`} className={`roadmap-mission ${state} side-${index % 2}`} key={concept.code}>
                <span className="mission-index">{index + 1}</span><span className="mission-icon"><Asset type="icon" name={concept.icon} alt="" width={38} height={38} /></span><span className="mission-copy"><small>{state === "done" ? "HOÀN THÀNH" : state === "current" ? "NHIỆM VỤ HIỆN TẠI" : "CHƯA MỞ KHÓA"}</small><strong>{concept.title}</strong><em>{state === "locked" ? "Cần prerequisite" : `${mastery}% mastery`}</em></span>
              </Link>
            );
          })}
          <Asset type="mascot" name="mam-guide" alt="Mầm đứng cạnh nhiệm vụ hiện tại" width={130} height={120} className="map-mascot" />
        </section>
        <aside className="roadmap-legend"><h3>Vì sao range() là bước tiếp theo?</h3><ul><li><span className="dot green" />Mastery for đã đủ ngưỡng 55%</li><li><span className="dot yellow" />range chỉ ở {Math.round(demo.mastery * 100)}%</li><li><span className="dot red" />Stop included lặp lại 3 lần</li><li><span className="dot blue" />Còn 15 phút trong phiên học</li></ul><Link href="/student/lesson" className="button primary full">Mở bài học 3 pha</Link></aside>
      </div>
    </div>
  );
}

function CourseDetail() {
  return (
    <div className="page-stack">
      <PageIntro eyebrow={pythonCourse.audience} title={pythonCourse.title} description={pythonCourse.description} illustration="skill-mastery" />
      <div className="course-hero-card realistic-course"><Asset type="cover" name="course-cover-01" alt="Bìa khóa Python" width={300} height={190} /><div><div className="course-meta"><StatusPill tone="green">Đang học · {pythonCourse.progress}%</StatusPill><span>{pythonCourse.duration}</span><span>{pythonCourse.cadence}</span></div><h2>Sản phẩm cuối: trò chơi hỏi–đáp bằng Python</h2><p>AI ưu tiên bài range() vì Minh đã đủ nền tảng for nhưng còn nhầm điểm dừng ở 3 lần gần đây.</p><ProgressBar value={pythonCourse.progress} /><Link href="/student/lesson" className="button primary">Học tiếp bài 8 · range() →</Link></div></div>
      <section className="surface-card course-outcomes"><SectionHeading eyebrow="Sau khóa học" title="Học để làm được, không chỉ xem hết video"/><div>{pythonCourse.outcomes.map((outcome) => <p key={outcome}><Asset type="icon" name="ui-check" alt="" width={20} height={20}/>{outcome}</p>)}</div></section>
      <section className="course-syllabus"><SectionHeading eyebrow="Chương trình học" title="4 module · 12 bài · mỗi bài có 3 pha"/><div className="syllabus-list">{pythonCourse.modules.map((module, moduleIndex) => <details open={moduleIndex === 2} key={module.id}><summary><span className="module-number">{moduleIndex + 1}</span><div><strong>{module.title}</strong><small>{module.description}</small></div><div className="module-progress"><span>{module.progress}%</span><ProgressBar value={module.progress}/></div></summary><div className="syllabus-lessons">{module.lessons.map((lesson, lessonIndex) => <article className={lesson.status.toLowerCase()} key={lesson.id}><span className="lesson-order">{moduleIndex * 3 + lessonIndex + 1}</span><div className="lesson-summary"><small>{lesson.durationMinutes} phút · {lesson.conceptCode}</small><strong>{lesson.title}</strong><p>{lesson.outcome}</p><div className="phase-chips">{lesson.phases.map((phase) => <span key={phase.phase}>{phase.title} · {phase.durationMinutes}p</span>)}</div></div><StatusPill tone={lesson.status === "COMPLETED" ? "green" : lesson.status === "CURRENT" ? "purple" : lesson.status === "AVAILABLE" ? "blue" : "gray"}>{lesson.status === "COMPLETED" ? "Đã xong" : lesson.status === "CURRENT" ? "Học tiếp" : lesson.status === "AVAILABLE" ? "Có thể học" : "Chưa mở"}</StatusPill>{lesson.status === "CURRENT" && <Link href="/student/lesson" className="button primary small">Mở bài</Link>}</article>)}</div></details>)}</div></section>
    </div>
  );
}

function LessonPlayer() {
  const demo = useDemo();
  const lesson = pythonCourse.modules[2].lessons[1];
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [theoryTab, setTheoryTab] = useState<"lecture" | "video" | "document">("lecture");
  const [practiceAnswer, setPracticeAnswer] = useState<number | null>(null);
  const [practiceChecked, setPracticeChecked] = useState(false);
  const [checkpointAnswers, setCheckpointAnswers] = useState<Record<number, number>>({});
  const [checkpointScore, setCheckpointScore] = useState<number | null>(null);
  const phases = lesson.phases;
  const current = phases[phaseIndex] ?? phases[0]!;
  const checkpointQuestions = [
    { prompt: "list(range(2, 6)) tạo dãy nào?", options: ["[2, 3, 4, 5]", "[2, 3, 4, 5, 6]", "[1, 2, 3, 4, 5]"], correct: 0 },
    { prompt: "Muốn in các số 1 đến 10, stop nên là bao nhiêu?", options: ["10", "11", "9"], correct: 1 },
    { prompt: "range(6, 1, -2) cho kết quả nào?", options: ["[6, 4, 2]", "[6, 4, 2, 1]", "[1, 3, 5]"], correct: 0 }
  ];
  const checkPractice = async () => {
    if (practiceAnswer === null) return;
    setPracticeChecked(true);
    if (practiceAnswer === 1) {
      await demo.submitRangeMistake();
    } else {
      await demo.submitLearningAttempt({
        activityId: "practice-range-predict-01",
        phase: "PRACTICE",
        isCorrect: practiceAnswer === 0,
        submittedAnswer: practiceAnswer === 0 ? "1, 2, 3, 4" : "0, 1, 2, 3, 4",
        expectedAnswer: "1, 2, 3, 4",
        difficulty: 0.45,
        responseTimeMs: 11_200,
        stopValue: 5
      });
    }
  };
  const submitCheckpoint = async () => {
    const score = checkpointQuestions.filter((question, index) => checkpointAnswers[index] === question.correct).length;
    setCheckpointScore(score);
    await demo.submitLearningAttempt({
      activityId: "checkpoint-range-01",
      phase: "CHECKPOINT",
      isCorrect: score >= 2,
      submittedAnswer: checkpointQuestions.map((_, index) => checkpointAnswers[index]).join(","),
      expectedAnswer: "0,1,0",
      difficulty: 0.65,
      responseTimeMs: 48_000,
      stopValue: 5
    });
  };
  return (
    <div className="lesson-layout">
      <aside className="lesson-sidebar"><Link href="/student/course">← Khóa học</Link><span className="eyebrow">Bài 8/12 · {lesson.durationMinutes} phút</span><h2>{lesson.title}</h2><p>{lesson.outcome}</p>{phases.map((phase, index) => <button aria-label={`${phase.title}, ${phase.durationMinutes} phút`} className={index === phaseIndex ? "active" : index < phaseIndex ? "done" : ""} onClick={() => setPhaseIndex(index)} key={phase.phase}><span>{index < phaseIndex ? "✓" : index + 1}</span><div><strong>{phase.title}</strong><small>{phase.durationMinutes} phút</small></div></button>)}</aside>
      <section className="lesson-stage three-phase-stage">
        <div className="phase-header"><div><span className="eyebrow">Pha {phaseIndex + 1}/3 · {current.title}</span><h1>{phaseIndex === 0 ? "Hiểu điểm dừng của range()" : phaseIndex === 1 ? "Thử, sai và sửa ngay trong code" : "Củng cố bằng tình huống mới"}</h1><p>{current.summary}</p></div><StatusPill tone={phaseIndex === 0 ? "blue" : phaseIndex === 1 ? "purple" : "green"}>{current.durationMinutes} phút</StatusPill></div>
        {phaseIndex === 0 && <div className="phase-content"><div className="resource-tabs">{(["lecture", "video", "document"] as const).map((tab) => <button className={theoryTab === tab ? "active" : ""} onClick={() => setTheoryTab(tab)} key={tab}>{tab === "lecture" ? "Bài giảng" : tab === "video" ? "Video 6 phút" : "Tài liệu đọc"}</button>)}</div>{theoryTab === "lecture" && <div className="theory-panel"><div className="lesson-visual"><Asset type="illustration" name="illustration-code-challenge" alt="Robot đi qua dãy số và dừng trước biển STOP" width={520} height={280}/></div><h2>Stop là vạch dừng, không phải điểm được ghé</h2><p><code>range(start, stop, step)</code> bắt đầu ở <strong>start</strong>, thay đổi theo <strong>step</strong> và dừng trước <strong>stop</strong>. Với step dương, giá trị chỉ được nhận khi còn nhỏ hơn stop.</p><pre><code>{"list(range(1, 5))\n# [1, 2, 3, 4]"}</code></pre><div className="concept-callout">Mẹo kiểm tra: viết thử 3 lượt đầu, hỏi “giá trị hiện tại đã chạm stop chưa?” rồi mới đoán cả dãy.</div></div>}{theoryTab === "video" && <div className="media-lesson"><Asset type="illustration" name="illustration-micro-lesson" alt="Minh họa video về range" width={360} height={220}/><div><StatusPill tone="blue">Video có phụ đề · 06:12</StatusPill><h2>Robot Mầm đi qua trạm số</h2><p>Video dừng ở ba mốc để học sinh tự dự đoán. Có bản chép lời tiếng Việt và điều khiển tốc độ.</p><button className="button dark">▶ Xem đoạn minh họa</button></div></div>}{theoryTab === "document" && <div className="document-card"><h2>Phiếu ghi nhớ range()</h2><p><strong>Cú pháp:</strong> range(start, stop, step)</p><ul><li>start được lấy; stop không được lấy.</li><li>step mặc định là 1 và không được bằng 0.</li><li>Với step âm, dãy giảm và vẫn dừng trước giới hạn.</li></ul><small>Nguồn đã kiểm chứng: Python handbook nội bộ · bản 1.3 · giáo viên Mai duyệt</small></div>}</div>}
        {phaseIndex === 1 && <div className="practice-lab"><div className="practice-brief"><StatusPill tone="purple">Predict output · mức 0.45</StatusPill><h2>Chương trình sẽ in gì?</h2><p>Đọc start và stop trước, sau đó theo vết từng lượt lặp.</p><pre className="code-window"><code>{"for n in range(1, 5):\n    print(n)"}</code></pre></div><div className="answer-list large">{["1, 2, 3, 4", "1, 2, 3, 4, 5", "0, 1, 2, 3, 4"].map((answer, index) => { const state = practiceChecked ? index === 0 ? "correct" : index === practiceAnswer ? "incorrect" : "" : practiceAnswer === index ? "selected" : ""; return <button className={state} disabled={practiceChecked} onClick={() => setPracticeAnswer(index)} key={answer}><span>{String.fromCharCode(65 + index)}</span><code>{answer}</code></button>; })}</div><button className="button primary" disabled={practiceAnswer === null || demo.busy || practiceChecked} onClick={checkPractice}>{demo.busy ? "AI đang cập nhật hồ sơ..." : "Kiểm tra và ghi learning event"}</button>{practiceChecked && <div className={practiceAnswer === 0 ? "feedback-inline correct" : "feedback-inline incorrect"}><strong>{practiceAnswer === 0 ? "Đúng — stop không thuộc dãy." : "Đã ghi nhận lỗi lệch điểm dừng."}</strong><p>{practiceAnswer === 0 ? "Tiếp tục với một bài có step khác 1." : "Hệ thống kết hợp attempt này với lịch sử; một lỗi đơn lẻ không tự động gắn nhãn học sinh."}</p>{demo.analysis && <small>Recommendation: {demo.analysis.recommendation.action} · ưu tiên {Math.round(demo.analysis.recommendation.priority_score * 100)}%</small>}</div>}</div>}
        {phaseIndex === 2 && <div className="checkpoint-panel"><div className="checkpoint-note"><Asset type="icon" name="ai-evidence" alt="" width={28} height={28}/><p><strong>Kiểm tra theo kỹ năng, không chỉ tính tổng điểm.</strong> Kết quả cập nhật mastery của range(), mức độ tự tin và bài tiếp theo được đề xuất.</p></div>{checkpointQuestions.map((question, questionIndex) => <fieldset disabled={checkpointScore !== null} key={question.prompt}><legend>{questionIndex + 1}. {question.prompt}</legend>{question.options.map((option, optionIndex) => <label key={option}><input type="radio" name={`checkpoint-${questionIndex}`} checked={checkpointAnswers[questionIndex] === optionIndex} onChange={() => setCheckpointAnswers((currentAnswers) => ({ ...currentAnswers, [questionIndex]: optionIndex }))}/><code>{option}</code></label>)}</fieldset>)}<button className="button primary" disabled={Object.keys(checkpointAnswers).length < checkpointQuestions.length || checkpointScore !== null || demo.busy} onClick={submitCheckpoint}>Nộp kiểm tra cuối bài</button>{checkpointScore !== null && <div className={checkpointScore >= 2 ? "checkpoint-result pass" : "checkpoint-result retry"}><div><span>Kết quả</span><strong>{checkpointScore}/3</strong></div><div><h2>{checkpointScore >= 2 ? "Đã củng cố kiến thức cốt lõi" : "Cần một vòng hỗ trợ ngắn"}</h2><p>{checkpointScore >= 2 ? "AI đề xuất mở bài while, đồng thời hẹn ôn range() sau 5 ngày." : "AI đề xuất bài bổ trợ 5 phút về stop, sau đó làm lại một câu tương đương—không bắt học lại toàn bộ bài."}</p>{demo.analysis && <p className="recommendation-log">Log: {demo.analysis.recommendation.reasons.join(" · ")}</p>}</div></div>}</div>}
        <div className="lesson-actions"><button className="button ghost" disabled={phaseIndex === 0} onClick={() => setPhaseIndex((value) => Math.max(0, value - 1))}>← Pha trước</button>{phaseIndex < phases.length - 1 ? <button className="button primary" onClick={() => setPhaseIndex((value) => value + 1)}>Sang {phases[phaseIndex + 1]?.title} →</button> : <Link className="button ghost" href="/student/course">Về khóa học</Link>}</div>
      </section>
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
          <article className="review-card urgent"><div className="review-asset"><Asset type="illustration" name="illustration-micro-lesson" alt="Bài ôn range" width={240} height={150} /></div><div className="review-content"><div><StatusPill tone="red">Đến hạn hôm nay</StatusPill><StatusPill tone="purple">{demo.analysis.recommendation.action}</StatusPill></div><h2>{demo.analysis.recommendation.target?.title ?? "Stop không thuộc range()"}</h2><p>{demo.analysis.recommendation.reasons.join(" · ")}</p><div className="review-signals"><span>Mastery <strong>{Math.round(demo.mastery * 100)}%</strong></span><span>Retrievability <strong>{Math.round(demo.analysis.retrievability * 100)}%</strong></span><span>Ước tính <strong>{demo.analysis.recommendation.target?.estimated_minutes ?? 5} phút</strong></span></div><small>Đích cụ thể: {demo.analysis.recommendation.target?.id ?? "python_range-range_stop_included-v1"} · {demo.analysis.recommendation.target?.phase ?? "THEORY"}</small>{demo.lesson?.status === "PUBLISHED" ? <Link className="button primary" href="/student/micro-lesson">Bắt đầu bài ôn →</Link> : <Link className="button dark" href="/teacher/studio">Nhờ teacher tạo bài ôn →</Link>}</div></article>
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
  const [slide, setSlide] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; masteryAfter: number } | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [speechNotice, setSpeechNotice] = useState("");
  if (!demo.lesson || demo.lesson.status !== "PUBLISHED") {
    return <EmptyState illustration="review" title="Bài ôn chưa được xuất bản" description="Học sinh chỉ thấy nội dung PUBLISHED. Hãy chuyển sang teacher, tạo, chỉnh sửa, approve và publish." href="/teacher/studio" action="Mở Teacher studio" />;
  }
  const current = demo.lesson.slides[slide];
  const speak = async () => {
    if (!current) return;
    setSpeaking(true);
    setSpeechNotice("Đang đọc bằng giọng tiếng Việt...");
    const speechResult = await speakVietnamese(current.narration);
    setSpeechNotice(vietnameseSpeechMessage(speechResult));
    setSpeaking(false);
  };
  const answer = async () => {
    if (selected === null) return;
    setResult(await demo.completeQuiz(selected));
  };
  return (
    <div className="micro-player">
      <header className="micro-header"><Link href="/student/reviews">← Bài ôn</Link><div><StatusPill tone="green">PUBLISHED</StatusPill><strong>{demo.lesson.title}</strong></div><span>{slide + 1}/{demo.lesson.slides.length}</span></header>
      <div className="micro-progress">{demo.lesson.slides.map((item, index) => <button aria-label={`Mở slide ${index + 1}`} className={index <= slide ? "active" : ""} onClick={() => setSlide(index)} key={item.id} />)}</div>
      <section className="micro-stage">
        <div className="micro-visual"><Asset type="mascot" name={slide === 2 ? "mam-error" : slide === 3 ? "mam-celebrate" : "mam-code"} alt="Robot Mầm" width={210} height={190} />{current && <NumberSequence values={(current.animationData.values as string[] | undefined) ?? ["1", "2", "3", "4", "stop"]} />}</div>
        <article className="micro-copy">{current && <><span className="eyebrow">{current.type} · {current.animationTemplate}</span><h1>{current.title}</h1><p>{current.body}</p>{current.code && <pre><code>{current.code}</code></pre>}<button className="narration-button" disabled={speaking} onClick={speak}><Asset type="icon" name="media-audio" alt="" width={22} height={22} /> {speaking ? "Đang đọc..." : "Nghe tiếng Việt"}</button>{speechNotice && <small className="speech-notice" role="status">{speechNotice}</small>}</>}</article>
      </section>
      <div className="micro-actions"><button className="button ghost" disabled={slide === 0} onClick={() => setSlide((value) => value - 1)}>← Trước</button>{slide < demo.lesson.slides.length - 1 ? <button className="button primary" onClick={() => setSlide((value) => value + 1)}>Tiếp tục →</button> : <a className="button primary" href="#quiz">Làm quiz →</a>}</div>
      <section id="quiz" className="micro-quiz"><span className="eyebrow">Checkpoint</span><h2>{demo.lesson.quiz.question}</h2><div className="answer-list">{demo.lesson.quiz.options.map((option, index) => <button className={selected === index ? "selected" : ""} disabled={Boolean(result)} onClick={() => setSelected(index)} key={option}><span>{String.fromCharCode(65 + index)}</span><code>{option}</code></button>)}</div>{!result ? <button className="button primary" disabled={selected === null || demo.busy} onClick={answer}>Kiểm tra & cập nhật mastery</button> : <div className={result.correct ? "quiz-result correct" : "quiz-result incorrect"}><Asset type="mascot" name={result.correct ? "mam-celebrate" : "mam-thinking"} alt="" width={110} height={100} /><div><h3>{result.correct ? "Chính xác! +40 XP" : "Chưa đúng, hẹn ôn lại ngày mai"}</h3><p>{demo.lesson.quiz.explanation}</p><strong>Mastery {Math.round(demo.masteryBeforeReview * 100)}% → {Math.round(result.masteryAfter * 100)}%</strong></div><Link href="/student/progress" className="button ghost">Xem tiến bộ →</Link></div>}</section>
    </div>
  );
}

function GameCenter() {
  return (
    <div className="page-stack">
      <PageIntro eyebrow="Hoạt động thực hành" title="Phòng luyện kỹ năng" description="Các hình thức tương tác được gắn vào bài học như code, trắc nghiệm hay sửa lỗi; mỗi hoạt động đo một kỹ năng rõ ràng." illustration="game-center" />
      <div className="game-grid">{games.map((game, index) => <Link href={`/student/games/${game.slug}`} className={`game-card ${game.color}`} key={game.slug}><span className="game-level">Hoạt động {index + 1}</span><Asset type="game" name={game.asset} alt={game.title} width={260} height={170} /><h2>{game.title}</h2><p>{game.description}</p><span className="xp-reward">{index < 2 ? "Cơ bản" : "Vận dụng"} <em>Mở hoạt động →</em></span></Link>)}</div>
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
      <div className="metric-grid four"><Metric label="Mastery gain" value="+27%" note="Từ diagnostic" icon="learning-brain" /><Metric label="Recall accuracy" value="76%" note="+11% sau ôn" icon="learning-recall" tone="blue" /><Metric label="Thời gian học" value="237′" note="Mục tiêu 240′" icon="ui-clock" tone="purple" /><Metric label="Hoạt động" value="38" note="Code, quiz và sửa lỗi" icon="nav-review" tone="orange" /></div>
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
