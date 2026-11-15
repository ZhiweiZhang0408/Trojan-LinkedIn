import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { CAREER_INTERESTS, TagInput } from '../components/TagInput';
import { Avatar, Button, ErrorNote, Field, Input, Loading, PageHeader, Panel, Select, Textarea } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useRoute } from '../hooks/useRouter';
import { useToast } from '../hooks/useToast';
import { api } from '../services/api';
import type { Profile, ProfileSettings, ProfileUpdate, ResumeInfo, ResumeVisibility } from '../services/types';

const SKILL_SUGGESTIONS = ['Python', 'SQL', 'Machine Learning', 'Data Analysis', 'React', 'Java', 'Figma', 'Excel'];

function toForm(p: Profile): ProfileUpdate {
  return { full_name: p.full_name, ...(p.student ?? p.alumni ?? {}) };
}

function clean(form: ProfileUpdate, isStudent: boolean): ProfileUpdate {
  const student = ['major', 'degree_program', 'target_roles', 'resume_url', 'portfolio_url'];
  const alumni = ['usc_degree', 'current_company', 'current_title', 'industry', 'coffee_chat_available'];
  const drop = new Set(isStudent ? alumni : student);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(form)) if (!drop.has(k)) out[k] = typeof v === 'string' ? v.trim() : v;
  if (out.graduation_year === '' || Number.isNaN(out.graduation_year)) out.graduation_year = null;
  return out as ProfileUpdate;
}

export function MyProfilePage() {
  const route = useRoute();
  const toast = useToast();
  const { data, loading, error, setData } = useAsync(() => api.myProfile(), []);
  const [form, setForm] = useState<ProfileUpdate>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOnce, setSavedOnce] = useState(false);

  useEffect(() => {
    if (data) setForm(toForm(data));
  }, [data]);

  if (loading) return <Loading label="Loading your profile" />;
  if (error || !data) return <ErrorNote message={error ?? 'Could not load your profile'} />;
  const isStudent = data.role === 'student';
  const set = <K extends keyof ProfileUpdate>(k: K, v: ProfileUpdate[K]) => setForm((f) => ({ ...f, [k]: v }));
  const text = (k: keyof ProfileUpdate) => ({
    value: (form[k] as string | undefined) ?? '',
    onChange: (e: { target: { value: string } }) => set(k, e.target.value as never),
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api.updateMyProfile(clean(form, isStudent));
      setData(() => updated);
      setSavedOnce(true);
      toast('Profile saved');
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="My profile"
        intro={
          route.query.get('welcome')
            ? 'Welcome to TrojanLink. Fill in your profile so recommendations and introductions can use it.'
            : 'This is what other Trojans see. Only you can edit it.'
        }
        actions={
          <a href={`#/profiles/${data.user_id}`} className="text-sm font-semibold text-cardinal-700 hover:underline">
            View as others see it
          </a>
        }
      />
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="grid gap-6">
          <Panel className="p-6">
            <div className="mb-6 flex items-center gap-4">
              <Avatar name={form.full_name || data.full_name} size="lg" />
              <div>
                <p className="font-display text-xl font-semibold">{form.full_name || data.full_name}</p>
                <p className="text-sm text-stone">{data.email}</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="p-name">
                <Input id="p-name" required minLength={2} {...text('full_name')} />
              </Field>
              <Field label="Graduation year" htmlFor="p-year">
                <Input
                  id="p-year"
                  type="number"
                  min={1950}
                  max={2040}
                  value={form.graduation_year ?? ''}
                  onChange={(e) => set('graduation_year', e.target.value ? Number(e.target.value) : null)}
                />
              </Field>
              {isStudent ? (
                <>
                  <Field label="USC major" htmlFor="p-major">
                    <Input id="p-major" {...text('major')} placeholder="Computer Science" />
                  </Field>
                  <Field label="Degree program" htmlFor="p-degree">
                    <Input id="p-degree" {...text('degree_program')} placeholder="B.S." />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="USC degree" htmlFor="p-usc-degree">
                    <Input id="p-usc-degree" {...text('usc_degree')} placeholder="B.S. Computer Science" />
                  </Field>
                  <Field label="Industry" htmlFor="p-industry">
                    <Input id="p-industry" {...text('industry')} placeholder="Technology" />
                  </Field>
                  <Field label="Current company" htmlFor="p-company">
                    <Input id="p-company" {...text('current_company')} />
                  </Field>
                  <Field label="Current job title" htmlFor="p-title">
                    <Input id="p-title" {...text('current_title')} />
                  </Field>
                </>
              )}
            </div>
          </Panel>

          <Panel className="grid gap-5 p-6">
            <h2 className="text-xl font-bold">{isStudent ? 'Career goals' : 'Expertise'}</h2>
            <Field label="Career interests" htmlFor="p-interests" hint="Recommendations weigh these most heavily.">
              <TagInput id="p-interests" value={form.career_interests ?? []} onChange={(v) => set('career_interests', v)}
                placeholder="Type and press Enter" suggestions={CAREER_INTERESTS} />
            </Field>
            {isStudent && (
              <Field label="Target job roles" htmlFor="p-roles">
                <TagInput id="p-roles" value={form.target_roles ?? []} onChange={(v) => set('target_roles', v)}
                  placeholder="e.g. Software Engineer" suggestions={['Software Engineer', 'Data Scientist', 'Product Manager']} />
              </Field>
            )}
            <Field label="Skills" htmlFor="p-skills">
              <TagInput id="p-skills" value={form.skills ?? []} onChange={(v) => set('skills', v)} placeholder="e.g. Python"
                suggestions={SKILL_SUGGESTIONS} />
            </Field>
            <Field
              label={isStudent ? 'Experience' : 'Professional experience'}
              htmlFor="p-exp"
              hint={isStudent ? 'Internships, research, projects, campus roles.' : undefined}
            >
              <Textarea id="p-exp" rows={4} maxLength={4000} {...text('experience')} />
            </Field>
            <Field label="Biography" htmlFor="p-bio">
              <Textarea id="p-bio" rows={4} maxLength={2000} {...text('bio')} />
            </Field>
          </Panel>

          <Panel className="grid gap-4 p-6 sm:grid-cols-2">
            <h2 className="text-xl font-bold sm:col-span-2">Links</h2>
            <Field label="LinkedIn URL" htmlFor="p-li">
              <Input id="p-li" type="url" placeholder="https://" {...text('linkedin_url')} />
            </Field>
            {isStudent && (
              <>
                <Field label="Resume URL" htmlFor="p-resume">
                  <Input id="p-resume" type="url" placeholder="https://" {...text('resume_url')} />
                </Field>
                <Field label="Portfolio URL" htmlFor="p-portfolio">
                  <Input id="p-portfolio" type="url" placeholder="https://" {...text('portfolio_url')} />
                </Field>
              </>
            )}
          </Panel>
        </div>

        <aside className="grid content-start gap-6">
          <Panel className="grid gap-4 p-5">
            {!isStudent && (
              <div className="grid gap-3">
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-0.5 accent-cardinal-600" checked={Boolean(form.coffee_chat_available)}
                    onChange={(e) => set('coffee_chat_available', e.target.checked)} />
                  <span>
                    <span className="font-semibold">Open to coffee chats</span>
                    <span className="block text-xs text-stone">Students can send you requests.</span>
                  </span>
                </label>
              </div>
            )}
            {saveError && <ErrorNote message={saveError} />}
            <Button type="submit" busy={saving} className="w-full">
              Save profile
            </Button>
            {isStudent && savedOnce && (
              <a href="#/discover" className="rounded-lg bg-gold-100 px-3 py-2.5 text-center text-sm font-semibold text-ink hover:bg-gold-200">
                See alumni recommended for you
              </a>
            )}
          </Panel>
          {isStudent && (
            <ResumeManager
              resume={data.resume}
              userId={data.user_id}
              onChange={(resume) => setData((prev) => prev && { ...prev, resume })}
            />
          )}
          <SettingsPanel isStudent={isStudent} onVisibility={(v) => setData((prev) => prev && prev.resume ? { ...prev, resume: { ...prev.resume, visibility: v } } : prev)} />
        </aside>
      </form>
    </div>
  );
}

const VISIBILITY_LABEL: Record<ResumeVisibility, string> = {
  private: 'Only me',
  connections: 'My connections',
  everyone: 'Anyone signed in',
};

export function openBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function ResumeManager({ resume, userId, onChange }: { resume: ResumeInfo | null; userId: number; onChange: (r: ResumeInfo | null) => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    if (file.type && file.type !== 'application/pdf') return setError('Choose a PDF file.');
    if (file.size > 5 * 1024 * 1024) return setError('The file is larger than 5 MB.');
    setBusy(true);
    try {
      onChange(await api.uploadResume(file));
      toast('Resume uploaded');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.deleteResume();
      onChange(null);
      toast('Resume removed', 'info');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const view = async () => {
    try {
      openBlob(await api.downloadResume(userId), resume?.filename ?? 'resume.pdf');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  return (
    <Panel className="grid gap-3 p-5">
      <h2 className="text-lg font-bold">Resume</h2>
      {resume ? (
        <div className="rounded-lg bg-canvas p-3">
          <p className="truncate text-sm font-semibold">{resume.filename}</p>
          <p className="text-xs text-stone">
            {resume.size < 1024 ? `${resume.size} bytes` : `${Math.round(resume.size / 1024)} KB`}, uploaded {new Date(resume.uploaded_at).toLocaleDateString()}
          </p>
          <p className="mt-1 text-xs text-stone">Visible to: {VISIBILITY_LABEL[resume.visibility]}</p>
        </div>
      ) : (
        <p className="text-sm text-stone">Upload a PDF so connections can review your background before a coffee chat.</p>
      )}
      <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={pick} aria-label="Resume PDF" />
      {error && <ErrorNote message={error} />}
      <div className="flex flex-wrap items-center gap-1">
        <Button type="button" variant={resume ? 'secondary' : 'primary'} size="sm" busy={busy} onClick={() => input.current?.click()}>
          {resume ? 'Replace PDF' : 'Upload PDF'}
        </Button>
        {resume && (
          <>
            <Button type="button" variant="ghost" size="sm" className="px-2!" onClick={view} aria-label={`View ${resume.filename}`}>View</Button>
            <Button type="button" variant="ghost" size="sm" className="px-2!" disabled={busy} onClick={remove} aria-label="Remove uploaded resume">Remove</Button>
          </>
        )}
      </div>
      <p className="text-xs text-stone">PDF only, up to 5 MB. You can also add a resume link in the Links section.</p>
    </Panel>
  );
}

function SettingsPanel({ isStudent, onVisibility }: { isStudent: boolean; onVisibility: (v: ResumeVisibility) => void }) {
  const toast = useToast();
  const s = useAsync<ProfileSettings>(() => api.settings(), []);
  const save = async (patch: Partial<ProfileSettings>) => {
    const before = s.data;
    s.setData((prev) => prev && { ...prev, ...patch }); // optimistic: the control reacts immediately
    try {
      const next = await api.updateSettings(patch);
      s.setData(() => next);
      if (patch.resume_visibility) onVisibility(patch.resume_visibility);
      toast('Settings saved');
    } catch (err) {
      s.setData(() => before); // roll back on failure
      toast((err as Error).message, 'error');
    }
  };
  if (!s.data) return null;
  return (
    <Panel className="grid gap-4 p-5">
      <h2 className="text-lg font-bold">Profile settings</h2>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 accent-cardinal-600" checked={s.data.discoverable} onChange={(e) => save({ discoverable: e.target.checked })} />
        <span>
          <span className="font-semibold">Show me in search</span>
          <span className="block text-xs text-stone">
            {isStudent ? 'Other students can find you under Find students.' : 'Students can find you in the directory and recommendations.'}
          </span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 accent-cardinal-600" checked={s.data.show_email_to_connections}
          onChange={(e) => save({ show_email_to_connections: e.target.checked })} />
        <span>
          <span className="font-semibold">Share my email with connections</span>
          <span className="block text-xs text-stone">Only people you're connected with or have a confirmed coffee chat with.</span>
        </span>
      </label>
      {isStudent && s.data.resume_visibility && (
        <Field label="Who can see my resume" htmlFor="set-resume" hint="Connections include people you have a confirmed coffee chat with.">
          <Select id="set-resume" value={s.data.resume_visibility} onChange={(e) => save({ resume_visibility: e.target.value as ResumeVisibility })}>
            {(Object.keys(VISIBILITY_LABEL) as ResumeVisibility[]).map((v) => (
              <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>
            ))}
          </Select>
        </Field>
      )}
    </Panel>
  );
}
