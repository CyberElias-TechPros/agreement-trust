import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, FileText, Users, Calendar, Tag, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import type { ApiUser } from '@/types/api';
import type { ContractPriority } from '@/types/contracts';

const steps = [
  { label: 'Basic Info', icon: FileText },
  { label: 'Assignment', icon: Users },
  { label: 'Parameters', icon: Calendar },
  { label: 'Review', icon: Tag },
];

type User = ApiUser;

interface Category {
  id: string;
  name: string;
  color: string;
}

export default function CreateContract() {
  const navigate = useNavigate();
  const { organizations } = useAuth();
  const organizationId = organizations?.[0]?.id;
  
  const [step, setStep] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    executorId: '',
    observerIds: [] as string[],
    deadline: '',
    priority: 'medium' as string,
    categoryId: '',
    tags: '',
  });

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    try {
      const [usersData, categoriesData] = await Promise.all([
        api.getOrganizationUsers(organizationId),
        api.getCategories(organizationId),
      ]);
      setUsers(usersData.users || []);
      setCategories(categoriesData.categories || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      loadData();
    }
  }, [organizationId, loadData]);

  const update = (key: keyof typeof form, value: string | string[]) => setForm(prev => ({ ...prev, [key]: value }));
  const canProceed = step === 0 ? form.title && form.description : step === 1 ? form.executorId : true;
  const executor = users.find(u => u.id === form.executorId);
  const category = categories.find(c => c.id === form.categoryId);

  const handleSubmit = async () => {
    if (!organizationId) return;
    setSubmitting(true);
    try {
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
      await api.createContract(organizationId, {
        title: form.title,
        description: form.description,
        deadline: form.deadline || undefined,
        priority: form.priority,
        categoryId: form.categoryId || undefined,
        executorId: form.executorId || undefined,
        tags,
      });
      navigate('/contracts');
    } catch (error) {
      console.error('Failed to create contract:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <h1 className="page-title mb-2">Create New Contract</h1>
      <p className="page-subtitle mb-8">Set up a new task contract for delegation.</p>

      {/* Steps */}
      <div className="flex items-center gap-1 mb-8">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center flex-1">
            <button
              onClick={() => i <= step && setStep(i)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all w-full',
                i === step ? 'bg-primary/10 text-primary' :
                i < step ? 'text-success' : 'text-muted-foreground'
              )}
            >
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold',
                i === step ? 'bg-primary text-primary-foreground' :
                i < step ? 'bg-success text-success-foreground' : 'bg-secondary text-muted-foreground'
              )}>
                {i + 1}
              </div>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < steps.length - 1 && <div className="w-4 h-px bg-border shrink-0" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <motion.div
        key={step}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="glass-card p-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <>
              {step === 0 && (
                <div className="space-y-5">
                  <div>
                    <label className="input-label">Contract Title *</label>
                    <Input value={form.title} onChange={e => update('title', e.target.value)} placeholder="e.g., Redesign Customer Dashboard UI" />
                  </div>
                  <div>
                    <label className="input-label">Description *</label>
                    <Textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Describe the scope of work, deliverables, and expectations..." rows={6} />
                  </div>
                  <div>
                    <label className="input-label">Attachments</label>
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/30 transition-colors cursor-pointer">
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Drag & drop files here, or <span className="text-primary">browse</span></p>
                      <p className="text-[11px] text-muted-foreground mt-1">PDF, DOC, PNG up to 10MB</p>
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <label className="input-label">Assign Executor *</label>
                    <Select value={form.executorId} onValueChange={v => update('executorId', v)}>
                      <SelectTrigger className="bg-secondary/50 border-0"><SelectValue placeholder="Select team member..." /></SelectTrigger>
                      <SelectContent>
                        {users.filter(u => u.role === 'executor' || u.role === 'manager').map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName} — {u.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="input-label">Add Observers (optional)</label>
                    <Select onValueChange={v => !form.observerIds.includes(v) && update('observerIds', [...form.observerIds, v])}>
                      <SelectTrigger className="bg-secondary/50 border-0"><SelectValue placeholder="Add observers..." /></SelectTrigger>
                      <SelectContent>
                        {users.filter(u => !form.observerIds.includes(u.id) && u.id !== form.executorId).map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.observerIds.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {form.observerIds.map(id => {
                          const u = users.find(u => u.id === id);
                          return u ? (
                            <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary text-xs font-medium">
                              {u.firstName} {u.lastName}
                              <button onClick={() => update('observerIds', form.observerIds.filter(x => x !== id))} className="text-muted-foreground hover:text-foreground">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <label className="input-label">Deadline</label>
                    <Input type="datetime-local" value={form.deadline} onChange={e => update('deadline', e.target.value)} className="bg-secondary/50 border-0" />
                  </div>
                  <div>
                    <label className="input-label">Priority</label>
                    <Select value={form.priority} onValueChange={v => update('priority', v)}>
                      <SelectTrigger className="bg-secondary/50 border-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="input-label">Category</label>
                    <Select value={form.categoryId} onValueChange={v => update('categoryId', v)}>
                      <SelectTrigger className="bg-secondary/50 border-0"><SelectValue placeholder="Select category..." /></SelectTrigger>
                      <SelectContent>
                        {categories.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="input-label">Tags</label>
                    <Input value={form.tags} onChange={e => update('tags', e.target.value)} placeholder="Comma-separated tags" className="bg-secondary/50 border-0" />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h3 className="section-title">Contract Preview</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Title</span>
                      <span className="font-medium text-foreground">{form.title}</span>
                    </div>
                    <div className="py-2 border-b border-border">
                      <span className="text-muted-foreground block mb-1">Description</span>
                      <p className="text-foreground">{form.description}</p>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Executor</span>
                      <span className="font-medium text-foreground">{executor ? `${executor.firstName} ${executor.lastName}` : 'None'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Deadline</span>
                      <span className="font-medium text-foreground">{form.deadline ? new Date(form.deadline).toLocaleDateString() : 'None'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Priority</span>
                      <span className="font-medium text-foreground capitalize">{form.priority}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Category</span>
                      <span className="font-medium text-foreground">{category?.name || 'None'}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button variant="outline" onClick={() => step > 0 ? setStep(step - 1) : navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> {step > 0 ? 'Previous' : 'Cancel'}
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canProceed} className="gradient-hero text-primary-foreground border-0">
            Next <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting} className="gradient-hero text-primary-foreground border-0 shadow-glow">
            {submitting ? 'Sending...' : 'Send Contract'} <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
