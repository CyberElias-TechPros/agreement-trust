import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Shield, GitBranch, Users, ArrowRight, CheckCircle2, ChevronRight, Zap, Lock, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  { icon: GitBranch, title: 'Immutable Versioning', description: 'Every edit creates a new version. The original agreement is always preserved and auditable.' },
  { icon: Shield, title: 'Structured Accountability', description: 'Categorized interactions replace chaotic chat threads. Progress, issues, and submissions are organized.' },
  { icon: Lock, title: 'Tamper-Proof Audit Trail', description: 'Every action is logged with timestamps, checksums, and user identity. Disputes have clear evidence.' },
  { icon: Users, title: 'Role-Based Access', description: 'Managers, executors, and observers each see exactly what they need. No more, no less.' },
  { icon: BarChart3, title: 'Analytics & Reports', description: 'Track completion rates, team workload, and contract performance with real-time dashboards.' },
  { icon: Zap, title: 'Real-Time Updates', description: 'WebSocket-powered notifications keep everyone in sync. No refreshing, no missed updates.' },
];

const stats = [
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '<200ms', label: 'API Response' },
  { value: '256-bit', label: 'Encryption' },
  { value: 'SOC 2', label: 'Compliant' },
];

const pricingPlans = [
  { name: 'Starter', price: 'Free', period: '', features: ['5 active contracts', '2 team members', 'Basic audit trail', 'Email notifications'], cta: 'Get Started', popular: false },
  { name: 'Professional', price: '$12', period: '/user/mo', features: ['Unlimited contracts', 'Unlimited members', 'Full audit + export', 'Custom categories', 'API access', 'Priority support'], cta: 'Start Free Trial', popular: true },
  { name: 'Enterprise', price: 'Custom', period: '', features: ['Everything in Pro', 'SSO / SAML', 'Advanced RBAC', 'Data residency', 'Dedicated support', 'Custom integrations'], cta: 'Contact Sales', popular: false },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">TaskContract</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#security" className="hover:text-foreground transition-colors">Security</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Sign In</Button>
            <Button size="sm" onClick={() => navigate('/register')} className="gradient-hero text-primary-foreground border-0">
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(217_91%_50%_/_0.08),_transparent_60%)]" />
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-primary text-xs font-semibold mb-6">
              <Zap className="w-3 h-3" /> Delegation Governance Platform
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1] mb-6">
              Eliminate Task<br />
              <span className="gradient-text">Ambiguity Forever</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
              Immutable contracts, version-locked agreements, and structured interactions that create clear accountability between delegators and executors.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button size="lg" onClick={() => navigate('/register')} className="gradient-hero text-primary-foreground border-0 shadow-glow h-12 px-8">
                Start Free Trial <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8" onClick={() => navigate('/login')}>
                View Demo
              </Button>
            </div>
          </motion.div>

          {/* Hero Visual */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-16 max-w-4xl mx-auto"
          >
            <div className="glass-card p-1 shadow-xl">
              <div className="bg-sidebar rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-destructive/60" />
                  <div className="w-3 h-3 rounded-full bg-warning/60" />
                  <div className="w-3 h-3 rounded-full bg-success/60" />
                </div>
                <div className="grid grid-cols-12 gap-3 h-64">
                  <div className="col-span-3 bg-sidebar-accent rounded-lg p-3 space-y-2">
                    {['Dashboard', 'Contracts', 'Reports'].map((item, i) => (
                      <div key={item} className={`h-8 rounded-md flex items-center px-3 text-xs font-medium ${i === 1 ? 'bg-sidebar-primary/20 text-sidebar-primary' : 'text-sidebar-foreground/50'}`}>
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="col-span-9 bg-background rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-32 bg-foreground/10 rounded" />
                      <div className="status-badge bg-status-in-progress/10 text-status-in-progress text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-in-progress" />
                        In Progress
                      </div>
                    </div>
                    <div className="h-3 w-full bg-foreground/5 rounded" />
                    <div className="h-3 w-3/4 bg-foreground/5 rounded" />
                    <div className="flex gap-2 mt-4">
                      {[60, 75, 90].map((w, i) => (
                        <div key={i} className="flex-1 h-20 rounded-lg bg-secondary/60 p-3">
                          <div className="h-2 w-8 bg-primary/20 rounded mb-2" />
                          <div className="h-2 w-full bg-foreground/5 rounded" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-3xl mx-auto">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="text-center"
              >
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-secondary/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-3">Built for Accountability</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">Every feature is designed to create clarity in delegated work and eliminate disputes.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: i * 0.08 }}
                className="glass-card-hover p-6"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-3">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground">Start free. Scale as you grow.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {pricingPlans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`glass-card p-6 flex flex-col ${plan.popular ? 'border-primary/30 shadow-glow ring-1 ring-primary/20' : ''}`}
              >
                {plan.popular && (
                  <span className="status-badge bg-primary/10 text-primary self-start mb-4">Most Popular</span>
                )}
                <h3 className="font-semibold text-foreground text-lg">{plan.name}</h3>
                <div className="mt-3 mb-6">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-3 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className={plan.popular ? 'gradient-hero text-primary-foreground border-0' : ''}
                  variant={plan.popular ? 'default' : 'outline'}
                  onClick={() => navigate('/register')}
                >
                  {plan.cta}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-secondary/30">
        <div className="max-w-xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Eliminate Ambiguity?</h2>
          <p className="text-muted-foreground mb-8">Start with a free account. No credit card required.</p>
          <Button size="lg" onClick={() => navigate('/register')} className="gradient-hero text-primary-foreground border-0 shadow-glow h-12 px-8">
            Get Started Free <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded gradient-hero flex items-center justify-center">
              <FileText className="w-2.5 h-2.5 text-primary-foreground" />
            </div>
            TaskContract
          </div>
          <p>© 2025 TaskContract. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
