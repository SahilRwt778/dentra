import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { FileText, Image as ImageIcon } from 'lucide-react-native';
import {
  useAppointmentFilesQuery,
  useDownloadPatientFile,
  usePatientFilesQuery,
  useRemovePatientFile,
} from '@/api/files';
import type { PatientFile } from '@/api/types';
import { errorMessage } from '@/api/errors';
import { openPrivateFile } from '@/lib/private-files';
import { formatDate } from '@/lib/patient';
import { Button, Card, Empty, ErrorState, Loading } from './ui';
import { colors, ui } from '@/theme';

function PatientFileRow({
  file,
  allowRemove = false,
}: {
  file: PatientFile;
  allowRemove?: boolean;
}) {
  const download = useDownloadPatientFile();
  const remove = useRemovePatientFile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const Icon = file.mimeType === 'application/pdf' ? FileText : ImageIcon;
  async function open() {
    setBusy(true);
    setError(undefined);
    try {
      const path = await download(file);
      if (mounted.current) await openPrivateFile(path, file.mimeType);
    } catch (err) {
      if (mounted.current)
        setError(
          errorMessage(
            err,
            'Could not open the file. Check that a viewer is installed and try again.',
          ),
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function discard() {
    setBusy(true);
    setError(undefined);
    try {
      await remove(file.id);
    } catch (err) {
      if (mounted.current) setError(errorMessage(err));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <View style={ui.stack}>
      <View style={ui.row}>
        <Icon size={24} color={colors.accent} />
        <View style={ui.grow}>
          <Text style={ui.body}>{file.name}</Text>
          <Text style={ui.small}>
            {file.mimeType === 'application/pdf' ? 'PDF report' : 'Photo'} ·{' '}
            {Math.max(1, Math.round(file.sizeBytes / 1024))} KB
          </Text>
          <Text style={ui.small}>
            {file.dentistName
              ? `${file.dentistName} · ${formatDate(
                  file.appointmentDate ?? undefined,
                )}`
              : file.appointmentId
              ? 'Shared with this booking'
              : 'Unused upload · expires after 24 hours'}
          </Text>
        </View>
      </View>
      <Button
        title={
          file.mimeType === 'application/pdf' ? 'Open report' : 'View photo'
        }
        variant="secondary"
        small
        loading={busy}
        onPress={() => {
          open();
        }}
      />
      {allowRemove && !file.appointmentId ? (
        <Button
          title="Remove unused upload"
          variant="danger"
          small
          disabled={busy}
          onPress={() => {
            discard();
          }}
        />
      ) : null}
      {error ? <ErrorState message={error} /> : null}
    </View>
  );
}

export function AppointmentFiles({ appointmentId }: { appointmentId: string }) {
  const { data, error, isLoading, refetch } =
    useAppointmentFilesQuery(appointmentId);
  if (isLoading) return <Loading />;
  if (error)
    return (
      <ErrorState message="Couldn’t load photos and reports." retry={refetch} />
    );
  if (!data?.length) return null;
  return (
    <Card>
      <Text style={ui.heading}>Photos and reports</Text>
      {data.map(file => (
        <PatientFileRow key={file.id} file={file} />
      ))}
    </Card>
  );
}

export function PatientFiles() {
  const [page, setPage] = useState(1);
  const {
    currentData: data,
    error,
    isFetching,
    refetch,
  } = usePatientFilesQuery(page, { refetchOnMountOrArgChange: true });
  return (
    <>
      <Text style={ui.small}>
        Your private photos and reports. Files saved with a booking are
        available to its assigned dentist.
      </Text>
      {error ? (
        <ErrorState retry={refetch} />
      ) : !data ? (
        <Loading />
      ) : data.items.length ? (
        data.items.map(file => (
          <Card key={file.id}>
            <PatientFileRow file={file} allowRemove />
          </Card>
        ))
      ) : (
        <Empty
          icon={FileText}
          title="No files yet"
          message="Add photos or PDF reports while booking your next appointment."
        />
      )}
      <View style={ui.row}>
        {page > 1 ? (
          <Button
            title="Newer files"
            variant="secondary"
            small
            disabled={isFetching}
            onPress={() => setPage(value => value - 1)}
          />
        ) : null}
        {data?.nextPage ? (
          <Button
            title="Older files"
            variant="secondary"
            small
            disabled={isFetching}
            onPress={() => setPage(data.nextPage!)}
          />
        ) : null}
        <Button
          title="Refresh files"
          variant="secondary"
          small
          disabled={isFetching}
          onPress={() => {
            refetch();
          }}
        />
      </View>
    </>
  );
}
