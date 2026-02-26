import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Shield, Key, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserAvatar } from '@/components/UserAvatar';
import { currentUser } from '@/data/mockData';

export default function Profile() {
  const [form, setForm] = useState({
    firstName: currentUser.firstName,
    lastName: currentUser.lastName,
    email: currentUser.email,
  });

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

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
                  <UserAvatar user={currentUser} size="lg" />
                  <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md">
                    <Camera className="w-3 h-3 text-primary-foreground" />
                  </button>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{currentUser.firstName} {currentUser.lastName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{currentUser.role}</p>
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
                <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} />
              </div>
              <Button className="gradient-hero text-primary-foreground border-0">Save Changes</Button>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="security">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="glass-card p-6 space-y-5">
              <h3 className="section-title flex items-center gap-2"><Lock className="w-4 h-4" /> Change Password</h3>
              <div>
                <label className="input-label">Current Password</label>
                <Input type="password" placeholder="••••••••" />
              </div>
              <div>
                <label className="input-label">New Password</label>
                <Input type="password" placeholder="Min 12 characters" />
              </div>
              <div>
                <label className="input-label">Confirm New Password</label>
                <Input type="password" placeholder="••••••••" />
              </div>
              <Button className="gradient-hero text-primary-foreground border-0">Update Password</Button>
            </div>

            <div className="glass-card p-6 space-y-5">
              <h3 className="section-title flex items-center gap-2"><Key className="w-4 h-4" /> Two-Factor Authentication</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Enable 2FA</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Add an extra layer of security to your account</p>
                </div>
                <Switch />
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
