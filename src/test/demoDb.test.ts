import { describe, it, expect, beforeEach } from "vitest";
import {
  getDb,
  resetDemo,
  computeAnalytics,
  transitionContract,
  nextContractNumber,
  DEMO_USER_ID,
} from "@/lib/demo/demoDb";

describe("demo database — domain integrity", () => {
  beforeEach(() => {
    localStorage.clear();
    resetDemo();
  });

  it("seeds a coherent workspace", () => {
    const db = getDb();
    expect(db.users.length).toBeGreaterThanOrEqual(5);
    expect(db.orgs.length).toBeGreaterThanOrEqual(2);
    expect(db.contracts.length).toBeGreaterThanOrEqual(6);
    // Every contract references existing parties and has version 1
    for (const c of db.contracts) {
      expect(db.users.some((u) => u.id === c.initiatorId)).toBe(true);
      const versions = db.versions.filter((v) => v.contractId === c.id);
      expect(versions.some((v) => v.versionNumber === 1)).toBe(true);
    }
  });

  it("creates new contracts as version 1 drafts", () => {
    const db = getDb();
    const id = `tc-new-${Date.now()}`;
    db.contracts.unshift({
      id,
      orgId: "org1",
      contractNumber: nextContractNumber(db),
      title: "Test agreement",
      currentDescription: "A test scope",
      currentPriority: "medium",
      currentStatus: "draft",
      progress: 0,
      initiatorId: DEMO_USER_ID,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    db.versions.unshift({
      id: `v-${id}-1`,
      contractId: id,
      versionNumber: 1,
      title: "Test agreement",
      description: "A test scope",
      priority: "medium",
      changeReason: "Initial creation",
      changedBy: DEMO_USER_ID,
      changedAt: new Date().toISOString(),
    });
    expect(db.contracts[0].currentStatus).toBe("draft");
    expect(db.versions[0].versionNumber).toBe(1);
  });

  it("enforces the contract state machine", () => {
    const db = getDb();
    const draft = db.contracts.find((c) => c.id === "tc5")!;
    expect(draft.currentStatus).toBe("draft");

    // Valid: draft → sent
    const sent = transitionContract(db, draft, "send", DEMO_USER_ID);
    expect(sent.status).toBe("sent");

    // Valid: sent → accepted (auto-advances to in_progress)
    const accepted = transitionContract(db, draft, "accept", draft.responsibleExecutorId || DEMO_USER_ID);
    expect(accepted.status).toBe("in_progress");

    // Invalid: cannot approve something that was never submitted
    expect(() => transitionContract(db, draft, "approve", DEMO_USER_ID)).toThrow(/Invalid transition/);

    // Invalid: cannot send an active contract
    expect(() => transitionContract(db, draft, "send", DEMO_USER_ID)).toThrow(/Invalid transition/);
  });

  it("records interactions and audit entries on state changes", () => {
    const db = getDb();
    const draft = db.contracts.find((c) => c.id === "tc5")!;
    const beforeInteractions = db.interactions.filter((i) => i.contractId === draft.id).length;
    const beforeAudit = db.audit.length;

    transitionContract(db, draft, "send", DEMO_USER_ID);

    expect(db.interactions.filter((i) => i.contractId === draft.id)).toHaveLength(beforeInteractions + 1);
    expect(db.audit).toHaveLength(beforeAudit + 1);
    expect(db.audit[0].action).toBe("contract_send");
  });

  it("computes analytics consistent with the data", () => {
    const db = getDb();
    const { stats, contractsByStatus } = computeAnalytics(db, "org1");
    expect(stats.totalContracts).toBe(db.contracts.filter((c) => c.orgId === "org1").length);
    expect(stats.pendingReview).toBe(contractsByStatus.submitted ?? 0);
    expect(stats.completionRate).toBeGreaterThanOrEqual(0);
    expect(stats.completionRate).toBeLessThanOrEqual(100);
    expect(stats.overdue).toBeGreaterThanOrEqual(0);
  });
});
