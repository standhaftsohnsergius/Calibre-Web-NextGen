import { useState } from 'react';
import { Shield, Trash2, Mail, UserPlus, ExternalLink, Settings, Database, Server, Clock, FileText, Sliders, BarChart3, Files } from 'lucide-react';
import { useEffect } from 'react';
import {
  useAdminUsers, useUpdateAdminUser, useDeleteAdminUser, useCreateAdminUser, useMe,
  useAdminConfig, useUpdateAdminConfig, useMailConfig, useUpdateMailConfig,
} from '../lib/queries';
import { SpinnerCentered } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import type { AdminUser } from '../lib/api';
import { ApiError } from '../lib/api';
import { useT } from '../lib/i18n';
import styles from './Admin.module.css';

// Server-configuration pages. Under the hybrid cutover these open the proven
// legacy admin UI (rarely-touched set-once config) rather than being rebuilt in
// React — no capability is dropped; an admin occasionally lands on a Jinja page.
const SERVER_SETTINGS: { href: string; label: string; icon: typeof Settings }[] = [
  { href: '/admin/view', label: 'Full user table & restrictions', icon: Shield },
  { href: '/admin/config', label: 'Basic configuration', icon: Settings },
  { href: '/admin/viewconfig', label: 'UI / display configuration', icon: Sliders },
  { href: '/admin/dbconfig', label: 'Database & library path', icon: Database },
  { href: '/admin/scheduledtasks', label: 'Scheduled tasks', icon: Clock },
  { href: '/cwa-settings', label: 'CWA settings (ingest/convert)', icon: Server },
  { href: '/cwa-stats-show', label: 'Statistics dashboard', icon: BarChart3 },
  { href: '/admin/logfile', label: 'Logs', icon: FileText },
  { href: '/duplicates', label: 'Duplicate books', icon: Files },
];

// Order + labels for the role toggles shown per user.
const ROLE_FIELDS: { key: string; label: string }[] = [
  { key: 'admin', label: 'Admin' },
  { key: 'upload', label: 'Upload' },
  { key: 'edit', label: 'Edit metadata' },
  { key: 'download', label: 'Download' },
  { key: 'delete_books', label: 'Delete books' },
  { key: 'edit_shelfs', label: 'Edit public shelves' },
  { key: 'passwd', label: 'Change password' },
  { key: 'viewer', label: 'Viewer' },
];

export function Admin() {
  const t = useT();
  const { data, isLoading, error } = useAdminUsers();
  const updateUser = useUpdateAdminUser();
  const deleteUser = useDeleteAdminUser();
  const createUser = useCreateAdminUser();
  const me = useMe().data;
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', password: '', email: '', upload: false });

  if (isLoading) return <SpinnerCentered size={40} />;
  if (error || !data) {
    return (
      <main className={styles.container}>
        <EmptyState message={error instanceof Error ? error.message : 'Could not load users.'} />
      </main>
    );
  }

  const toggleRole = (user: AdminUser, key: string, value: boolean) => {
    setBanner(null);
    updateUser.mutate(
      { id: user.id, roles: { [key]: value } },
      {
        onError: (err) =>
          setBanner({ ok: false, text: err instanceof ApiError ? err.message : 'Update failed.' }),
      },
    );
  };

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    createUser.mutate(
      {
        name: form.name.trim(),
        password: form.password,
        email: form.email.trim() || undefined,
        roles: { download: true, viewer: true, upload: form.upload },
      },
      {
        onSuccess: (u) => {
          setBanner({ ok: true, text: `Created ${u.name}.` });
          setForm({ name: '', password: '', email: '', upload: false });
          setShowNew(false);
        },
        onError: (err) =>
          setBanner({ ok: false, text: err instanceof ApiError ? err.message : 'Create failed.' }),
      },
    );
  };

  const onDelete = (user: AdminUser) => {
    if (!window.confirm(`Delete user "${user.name}"? Their shelves and reading data are removed too.`)) return;
    setBanner(null);
    deleteUser.mutate(user.id, {
      onSuccess: () => setBanner({ ok: true, text: `Deleted ${user.name}.` }),
      onError: (err) =>
        setBanner({ ok: false, text: err instanceof ApiError ? err.message : 'Delete failed.' }),
    });
  };

  return (
    <main className={styles.container}>
      <div className={styles.header}>
        <Shield size={22} className={styles.headerIcon} />
        <h1 className={styles.title}>{t('User administration')}</h1>
        <span className={styles.count}>{data.items.length}</span>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => { setShowNew((v) => !v); setBanner(null); }}
        >
          <UserPlus size={16} /> {t('New user')}
        </button>
      </div>

      {banner && <p className={banner.ok ? styles.msgOk : styles.msgErr}>{banner.text}</p>}

      {showNew && (
        <form className={styles.newForm} onSubmit={onCreate}>
          <div className={styles.newRow}>
            <label className={styles.field}>
              <span>{t('Username')}</span>
              <input
                value={form.name} required autoFocus
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span>{t('Password')}</span>
              <input
                type="password" value={form.password} required
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span>{t('Email (optional)')}</span>
              <input
                type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
          </div>
          <div className={styles.newActions}>
            <label className={styles.roleToggle}>
              <input
                type="checkbox" checked={form.upload}
                onChange={(e) => setForm({ ...form, upload: e.target.checked })}
              />
              {t('Can upload books')}
            </label>
            <button type="submit" className={styles.submitBtn} disabled={createUser.isPending}>
              {createUser.isPending ? t('Creating…') : t('Create user')}
            </button>
          </div>
        </form>
      )}

      <div className={styles.users}>
        {data.items.map((user) => {
          const isSelf = me?.id === user.id;
          return (
            <section key={user.id} className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <p className={styles.name}>
                    {user.name}
                    {isSelf && <span className={styles.youBadge}>{t('you')}</span>}
                  </p>
                  {user.email && (
                    <p className={styles.email}><Mail size={12} /> {user.email}</p>
                  )}
                </div>
                {!isSelf && !user.is_guest && (
                  <button className={styles.deleteBtn} onClick={() => onDelete(user)}
                    disabled={deleteUser.isPending} aria-label={`Delete ${user.name}`}>
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              <div className={styles.roles}>
                {ROLE_FIELDS.map(({ key, label }) => (
                  <label key={key} className={styles.roleToggle}>
                    <input
                      type="checkbox"
                      checked={!!user.roles[key]}
                      disabled={updateUser.isPending}
                      onChange={(e) => toggleRole(user, key, e.target.checked)}
                    />
                    {t(label)}
                  </label>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <AdminConfigForm />
      <MailConfigForm />

      <div className={styles.settingsHead}>
        <Settings size={18} className={styles.headerIcon} />
        <h2 className={styles.settingsTitle}>{t('More server configuration')}</h2>
      </div>
      <p className={styles.settingsHint}>
        {t('These open the full configuration pages. Changes there apply to the whole server.')}
      </p>
      <div className={styles.settingsGrid}>
        {SERVER_SETTINGS.map(({ href, label, icon: Icon }) => (
          <a key={href} href={href} className={styles.settingsCard}>
            <Icon size={18} className={styles.settingsIcon} />
            <span className={styles.settingsLabel}>{t(label)}</span>
            <ExternalLink size={13} className={styles.settingsExt} />
          </a>
        ))}
      </div>
    </main>
  );
}

/** Native UI-configuration form (books/page, default language/locale, theme,
 *  random count, title, announcement). The deep security config (LDAP/OAuth/
 *  SMTP/SSL) stays on the legacy pages linked below. */
function AdminConfigForm() {
  const t = useT();
  const { data: cfg } = useAdminConfig();
  const update = useUpdateAdminConfig();
  const [form, setForm] = useState<Record<string, string | number>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!cfg) return;
    setForm({
      config_calibre_web_title: cfg.config_calibre_web_title,
      config_books_per_page: cfg.config_books_per_page,
      config_random_books: cfg.config_random_books,
      config_authors_max: cfg.config_authors_max,
      config_theme: cfg.config_theme,
      config_default_language: cfg.config_default_language,
      config_default_locale: cfg.config_default_locale,
      config_server_announcement: cfg.config_server_announcement,
    });
  }, [cfg]);

  if (!cfg) return null;
  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    update.mutate(form, {
      onSuccess: () => setMsg({ ok: true, text: t('Settings saved.') }),
      onError: (err) => setMsg({ ok: false, text: err instanceof ApiError ? err.message : t('Could not save.') }),
    });
  };

  return (
    <form className={styles.newForm} onSubmit={onSubmit}>
      <div className={styles.settingsHead} style={{ marginTop: 0 }}>
        <Settings size={18} className={styles.headerIcon} />
        <h2 className={styles.settingsTitle}>{t('Library settings')}</h2>
      </div>
      <div className={styles.newRow}>
        <label className={styles.field}>
          <span>{t('Site title')}</span>
          <input value={String(form.config_calibre_web_title ?? '')}
            onChange={(e) => set('config_calibre_web_title', e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>{t('Books per page')}</span>
          <input type="number" min={1} value={String(form.config_books_per_page ?? '')}
            onChange={(e) => set('config_books_per_page', e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>{t('Random books shown')}</span>
          <input type="number" min={0} value={String(form.config_random_books ?? '')}
            onChange={(e) => set('config_random_books', e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>{t('Max authors shown')}</span>
          <input type="number" min={0} value={String(form.config_authors_max ?? '')}
            onChange={(e) => set('config_authors_max', e.target.value)} />
        </label>
      </div>
      <div className={styles.newRow}>
        <label className={styles.field}>
          <span>{t('Theme')}</span>
          <select value={String(form.config_theme ?? 1)} onChange={(e) => set('config_theme', e.target.value)}>
            <option value="0">{t('Light')}</option>
            <option value="1">{t('Dark')}</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>{t('Default interface language')}</span>
          <select value={String(form.config_default_locale ?? 'en')}
            onChange={(e) => set('config_default_locale', e.target.value)}>
            {cfg.locales.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span>{t('Default book language')}</span>
          <select value={String(form.config_default_language ?? 'all')}
            onChange={(e) => set('config_default_language', e.target.value)}>
            {cfg.languages.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
      </div>
      <label className={styles.field}>
        <span>{t('Server announcement (shown to all users)')}</span>
        <input value={String(form.config_server_announcement ?? '')}
          onChange={(e) => set('config_server_announcement', e.target.value)} />
      </label>
      <div className={styles.newActions}>
        <button type="submit" className={styles.submitBtn} disabled={update.isPending}>
          {update.isPending ? t('Saving…') : t('Save settings')}
        </button>
        {msg && <span className={msg.ok ? styles.msgOk : styles.msgErr}>{msg.text}</span>}
      </div>
    </form>
  );
}

/** Native SMTP / email server settings. Password is write-only: blank = keep
 *  the existing one. (Security-review gated before merge — writes a secret.) */
function MailConfigForm() {
  const t = useT();
  const { data: cfg } = useMailConfig();
  const update = useUpdateMailConfig();
  const [form, setForm] = useState<Record<string, string | number>>({});
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!cfg) return;
    setForm({
      mail_server: cfg.mail_server, mail_port: cfg.mail_port, mail_use_ssl: cfg.mail_use_ssl,
      mail_login: cfg.mail_login, mail_from: cfg.mail_from, mail_size_mb: cfg.mail_size_mb,
    });
  }, [cfg]);

  if (!cfg) return null;
  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    update.mutate({ ...form, ...(pw ? { mail_password: pw } : {}) }, {
      onSuccess: () => { setMsg({ ok: true, text: t('Email settings saved.') }); setPw(''); },
      onError: (err: unknown) => setMsg({ ok: false, text: err instanceof ApiError ? err.message : t('Could not save.') }),
    });
  };

  return (
    <form className={styles.newForm} onSubmit={onSubmit}>
      <div className={styles.settingsHead} style={{ marginTop: 0 }}>
        <Mail size={18} className={styles.headerIcon} />
        <h2 className={styles.settingsTitle}>{t('Email (SMTP) server')}</h2>
      </div>
      <div className={styles.newRow}>
        <label className={styles.field}>
          <span>{t('SMTP server')}</span>
          <input value={String(form.mail_server ?? '')} onChange={(e) => set('mail_server', e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>{t('Port')}</span>
          <input type="number" value={String(form.mail_port ?? '')} onChange={(e) => set('mail_port', e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>{t('Encryption')}</span>
          <select value={String(form.mail_use_ssl ?? 0)} onChange={(e) => set('mail_use_ssl', e.target.value)}>
            <option value="0">{t('None')}</option>
            <option value="1">{t('STARTTLS')}</option>
            <option value="2">{t('SSL/TLS')}</option>
          </select>
        </label>
      </div>
      <div className={styles.newRow}>
        <label className={styles.field}>
          <span>{t('Login')}</span>
          <input value={String(form.mail_login ?? '')} onChange={(e) => set('mail_login', e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>{cfg.has_password ? t('Password (leave blank to keep)') : t('Password')}</span>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        </label>
        <label className={styles.field}>
          <span>{t('From address')}</span>
          <input value={String(form.mail_from ?? '')} onChange={(e) => set('mail_from', e.target.value)} />
        </label>
      </div>
      <div className={styles.newActions}>
        <button type="submit" className={styles.submitBtn} disabled={update.isPending}>
          {update.isPending ? t('Saving…') : t('Save email settings')}
        </button>
        {msg && <span className={msg.ok ? styles.msgOk : styles.msgErr}>{msg.text}</span>}
      </div>
    </form>
  );
}
