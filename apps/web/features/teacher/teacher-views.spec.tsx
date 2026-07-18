import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DemoProvider } from "@/features/demo/demo-context";
import { TeacherViewRouter } from "./teacher-view-router";

describe("teacher experience", () => {
  beforeEach(() => window.localStorage.clear());

  it("requires recommendation evidence before generation", () => {
    render(<DemoProvider><TeacherViewRouter path="studio" /></DemoProvider>);
    expect(screen.getByText("Chưa có recommendation context")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tạo attempt/ })).toHaveAttribute("href", "/student/exercise");
  });

  it("renders a 20-learner class list", () => {
    render(<DemoProvider><TeacherViewRouter path="classes" /></DemoProvider>);
    expect(screen.getByText(/20 học viên/)).toBeInTheDocument();
    expect(screen.getByText("Minh 🌱")).toBeInTheDocument();
  });

  it("shows measured demo workflow time against the brief baseline", async () => {
    window.localStorage.setItem("edurecall-demo-v1", JSON.stringify({
      lesson: {
        id: "lesson-measured",
        status: "PUBLISHED",
        reuseCount: 0,
        generationMs: 1_250,
        teacherEditingSeconds: 9,
        workflowStartedAt: "2026-07-18T00:00:00.000Z"
      }
    }));

    render(<DemoProvider><TeacherViewRouter path="analytics" /></DemoProvider>);

    expect(await screen.findByText("10.3 giây")).toBeInTheDocument();
    expect(screen.getByText(/Brief nêu khoảng 40–50 giờ cho một bài học hoàn chỉnh/)).toBeInTheDocument();
    expect(screen.getByText(/hai số chưa tương đương/)).toBeInTheDocument();
    expect(screen.getByText(/phiên demo trên thiết bị hiện tại/)).toBeInTheDocument();
  });
});
