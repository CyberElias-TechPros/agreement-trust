import { describe, it, expect, beforeEach } from "vitest";
import { resetDemo, computeAnalytics, getDb } from "@/lib/demo/demoDb";
import { demoApi } from "@/lib/demo/demoApi";

/**
 * Integration tests for the demo adapter — the exact code path the UI uses
 * when the backend is unreachable (or VITE_DEMO_MODE is on).
 */
describe("demoApi — end-to-end user flow", () => {
  beforeEach(() => {
    resetDemo();
  });

  it("signs in as the seeded demo user and loads their organizations", async () => {
    const login = await demoApi.login("alex.morgan@northwind.studio", "demo1234");
    expect(login.user.email).toBe("alex.morgan@northwind.studio");
    // password hash must never leak through the API
    expect((login.user as Record<string, unknown>).password).toBeUndefined();
    expect(login.organizations.map((o) => o.name)).toContain("Northwind Studio");

    const orgs = await demoApi.getOrganizations();
    expect(orgs.organizations.length).toBeGreaterThan(0);
  });

  it("rejects wrong credentials", async () => {
    await expect(demoApi.login("alex.morgan@northwind.studio", "nope")).rejects.toThrow("Invalid credentials");
  });

  it("runs a full contract lifecycle and analytics reflects it", async () => {
    await demoApi.login("alex.morgan@northwind.studio", "demo1234");
    const orgId = "org1";

    // Draft a contract
    const created = await demoApi.createContract(orgId, {
      title: "Integration Test Contract",
      description: "Verifies the lifecycle end to end.",
      priority: "high",
      executorId: "u2",
      observerIds: ["u6"],
      tags: ["test"],
    });
    expect(created.contract.contractNumber).toMatch(/^TCP-\d{4}-\d{5}$/);
    expect(created.contract.status).toBe("draft");

    // Send → accept → submit → approve
    const sent = await demoApi.sendContract(orgId, created.contract.id);
    expect(sent.contract.status).toBe("sent");

    const accepted = await demoApi.acceptContract(orgId, created.contract.id);
    expect(accepted.contract.status).toBe("in_progress");

    const submitted = await demoApi.submitContract(orgId, created.contract.id);
    expect(submitted.contract.status).toBe("submitted");

    const approved = await demoApi.approveContract(orgId, created.contract.id);
    expect(approved.contract.status).toBe("approved");
    expect(approved.contract.progress).toBe(100);

    // Analytics must be derived from the store — the new seal shows up.
    const analytics = await demoApi.getOrganizationAnalytics(orgId);
    expect(analytics.stats.totalContracts).toBe(getDb().contracts.filter((c) => c.orgId === orgId).length);
    expect(analytics.contractsByStatus.approved).toBeGreaterThanOrEqual(1);
    expect(analytics.weeklyActivity.length).toBe(8);
    expect(analytics.sealedPerMonth.length).toBe(6);
    expect(analytics.teamPerformance.some((t) => t.completed >= 1)).toBe(true);

    // computeAnalytics and the adapter must agree
    const direct = computeAnalytics(getDb(), orgId);
    expect(direct.stats.totalContracts).toBe(analytics.stats.totalContracts);
  });

  it("rejects invalid transitions with a clear error", async () => {
    await demoApi.login("alex.morgan@northwind.studio", "demo1234");
    // tc1 is in_progress — approving it must fail.
    await expect(demoApi.approveContract("org1", "tc1")).rejects.toThrow(/cannot approve/i);
  });

  it("keeps participants honest — observer shows up on the contract", async () => {
    await demoApi.login("alex.morgan@northwind.studio", "demo1234");
    const created = await demoApi.createContract("org1", {
      title: "Observer Visibility",
      description: "Observers must appear in participants.",
      executorId: "u2",
      observerIds: ["u6"],
    });
    const detail = await demoApi.getContract("org1", created.contract.id);
    const roles = detail.participants.map((p: { role: string }) => p.role);
    expect(roles).toContain("observer");
    expect(roles).toContain("executor");
    expect(roles).toContain("initiator");
  });
});
