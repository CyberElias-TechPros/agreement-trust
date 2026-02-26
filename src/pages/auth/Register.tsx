import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Register() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', orgName: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) { setStep(2); return; }
    setLoading(true);
    setTimeout(() => { setLoading(false); navigate('/dashboard'); }, 800);
  };

  const update = (key: string, value: string) => setForm({ ...form, [key]: value });

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 gradient-hero relative items-center justify-center p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,_hsl(0_0%_100%_/_0.1),_transparent_50%)]" />
        <div className="relative text-primary-foreground max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center backdrop-blur-sm">
              <FileText className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl">TaskContract</span>
          </div>
          <h2 className="text-3xl font-bold mb-4 leading-tight">Start governing your<br />delegated work today.</h2>
          <p className="text-primary-foreground/70 leading-relaxed">Create immutable task contracts, track every interaction, and build a complete audit trail.</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">TaskContract</span>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1">Create your account</h1>
          <p className="text-sm text-muted-foreground mb-8">Step {step} of 2 — {step === 1 ? 'Personal info' : 'Organization'}</p>

          {/* Progress */}
          <div className="flex gap-2 mb-6">
            <div className="h-1 rounded-full flex-1 bg-primary" />
            <div className={`h-1 rounded-full flex-1 ${step >= 2 ? 'bg-primary' : 'bg-border'} transition-colors`} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">First name</label>
                    <Input value={form.firstName} onChange={e => update('firstName', e.target.value)} required placeholder="Alex" />
                  </div>
                  <div>
                    <label className="input-label">Last name</label>
                    <Input value={form.lastName} onChange={e => update('lastName', e.target.value)} required placeholder="Morgan" />
                  </div>
                </div>
                <div>
                  <label className="input-label">Email</label>
                  <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} required placeholder="you@company.com" />
                </div>
                <div>
                  <label className="input-label">Password</label>
                  <div className="relative">
                    <Input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => update('password', e.target.value)} required placeholder="Min 12 characters" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="input-label">Organization name</label>
                <Input value={form.orgName} onChange={e => update('orgName', e.target.value)} required placeholder="Acme Corporation" />
                <p className="text-xs text-muted-foreground mt-1.5">You can invite team members later.</p>
              </div>
            )}

            <Button type="submit" className="w-full gradient-hero text-primary-foreground border-0" disabled={loading}>
              {loading ? 'Creating account...' : step === 1 ? 'Continue' : 'Create Account'}
            </Button>

            {step === 2 && (
              <Button type="button" variant="ghost" className="w-full" onClick={() => setStep(1)}>Back</Button>
            )}
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
