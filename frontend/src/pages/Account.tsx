import { useState, useEffect } from 'react';
import { UserCircle, Mail, Globe, KeyRound, Check } from 'lucide-react';
import { useAccount, useUpdateProfile, useChangePassword } from '../lib/queries';
import { Button } from '../components/Button';
import { SpinnerCentered } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { ApiError } from '../lib/api';
import styles from './Account.module.css';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', upload: 'Upload', edit: 'Edit metadata', download: 'Download',
  delete_books: 'Delete books', edit_shelfs: 'Edit public shelves', viewer: 'Viewer',
  passwd: 'Change password',
};

export function Account() {
  const { data: account, isLoading, error } = useAccount();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  // Profile form
  const [email, setEmail] = useState('');
  const [kindleMail, setKindleMail] = useState('');
  const [locale, setLocale] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Password form
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Seed the profile form once the account loads.
  useEffect(() => {
    if (!account) return;
    setEmail(account.email);
    setKindleMail(account.kindle_mail);
    setLocale(account.locale);
    setDefaultLanguage(account.default_language);
  }, [account]);

  if (isLoading) return <SpinnerCentered size={40} />;
  if (error || !account) {
    return (
      <main className={styles.container}>
        <EmptyState message={error instanceof Error ? error.message : 'Could not load your account.'} />
      </main>
    );
  }

  const onSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    updateProfile.mutate(
      { email, kindle_mail: kindleMail, locale, default_language: defaultLanguage },
      {
        onSuccess: () => setProfileMsg({ ok: true, text: 'Profile saved.' }),
        onError: (err) =>
          setProfileMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Could not save.' }),
      },
    );
  };

  const onChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) {
      setPwMsg({ ok: false, text: 'New passwords do not match.' });
      return;
    }
    changePassword.mutate(
      { current_password: currentPw, new_password: newPw },
      {
        onSuccess: () => {
          setPwMsg({ ok: true, text: 'Password changed.' });
          setCurrentPw('');
          setNewPw('');
          setConfirmPw('');
        },
        onError: (err) =>
          setPwMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Could not change password.' }),
      },
    );
  };

  const activeRoles = Object.entries(account.role).filter(([, v]) => v);

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>Account</h1>

      {/* Identity */}
      <section className={styles.card}>
        <div className={styles.identity}>
          <UserCircle size={48} className={styles.avatar} />
          <div>
            <p className={styles.name}>{account.name}</p>
            <div className={styles.roles}>
              {activeRoles.map(([key]) => (
                <span key={key} className={styles.roleBadge}>{ROLE_LABELS[key] ?? key}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Profile */}
      <form className={styles.card} onSubmit={onSaveProfile}>
        <h2 className={styles.cardTitle}><Mail size={16} /> Profile</h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="acc-email">Email</label>
          <input id="acc-email" type="email" className={styles.input}
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="acc-kindle">Send-to-eReader email</label>
          <input id="acc-kindle" type="text" className={styles.input}
            value={kindleMail} onChange={(e) => setKindleMail(e.target.value)}
            placeholder="kindle@kindle.com" />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="acc-locale"><Globe size={13} /> Interface language</label>
            <select id="acc-locale" className={styles.input}
              value={locale} onChange={(e) => setLocale(e.target.value)}>
              {account.locales.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="acc-lang">Show books in language</label>
            <select id="acc-lang" className={styles.input}
              value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value)}>
              {account.languages.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>

        <div className={styles.actions}>
          <Button type="submit" disabled={updateProfile.isPending}>
            <Check size={16} /> Save profile
          </Button>
          {profileMsg && (
            <span className={profileMsg.ok ? styles.msgOk : styles.msgErr}>{profileMsg.text}</span>
          )}
        </div>
      </form>

      {/* Password */}
      {account.can_change_password && (
        <form className={styles.card} onSubmit={onChangePassword}>
          <h2 className={styles.cardTitle}><KeyRound size={16} /> Change password</h2>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="acc-cur">Current password</label>
            <input id="acc-cur" type="password" autoComplete="current-password" className={styles.input}
              value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="acc-new">New password</label>
              <input id="acc-new" type="password" autoComplete="new-password" className={styles.input}
                value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="acc-confirm">Confirm new password</label>
              <input id="acc-confirm" type="password" autoComplete="new-password" className={styles.input}
                value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            </div>
          </div>

          <div className={styles.actions}>
            <Button type="submit" variant="ghost"
              disabled={changePassword.isPending || !currentPw || !newPw}>
              <KeyRound size={15} /> Update password
            </Button>
            {pwMsg && (
              <span className={pwMsg.ok ? styles.msgOk : styles.msgErr}>{pwMsg.text}</span>
            )}
          </div>
        </form>
      )}
    </main>
  );
}
