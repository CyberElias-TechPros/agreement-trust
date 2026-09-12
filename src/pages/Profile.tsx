import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Shield, Key, Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
  });
  const [loading, setLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const { toast } = useToast();

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      await api.updateProfile({
        firstName: form.firstName,
        lastName: form.lastName,
      });
      await refreshUser();
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update profile',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'New passwords do not match',
      });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Password must be at least 8 characters',
      });
      return;
    }
    setPasswordLoading(true);
    try {
      await api.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast({
        title: 'Password changed',
        description: 'Your password has been updated successfully.',
      });
    } catch (error) {
      console.error('Failed to change password:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to change password',
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-subtitle">Manage your personal information and security.</p>
        </div>
      </div>

      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="bg-secondary/50 p-1 mb-6">
          <TabsTrigger value="personal" className="text-xs"><User className="w-3.5 h-3.5 mr-1.5" /> Personal</TabsTrigger>
          <TabsTrigger value="security" className="text-xs"><Shield className="w-3.5 h-3.5 mr-1.5" /> Security</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Avatar */}
            <div className="glass-card p-6">
              <h3 className="section-title">Avatar</h3>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <UserAvatar user={user || { id: '', email: '', firstName: '', lastName: '', role: 'executor' }} size="lg" />
                  <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md">
                    <Camera className="w-3 h-3 text-primary-foreground" />
                  </button>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                </div>
              </div>
            </div>

            {/* Personal Info */}
            <div className="glass-card p-6 space-y-5">
              <h3 className="section-title">Personal Information</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">First Name</label>
                  <Input value={form.firstName} onChange={e => update('firstName', e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Last Name</label>
                  <Input value={form.lastName} onChange={e => update('lastName', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="input-label">Email</label>
                <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} disabled />
              </div>
              <Button 
                className="gradient-hero text-primary-foreground border-0" 
                onClick={handleSaveProfile}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="security">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="glass-card p-6 space-y-5">
              <h3 className="section-title flex items-center gap-2"><Lock className="w-4 h-4" /> Change Password</h3>
              <div>
                <label className="input-label">Current Password</label>
                <Input 
                  type="password" 
                  placeholder="••••••••" 
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                />
              </div>
              <div>
                <label className="input-label">New Password</label>
                <Input 
                  type="password" 
                  placeholder="Min 8 characters" 
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                />
              </div>
              <div>
                <label className="input-label">Confirm New Password</label>
                <Input 
                  type="password" 
                  placeholder="••••••••" 
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                />
              </div>
              <Button 
                className="gradient-hero text-primary-foreground border-0"
                onClick={handleChangePassword}
                disabled={passwordLoading || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
              >
                {passwordLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Update Password
              </Button>
            </div>

            <div className="glass-card p-6 space-y-5">
              <h3 className="section-title flex items-center gap-2"><Key className="w-4 h-4" /> Two-Factor Authentication</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Enable 2FA</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Add an extra layer of security to your account</p>
                </div>
                <Switch 
                  checked={twoFactorEnabled}
                  onCheckedChange={setTwoFactorEnabled}
                />
              </div>
            </div>

            <div className="glass-card p-6">
              <h3 className="section-title">Active Sessions</h3>
              <div className="space-y-3">
                {[
                  { device: 'Chrome on MacOS', location: 'New York, US', current: true, lastActive: 'Now' },
                  { device: 'Safari on iPhone', location: 'New York, US', current: false, lastActive: '2 hours ago' },
                ].map((session, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                    <div>
                      <p className="text-sm font-medium text-foreground flex items-center gap-2">
                        {session.device}
                        {session.current && <span className="status-badge bg-success/10 text-success text-[9px]">Current</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{session.location} · {session.lastActive}</p>
                    </div>
                    {!session.current && (
                      <Button variant="ghost" size="sm" className="text-destructive text-xs">Revoke</Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
