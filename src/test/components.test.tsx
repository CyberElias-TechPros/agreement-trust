import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { Logo } from "@/components/Logo";
import { Reveal } from "@/components/motion/Reveal";

describe("StatusBadge", () => {
  it("renders human labels for every contract status", () => {
    const { rerender } = render(<StatusBadge status="draft" />);
    expect(screen.getByText("Draft")).toBeInTheDocument();

    rerender(<StatusBadge status="in_progress" />);
    expect(screen.getByText("In Progress")).toBeInTheDocument();

    rerender(<StatusBadge status="approved" />);
    expect(screen.getByText("Approved")).toBeInTheDocument();

    rerender(<StatusBadge status="submitted" />);
    expect(screen.getByText("Submitted")).toBeInTheDocument();
  });

  it("renders the pulse variant without crashing", () => {
    render(<StatusBadge status="sent" pulse />);
    expect(screen.getByText("Sent")).toBeInTheDocument();
  });
});

describe("PriorityBadge", () => {
  it("renders known priorities", () => {
    const { rerender } = render(<PriorityBadge priority="critical" />);
    expect(screen.getByText("Critical")).toBeInTheDocument();
    rerender(<PriorityBadge priority="low" />);
    expect(screen.getByText("Low")).toBeInTheDocument();
  });

  it("returns nothing for unknown priorities", () => {
    const { container } = render(<PriorityBadge priority={undefined} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("Logo", () => {
  it("renders the brand wordmark", () => {
    render(<Logo />);
    expect(screen.getByText("Task")).toBeInTheDocument();
    expect(screen.getByText("Contract")).toBeInTheDocument();
  });
});

describe("Reveal", () => {
  it("renders children", () => {
    render(
      <Reveal>
        <p>content</p>
      </Reveal>
    );
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});
