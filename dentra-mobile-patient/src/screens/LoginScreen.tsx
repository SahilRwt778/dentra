import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { Tooth } from '@/components/tooth-icon';
import { OtpInput } from '@/components/otp-input';
import { useAuth } from '@/auth/auth-context';
import {
  Button,
  Card,
  ErrorState,
  Field,
  Screen,
  TextLink,
} from '@/components/ui';
import { normalizeMobile } from '@/lib/patient';
import { isCompleteMobile, mobileInput } from '@/lib/mobile-input';
import { colors, ui } from '@/theme';

export function LoginScreen() {
  const { requestOtp, verifyOtp } = useAuth();
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [otpId, setOtpId] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const update = () =>
      setSeconds(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);
  async function sendCode() {
    const phone = normalizeMobile(mobile);
    if (!isCompleteMobile(mobile)) {
      setError('Enter a 10-digit mobile number.');
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      const result = await requestOtp(phone);
      if ('error' in result) {
        setError(result.error);
        return;
      }
      setOtpId(result.otpId);
      setCode('');
      setResendAt(Date.now() + result.resendAfterSeconds * 1000);
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    if (!otpId) return;
    if (!/^\d{4}$/.test(code)) {
      setError('Enter the 4-digit verification code.');
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      const result = await verifyOtp(otpId, code);
      if (result.error) setError(result.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <View style={s.intro}>
        <View style={ui.row}>
          <View style={s.mark}>
            <Tooth color={colors.accent} size={30} />
          </View>
          <Text style={s.brand}>Dentra</Text>
        </View>
        <Text accessibilityRole="header" style={s.headline}>
          See a dentist,{'\n'}without the wait.
        </Text>
        <Text style={ui.muted}>
          Book video consults and clinic visits with verified dentists. Keep
          your prescriptions and dental records in one place.
        </Text>
      </View>
      <Card>
        <Text style={ui.heading}>
          {otpId ? 'Check your phone' : 'Welcome to better dental care'}
        </Text>
        {otpId ? (
          <>
            <Text style={ui.muted}>
              Enter the 4-digit code for {normalizeMobile(mobile)}.
            </Text>
            <OtpInput
              value={code}
              onChangeText={setCode}
              editable={!busy}
              autoFocus
            />
          </>
        ) : (
          <Field
            label="Mobile number"
            value={mobile}
            onChangeText={value => setMobile(mobileInput(value))}
            maxLength={10}
            keyboardType="phone-pad"
            placeholder="Enter your number"
            autoComplete="tel-national"
            textContentType="telephoneNumber"
            hint="+91 (India) · Enter your 10-digit mobile number."
          />
        )}
        {error ? <ErrorState message={error} /> : null}
        <Button
          title={otpId ? 'Verify and continue' : 'Send code'}
          loading={busy}
          disabled={otpId ? !/^\d{4}$/.test(code) : !isCompleteMobile(mobile)}
          onPress={otpId ? verify : sendCode}
        />
        {otpId ? (
          <View style={ui.stack}>
            <Button
              variant="secondary"
              title={seconds ? `Resend code in ${seconds}s` : 'Resend code'}
              disabled={seconds > 0 || busy}
              onPress={sendCode}
            />
            <TextLink
              title="Use a different number"
              onPress={() => {
                setOtpId(undefined);
                setError(undefined);
                setCode('');
              }}
            />
          </View>
        ) : (
          <Text style={ui.small}>
            New here? We’ll help you create your account after you verify your
            number.
          </Text>
        )}
      </Card>
      <View style={[ui.row, s.assurance]}>
        <ShieldCheck size={21} color={colors.accent} />
        <Text style={[ui.muted, ui.grow]}>
          Verified dentists. Your records, in one place.
        </Text>
      </View>
    </Screen>
  );
}
const s = StyleSheet.create({
  intro: { gap: 20, paddingTop: 38, paddingBottom: 14 },
  mark: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { fontSize: 28, fontWeight: '600', color: colors.ink },
  headline: {
    fontSize: 33,
    fontWeight: '600',
    lineHeight: 40,
    color: colors.ink,
    letterSpacing: -1,
  },
  assurance: { padding: 8 },
});
