"use client";

export interface CodeBlock {
  id: string;
  text: string;
}

export function PseudocodeWorkspace({
  value,
  onChange,
  disabled,
  guidance,
  starterText
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  guidance?: string;
  starterText?: string;
}) {
  return (
    <div className="pseudocode-workspace">
      <div className="formative-ai-note" role="note">
        <strong>AI đánh giá ý tưởng luyện tập</strong>
        <span>Không phạt cú pháp Python và không dùng kết quả này làm điểm chính thức.</span>
      </div>
      {guidance && <p className="practice-guidance">{guidance}</p>}
      <label className="practice-editor-label" htmlFor="pseudocode-answer">
        <span>Mô tả các bước giải của em</span>
        <textarea
          id="pseudocode-answer"
          disabled={disabled}
          maxLength={2000}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={starterText ?? "Ví dụ: Nhận dữ liệu → lặp qua từng phần tử → hiển thị kết quả"}
          spellCheck
        />
        <small className="practice-character-count" aria-live="polite">{value.length}/2.000 ký tự</small>
      </label>
    </div>
  );
}

export function CodeOrderWorkspace({
  blocks,
  order,
  onChange,
  disabled,
  guidance
}: {
  blocks: CodeBlock[];
  order: string[];
  onChange: (order: string[]) => void;
  disabled: boolean;
  guidance?: string;
}) {
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (disabled || target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };

  return (
    <div className="code-order-workspace">
      <div className="formative-ai-note deterministic" role="note">
        <strong>Ghép chương trình bằng khối code</strong>
        <span>Server kiểm tra thứ tự theo đáp án đã được giáo viên duyệt; không cần AI cho phần có đáp án xác định.</span>
      </div>
      {guidance && <p className="practice-guidance">{guidance}</p>}
      <ol className="code-block-list" aria-label="Các khối code theo thứ tự hiện tại">
        {order.map((id, index) => {
          const block = blockById.get(id);
          if (!block) return null;
          return (
            <li key={id}>
              <span className="code-block-position" aria-hidden="true">{index + 1}</span>
              <code>{block.text}</code>
              <span className="code-block-actions">
                <button
                  type="button"
                  className="button ghost small"
                  disabled={disabled || index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={`Đưa khối ${index + 1}: ${block.text} lên trên`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="button ghost small"
                  disabled={disabled || index === order.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`Đưa khối ${index + 1}: ${block.text} xuống dưới`}
                >
                  ↓
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="assembled-code-preview">
        <strong>Chương trình sau khi ghép</strong>
        <pre><code>{order.map((id) => blockById.get(id)?.text ?? "").join("\n")}</code></pre>
      </div>
    </div>
  );
}
