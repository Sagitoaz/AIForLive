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
});
