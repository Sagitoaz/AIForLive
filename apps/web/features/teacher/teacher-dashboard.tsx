"use client";

import Link from "next/link";
import { Asset } from "@/components/asset";
import { Metric, ProgressBar, SectionHeading, StatusPill } from "@/components/ui";
import { useDemo } from "@/features/demo/demo-context";
import { concepts, learners } from "@/lib/demo-data";

export function TeacherDashboard() {
  const demo = useDemo();
  return (
    <div className="page-stack teacher-dashboard">
      <header className="teacher-welcome"><div><span className="eyebrow">Python Explorers · Cập nhật lúc 08:30</span><h1>Chào buổi sáng, Cô Mai.</h1><p>Lớp đang tiến bộ, nhưng có <strong>4 học viên</strong> cần hỗ trợ trước checkpoint.</p></div><div className="teacher-actions"><Link href="/teacher/studio" className="button primary"><Asset type="icon" name="ai-spark" alt="" width={20} height={20} /> Tạo nội dung AI</Link><Link href="/teacher/classes" className="button ghost">Mở lớp học</Link></div></header>
      <div className="metric-grid four"><Metric label="Mastery trung bình" value="58%" note="+6% tuần này" icon="learning-brain"/><Metric label="Hoạt động hôm nay" value="17/20" note="3 học viên chưa vào" icon="student-group" tone="blue"/><Metric label="Cần hỗ trợ" value="4" note="Dựa trên nhiều signal" icon="teacher-support" tone="orange"/><Metric label="Review queue" value={demo.lesson && demo.lesson.status !== "PUBLISHED" ? "1" : "0"} note="Teacher phải quyết định" icon="nav-review" tone="purple"/></div>
      <div className="teacher-grid-main">
        <section className="surface-card heatmap-preview"><SectionHeading eyebrow="Knowledge heatmap" title="Lớp đang mắc ở đâu?" description="20 học viên × 8 concept" action={<Link href="/teacher/heatmap" className="text-link">Mở heatmap →</Link>} /><div className="mini-heatmap"><div className="heatmap-head"><span>Học viên</span>{concepts.map((concept) => <Asset key={concept.code} type="icon" name={concept.icon} alt={concept.title} width={24} height={24}/>)}</div>{learners.slice(0, 7).map((learner, row) => <div className="heatmap-row" key={learner.id}><span><img src={learner.avatar} alt=""/>{learner.name}</span>{concepts.map((concept, column) => { const value = row === 0 && concept.code === "PYTHON_RANGE" ? Math.round(demo.mastery * 100) : 25 + ((row * 17 + column * 13) % 66); return <i title={`${concept.title}: ${value}%`} className={value < 45 ? "low" : value < 65 ? "mid" : "high"} key={concept.code}>{value}</i>; })}</div>)}</div><div className="heat-legend"><span><i className="low"/>Cần hỗ trợ</span><span><i className="mid"/>Đang phát triển</span><span><i className="high"/>Vững</span></div></section>
        <aside className="surface-card misconception-list"><SectionHeading eyebrow="Pattern nổi bật" title="Misconception" action={<Link href="/teacher/misconceptions" className="text-link">Tất cả →</Link>} />{[
          ["RANGE_STOP_INCLUDED", 7, 18, "red"], ["WHILE_VARIABLE_NOT_UPDATED", 5, 12, "orange"], ["LIST_INDEX_STARTS_AT_ONE", 4, 8, "yellow"]
        ].map(([code, students, attempts, tone]) => <Link href="/teacher/recommendations/latest" className="misconception-row" key={String(code)}><span className={`severity ${tone}`}/><div><strong>{code}</strong><small>{students} học viên · {attempts} attempt</small></div><em>→</em></Link>)}<Link href="/teacher/studio" className="reuse-callout"><Asset type="icon" name="ai-reuse" alt="" width={30} height={30}/><span><strong>Tái sử dụng thông minh</strong><small>1 micro-lesson đã duyệt phù hợp 4 học viên</small></span></Link></aside>
      </div>
      {demo.analysis && <section className="teacher-alert"><Asset type="illustration" name="illustration-teacher-review" alt="" width={220} height={145}/><div><StatusPill tone="red">Cần xem evidence</StatusPill><h2>Minh vừa lặp lại RANGE_STOP_INCLUDED</h2><p>Mastery {Math.round(demo.analysis.mastery_before * 100)}% → {Math.round(demo.analysis.mastery_after * 100)}% · confidence {Math.round(demo.analysis.diagnosis.confidence * 100)}% · {demo.analysis.mode}</p><div className="signal-chips">{demo.analysis.diagnosis.evidence.map((evidence) => <span key={evidence}>{evidence}</span>)}</div></div><Link className="button dark" href="/teacher/studio">Tạo micro-lesson →</Link></section>}
      <section><SectionHeading eyebrow="Học viên cần chú ý" title="Can thiệp đúng người, đúng lý do" description="Không gắn nhãn chỉ từ một lần sai." action={<Link href="/teacher/classes" className="text-link">Xem 20 học viên →</Link>} /><div className="student-attention-grid">{learners.filter((_, index) => index % 5 === 0).slice(0, 4).map((learner, index) => <article key={learner.id}><img src={learner.avatar} alt=""/><div><strong>{learner.name}</strong><small>Yếu: {learner.weak}</small><ProgressBar value={39 + index * 4}/></div><StatusPill tone={index === 0 ? "red" : "yellow"}>{index === 0 ? "High" : "Watch"}</StatusPill><Link href={`/teacher/students/${learner.id}`}>Chi tiết →</Link></article>)}</div></section>
    </div>
  );
}
