import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { Download } from 'lucide-react-native';
import {
  useDownloadCareDocument,
  type CareDocumentKind,
} from '@/api/care-documents';
import { useConsultationQuery } from '@/api/appointments';
import { errorMessage } from '@/api/errors';
import { openPrivateFile } from '@/lib/private-files';
import { Button, Card, ErrorState, Loading } from './ui';
import { ui } from '@/theme';

export function CareDocumentDownloads({
  appointmentId,
  hasPrescription,
}: {
  appointmentId: string;
  hasPrescription: boolean;
}) {
  const download = useDownloadCareDocument();
  const [opening, setOpening] = useState<CareDocumentKind>();
  const [error, setError] = useState<string>();
  const mounted = useRef(true),
    locked = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function open(kind: CareDocumentKind) {
    if (locked.current) return;
    locked.current = true;
    setOpening(kind);
    setError(undefined);
    try {
      const path = await download(appointmentId, kind);
      if (mounted.current) await openPrivateFile(path, 'application/pdf');
    } catch (err) {
      if (mounted.current)
        setError(
          errorMessage(
            err,
            'Could not open the PDF. Check that a PDF viewer is installed and try again.',
          ),
        );
    } finally {
      locked.current = false;
      if (mounted.current) setOpening(undefined);
    }
  }
  return (
    <Card>
      <Text style={ui.heading}>Visit documents</Text>
      <Button
        title="Download visit summary PDF"
        icon={Download}
        variant="secondary"
        loading={opening === 'visit-summary'}
        disabled={!!opening}
        onPress={() => {
          open('visit-summary');
        }}
      />
      {hasPrescription ? (
        <Button
          title="Download prescription PDF"
          icon={Download}
          variant="secondary"
          loading={opening === 'prescription'}
          disabled={!!opening}
          onPress={() => {
            open('prescription');
          }}
        />
      ) : null}
      <Text style={ui.small}>
        Opens in your phone’s PDF viewer, where you can save or share the
        document.
      </Text>
      {error ? <ErrorState message={error} /> : null}
    </Card>
  );
}

export function CompletedVisitDocuments({
  appointmentId,
}: {
  appointmentId: string;
}) {
  const { data, error, isLoading, refetch } = useConsultationQuery(
    appointmentId,
    { refetchOnMountOrArgChange: true },
  );
  if (isLoading) return <Loading />;
  if (error)
    return (
      <ErrorState message="Could not load visit documents." retry={refetch} />
    );
  if (!data) return null;
  return (
    <CareDocumentDownloads
      appointmentId={appointmentId}
      hasPrescription={
        !!data.prescription?.signedAt && !!data.prescription.items?.length
      }
    />
  );
}
