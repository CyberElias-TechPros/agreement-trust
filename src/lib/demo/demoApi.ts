/**
 * DemoApi — a drop-in adapter with the same surface as ApiClient.
 * Backed by demoDb (localStorage). Simulates realistic latency.
 * Only used when the live backend is unreachable.
 */
import {
  getDb,
  mutate,
  uid,
  nextContractNumber,
  isoNow,
  publicUser,
  serializeContract,
  computeAnalytics,
  transitionContract,
  DEMO_USER_ID,
  type DemoContract,
  type DemoDbShape,
  type DemoInteraction,
  type DemoMembership,
  type DemoOrg,
} from "./demoDb";

const delay = (ms = 260) => new Promise((r) => setTimeout(r, ms + Math.random() * 180));

const statuses = ["draft", "sent", "accepted", "in_progress", "submitted", "approved", "rejected", "archived"];

function orgsFor(db: DemoDbShape, userId: string) {
  return db.memberships
    .filter((m) => m.userId === userId && m.status === "active")
    .map((m) => {
      const org = db.orgs.find((o) => o.id === m.orgId)!;
      return { ...org, role: m.role };
    });
}

function requireOrg(db: DemoDbShape, userId: string, orgId: string) {
  const m = db.memberships.find((x) => x.userId === userId && x.orgId === orgId && x.status === "active");
  if (!m) throw new Error("Access denied to this organization");
  return m;
}

function toAuthUser(db: DemoDbShape, userId: string) {
  const u = publicUser(db, userId)!;
  return { ...u, role: db.memberships.find((m) => m.userId === userId)?.role || "observer" };
}

function serializeVersion(db: DemoDbShape, v: (typeof db.versions)[number]) {
  return {
    id: v.id,
    versionNumber: v.versionNumber,
    title: v.title,
    description: v.description,
    deadline: v.deadline,
    priority: v.priority,
    changeReason: v.changeReason,
    changedBy: publicUser(db, v.changedBy),
    changedAt: v.changedAt,
  };
}

function serializeInteraction(db: DemoDbShape, ix: (typeof db.interactions)[number]) {
  return {
    id: ix.id,
    contractId: ix.contractId,
    author: publicUser(db, ix.authorId),
    interactionType: ix.interactionType,
    content: ix.content,
    progressPercentage: ix.progressPercentage,
    statusChangeFrom: ix.statusChangeFrom,
    statusChangeTo: ix.statusChangeTo,
    createdAt: ix.createdAt,
  };
}

export class DemoApi {
  /* ---------- auth ---------- */

  async register(email: string, password: string, firstName: string, lastName: string) {
    await delay(500);
    const db = getDb();
    const existing = db.users.find((u) => u.email === email.toLowerCase());
    if (existing) throw new Error("Email already registered");
    const user = {
      id: uid("u"),
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      title: "",
      avatarUrl: "",
    };
    const org = {
      id: uid("org"),
      name: `${firstName}'s Organization`,
      slug: `${firstName.toLowerCase()}${lastName.toLowerCase()}-${Date.now()}`,
      planType: "free" as const,
    };
    mutate((d) => {
      d.users.push(user);
      d.orgs.push(org);
      d.memberships.push({
        id: uid("m"),
        userId: user.id,
        orgId: org.id,
        role: "owner",
        status: "active",
        joinedAt: isoNow(),
      });
      d.sessionUserId = user.id;
    });
    return {
      user: toAuthUser(getDb(), user.id),
      organization: { ...org, role: "owner" },
      accessToken: `demo-token-${user.id}`,
      refreshToken: `demo-refresh-${user.id}`,
    };
  }

  async login(email: string, password: string) {
    await delay(500);
    const db = getDb();
    const user = db.users.find((u) => u.email === email.toLowerCase());
    if (!user || user.password !== password) throw new Error("Invalid credentials");
    mutate((d) => {
      d.sessionUserId = user.id;
    });
    return {
      user: toAuthUser(getDb(), user.id),
      organizations: orgsFor(getDb(), user.id),
      accessToken: `demo-token-${user.id}`,
      refreshToken: `demo-refresh-${user.id}`,
    };
  }

  /** One-click demo entry — signs into the seeded workspace. */
  async enterDemo() {
    await delay(600);
    const db = getDb();
    mutate((d) => {
      d.sessionUserId = DEMO_USER_ID;
    });
    return {
      user: toAuthUser(getDb(), DEMO_USER_ID),
      organizations: orgsFor(getDb(), DEMO_USER_ID),
      accessToken: `demo-token-${DEMO_USER_ID}`,
      refreshToken: `demo-refresh-${DEMO_USER_ID}`,
    };
  }

  async logout() {
    await delay(120);
    mutate((d) => {
      d.sessionUserId = null;
    });
    return { message: "Logged out successfully" };
  }

  async getMe() {
    await delay(180);
    const db = getDb();
    const userId = db.sessionUserId || DEMO_USER_ID;
    return { user: toAuthUser(db, userId), organizations: orgsFor(db, userId) };
  }

  async updateProfile(data: { firstName?: string; lastName?: string; avatarUrl?: string }) {
    await delay(300);
    mutate((d) => {
      const u = d.users.find((x) => x.id === (d.sessionUserId || DEMO_USER_ID));
      if (!u) return;
      if (data.firstName) u.firstName = data.firstName;
      if (data.lastName) u.lastName = data.lastName;
      if (data.avatarUrl !== undefined) u.avatarUrl = data.avatarUrl;
    });
    return { user: toAuthUser(getDb(), getDb().sessionUserId || DEMO_USER_ID) };
  }

  async changePassword(currentPassword: string, newPassword: string) {
    await delay(400);
    const db = getDb();
    const u = db.users.find((x) => x.id === (db.sessionUserId || DEMO_USER_ID));
    if (!u) throw new Error("Not authenticated");
    if (u.password !== currentPassword) throw new Error("Current password is incorrect");
    if (!newPassword || newPassword.length < 8) throw new Error("New password must be at least 8 characters");
    mutate((d) => {
      const du = d.users.find((x) => x.id === u.id);
      if (du) du.password = newPassword;
    });
    return { message: "Password changed successfully" };
  }

  /* ---------- organizations ---------- */

  async getOrganizations() {
    await delay(180);
    return { organizations: orgsFor(getDb(), getDb().sessionUserId || DEMO_USER_ID) };
  }

  async createOrganization(name: string, slug?: string) {
    await delay(350);
    const db = getDb();
    const org = {
      id: uid("org"),
      name,
      slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36),
      planType: "free" as const,
    };
    mutate((d) => {
      d.orgs.push(org);
      d.memberships.push({
        id: uid("m"),
        userId: d.sessionUserId || DEMO_USER_ID,
        orgId: org.id,
        role: "owner",
        status: "active",
        joinedAt: isoNow(),
      });
    });
    return { organization: { ...org, role: "owner" } };
  }

  async getOrganization(organizationId: string) {
    await delay(160);
    const db = getDb();
    const org = db.orgs.find((o) => o.id === organizationId);
    if (!org) throw new Error("Organization not found");
    return { organization: org };
  }

  async updateOrganization(
    organizationId: string,
    data: { name?: string; branding?: DemoOrg["branding"]; settings?: Record<string, unknown> }
  ) {
    await delay(350);
    mutate((d) => {
      const org = d.orgs.find((o) => o.id === organizationId);
      if (!org) return;
      if (data.name) org.name = data.name;
      if (data.branding) org.branding = data.branding;
      if (data.settings) org.settings = data.settings;
    });
    return { organization: getDb().orgs.find((o) => o.id === organizationId) };
  }

  async getOrganizationMembers(organizationId: string) {
    await delay(220);
    const db = getDb();
    const members = db.memberships
      .filter((m) => m.orgId === organizationId)
      .map((m) => {
        const u = publicUser(db, m.userId);
        return { id: m.id, user: u, userDetails: u, role: m.role, status: m.status, joinedAt: m.joinedAt };
      });
    return { members };
  }

  async inviteMember(organizationId: string, email: string, role = "executor") {
    await delay(450);
    const db = getDb();
    const existing = db.users.find((u) => u.email === email.toLowerCase());
    if (existing) {
      if (db.memberships.some((m) => m.orgId === organizationId && m.userId === existing.id)) {
        throw new Error("This person is already a member");
      }
      mutate((d) => {
        d.memberships.push({
          id: uid("m"),
          userId: existing.id,
          orgId: organizationId,
          role,
          status: "active",
          joinedAt: isoNow(),
        });
      });
      return { membership: { id: "m", role } };
    }
    const nameParts = email.split("@")[0].split(/[._-]/);
    const firstName = nameParts[0] ? nameParts[0][0].toUpperCase() + nameParts[0].slice(1) : "New";
    const lastName = nameParts[1] ? nameParts[1][0].toUpperCase() + nameParts[1].slice(1) : "Member";
    const newUser = {
      id: uid("u"),
      email: email.toLowerCase(),
      password: "changeme123",
      firstName,
      lastName,
      title: "",
      avatarUrl: "",
    };
    let membership: { id: string; role: string } | undefined;
    mutate((d) => {
      d.users.push(newUser);
      const m = {
        id: uid("m"),
        userId: newUser.id,
        orgId: organizationId,
        role,
        status: "pending",
        joinedAt: isoNow(),
      };
      d.memberships.push(m);
      membership = { id: m.id, role };
    });
    return { membership };
  }

  async updateMemberRole(organizationId: string, memberId: string, role: string, status?: string) {
    await delay(300);
    mutate((d) => {
      const m = d.memberships.find((x) => x.id === memberId && x.orgId === organizationId);
      if (!m) return;
      m.role = role as DemoMembership["role"];
      if (status) m.status = status as DemoMembership["status"];
    });
    return { membership: getDb().memberships.find((x) => x.id === memberId) };
  }

  async removeMember(organizationId: string, memberId: string) {
    await delay(300);
    mutate((d) => {
      d.memberships = d.memberships.filter((x) => !(x.id === memberId && x.orgId === organizationId));
    });
    return { message: "Member removed" };
  }

  async getOrganizationAnalytics(organizationId: string) {
    await delay(320);
    return computeAnalytics(getDb(), organizationId);
  }

  /* ---------- contracts ---------- */

  async getContracts(
    organizationId: string,
    params?: { status?: string; priority?: string; search?: string; page?: number; limit?: number }
  ) {
    await delay(280);
    const db = getDb();
    requireOrg(db, db.sessionUserId || DEMO_USER_ID, organizationId);
    let list = db.contracts.filter((c) => c.orgId === organizationId);
    if (params?.status) list = list.filter((c) => c.currentStatus === params.status);
    if (params?.priority) list = list.filter((c) => c.currentPriority === params.priority);
    if (params?.search) {
      const s = params.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(s) ||
          c.currentDescription.toLowerCase().includes(s) ||
          c.contractNumber.toLowerCase().includes(s) ||
          c.tags.some((t) => t.toLowerCase().includes(s))
      );
    }
    list = [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const total = list.length;
    const paged = list.slice((page - 1) * limit, page * limit);
    return {
      contracts: paged.map((c) => serializeContract(db, c)),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async getContract(organizationId: string, contractId: string) {
    await delay(260);
    const db = getDb();
    const contract = db.contracts.find((c) => c.id === contractId && c.orgId === organizationId);
    if (!contract) throw new Error("Contract not found");
    const versions = db.versions
      .filter((v) => v.contractId === contractId)
      .sort((a, b) => b.versionNumber - a.versionNumber)
      .map((v) => serializeVersion(db, v));
    const interactions = db.interactions
      .filter((ix) => ix.contractId === contractId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((ix) => serializeInteraction(db, ix));
    const participants = [
      { user: publicUser(db, contract.initiatorId), role: "initiator", isLead: false },
      ...(contract.responsibleExecutorId
        ? [{ user: publicUser(db, contract.responsibleExecutorId), role: "executor", isLead: true }]
        : []),
    ];
    return { contract: serializeContract(db, contract), participants, versions, interactions };
  }

  async createContract(
    organizationId: string,
    data: {
      title: string;
      description: string;
      deadline?: string;
      priority?: string;
      categoryId?: string;
      executorId?: string;
      tags?: string[];
    }
  ) {
    await delay(500);
    const db = getDb();
    requireOrg(db, db.sessionUserId || DEMO_USER_ID, organizationId);
    if (!data.title?.trim()) throw new Error("Title is required");
    if (!data.description?.trim()) throw new Error("Description is required");
    let created: DemoContract | undefined;
    mutate((d) => {
      const contract: DemoContract = {
        id: uid("tc"),
        orgId: organizationId,
        contractNumber: nextContractNumber(d),
        title: data.title.trim(),
        currentDescription: data.description.trim(),
        currentDeadline: data.deadline || undefined,
        currentPriority: (data.priority as DemoContract["currentPriority"]) || "medium",
        currentStatus: "draft",
        progress: 0,
        initiatorId: d.sessionUserId || DEMO_USER_ID,
        responsibleExecutorId: data.executorId,
        categoryId: data.categoryId,
        tags: data.tags || [],
        createdAt: isoNow(),
        updatedAt: isoNow(),
      };
      d.contracts.unshift(contract);
      d.versions.unshift({
        id: uid("v"),
        contractId: contract.id,
        versionNumber: 1,
        title: contract.title,
        description: contract.currentDescription,
        deadline: contract.currentDeadline,
        priority: contract.currentPriority,
        changeReason: "Initial creation",
        changedBy: contract.initiatorId,
        changedAt: isoNow(),
      });
      d.audit.push({
        id: uid("au"),
        orgId: organizationId,
        userId: contract.initiatorId,
        action: "contract_created",
        entityType: "contract",
        entityId: contract.id,
        createdAt: isoNow(),
      });
      if (data.executorId) {
        d.notifications.unshift({
          id: uid("n"),
          userId: data.executorId,
          type: "created",
          title: "New contract drafted",
          content: `${publicUser(d, contract.initiatorId)?.firstName ?? "A teammate"} drafted “${contract.title}” and is preparing to send it.`,
          contractId: contract.id,
          read: false,
          createdAt: isoNow(),
        });
      }
      created = contract;
    });
    return { contract: serializeContract(getDb(), created!) };
  }

  async updateContract(
    organizationId: string,
    contractId: string,
    data: { title?: string; description?: string; deadline?: string; priority?: string; categoryId?: string; tags?: string[]; changeReason?: string }
  ) {
    await delay(450);
    const db = getDb();
    const contract = db.contracts.find((c) => c.id === contractId && c.orgId === organizationId);
    if (!contract) throw new Error("Contract not found");
    if ((data.description || data.title) && !data.changeReason) {
      throw new Error("A change reason is required when modifying the agreement");
    }
    mutate((d) => {
      const c = d.contracts.find((x) => x.id === contractId)!;
      if (data.title) c.title = data.title;
      if (data.description) c.currentDescription = data.description;
      if (data.deadline !== undefined) c.currentDeadline = data.deadline || undefined;
      if (data.priority) c.currentPriority = data.priority as DemoContract["currentPriority"];
      if (data.categoryId !== undefined) c.categoryId = data.categoryId || undefined;
      if (data.tags) c.tags = data.tags;
      c.updatedAt = isoNow();
      const last = d.versions.filter((v) => v.contractId === contractId).sort((a, b) => b.versionNumber - a.versionNumber)[0];
      d.versions.unshift({
        id: uid("v"),
        contractId,
        versionNumber: (last?.versionNumber || 0) + 1,
        title: c.title,
        description: c.currentDescription,
        deadline: c.currentDeadline,
        priority: c.currentPriority,
        changeReason: data.changeReason || "Updated",
        changedBy: d.sessionUserId || DEMO_USER_ID,
        changedAt: isoNow(),
      });
      d.audit.push({
        id: uid("au"),
        orgId: organizationId,
        userId: d.sessionUserId || DEMO_USER_ID,
        action: "contract_updated",
        entityType: "contract",
        entityId: contractId,
        createdAt: isoNow(),
      });
    });
    return { contract: serializeContract(getDb(), getDb().contracts.find((c) => c.id === contractId)!) };
  }

  async getContractHistory(organizationId: string, contractId: string) {
    await delay(200);
    const db = getDb();
    return {
      versions: db.versions
        .filter((v) => v.contractId === contractId)
        .sort((a, b) => b.versionNumber - a.versionNumber)
        .map((v) => serializeVersion(db, v)),
    };
  }

  async getContractAudit(organizationId: string, contractId: string) {
    await delay(200);
    const db = getDb();
    return {
      auditLogs: db.audit
        .filter((a) => a.entityId === contractId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((a) => ({ ...a, user: publicUser(db, a.userId) })),
    };
  }

  private async transition(organizationId: string, contractId: string, action: "send" | "accept" | "reject" | "submit" | "approve" | "archive", note?: string) {
    await delay(420);
    const db = getDb();
    const contract = db.contracts.find((c) => c.id === contractId && c.orgId === organizationId);
    if (!contract) throw new Error("Contract not found");
    mutate((d) => {
      const c = d.contracts.find((x) => x.id === contractId)!;
      transitionContract(d, c, action, d.sessionUserId || DEMO_USER_ID, note);
    });
    return { contract: serializeContract(getDb(), getDb().contracts.find((c) => c.id === contractId)!) };
  }

  sendContract = (o: string, c: string) => this.transition(o, c, "send");
  acceptContract = (o: string, c: string) => this.transition(o, c, "accept");
  rejectContract = (o: string, c: string, reason?: string) => this.transition(o, c, "reject", reason);
  submitContract = (o: string, c: string, summary?: string) => this.transition(o, c, "submit", summary);
  approveContract = (o: string, c: string) => this.transition(o, c, "approve");
  archiveContract = (o: string, c: string) => this.transition(o, c, "archive");

  /* ---------- interactions ---------- */

  async getInteractions(organizationId: string, contractId: string, type?: string) {
    await delay(220);
    const db = getDb();
    let list = db.interactions.filter((ix) => ix.contractId === contractId);
    if (type) list = list.filter((ix) => ix.interactionType === type);
    list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { interactions: list.map((ix) => serializeInteraction(db, ix)), pagination: { total: list.length } };
  }

  async createInteraction(
    organizationId: string,
    contractId: string,
    data: {
      interactionType: string;
      content: string;
      structuredData?: Record<string, unknown>;
      progressPercentage?: number;
      attachments?: unknown[];
    }
  ) {
    await delay(350);
    const db = getDb();
    const contract = db.contracts.find((c) => c.id === contractId);
    if (!contract) throw new Error("Contract not found");
    if (!data.content?.trim()) throw new Error("Content is required");
    let created: (typeof db.interactions)[number] | undefined;
    mutate((d) => {
      const ix = {
        id: uid("ix"),
        contractId,
        authorId: d.sessionUserId || DEMO_USER_ID,
        interactionType: (data.interactionType || "comment") as DemoInteraction["interactionType"],
        content: data.content.trim(),
        progressPercentage: data.progressPercentage,
        createdAt: isoNow(),
      };
      d.interactions.unshift(ix);
      const c = d.contracts.find((x) => x.id === contractId)!;
      if (data.interactionType === "progress_update" && typeof data.progressPercentage === "number") {
        c.progress = Math.max(0, Math.min(100, data.progressPercentage));
        c.updatedAt = isoNow();
      } else {
        c.updatedAt = isoNow();
      }
      const counterpartId =
        (d.sessionUserId || DEMO_USER_ID) === c.initiatorId ? c.responsibleExecutorId : c.initiatorId;
      if (counterpartId && counterpartId !== (d.sessionUserId || DEMO_USER_ID)) {
        d.notifications.unshift({
          id: uid("n"),
          userId: counterpartId,
          type: data.interactionType,
          title: data.interactionType === "progress_update" ? "Progress update" : "New interaction",
          content: `${publicUser(d, d.sessionUserId || DEMO_USER_ID)?.firstName ?? "A teammate"} added a ${(data.interactionType || "comment").replace(/_/g, " ")} on “${c.title}”.`,
          contractId,
          read: false,
          createdAt: isoNow(),
        });
      }
      created = ix;
    });
    return { interaction: serializeInteraction(getDb(), created!) };
  }

  /* ---------- notifications ---------- */

  async getNotifications(params?: { unreadOnly?: boolean; limit?: number; offset?: number }) {
    await delay(200);
    const db = getDb();
    const userId = db.sessionUserId || DEMO_USER_ID;
    let list = db.notifications.filter((n) => n.userId === userId);
    const unreadCount = list.filter((n) => !n.read).length;
    if (params?.unreadOnly) list = list.filter((n) => !n.read);
    list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const offset = params?.offset || 0;
    const limit = params?.limit || 20;
    const notifications = list.slice(offset, offset + limit).map((n) => ({
      ...n,
      contract: n.contractId
        ? (() => {
            const c = db.contracts.find((x) => x.id === n.contractId);
            return c ? { title: c.title, contractNumber: c.contractNumber } : undefined;
          })()
        : undefined,
    }));
    return { notifications, unreadCount, pagination: { total: list.length, offset, limit } };
  }

  async markNotificationRead(notificationId: string) {
    await delay(160);
    mutate((d) => {
      const n = d.notifications.find((x) => x.id === notificationId);
      if (n) n.read = true;
    });
    return { notification: getDb().notifications.find((x) => x.id === notificationId) };
  }

  async markAllNotificationsRead() {
    await delay(220);
    mutate((d) => {
      const userId = d.sessionUserId || DEMO_USER_ID;
      d.notifications.forEach((n) => {
        if (n.userId === userId) n.read = true;
      });
    });
    return { message: "All notifications marked as read" };
  }

  /* ---------- categories ---------- */

  async getCategories(organizationId: string) {
    await delay(180);
    return { categories: getDb().categories.filter((c) => c.orgId === organizationId) };
  }

  async createCategory(organizationId: string, data: { name: string; color?: string; description?: string }) {
    await delay(280);
    if (!data.name?.trim()) throw new Error("Name is required");
    const palette = ["#8B5CF6", "#4F5BD5", "#D9A441", "#0F9D6E", "#D6577E", "#3B82F6"];
    const category = {
      id: uid("c"),
      orgId: organizationId,
      name: data.name.trim(),
      color: data.color || palette[Math.floor(Math.random() * palette.length)],
      description: data.description,
    };
    mutate((d) => {
      d.categories.push(category);
    });
    return { category };
  }

  async updateCategory(organizationId: string, categoryId: string, data: { name?: string; color?: string; description?: string }) {
    await delay(280);
    mutate((d) => {
      const c = d.categories.find((x) => x.id === categoryId && x.orgId === organizationId);
      if (!c) return;
      if (data.name) c.name = data.name;
      if (data.color) c.color = data.color;
      if (data.description !== undefined) c.description = data.description;
    });
    return { category: getDb().categories.find((x) => x.id === categoryId) };
  }

  async deleteCategory(organizationId: string, categoryId: string) {
    await delay(280);
    mutate((d) => {
      d.categories = d.categories.filter((x) => !(x.id === categoryId && x.orgId === organizationId));
      d.contracts.forEach((c) => {
        if (c.categoryId === categoryId) c.categoryId = undefined;
      });
    });
    return { message: "Category deleted" };
  }

  /* ---------- users ---------- */

  async getOrganizationUsers(organizationId: string) {
    await delay(180);
    const db = getDb();
    const memberIds = db.memberships.filter((m) => m.orgId === organizationId).map((m) => m.userId);
    return { users: memberIds.map((id) => publicUser(db, id)).filter(Boolean) };
  }

  async searchUsers(organizationId: string, query: string) {
    await delay(220);
    const db = getDb();
    const memberIds = db.memberships.filter((m) => m.orgId === organizationId).map((m) => m.userId);
    const q = query.toLowerCase();
    return {
      users: memberIds
        .map((id) => publicUser(db, id))
        .filter(
          (u) =>
            u &&
            (u.firstName.toLowerCase().includes(q) ||
              u.lastName.toLowerCase().includes(q) ||
              u.email.toLowerCase().includes(q))
        ),
    };
  }
}

export const demoApi = new DemoApi();
export { statuses };
