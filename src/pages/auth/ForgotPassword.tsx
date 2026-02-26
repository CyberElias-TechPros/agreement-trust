import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); setSent(true); }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground">TaskContract</span>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Check your email</h1>
            <p className="text-sm text-muted-foreground mb-6">
              We sent a password reset link to <strong className="text-foreground">{email}</strong>
            </p>
            <Link to="/login">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sign In
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-foreground mb-1">Reset password</h1>
            <p className="text-sm text-muted-foreground mb-8">Enter your email and we'll send you a reset link.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="input-label">Email</label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@company.com" />
              </div>
              <Button type="submit" className="w-full gradient-hero text-primary-foreground border-0" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              <Link to="/login" className="text-primary font-medium hover:underline flex items-center justify-center gap-1">
                <ArrowLeft className="w-3 h-3" /> Back to Sign In
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
