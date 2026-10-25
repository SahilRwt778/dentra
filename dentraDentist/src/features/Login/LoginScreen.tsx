import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { authApi } from '../../api/auth.api';
import { session } from '../auth/session';
import { errorMessage } from '../../common/utils/api-error';
import type { OtpChallenge } from '../../common/types/api';
import { colors, layout } from '../../common/theme/theme';
import { Brand } from '../../components/icons/Brand';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorMessage } from '../../components/ui/Feedback';
import { FormScreen } from '../../components/ui/Screen';
import { Field } from '../../components/forms/Field';

type Challenge = OtpChallenge & { resendAt: number; expiresAt: number };
export function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!challenge) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [challenge]);
  const resendIn = challenge
    ? Math.max(0, Math.ceil((challenge.resendAt - now) / 1000))
    : 0;
  const expired = challenge ? now >= challenge.expiresAt : false;
  async function sendCode() {
    if (lock.current) return;
    if (!/^\d{10}$/.test(phone)) {
      setError('Enter a 10-digit mobile number.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    Keyboard.dismiss();
    try {
      const result = await authApi.requestOtp(`+91${phone}`);
      if (!mounted.current) return;
      const received = Date.now();
      setChallenge({
        ...result,
        resendAt: received + result.resendAfterSeconds * 1000,
        expiresAt: received + result.expiresInSeconds * 1000,
      });
      setNow(received);
      setCode('');
    } catch (failure) {
      if (mounted.current) setError(errorMessage(failure));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function verifyCode() {
    if (lock.current || !challenge) return;
    if (!/^\d{4}$/.test(code)) {
      setError('Enter the 4-digit verification code.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    Keyboard.dismiss();
    try {
      const tokens = await authApi.verifyOtp(challenge.otpId, code);
      if (mounted.current) await session.signIn(tokens);
    } catch (failure) {
      if (mounted.current) setError(errorMessage(failure));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <FormScreen>
      <Brand />
      <View style={layout.stack}>
        <Text style={layout.title}>
          {challenge ? 'Verify your number' : 'Your practice,\nin your pocket.'}
        </Text>
        <Text style={layout.muted}>
          {challenge
            ? `Enter the 4-digit code for +91 ${phone}.`
            : 'Sign in to manage your appointments, or apply to join Dentra.'}
        </Text>
      </View>
      <Card>
        {challenge ? (
          <>
            <Field
              label="Verification code"
              testID="otp-input"
              value={code}
              onChangeText={value =>
                setCode(value.replace(/\D/g, '').slice(0, 4))
              }
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              maxLength={4}
              editable={!busy}
              style={styles.otp}
              autoFocus
            />
            {expired && (
              <Text style={layout.muted}>
                This code has expired. Request a new code below.
              </Text>
            )}
            <ErrorMessage message={error} />
            <Button
              title="Verify and continue"
              onPress={verifyCode}
              loading={busy}
              disabled={code.length !== 4 || expired}
            />
            <Button
              title={resendIn ? `Resend code in ${resendIn}s` : 'Resend code'}
              variant="secondary"
              onPress={sendCode}
              disabled={busy || resendIn > 0}
            />
            <Button
              title="Change mobile number"
              variant="secondary"
              disabled={busy}
              onPress={() => {
                setChallenge(null);
                setCode('');
                setError(null);
              }}
            />
          </>
        ) : (
          <>
            <View style={styles.phoneRow}>
              <Text style={styles.prefix}>+91</Text>
              <View style={styles.phone}>
                <Field
                  label="10-digit mobile number"
                  testID="phone-input"
                  value={phone}
                  onChangeText={value =>
                    setPhone(value.replace(/\D/g, '').slice(0, 10))
                  }
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  autoComplete="tel-national"
                  maxLength={10}
                  editable={!busy}
                  placeholder="Enter mobile number"
                />
              </View>
            </View>
            <ErrorMessage message={error} />
            <Button
              title="Send verification code"
              onPress={sendCode}
              loading={busy}
            />
          </>
        )}
      </Card>
      <View style={styles.notice}>
        <ShieldCheck size={22} color={colors.primary} />
        <Text style={styles.noticeText}>
          New applications are reviewed by the admin. Your appointments become
          available after approval.
        </Text>
      </View>
    </FormScreen>
  );
}
const styles = StyleSheet.create({
  otp: { fontSize: 28, letterSpacing: 16, textAlign: 'center', minHeight: 66 },
  phoneRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  prefix: {
    paddingBottom: 15,
    fontSize: 17,
    fontWeight: '600',
    color: colors.ink,
  },
  phone: { flex: 1 },
  notice: { flexDirection: 'row', gap: 12, padding: 4 },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 22, color: colors.muted },
});
