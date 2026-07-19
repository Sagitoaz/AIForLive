"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Asset } from "./asset";

type AnimationValue = string | number | string[];

interface LearningAnimationProps {
  template?: string;
  data?: Record<string, unknown>;
  title?: string;
  compact?: boolean;
}

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function NumberSequence({ data }: { data: Record<string, unknown> }) {
  const start = Number(data.start ?? 1);
  const stop = Number(data.stop ?? 5);
  const provided = asList(data.values);
  const values = provided.length ? provided : Array.from({ length: Math.max(0, Math.min(8, stop - start)) }, (_, index) => String(start + index));
  return (
    <div className="animation-sequence" aria-label={`Dãy số dừng trước ${stop}`}>
      <Asset type="mascot" name="mam-code" alt="" width={62} height={62}/>
      {values.map((value, index) => <span className="animation-node" style={{ "--animation-index": index } as CSSProperties} key={`${value}-${index}`}>{value}</span>)}
      <span className="animation-node stop"><strong>{stop}</strong><small>STOP</small></span>
    </div>
  );
}

function VariableChange({ data }: { data: Record<string, unknown> }) {
  const variable = asText(data.variable ?? data.name, "x");
  const values = asList(data.values);
  const before = asText(data.before, values[0] ?? "0");
  const after = asText(data.after, values.at(-1) ?? "1");
  return <div className="animation-variable"><div><small>Trước</small><code>{variable} = {before}</code></div><span>→</span><div className="active"><small>Sau lệnh</small><code>{variable} = {after}</code></div></div>;
}

function FlowBranch({ data }: { data: Record<string, unknown> }) {
  const condition = asText(data.condition, "Điều kiện?");
  return <div className="animation-flow"><div className="decision">{condition}</div><div className="branch yes"><small>Đúng</small><strong>{asText(data.truePath ?? data.trueLabel ?? data.whenTrue, "Chạy nhánh if")}</strong></div><div className="branch no"><small>Sai</small><strong>{asText(data.falsePath ?? data.falseLabel ?? data.whenFalse, "Chạy nhánh else")}</strong></div></div>;
}

function ListIndex({ data }: { data: Record<string, unknown> }) {
  const supplied = asList(data.items ?? data.values);
  const values = supplied.length ? supplied : ["Táo", "Cam", "Ổi"];
  const selected = Number(data.activeIndex ?? data.index ?? 0);
  return <div className="animation-list">{values.map((value, index) => <div className={index === selected ? "selected" : ""} key={`${value}-${index}`}><small>[{index}]</small><strong>{value}</strong></div>)}</div>;
}

function FunctionFlow({ data }: { data: Record<string, unknown> }) {
  const steps = asList(data.steps);
  return <div className="animation-function"><div><small>Đầu vào</small><strong>{asText(data.input, "tham số")}</strong></div><span>→</span><div className="processor"><code>{asText(data.function ?? data.name, "hàm()")}</code><small>{steps.length ? steps.join(" → ") : asText(data.process, "xử lý")}</small></div><span>→</span><div><small>Kết quả</small><strong>{asText(data.output, "giá trị trả về")}</strong></div></div>;
}

function BugReveal({ data }: { data: Record<string, unknown> }) {
  return <div className="animation-bug"><div className="bug-line"><span>!</span><code>{asText(data.wrong ?? data.wrongLine ?? data.before, "Đoạn mã dễ nhầm")}</code></div><div className="fix-line"><span>✓</span><code>{asText(data.correct ?? data.fixedLine ?? data.after, "Cách viết đúng")}</code></div><p>{asText(data.explanation ?? data.message, "So sánh hai cách để tìm lỗi và sửa lại.")}</p></div>;
}

function GenericAnimation({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, value]) => ["string", "number"].includes(typeof value) || Array.isArray(value)).slice(0, 6) as Array<[string, AnimationValue]>;
  return <div className="animation-generic">{entries.length ? entries.map(([key, value], index) => <div style={{ "--animation-index": index } as CSSProperties} key={key}><small>{key}</small><strong>{Array.isArray(value) ? value.join(" → ") : value}</strong></div>) : <div><small>Minh họa</small><strong>Quan sát từng bước của đoạn mã</strong></div>}</div>;
}

export function LearningAnimation({ template = "CODE_HIGHLIGHT", data = {}, title, compact = false }: LearningAnimationProps) {
  const [run, setRun] = useState(0);
  const normalized = useMemo(() => template.toUpperCase(), [template]);
  const content = normalized === "NUMBER_SEQUENCE" || normalized === "LOOP_TIMELINE"
    ? <NumberSequence data={data}/>
    : normalized === "VARIABLE_CHANGE"
      ? <VariableChange data={data}/>
      : normalized === "FLOW_BRANCH"
        ? <FlowBranch data={data}/>
        : normalized === "LIST_INDEX"
          ? <ListIndex data={data}/>
          : normalized === "FUNCTION_FLOW"
            ? <FunctionFlow data={data}/>
            : normalized === "BUG_REVEAL"
              ? <BugReveal data={data}/>
              : <GenericAnimation data={data}/>;
  return (
    <section className={`learning-animation ${compact ? "compact" : ""}`} aria-label={title ?? "Minh họa tương tác"}>
      <header><div><small>MINH HỌA HTML · {normalized.replaceAll("_", " ")}</small>{title && <strong>{title}</strong>}</div><button type="button" onClick={() => setRun((value) => value + 1)}>↻ Chạy lại</button></header>
      <div className="learning-animation-stage" key={run}>{content}</div>
      <footer>AI tạo đặc tả nội dung; hệ thống dựng bằng HTML/CSS an toàn, không chạy mã JavaScript do AI sinh.</footer>
    </section>
  );
}
