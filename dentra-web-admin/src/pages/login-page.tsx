import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Toothbrush } from 'lucide-react';
import { useAuth } from '@/auth/auth-context';

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await login(email, password);
    setIsSubmitting(false);
    if (result.error) setError(result.error);
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="row between">
          <div className="brand">
            <Toothbrush />
            Dentra
          </div>
        </div>
        <h1 style={{ marginTop: 18 }}>Log in to the admin portal</h1>
        <p className="muted small" style={{ margin: '6px 0 14px' }}>
          Platform operations staff only.
        </p>
        <form onSubmit={handleSubmit} className="stack">
          <label className="field">
            <span>Work email</span>
            <input
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="small" style={{ color: 'var(--red)' }}>{error}</p>}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}
