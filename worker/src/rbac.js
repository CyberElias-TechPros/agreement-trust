export const ROLE_LEVEL = {
  owner: 5,
  admin: 4,
  manager: 3,
  executor: 2,
  observer: 1,
  auditor: 1,
};

const PERMISSIONS = {
  owner: {
    contract: ["create", "read", "update", "delete", "send", "accept", "submit", "approve", "reject", "archive", "start", "export"],
    member: ["create", "read", "update", "delete"],
    organization: ["read", "update", "delete", "manage_billing"],
    audit: ["read", "export"],
    category: ["create", "read", "update", "delete"],
  },
  admin: {
    contract: ["create", "read", "update", "delete", "send", "accept", "submit", "approve", "reject", "archive", "start", "export"],
    member: ["create", "read", "update", "delete"],
    organization: ["read", "update"],
    audit: ["read", "export"],
    category: ["create", "read", "update", "delete"],
  },
  manager: {
    contract: ["create", "read", "update", "send", "accept", "submit", "approve", "reject", "start", "export"],
    member: ["read"],
    organization: ["read"],
    audit: ["read"],
    category: ["create", "read", "update"],
  },
  executor: {
    contract: ["read", "accept", "submit", "start"],
    member: ["read"],
    organization: ["read"],
    audit: [],
    category: ["read"],
  },
  observer: {
    contract: ["read"],
    member: ["read"],
    organization: ["read"],
    audit: [],
    category: ["read"],
  },
  auditor: {
    contract: ["read", "export"],
    member: ["read"],
    organization: ["read"],
    audit: ["read", "export"],
    category: ["read"],
  },
};

export function can(role, action, resource) {
  return Boolean(PERMISSIONS[role]?.[resource]?.includes(action));
}

export function isManagerPlus(role) {
  return (ROLE_LEVEL[role] || 0) >= ROLE_LEVEL.manager;
}

export const VALID_ROLES = ["owner", "admin", "manager", "executor", "observer", "auditor"];
export const VALID_PRIORITIES = ["low", "medium", "high", "critical"];
export const VALID_STATUSES = ["draft", "sent", "accepted", "in_progress", "submitted", "approved", "rejected", "archived"];
export const VALID_INTERACTIONS = [
  "progress_update",
  "clarification_request",
  "clarification_response",
  "scope_proposal",
  "scope_acknowledgment",
  "scope_rejection",
  "issue_report",
  "issue_resolution",
  "submission",
  "approval",
  "rejection",
  "comment",
  "system_note",
];

export const TRANSITIONS = {
  send: { draft: "sent" },
  accept: { sent: "accepted" },
  reject: { sent: "rejected", submitted: "in_progress" },
  start: { accepted: "in_progress" },
  submit: { accepted: "submitted", in_progress: "submitted", rejected: "submitted" },
  approve: { submitted: "approved" },
  archive: {
    draft: "archived",
    sent: "archived",
    accepted: "archived",
    in_progress: "archived",
    submitted: "archived",
    approved: "archived",
    rejected: "archived",
  },
  reopen: { approved: "sent", rejected: "sent" },
};
