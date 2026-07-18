import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoProvider } from "@/features/demo/demo-context";
import { StudentDashboard } from "./student-dashboard";
import { StudentViewRouter } from "./student-view-router";

describe("student experience", () => {
  it("renders the dashboard with personalized focus", () => {
    render(<DemoProvider><StudentDashboard /></DemoProvider>);
    expect(screen.getByText(/Chào Minh/)).toBeInTheDocument();
    expect(screen.getByText(/Hàm range/)).toBeInTheDocument();
    expect(screen.getByText(/Vì sao mình nhận đề xuất/)).toBeInTheDocument();
  });

  it("moves through diagnostic questions without a dead button", () => {
    render(<DemoProvider><StudentViewRouter path="diagnostic" /></DemoProvider>);
    expect(screen.getByText(/giá trị của x/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /3/ }));
    expect(screen.getByRole("heading", { name: "Dãy nào do range(1, 5) tạo ra?" })).toBeInTheDocument();
  });

  it("presents a realistic 12-lesson course and a three-phase lesson", () => {
    const { rerender } = render(<DemoProvider><StudentViewRouter path="course" /></DemoProvider>);
    expect(screen.getByText(/4 module · 12 bài · mỗi bài có 3 pha/)).toBeInTheDocument();
    expect(screen.getByText("Dự án: Trò chơi hỏi–đáp")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Xem lại" })).toHaveLength(7);

    rerender(<DemoProvider><StudentViewRouter path="lesson" /></DemoProvider>);
    expect(screen.getByText("Pha 1/3 · Lý thuyết")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nghe bài giảng/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "AI animation" }));
    expect(screen.getByRole("heading", { name: "Robot Mầm dừng trước số 5" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Thực hành, 29 phút/ }));
    expect(screen.getByText("Pha 2/3 · Thực hành")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kiểm tra và ghi learning event/ })).toBeInTheDocument();
  });

  it("lets a learner reopen every completed lesson without changing completion", () => {
    render(<DemoProvider><StudentViewRouter path="lessons/lesson-01" /></DemoProvider>);
    expect(screen.getByRole("heading", { name: "Ra lệnh cho máy tính" })).toBeInTheDocument();
    expect(screen.getByText(/lần xem lại không xóa kết quả cũ/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thực hành/ })).toBeInTheDocument();
  });
});
