import { FormEvent, useState } from 'react';
import { FileText } from 'lucide-react';
import { login, register } from '../lib/api';
import type { AuthResponse } from '../types';

type Props = {
  onAuthenticated: (auth: AuthResponse) => void;
};

export function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [name, setName] = useState('Harsh');
  const [email, setEmail] = useState('harsh@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const auth = mode === 'register' ? await register(name, email, password) : await login(email, password);
      onAuthenticated(auth);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Unable to authenticate');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-mark">
          <FileText size={22} />
          <span>NoteFlow</span>
        </div>
        <h1>Write, refine, and find your ideas faster.</h1>
        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && (
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button disabled={loading} type="submit">
            {loading ? 'Working...' : mode === 'register' ? 'Create workspace' : 'Log in'}
          </button>
        </form>
        <button className="link-button" type="button" onClick={() => setMode(mode === 'register' ? 'login' : 'register')}>
          {mode === 'register' ? 'Already have an account?' : 'Create a new account'}
        </button>
      </section>
    </main>
  );
}

