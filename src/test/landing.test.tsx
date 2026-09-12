import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Landing from "@/pages/Landing";
import Login from "@/pages/auth/Login";
import NotFound from "@/pages/NotFound";
import { AuthProvider } from "@/contexts/AuthContext";

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
}

describe("public experience smoke tests", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the landing page with its core sections", async () => {
    renderWithProviders(<Landing />);

    // Hero copy (words are animated individually — match the eyebrow + CTA instead)
    expect(screen.getByText("Delegation governance platform")).toBeInTheDocument();
    expect(screen.getAllByText("Start free").length).toBeGreaterThan(0);

    // The interactive agreement document
    expect(screen.getByText("Seal this agreement")).toBeInTheDocument();

    // Section headings
    expect(screen.getByText("Delegation fails", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("The product")).toBeInTheDocument();
    expect(screen.getByText("Capabilities")).toBeInTheDocument();
    expect(screen.getAllByText("Pricing").length).toBeGreaterThan(0);
    expect(screen.getByText("Questions")).toBeInTheDocument();
  });

  it("sealing the hero agreement updates the document state", async () => {
    renderWithProviders(<Landing />);
    const sealButton = screen.getByText("Seal this agreement");
    sealButton.click();
    expect(await screen.findByText("Sealed")).toBeInTheDocument();
    expect(screen.getByText("Seal another copy")).toBeInTheDocument();
  });

  it("renders the login page", () => {
    renderWithProviders(<Login />);
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByText("Explore the demo workspace")).toBeInTheDocument();
  });

  it("renders the 404 page", () => {
    renderWithProviders(<NotFound />);
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("Return to the ledger")).toBeInTheDocument();
  });
});
