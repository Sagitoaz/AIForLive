import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LearningAnimation } from "./learning-animation";

describe("registered lesson animations", () => {
  it("renders the registered if/else branch labels", () => {
    render(<LearningAnimation template="FLOW_BRANCH" data={{ condition: "điểm >= 5?", truePath: "Đạt", falsePath: "Luyện thêm" }} />);
    expect(screen.getByText("Đạt")).toBeInTheDocument();
    expect(screen.getByText("Luyện thêm")).toBeInTheDocument();
  });

  it("renders the registered list keys and selected index", () => {
    render(<LearningAnimation template="LIST_INDEX" data={{ items: ["Táo", "Cam", "Ổi"], activeIndex: 1 }} />);
    expect(screen.getByText("Cam").parentElement).toHaveClass("selected");
  });

  it("renders the registered function steps", () => {
    render(<LearningAnimation template="FUNCTION_FLOW" data={{ input: "3", steps: ["nhận x", "x × 2", "return"], output: "6" }} />);
    expect(screen.getByText("nhận x → x × 2 → return")).toBeInTheDocument();
  });
});
