import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CodeOrderWorkspace, PseudocodeWorkspace } from "./practice-workspaces";

describe("PseudocodeWorkspace", () => {
  it("explains formative idea grading and accepts syntax-free steps", () => {
    const onChange = vi.fn();
    render(<PseudocodeWorkspace value="" onChange={onChange} disabled={false} />);

    expect(screen.getByText(/không phạt cú pháp/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/mô tả các bước giải/i), {
      target: { value: "nhận số; lặp đến khi đủ; in kết quả" }
    });
    expect(onChange).toHaveBeenCalledWith("nhận số; lặp đến khi đủ; in kết quả");
  });
});

describe("CodeOrderWorkspace", () => {
  it("supports keyboard-accessible move controls and renders an assembled preview", () => {
    const onChange = vi.fn();
    const blocks = [
      { id: "second", text: "print(value)" },
      { id: "first", text: "value = 1" }
    ];
    render(<CodeOrderWorkspace blocks={blocks} order={["second", "first"]} onChange={onChange} disabled={false} />);

    fireEvent.click(screen.getByRole("button", { name: /đưa khối 1: print\(value\) xuống dưới/i }));
    expect(onChange).toHaveBeenCalledWith(["first", "second"]);
    expect(screen.getByText(/chương trình sau khi ghép/i)).toBeInTheDocument();
  });
});
