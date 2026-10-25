import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronRight, FileText, ImageIcon } from 'lucide-react-native';
import axios from 'axios';
import { patientFilesApi } from '../../api/patient-files.api';
import type { PatientFile } from '../../common/types/api';
import { useGetPatientFilesQuery } from '../../store/dentraApi';
import { colors } from '../../common/theme/theme';
import { appointmentStyles as details } from '../appointments/appointment.styles';
import { errorMessage } from '../../common/utils/api-error';
import {
  openPrivatePdf,
  removePrivateFile,
} from '../../common/services/private-files';
import { session } from '../auth/session';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorMessage, Loading } from '../../components/ui/Feedback';
import { PatientPhotoViewer, type PatientPhoto } from './PatientPhotoViewer';

export function AppointmentAttachments({
  appointmentId,
}: {
  appointmentId: string;
}) {
  const {
    currentData: files,
    isFetching: loading,
    error: requestError,
    refetch: reload,
  } = useGetPatientFilesQuery(appointmentId);
  const error = requestError ? errorMessage(requestError) : null;
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PatientPhoto | null>(null);
  const previewPath = useRef<string | null>(null);
  const downloadedPaths = useRef(new Map<string, string>());
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const lock = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const paths = downloadedPaths.current;
    return () => {
      mounted.current = false;
      controller.current?.abort();
      paths.forEach(path => {
        removePrivateFile(path).catch(() => {});
      });
      paths.clear();
    };
  }, []);
  function closePreview() {
    const path = previewPath.current;
    previewPath.current = null;
    setPreview(null);
    if (path) {
      downloadedPaths.current.forEach((value, id) => {
        if (value === path) downloadedPaths.current.delete(id);
      });
      removePrivateFile(path).catch(() => {});
    }
  }
  function photoFailed(path: string) {
    if (!mounted.current || previewPath.current !== path) return;
    closePreview();
    setOpenError('Could not display this photo. Please try again.');
  }
  async function open(file: PatientFile) {
    if (lock.current) return;
    lock.current = true;
    const version = session.getVersion();
    const abort = new AbortController();
    controller.current = abort;
    setOpening(file.id);
    setOpenError(null);
    try {
      const path = await patientFilesApi.download(file, abort.signal);
      if (
        !mounted.current ||
        version !== session.getVersion() ||
        abort.signal.aborted
      ) {
        await removePrivateFile(path);
        return;
      }
      const previousPath = downloadedPaths.current.get(file.id);
      downloadedPaths.current.set(file.id, path);
      if (previousPath) await removePrivateFile(previousPath);
      if (
        !mounted.current ||
        version !== session.getVersion() ||
        abort.signal.aborted
      ) {
        await removePrivateFile(path);
        return;
      }
      if (file.mimeType === 'application/pdf') await openPrivatePdf(path);
      else {
        previewPath.current = path;
        setPreview({ path, name: file.name });
      }
    } catch (failure) {
      if (mounted.current && !axios.isCancel(failure) && !abort.signal.aborted)
        setOpenError(errorMessage(failure));
    } finally {
      lock.current = false;
      if (controller.current === abort) controller.current = null;
      if (mounted.current) setOpening(null);
    }
  }
  return (
    <Card style={details.card}>
      <Text accessibilityRole="header" style={details.heading}>
        Patient photos and reports
      </Text>
      {loading && !files ? (
        <Loading text="Loading patient files…" />
      ) : error ? (
        <>
          <ErrorMessage message={error} />
          <Button
            title="Retry patient files"
            variant="secondary"
            onPress={reload}
          />
        </>
      ) : !files?.length ? (
        <Text style={details.muted}>
          No files were shared with this appointment.
        </Text>
      ) : (
        files.map(file => {
          const pdf = file.mimeType === 'application/pdf';
          const Icon = pdf ? FileText : ImageIcon;
          return (
            <Pressable
              key={file.id}
              accessibilityRole="button"
              accessibilityLabel={pdf ? 'Open PDF report' : 'View photo'}
              accessibilityHint={file.name}
              accessibilityState={{
                disabled: !!opening,
                busy: opening === file.id,
              }}
              disabled={!!opening}
              onPress={() => {
                open(file);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.icon}>
                <Icon size={20} color={colors.primary} />
              </View>
              <View style={styles.description}>
                <Text style={details.label} numberOfLines={2}>
                  {file.name}
                </Text>
                <Text style={details.muted}>
                  {pdf ? 'PDF report' : 'Photo'} ·{' '}
                  {Math.max(1, Math.round(file.sizeBytes / 1024))} KB
                </Text>
              </View>
              {opening === file.id ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <ChevronRight size={18} color={colors.muted} />
              )}
            </Pressable>
          );
        })
      )}
      <ErrorMessage message={openError} />
      <PatientPhotoViewer
        photo={preview}
        onClose={closePreview}
        onError={photoFailed}
      />
    </Card>
  );
}
const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingTop: 10,
    gap: 10,
  },
  icon: {
    backgroundColor: colors.primarySoft,
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: { flex: 1, gap: 4 },
  pressed: { opacity: 0.7 },
});
