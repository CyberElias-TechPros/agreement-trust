-- TaskContract D1 schema (Cloudflare D1 / SQLite)
-- Applied automatically on first boot (local) and via wrangler migrations (prod).

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  avatar_url TEXT,
  title TEXT,
  email_verified INTEGER DEFAULT 1,
  two_factor_enabled INTEGER DEFAULT 0,
  two_factor_secret TEXT,
  backup_codes TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan_type TEXT DEFAULT 'free',
  branding TEXT,
  settings TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  invited_by TEXT,
  joined_at TEXT NOT NULL,
  UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  invited_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  description TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS org_sequences (
  organization_id TEXT PRIMARY KEY,
  next_number INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  contract_number TEXT NOT NULL,
  title TEXT NOT NULL,
  current_description TEXT NOT NULL,
  current_deadline TEXT,
  current_priority TEXT DEFAULT 'medium',
  current_status TEXT DEFAULT 'draft',
  progress INTEGER DEFAULT 0,
  initiator_id TEXT NOT NULL,
  responsible_executor_id TEXT,
  category_id TEXT,
  tags TEXT,
  current_version INTEGER DEFAULT 1,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sent_at TEXT,
  accepted_at TEXT,
  submitted_at TEXT,
  approved_at TEXT,
  completed_at TEXT,
  archived_at TEXT,
  UNIQUE (organization_id, contract_number)
);

CREATE TABLE IF NOT EXISTS contract_versions (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  title TEXT,
  description TEXT NOT NULL,
  deadline TEXT,
  priority TEXT,
  change_reason TEXT,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  acknowledged_at TEXT,
  acknowledged_by TEXT,
  UNIQUE (contract_id, version_number)
);

CREATE TABLE IF NOT EXISTS contract_participants (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  is_lead INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  accepted_at TEXT
);

CREATE TABLE IF NOT EXISTS contract_interactions (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  interaction_type TEXT NOT NULL,
  content TEXT NOT NULL,
  progress_percentage INTEGER,
  structured_data TEXT,
  attachments TEXT,
  status_change_from TEXT,
  status_change_to TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  contract_id TEXT,
  read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  contract_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  previous_state TEXT,
  new_state TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  checksum TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  refresh_token_hash TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id TEXT PRIMARY KEY,
  contract_assigned INTEGER DEFAULT 1,
  status_changed INTEGER DEFAULT 1,
  deadline_reminder INTEGER DEFAULT 1,
  comments INTEGER DEFAULT 1,
  email_digest INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  contract_id TEXT,
  interaction_id TEXT,
  filename TEXT NOT NULL,
  content_type TEXT,
  size INTEGER,
  r2_key TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_org_status ON contracts(organization_id, current_status);
CREATE INDEX IF NOT EXISTS idx_contracts_executor ON contracts(responsible_executor_id);
CREATE INDEX IF NOT EXISTS idx_contracts_initiator ON contracts(initiator_id);
CREATE INDEX IF NOT EXISTS idx_interactions_contract ON contract_interactions(contract_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
