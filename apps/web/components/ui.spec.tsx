import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar, StatusPill } from "./ui";

describe("design system primitives", () => {
  it("exposes progress to assistive technology", () => {
    render(<ProgressBar label="Mastery" value={58} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "58");
    expect(screen.getByText("Mastery")).toBeInTheDocument();
  });

  it("renders workflow status visibly", () => {
    render(<StatusPill tone="green">PUBLISHED</StatusPill>);
    expect(screen.getByText("PUBLISHED")).toHaveClass("status-pill", "green");
  });
});
