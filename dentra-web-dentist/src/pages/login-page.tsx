import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Toothbrush } from 'lucide-react';
import { useAuth } from '@/auth/auth-context';

export function LoginPage() {
  const { isAuthenticated, requestOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otpId, setOtpId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  function toE164(input: string): string {
    const digits = input.replace(/\D/g, '');
    return `+91${digits}`;
  }

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError('Enter a 10-digit mobile number.');
      return;
    }
    setIsSubmitting(true);
    const result = await requestOtp(toE164(phone));
    setIsSubmitting(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setOtpId(result.otpId);
    setCode('');
    setStep('otp');
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{4}$/.test(code)) {
      setError('Enter the 4-digit verification code.');
      return;
    }
    setIsSubmitting(true);
    const result = await verifyOtp(otpId, code);
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
          <span className="demo-tag">Dentist</span>
        </div>
        <h1 style={{ marginTop: 18 }}>Sign in or apply as a dentist</h1>
        <p className="muted small" style={{ margin: '6px 0 14px' }}>
          Verify your mobile number to continue. New dentists can apply to join Dentra after verification.
        </p>

        {step === 'phone' ? (
          <form onSubmit={handleSendCode} className="stack">
            <label className="field">
              <span>Mobile number</span>
              <input
                className="input"
                inputMode="tel"
                type="tel"
                autoComplete="tel-national"
                placeholder="98200 10482"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </label>
            {error && <p className="small" style={{ color: 'var(--red)' }}>{error}</p>}
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Send code'}
            </button>
            <p className="hint" style={{ marginTop: 0 }}>
              Applications are reviewed by an admin before clinic portal access is enabled.
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="stack">
            <label className="field">
              <span>Enter the 4-digit code sent to +91 {phone}</span>
              <input
                className="input"
                inputMode="numeric"
                autoComplete="one-time-code"
                minLength={4}
                maxLength={4}
                pattern="[0-9]{4}"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                autoFocus
                required
              />
            </label>
            {error && <p className="small" style={{ color: 'var(--red)' }}>{error}</p>}
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={isSubmitting || !/^\d{4}$/.test(code)}>
              {isSubmitting ? 'Verifying…' : 'Verify and continue'}
            </button>
            <button type="button" className="btn-link btn" onClick={() => setStep('phone')}>
              Change number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
