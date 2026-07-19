"use client";

import { useEffect, useMemo, useState } from "react";
import { Asset } from "@/components/asset";
import { EmptyState, ProgressBar, SectionHeading, StatusPill } from "@/components/ui";
import {
  type CoursePlanBrief,
  type CoursePlanData,
  useProduct
} from "@/features/product/product-context";

type StudioView = "list" | "brief" | "editor";

function statusTone(status: CoursePlanData["status"]): "green" | "yellow" | "red" | "blue" | "purple" | "gray" {
  if (status === "PUBLISHED") return "green";
  if (status === "APPROVED") return "blue";
  if (status === "IN_REVIEW") return "purple";
  if (status === "REVISION_REQUIRED" || status === "REJECTED") return "red";
  if (status === "ARCHIVED") return "gray";
  return "yellow";
}

function statusLabel(status: CoursePlanData["status"]): string {
  return ({
    DRAFT: "Bản nháp",
    IN_REVIEW: "Đang chờ duyệt",
    REVISION_REQUIRED: "Cần chỉnh sửa",
    APPROVED: "Đã duyệt",
    PUBLISHED: "Đã xuất bản",
    REJECTED: "Đã từ chối",
    ARCHIVED: "Đã lưu trữ"
  } as Record<string, string>)[status] ?? status;
}

function phaseLabel(phase: string): string {
  if (phase === "THEORY") return "Lý thuyết";
  if (phase === "PRACTICE") return "Thực hành";
  if (phase === "CHECKPOINT") return "Kiểm tra";
  return phase;
}

function reviewActionLabel(action: string): string {
  return ({
    SUBMIT_REVIEW: "Gửi duyệt",
    REQUEST_REVISION: "Yêu cầu chỉnh sửa",
    APPROVE: "Phê duyệt",
    PUBLISH: "Phát hành",
    UPDATE: "Chỉnh sửa"
  } as Record<string, string>)[action] ?? action;
}

const planWorkflowStages = [
  { status: "DRAFT", label: "Bản nháp" },
  { status: "IN_REVIEW", label: "Chờ duyệt" },
  { status: "APPROVED", label: "Đã duyệt" },
  { status: "PUBLISHED", label: "Phát hành" }
] as const;

function PlanWorkflow({ status }: { status: CoursePlanData["status"] }) {
  const normalized = status === "REVISION_REQUIRED" ? "DRAFT" : status;
  const activeIndex = Math.max(0, planWorkflowStages.findIndex((item) => item.status === normalized));
  const nextAction = ({
    DRAFT: "Tiếp theo: kiểm tra thứ tự bài, lưu thay đổi rồi gửi duyệt.",
    REVISION_REQUIRED: "Tiếp theo: chỉnh bản kế hoạch theo phản hồi và gửi duyệt lại.",
    IN_REVIEW: "Tiếp theo: REVIEWER/OWNER không phải người tạo sẽ yêu cầu sửa hoặc phê duyệt.",
    APPROVED: "Tiếp theo: người kiểm duyệt phát hành đúng phiên bản đã duyệt; thao tác này chưa áp dụng vào lớp.",
    PUBLISHED: "Hoàn tất: đây là phiên bản kế hoạch đã phát hành, chưa thay đổi khóa học của học sinh."
  } as Record<string, string>)[status] ?? "Kiểm tra trạng thái trước khi tiếp tục.";
  return (
    <section className="workflow-guide" aria-label="Quy trình duyệt bản kế hoạch">
      <div className="workflow-steps">
        {planWorkflowStages.map((item, index) => (
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

function clonePlan(plan: CoursePlanData["planJson"]): CoursePlanData["planJson"] {
  return structuredClone(plan);
}

function refreshWeek(week: CoursePlanData["planJson"]["weeks"][number]) {
  week.estimatedMinutes = week.lessons.reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0);
  week.focus = week.lessons.length
    ? week.lessons.map((lesson) => lesson.title).join(" · ")
    : "Ôn tập, củng cố và hoàn thiện phần còn thiếu";
}

function PlanPreview({
  plan,
  editable,
  onPlanChange
}: {
  plan: CoursePlanData;
  editable: boolean;
  onPlanChange: (value: CoursePlanData["planJson"]) => void;
}) {
  const weeks = plan.planJson.weeks;
  const selectedCount = plan.planJson.explainability.selectedLessonIds.length;
  const moveLesson = (weekIndex: number, lessonIndex: number, direction: -1 | 1) => {
    const targetWeekIndex = weekIndex + direction;
    if (!editable || targetWeekIndex < 0 || targetWeekIndex >= weeks.length) return;
    const next = clonePlan(plan.planJson);
    const [lesson] = next.weeks[weekIndex]!.lessons.splice(lessonIndex, 1);
    if (!lesson) return;
    if (direction < 0) next.weeks[targetWeekIndex]!.lessons.push(lesson);
    else next.weeks[targetWeekIndex]!.lessons.unshift(lesson);
    refreshWeek(next.weeks[weekIndex]!);
    refreshWeek(next.weeks[targetWeekIndex]!);
    onPlanChange(next);
  };

  const removeLesson = (weekIndex: number, lessonIndex: number) => {
    if (!editable) return;
    const next = clonePlan(plan.planJson);
    const [removed] = next.weeks[weekIndex]!.lessons.splice(lessonIndex, 1);
    if (!removed) return;
    refreshWeek(next.weeks[weekIndex]!);
    next.estimatedMinutes = next.weeks.reduce((sum, week) => sum + week.estimatedMinutes, 0);
    next.explainability.selectedLessonIds = next.explainability.selectedLessonIds.filter((id) => id !== removed.lessonId);
    onPlanChange(next);
  };

  return (
    <div className="page-stack">
      <div className="analytics-grid">
        <section className="surface-card">
          <SectionHeading
            eyebrow={`v${plan.version} · ${plan.provider}`}
            title={plan.title}
            description={`${plan.gradeBand} · ${plan.durationWeeks} tuần · ${plan.modelVersion}`}
          />
          <div className="signal-chips">{plan.goals.map((goal) => <span key={goal}>{goal}</span>)}</div>
        </section>
        <section className="surface-card">
          <SectionHeading
            eyebrow="Lập kế hoạch có giải thích"
            title="Vì sao chọn tổ hợp này?"
            description="Điểm phù hợp, bài tiên quyết và độ phủ ba pha được lưu cùng bản nháp để giáo viên kiểm tra."
          />
          <div className="context-row"><span>Bài được chọn</span><strong>{selectedCount}</strong></div>
          <div className="context-row"><span>Bài ứng viên đã chấm</span><strong>{plan.planJson.explainability.candidateCount}</strong></div>
          <div className="context-row"><span>Lớp áp dụng</span><strong>{plan.class?.name ?? "Chưa gắn lớp"}</strong></div>
          <div className="context-row"><span>Thời gian tạo</span><strong>{plan.generationMs ?? "—"} ms</strong></div>
          <div className="context-row"><span>Trạng thái</span><StatusPill tone={statusTone(plan.status)}>{statusLabel(plan.status)}</StatusPill></div>
        </section>
      </div>

      {weeks.map((week, weekIndex) => (
        <section className="surface-card" key={week.week}>
          <SectionHeading
            eyebrow={`Tuần ${week.week} · ${week.estimatedMinutes} phút`}
            title={week.title}
            description={week.focus}
          />
          {week.lessons.length ? week.lessons.map((lesson, lessonIndex) => (
            <article className="context-row" key={lesson.lessonId}>
              <div>
                <strong>{lesson.title}</strong>
                <small>{lesson.moduleTitle} · {lesson.conceptCode}</small>
                <div className="signal-chips">
                  {Object.entries(lesson.phases).map(([phase, detail]) => (
                    <span key={phase}>{phaseLabel(phase)} · {detail.activityCount}</span>
                  ))}
                </div>
                {lesson.reasons.map((reason) => <small key={reason}>✓ {reason}</small>)}
              </div>
              <div>
                <ProgressBar label={`Độ phù hợp ${Math.round(lesson.selectionScore * 100)}%`} value={lesson.selectionScore * 100} />
                <strong>{lesson.estimatedMinutes} phút</strong>
                {editable && (
                  <div className="editor-actions">
                    <button className="button ghost small" disabled={weekIndex === 0} onClick={() => moveLesson(weekIndex, lessonIndex, -1)}>← Tuần trước</button>
                    <button className="button ghost small" disabled={weekIndex === weeks.length - 1} onClick={() => moveLesson(weekIndex, lessonIndex, 1)}>Tuần sau →</button>
                    <button className="button ghost small" onClick={() => removeLesson(weekIndex, lessonIndex)}>Bỏ khỏi plan</button>
                  </div>
                )}
              </div>
            </article>
          )) : <p>Tuần này dành cho ôn tập hoặc giáo viên có thể chuyển một bài vào đây.</p>}
        </section>
      ))}

      <section className="surface-card">
        <SectionHeading eyebrow="Nhật ký truy vết" title="Lịch sử chỉnh sửa và kiểm duyệt" />
        {plan.reviewHistory.length ? [...plan.reviewHistory].reverse().map((entry, index) => (
          <div className="context-row" key={`${entry.at}-${index}`}>
            <span>{new Date(entry.at).toLocaleString("vi-VN")} · {reviewActionLabel(entry.action)}</span>
            <strong>{statusLabel(entry.from as CoursePlanData["status"])} → {statusLabel(entry.to as CoursePlanData["status"])}</strong>
          </div>
      )) : <p>Chưa có thao tác kiểm duyệt; đây là bản nháp đầu tiên từ bộ lập kế hoạch catalog.</p>}
      </section>
    </div>
  );
}

function PlanLibrary({
  plans,
  busy,
  canCreate,
  onCreate,
  onOpen
}: {
  plans: CoursePlanData[];
  busy: boolean;
  canCreate: boolean;
  onCreate: () => void;
  onOpen: (id: string) => Promise<void>;
}) {
  const pending = plans.filter((item) => item.status !== "PUBLISHED");
  const published = plans.filter((item) => item.status === "PUBLISHED");
  const list = (items: CoursePlanData[], empty: string) => items.length ? items.map((item) => (
    <article className="misconception-row" key={item.id}>
      <span className={`severity ${item.status === "REVISION_REQUIRED" ? "red" : "yellow"}`} />
      <div>
        <strong>{item.title}</strong>
        <small>{item.class?.name ?? "Chưa gắn lớp"} · {item.durationWeeks} tuần · v{item.version}</small>
        <StatusPill tone={statusTone(item.status)}>{statusLabel(item.status)}</StatusPill>
      </div>
      <button className="button ghost small" disabled={busy} onClick={() => void onOpen(item.id)}>Mở</button>
    </article>
  )) : <p>{empty}</p>;

  return (
    <div className="analytics-grid">
      <section className="surface-card misconception-list">
        <SectionHeading
          eyebrow={`${pending.length} bản`}
          title="Bản nháp và hàng chờ duyệt"
          description="Bộ lập kế hoạch catalog tạo một phương án xác định; giáo viên vẫn quyết định nội dung cuối."
          action={<button className="button primary small" disabled={busy || !canCreate} onClick={onCreate}>Mô tả nhu cầu mới</button>}
        />
        {list(pending, "Chưa có kế hoạch khóa học đang chờ xử lý.")}
      </section>
      <section className="surface-card misconception-list">
        <SectionHeading eyebrow={`${published.length} bản`} title="Lộ trình đã xuất bản" description="Phiên bản đã được giáo viên kiểm duyệt." />
        {list(published, "Chưa có lộ trình đã xuất bản.")}
      </section>
    </div>
  );
}

export function CoursePlanStudio() {
  const product = useProduct();
  const [view, setView] = useState<StudioView>("list");
  const [goalText, setGoalText] = useState("Hoàn thành nền tảng Python và tự làm một sản phẩm nhỏ");
  const [brief, setBrief] = useState<CoursePlanBrief>({
    courseId: "",
    gradeBand: "Lớp 6–9",
    goals: ["Hoàn thành nền tảng Python và tự làm một sản phẩm nhỏ"],
    durationWeeks: 8
  });
  const [working, setWorking] = useState<CoursePlanData | null>(null);
  const selected = product.selectedCoursePlan;
  const classRoles = product.identity?.classRoles ?? [];
  const canAuthor = classRoles.includes("OWNER") || classRoles.includes("INSTRUCTOR");
  const canReview = classRoles.includes("OWNER") || classRoles.includes("REVIEWER");
  const isSelectedAuthor = Boolean(selected && product.identity?.id === selected.requestedBy.id);

  useEffect(() => {
    if (!product.course) return;
    setBrief((current) => ({
      ...current,
      courseId: current.courseId || product.course!.id,
      classId: current.classId || product.classData?.id,
      className: current.className || product.classData?.name,
      title: current.title || `Lộ trình ${product.course!.title}`,
      gradeBand: current.gradeBand === "Lớp 6–9" ? product.course!.audience : current.gradeBand
    }));
  }, [product.classData?.id, product.classData?.name, product.course]);

  useEffect(() => {
    if (!selected) return;
    setWorking(selected);
    setGoalText(selected.goals.join("\n"));
  }, [selected]);

  const draftGoals = useMemo(() => goalText.split("\n").map((item) => item.trim()).filter(Boolean), [goalText]);
  const dirty = useMemo(() => Boolean(
    working
    && selected
    && (JSON.stringify(working) !== JSON.stringify(selected) || JSON.stringify(draftGoals) !== JSON.stringify(selected.goals))
  ), [draftGoals, selected, working]);
  const editable = Boolean(canAuthor && working && ["DRAFT", "REVISION_REQUIRED", "APPROVED"].includes(working.status));

  const open = async (id: string) => {
    await product.selectCoursePlan(id);
    setView("editor");
  };

  const generate = async () => {
    await product.generateCoursePlan({ ...brief, goals: draftGoals });
    setView("editor");
  };

  const save = async () => {
    if (!working) return;
    await product.updateCoursePlan(working.id, {
      title: working.title,
      gradeBand: working.gradeBand,
      durationWeeks: working.durationWeeks,
      goals: draftGoals,
      planJson: working.planJson as unknown as Record<string, unknown>
    });
  };

  return (
    <div className="page-stack">
      <nav className="tabs" aria-label="Khu lập kế hoạch khóa học">
        <button className={view === "list" ? "active" : ""} disabled={product.busy} onClick={() => setView("list")}>1. Danh sách kế hoạch</button>
        <button className={view === "brief" ? "active" : ""} disabled={product.busy || !canAuthor} onClick={() => setView("brief")}>2. Mô tả nhu cầu lớp</button>
        <button className={view === "editor" ? "active" : ""} disabled={!working || product.busy} onClick={() => setView("editor")}>3. Biên tập & duyệt</button>
      </nav>

      <div className="provider-notice catalog-planner-notice">
        <Asset type="icon" name="ai-model" alt="" width={24} height={24} />
        <span>
          <strong>LOCAL_CATALOG_PLANNER · thuật toán xác định · 0 USD · không phải LLM</strong>
          <small>Bộ lập kế hoạch chấm danh mục, giữ bài tiên quyết và chia bài theo tuần. “Phát hành” chỉ lưu phiên bản kế hoạch đã duyệt; hiện chưa áp dụng hay ghi đè khóa học của lớp.</small>
        </span>
      </div>

      {product.error && <div className="provider-notice"><Asset type="icon" name="ui-alert" alt="" width={22} height={22} /><span><strong>Lỗi khi lập kế hoạch</strong><small>{product.error}</small></span></div>}

      {view === "list" && <PlanLibrary plans={product.coursePlans} busy={product.busy} canCreate={canAuthor} onCreate={() => setView("brief")} onOpen={open} />}

      {view === "brief" && (
        <section className="surface-card generation-form">
          <SectionHeading
            eyebrow="Bước 1 · nhu cầu lớp"
            title="Lập một phương án từ catalog hiện có"
            description="Bộ lập kế hoạch xác định chấm từng bài, bổ sung bài tiên quyết, chia tuần và lưu bản nháp kèm lý do lựa chọn."
          />
          <div className="studio-context-grid">
            <div>
              <label><span>Khóa học nguồn</span><select disabled value={brief.courseId}><option value={product.course?.id ?? ""}>{product.course?.title ?? "Đang tải khóa học"}</option></select></label>
              <label><span>Lớp pilot</span><select disabled value={brief.classId ?? ""}><option value={product.classData?.id ?? ""}>{product.classData?.name ?? "Đang tải lớp"}</option></select></label>
              <label><span>Tên lộ trình</span><input value={brief.title ?? ""} onChange={(event) => setBrief({ ...brief, title: event.target.value })} /></label>
            </div>
            <div>
              <label><span>Khối lớp</span><input value={brief.gradeBand} onChange={(event) => setBrief({ ...brief, gradeBand: event.target.value })} /></label>
              <label><span>Số tuần</span><input type="number" min={1} max={24} value={brief.durationWeeks} onChange={(event) => setBrief({ ...brief, durationWeeks: Number(event.target.value) })} /></label>
              <label><span>Mục tiêu · mỗi dòng một mục tiêu</span><textarea value={goalText} onChange={(event) => setGoalText(event.target.value)} /></label>
            </div>
          </div>
          <div className="draft-phase-preview">
            {["Đọc nhu cầu lớp", "Chấm các bài ứng viên", "Giữ bài tiên quyết", "Lưu bản nháp để duyệt"].map((item, index) => <div key={item}><span>{index + 1}</span><strong>{item}</strong><small>{index === 3 ? "Giáo viên quyết định" : "Có log giải thích"}</small></div>)}
          </div>
          <button className="button primary" disabled={product.busy || !brief.courseId || !brief.gradeBand.trim() || !goalText.trim()} onClick={() => void generate()}>{product.busy ? product.operation ?? "Đang lập kế hoạch…" : "Lập và lưu bản nháp kế hoạch"}</button>
        </section>
      )}

      {view === "editor" && working && (
        <div className="page-stack">
          <PlanWorkflow status={working.status} />
          <section className="surface-card generation-form">
            <SectionHeading
              eyebrow="Bước 2 · giáo viên chỉnh sửa"
              title="Chỉnh kế hoạch và quyết định trạng thái"
              description={working.status === "APPROVED" ? "Bản đã duyệt vẫn sửa được; khi lưu sẽ trở về REVISION_REQUIRED để không bỏ qua vòng kiểm duyệt." : "Tên, mục tiêu, thời lượng và phân bổ bài đều có thể sửa trước khi xuất bản."}
            />
            <div className="studio-context-grid">
              <div>
                <label><span>Tên lộ trình</span><input disabled={!editable} value={working.title} onChange={(event) => setWorking({ ...working, title: event.target.value })} /></label>
                <label><span>Khối lớp</span><input disabled={!editable} value={working.gradeBand} onChange={(event) => setWorking({ ...working, gradeBand: event.target.value })} /></label>
              </div>
              <div>
                <label><span>Số tuần</span><input disabled={!editable} type="number" min={1} max={24} value={working.durationWeeks} onChange={(event) => setWorking({ ...working, durationWeeks: Number(event.target.value) })} /></label>
                <label><span>Mục tiêu · mỗi dòng một mục tiêu</span><textarea disabled={!editable} value={goalText} onChange={(event) => setGoalText(event.target.value)} /></label>
              </div>
            </div>
            <div className="editor-actions">
              {editable && <button className="button ghost" disabled={product.busy || !dirty} onClick={() => void save()}>{working.status === "APPROVED" ? "Lưu thành revision" : "Lưu thay đổi"}</button>}
              {canAuthor && (working.status === "DRAFT" || working.status === "REVISION_REQUIRED") && <button className="button primary" disabled={product.busy || dirty} onClick={() => void product.transitionCoursePlan("submit-review")}>Gửi duyệt</button>}
              {canReview && !isSelectedAuthor && working.status === "IN_REVIEW" && <button className="button ghost" disabled={product.busy} onClick={() => void product.transitionCoursePlan("request-revision")}>Yêu cầu sửa</button>}
              {canReview && !isSelectedAuthor && working.status === "IN_REVIEW" && <button className="button primary" disabled={product.busy} onClick={() => void product.transitionCoursePlan("approve")}>Phê duyệt</button>}
              {canReview && !isSelectedAuthor && working.status === "APPROVED" && !dirty && <button className="button primary" disabled={product.busy} onClick={() => void product.transitionCoursePlan("publish")}>Phát hành bản kế hoạch</button>}
            </div>
            {isSelectedAuthor && (working.status === "IN_REVIEW" || working.status === "APPROVED") && (
              <div className="analytics-note plan-application-note"><p>Bạn là người tạo bản này. Hãy đăng nhập Cô Linh (REVIEWER) để kiểm duyệt độc lập và phát hành.</p></div>
            )}
            <div className="analytics-note plan-application-note"><p>Phát hành chỉ khóa và lưu phiên bản kế hoạch đã duyệt. Chức năng này chưa thay đổi thứ tự bài trong khóa học mà học sinh đang học.</p></div>
          </section>
          <PlanPreview
            plan={working}
            editable={editable}
            onPlanChange={(planJson) => setWorking({ ...working, planJson })}
          />
        </div>
      )}

      {view === "editor" && !working && <EmptyState illustration="review" title="Chưa chọn kế hoạch khóa học" description="Mở một bản nháp hoặc nhập nhu cầu lớp để bộ lập kế hoạch xác định tạo bản mới." />}
    </div>
  );
}
