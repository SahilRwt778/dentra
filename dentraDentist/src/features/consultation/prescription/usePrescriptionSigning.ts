import { useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import type { Appointment } from '../../../common/types/api';
import type { Consultation } from '../../../common/types/consultation';
import type {
  PatientAllergies,
  Prescription,
} from '../../../common/types/prescription';
import { useMounted } from '../../../common/hooks/useMounted';
import { errorMessage } from '../../../common/utils/api-error';
import {
  useRequestPrescriptionCodeMutation,
  useSignPrescriptionMutation,
} from '../../../store/dentraApi';
import { dentraApi } from '../../../store/dentraApi';
import { useAppDispatch } from '../../../store/hooks';
import {
  allergyConflict,
  medicineForm,
  prescriptionFingerprint,
  validateMedicine,
} from './prescription-form';

type Challenge = { otpId: string; expiresAt: number };
type Options = {
  appointment: Appointment;
  prescription: Prescription;
  allergies: PatientAllergies | undefined;
  dentistName: string;
  reloadPrescription: () => Promise<Consultation>;
  reloadAllergies: () => Promise<PatientAllergies>;
};
function normalizedName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}
function sameContents(a: Prescription, b: Prescription) {
  return (
    prescriptionFingerprint({ ...a, signedAt: null }) ===
    prescriptionFingerprint({ ...b, signedAt: null })
  );
}

export function usePrescriptionSigning({
  appointment,
  prescription,
  allergies,
  dentistName,
  reloadPrescription,
  reloadAllergies,
}: Options) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [ack, setAck] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverAllergyWarning, setServerAllergyWarning] = useState<
    string | null
  >(null);
  const [signedPrescription, setSignedPrescription] =
    useState<Prescription | null>(null);
  const [requestCode, codeMutation] = useRequestPrescriptionCodeMutation();
  const [signPrescription, signMutation] = useSignPrescriptionMutation();
  const lock = useRef(false);
  const mounted = useMounted();
  const dispatch = useAppDispatch();
  const fingerprint = prescriptionFingerprint(prescription);
  const latestFingerprint = useRef(fingerprint);
  latestFingerprint.current = fingerprint;
  const previousFingerprint = useRef(fingerprint);
  const previousAllergies = useRef(allergies?.allergies);
  const conflicts = prescription.items
    .map(item => allergyConflict(allergies?.allergies, item.medicineName))
    .filter(Boolean);
  const needsAck = conflicts.length > 0 || !!serverAllergyWarning;
  const editable =
    appointment.status === 'in_consult' &&
    !prescription.signedAt &&
    !signedPrescription;

  function confirmSignature(result: Consultation) {
    if (!mounted.current || !result.prescription?.signedAt) return;
    setSignedPrescription(result.prescription);
    setChallenge(null);
    setCode('');
    setError(null);
    dispatch(
      dentraApi.util.upsertQueryData('getConsultation', appointment.id, result),
    );
  }

  usePreventRemove(busy, () =>
    Alert.alert(
      'Prescription request in progress',
      'Please wait for the request to finish.',
    ),
  );
  useEffect(() => {
    if (previousFingerprint.current === fingerprint) return;
    previousFingerprint.current = fingerprint;
    setChallenge(null);
    setCode('');
    setName('');
    setAck(false);
    setServerAllergyWarning(null);
    setError(
      prescription.signedAt
        ? null
        : 'The prescription changed. Review the updated list and request a new signing code.',
    );
  }, [fingerprint, prescription.signedAt]);
  useEffect(() => {
    if (appointment.status !== 'in_consult') {
      setChallenge(null);
      setCode('');
      setAck(false);
    }
  }, [appointment.status]);
  useEffect(() => {
    if (previousAllergies.current !== allergies?.allergies) {
      previousAllergies.current = allergies?.allergies;
      setAck(false);
    }
  }, [allergies?.allergies]);
  useEffect(() => {
    if (!challenge && !resendAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') setNow(Date.now());
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [challenge, resendAt]);

  async function currentPrescription() {
    const latest = await reloadPrescription();
    if (!mounted.current) return false;
    if (latest.prescription?.signedAt) {
      setChallenge(null);
      setCode('');
      return false;
    }
    if (
      !latest.prescription ||
      prescriptionFingerprint(latest.prescription) !== fingerprint
    ) {
      setChallenge(null);
      setCode('');
      setAck(false);
      setError(
        'The prescription changed. Review the updated list and request a new signing code.',
      );
      return false;
    }
    return latestFingerprint.current === fingerprint;
  }

  async function sendCode() {
    if (
      lock.current ||
      !editable ||
      Date.now() < resendAt ||
      !prescription.items.length
    )
      return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setChallenge(null);
    setCode('');
    try {
      prescription.items.forEach(item => validateMedicine(medicineForm(item)));
      if (!(await currentPrescription())) return;
      await reloadAllergies();
      if (!mounted.current || latestFingerprint.current !== fingerprint) return;
      const result = await requestCode(appointment.id).unwrap();
      if (!mounted.current) return;
      const receivedAt = Date.now();
      setResendAt(receivedAt + result.resendAfterSeconds * 1000);
      setNow(receivedAt);
      // A second read prevents using a code issued for a changed server medicine list.
      if (!(await currentPrescription())) return;
      setChallenge({
        otpId: result.otpId,
        expiresAt: receivedAt + result.expiresInSeconds * 1000,
      });
      setCode('');
    } catch (failure) {
      if (mounted.current) setError(errorMessage(failure));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
      codeMutation.reset();
    }
  }

  async function sign() {
    if (lock.current || !editable) return;
    if (
      !challenge ||
      Date.now() >= challenge.expiresAt ||
      !/^\d{4}$/.test(code)
    ) {
      setError(
        'Request a signing code and enter all four digits before it expires.',
      );
      return;
    }
    if (normalizedName(name) !== normalizedName(dentistName)) {
      setError('Type your full name as shown above.');
      return;
    }
    if (needsAck && !ack) {
      setError('Review and acknowledge the allergy conflict before signing.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!(await currentPrescription())) return;
      const latestAllergies = await reloadAllergies();
      if (!mounted.current || latestFingerprint.current !== fingerprint) return;
      if (latestAllergies.allergies !== allergies?.allergies) {
        setAck(false);
        setError('The recorded allergies changed. Review them before signing.');
        return;
      }
      const result = await signPrescription({
        appointmentId: appointment.id,
        signature: {
          otpId: challenge.otpId,
          confirmationCode: code,
          ...(needsAck ? { allergyOverrideAck: ack } : {}),
        },
      }).unwrap();
      if (
        !result.prescription?.signedAt ||
        !sameContents(result.prescription, prescription)
      )
        throw new Error(
          'Could not confirm the signed prescription. Refresh its status.',
        );
      confirmSignature(result);
    } catch (failure) {
      if (!mounted.current) return;
      // A timed-out response may follow a committed signature; read it before retrying.
      try {
        const latest = await reloadPrescription();
        if (!mounted.current) return;
        if (
          latest.prescription?.signedAt &&
          sameContents(latest.prescription, prescription)
        ) {
          confirmSignature(latest);
          return;
        }
      } catch {
        /* Retain the original error and the saved prescription. */
      }
      const message = errorMessage(failure);
      if (message.toLowerCase().includes('allergy')) {
        setServerAllergyWarning(message);
        setAck(false);
      }
      setError(message);
      setCode('');
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
      signMutation.reset();
    }
  }

  const expiresIn = challenge
    ? Math.max(0, Math.ceil((challenge.expiresAt - now) / 1000))
    : 0;
  return {
    name,
    setName,
    code,
    setCode: (value: string) => setCode(value.replace(/\D/g, '').slice(0, 4)),
    ack,
    setAck,
    busy,
    error,
    needsAck,
    serverAllergyWarning,
    sendCode,
    sign,
    editable,
    signedPrescription,
    hasCode: !!challenge,
    expiresIn,
    resendIn: Math.max(0, Math.ceil((resendAt - now) / 1000)),
    canSign:
      editable &&
      !!challenge &&
      expiresIn > 0 &&
      /^\d{4}$/.test(code) &&
      normalizedName(name) === normalizedName(dentistName) &&
      (!needsAck || ack),
  };
}
