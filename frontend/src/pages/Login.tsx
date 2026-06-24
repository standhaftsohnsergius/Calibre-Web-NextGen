import React, { useState } from 'react';
import { BookMarked } from 'lucide-react';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';
import { useLogin } from '../lib/queries';
import { ApiError } from '../lib/api';
import styles from './Login.module.css';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const login = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    login.mutate(
      { username, password },
      {
        onError: (err) => {
          if (err instanceof ApiError && err.status === 401) {
            setErrorMsg('Invalid username or password.');
          } else {
            setErrorMsg('Sign in failed. Please try again.');
          }
        },
      },
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brandMark}>
          <BookMarked size={32} className={styles.brandIcon} />
          <span className={styles.brandText}>Calibre-Web <span className={styles.brandAccent}>NextGen</span></span>
        </div>
        <p className={styles.tagline}>Your personal digital library</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.field}>
            <span className={styles.label}>Username</span>
            <input
              type="text"
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Password</span>
            <input
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {errorMsg && (
            <div className={styles.error} role="alert">
              {errorMsg}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className={styles.submitBtn}
            disabled={login.isPending}
          >
            {login.isPending ? (
              <>
                <Spinner size={16} />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
