import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Building2, Users, CreditCard, Shield, Palette, Bell, Trash2, Plus, Mail, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserAvatar } from '@/components/UserAvatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { UserRole } from '@/types/contracts';

interface Member {
  id: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  role: string;
  status: string;
}

export default function Settings() {
  const { organizations, currentOrganization } = useAuth();
  const organizationId = currentOrganization?.id || organizations?.[0]?.id;
  
  const [orgName, setOrgName] = useState(currentOrganization?.name || organizations?.[0]?.name || '');
  const [orgSlug, setOrgSlug] = useState(currentOrganization?.slug || organizations?.[0]?.slug || '');
  const [branding, setBranding] = useState({
    primaryColor: '#3B82F6',
    accentColor: '#8B5CF6',
  });
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('executor');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [notifications, setNotifications] = useState({
    contract_assigned: true,
    status_changed: true,
    deadline_reminder: false,
    comments: true,
  });
  const { toast } = useToast();


  const loadMembers = useCallback(async () => {
    if (!organizationId) return;
    try {
      const data = await api.getOrganizationMembers(organizationId);
      setMembers(
        (data.members || []).map((m) => ({
          id: m.id,
          user: m.user
            ? { id: m.user.id, email: m.user.email, firstName: m.user.firstName, lastName: m.user.lastName }
            : { id: m.user?.id ?? '', email: 'pending@invite.local', firstName: 'Pending', lastName: 'Invite' },
          role: m.role,
          status: m.status || 'active',
        }))
      );
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      loadMembers();
    }
  }, [organizationId, loadMembers]);

  const handleSaveOrganization = async () => {
    if (!organizationId) return;
    setSaving(true);
    try {
      await api.updateOrganization(organizationId, {
        name: orgName,
        branding,
      });
      toast({
        title: 'Organization updated',
        description: 'Your organization settings have been saved.',
      });
    } catch (error) {
      console.error('Failed to save organization:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save organization settings',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationChange = async (key: string, value: boolean) => {
    const next = { ...notifications, [key]: value };
    setNotifications(next);
    try {
      await api.updatePreferences(next);
      toast({ title: 'Preference sealed', description: 'Notification preference recorded.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Could not save preference',
      });
    }
  };

  const handleInvite = async () => {
    if (!organizationId || !inviteEmail) return;
    setInviteLoading(true);
    try {
      await api.inviteMember(organizationId, inviteEmail, inviteRole);
      setInviteEmail('');
      loadMembers();
      toast({
        title: 'Invitation sent',
        description: `Invitation sent to ${inviteEmail}`,
      });
    } catch (error) {
      console.error('Failed to invite member:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to invite member',
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleUpdateRole = async (memberId: string, role: string) => {
    if (!organizationId) return;
    try {
      await api.updateMemberRole(organizationId, memberId, role);
      loadMembers();
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!organizationId) return;
    try {
      await api.removeMember(organizationId, memberId);
      loadMembers();
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

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
                  <Input value={orgSlug} onChange={e => setOrgSlug(e.target.value)} className="font-mono text-sm" disabled />
                </div>
              </div>
              <Button 
                className="gradient-hero text-primary-foreground border-0"
                onClick={handleSaveOrganization}
                disabled={saving}
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </div>

            <div className="glass-card p-6 space-y-5">
              <h3 className="section-title">Branding</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Primary Color</label>
                  <div className="flex gap-2">
                    <Input 
                      type="color" 
                      className="w-12 h-10 p-1" 
                      value={branding.primaryColor}
                      onChange={(e) => setBranding(prev => ({ ...prev, primaryColor: e.target.value }))}
                    />
                    <Input 
                      value={branding.primaryColor} 
                      className="font-mono text-sm"
                      onChange={(e) => setBranding(prev => ({ ...prev, primaryColor: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="input-label">Accent Color</label>
                  <div className="flex gap-2">
                    <Input 
                      type="color" 
                      className="w-12 h-10 p-1" 
                      value={branding.accentColor}
                      onChange={(e) => setBranding(prev => ({ ...prev, accentColor: e.target.value }))}
                    />
                    <Input 
                      value={branding.accentColor} 
                      className="font-mono text-sm"
                      onChange={(e) => setBranding(prev => ({ ...prev, accentColor: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* Members */}
        <TabsContent value="members">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="glass-card p-6 space-y-5">
              <h3 className="section-title">Invite Members</h3>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input 
                    type="email" 
                    placeholder="Enter email address" 
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                  />
                </div>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="executor">Executor</SelectItem>
                    <SelectItem value="observer">Observer</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleInvite} disabled={inviteLoading || !inviteEmail}>
                  {inviteLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Plus className="w-4 h-4 mr-2" /> Invite
                </Button>
              </div>
            </div>

            <div className="glass-card p-6">
              <h3 className="section-title mb-4">Team Members</h3>
              {loading ? (
                <p className="text-muted-foreground text-center py-4">Loading...</p>
              ) : members.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No members yet</p>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={{ id: member.user.id, email: member.user.email, firstName: member.user.firstName, lastName: member.user.lastName, role: member.role as UserRole }} size="sm" showName />
                        <div>
                          <p className="text-xs text-muted-foreground">{member.user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select value={member.role} onValueChange={(v) => handleUpdateRole(member.id, v)}>
                          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="executor">Executor</SelectItem>
                            <SelectItem value="observer">Observer</SelectItem>
                          </SelectContent>
                        </Select>
                        {member.role !== 'owner' && (
                          <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleRemoveMember(member.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </TabsContent>

        {/* Billing */}
        <TabsContent value="billing">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="glass-card p-6 space-y-5">
              <h3 className="section-title">Current Plan</h3>
              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                <div>
                  <p className="font-semibold text-foreground capitalize">{currentOrganization ? "Workspace plan" : "Free Plan"}</p>
                  <p className="text-xs text-muted-foreground">Upgrade instantly — no card required in this environment.</p>
                </div>
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!organizationId) return;
                    try {
                      const res = await api.upgradePlan(organizationId, "pro");
                      toast({ title: "Plan upgraded", description: res.message });
                    } catch (e) {
                      toast({ variant: "destructive", title: "Upgrade failed", description: e instanceof Error ? e.message : "" });
                    }
                  }}
                >
                  Upgrade to Pro
                </Button>
              </div>
            </div>

            <div className="glass-card p-6 space-y-5">
              <h3 className="section-title">Payment Method</h3>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/30">
                <CreditCard className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm">Ledger billing is organisation-invoiced. No card on file.</span>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="glass-card p-6 space-y-5">
              <h3 className="section-title">Email Notifications</h3>
              {[
                { id: 'contract_assigned', label: 'New contract assigned', desc: 'When a new contract is assigned to you', enabled: notifications.contract_assigned },
                { id: 'status_changed', label: 'Contract status changes', desc: 'When a contract status changes', enabled: notifications.status_changed },
                { id: 'deadline_reminder', label: 'Deadline reminders', desc: '24 hours before a deadline', enabled: notifications.deadline_reminder },
                { id: 'comments', label: 'Comments & mentions', desc: 'When someone comments or mentions you', enabled: notifications.comments },
              ].map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch 
                    checked={item.enabled}
                    onCheckedChange={(checked) => handleNotificationChange(item.id, checked)}
                  />
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
              <p className="text-sm text-muted-foreground">Members enable 2FA from their profile. Organisation-wide enforcement is available on Enterprise.</p>
            </div>

            <div className="glass-card p-6 space-y-5">
              <h3 className="section-title">Session Management</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Revoke individual devices from your profile. Role changes and member removal take effect on the next request.
              </p>
              <Button variant="outline" onClick={() => window.location.assign("/profile")}>Open profile security</Button>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
