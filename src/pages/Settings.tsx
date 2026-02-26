import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Users, CreditCard, Shield, Palette, Bell, Trash2, Plus, Mail, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserAvatar } from '@/components/UserAvatar';
import { users, categories } from '@/data/mockData';
import { cn } from '@/lib/utils';

export default function Settings() {
  const [orgName, setOrgName] = useState('Acme Corporation');
  const [orgSlug, setOrgSlug] = useState('acme-corp');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('executor');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your organization and preferences.</p>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="bg-secondary/50 p-1 mb-6">
          <TabsTrigger value="general" className="text-xs"><Building2 className="w-3.5 h-3.5 mr-1.5" /> General</TabsTrigger>
          <TabsTrigger value="members" className="text-xs"><Users className="w-3.5 h-3.5 mr-1.5" /> Members</TabsTrigger>
          <TabsTrigger value="billing" className="text-xs"><CreditCard className="w-3.5 h-3.5 mr-1.5" /> Billing</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs"><Bell className="w-3.5 h-3.5 mr-1.5" /> Notifications</TabsTrigger>
          <TabsTrigger value="security" className="text-xs"><Shield className="w-3.5 h-3.5 mr-1.5" /> Security</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="glass-card p-6 space-y-5">
              <h3 className="section-title">Organization Details</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Organization Name</label>
                  <Input value={orgName} onChange={e => setOrgName(e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Slug</label>
                  <Input value={orgSlug} onChange={e => setOrgSlug(e.target.value)} className="font-mono text-sm" />
                </div>
              </div>
              <div>
                <label className="input-label">Timezone</label>
                <Select defaultValue="utc-5">
                  <SelectTrigger className="w-full max-w-sm bg-secondary/50 border-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="utc-5">Eastern Time (UTC-5)</SelectItem>
                    <SelectItem value="utc-8">Pacific Time (UTC-8)</SelectItem>
                    <SelectItem value="utc">UTC</SelectItem>
                    <SelectItem value="utc+1">Central European Time (UTC+1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="gradient-hero text-primary-foreground border-0">Save Changes</Button>
            </div>

            <div className="glass-card p-6 space-y-5">
              <h3 className="section-title flex items-center gap-2"><Palette className="w-4 h-4" /> Categories</h3>
              <div className="space-y-2">
                {categories.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="text-sm font-medium text-foreground flex-1">{c.name}</span>
                    <button className="text-xs text-muted-foreground hover:text-destructive transition-colors">Remove</button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm"><Plus className="w-3 h-3 mr-1" /> Add Category</Button>
            </div>

            <div className="glass-card p-6 border-destructive/20">
              <h3 className="section-title text-destructive flex items-center gap-2"><Trash2 className="w-4 h-4" /> Danger Zone</h3>
              <p className="text-sm text-muted-foreground mb-4">Permanently delete this organization and all its data. This action cannot be undone.</p>
              <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5">Delete Organization</Button>
            </div>
          </motion.div>
        </TabsContent>

        {/* Members */}
        <TabsContent value="members">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="glass-card p-6">
              <h3 className="section-title">Invite Member</h3>
              <div className="flex gap-3">
                <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@company.com" className="flex-1" />
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="w-[140px] bg-secondary/50 border-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="executor">Executor</SelectItem>
                    <SelectItem value="observer">Observer</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="gradient-hero text-primary-foreground border-0"><Mail className="w-4 h-4 mr-2" /> Invite</Button>
              </div>
            </div>

            <div className="glass-card">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">{users.length} Members</h3>
              </div>
              <div className="divide-y divide-border">
                {users.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-4 hover:bg-secondary/30 transition-colors">
                    <UserAvatar user={u} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <span className="status-badge bg-secondary text-muted-foreground capitalize">{u.role}</span>
                    <Button variant="ghost" size="icon" className="shrink-0"><ChevronRight className="w-4 h-4" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* Billing */}
        <TabsContent value="billing">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="glass-card p-6 border-primary/20">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="section-title mb-0">Professional Plan</h3>
                  <p className="text-sm text-muted-foreground">$12/user/month · 6 users</p>
                </div>
                <span className="status-badge bg-success/10 text-success">Active</span>
              </div>
              <div className="grid sm:grid-cols-3 gap-4 mb-4">
                <div className="p-3 rounded-lg bg-secondary/30">
                  <p className="text-xs text-muted-foreground">Monthly Cost</p>
                  <p className="text-lg font-bold text-foreground">$72.00</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/30">
                  <p className="text-xs text-muted-foreground">Contracts Used</p>
                  <p className="text-lg font-bold text-foreground">7 / ∞</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/30">
                  <p className="text-xs text-muted-foreground">Next Billing</p>
                  <p className="text-lg font-bold text-foreground">Jan 15, 2025</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Change Plan</Button>
                <Button variant="outline" size="sm">View Invoices</Button>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="glass-card p-6 space-y-6">
              <h3 className="section-title">Notification Preferences</h3>
              {[
                { label: 'Contract assigned to me', desc: 'Get notified when you are assigned as executor', email: true, inApp: true },
                { label: 'Status changes', desc: 'Notify when contract status changes', email: true, inApp: true },
                { label: 'New interactions', desc: 'Get notified for new comments and updates', email: false, inApp: true },
                { label: 'Deadline approaching', desc: '24-hour warning before deadline', email: true, inApp: true },
                { label: 'Weekly summary', desc: 'Receive a weekly digest of all activity', email: true, inApp: false },
              ].map(pref => (
                <div key={pref.label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{pref.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{pref.desc}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground uppercase">Email</span>
                      <Switch defaultChecked={pref.email} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground uppercase">In-App</span>
                      <Switch defaultChecked={pref.inApp} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="glass-card p-6 space-y-5">
              <h3 className="section-title">Two-Factor Authentication</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground font-medium">Require 2FA for all members</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Enforce two-factor authentication across the organization</p>
                </div>
                <Switch />
              </div>
            </div>
            <div className="glass-card p-6 space-y-5">
              <h3 className="section-title">Session Management</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground font-medium">Session timeout</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Automatically sign out inactive users</p>
                </div>
                <Select defaultValue="24h">
                  <SelectTrigger className="w-[120px] bg-secondary/50 border-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">1 hour</SelectItem>
                    <SelectItem value="8h">8 hours</SelectItem>
                    <SelectItem value="24h">24 hours</SelectItem>
                    <SelectItem value="7d">7 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
