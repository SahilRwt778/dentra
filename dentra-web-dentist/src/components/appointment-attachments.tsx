import { useEffect, useRef, useState } from 'react';
import { Download, FileText, Image, X } from 'lucide-react';
import {
  useGetAppointmentsByAppointmentIdAttachmentsQuery,
  type PatientFile,
} from '@/api/generated-api';
import { useDownloadPatientAttachmentMutation } from '@/api/patient-files';
import { Modal } from './modal';

function Attachment({ file }: { file: PatientFile }) {
  const [download, { isLoading }] = useDownloadPatientAttachmentMutation();
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState<string>();
  const urls = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const activeUrls = urls.current;
    return () => {
      mounted.current = false;
      activeUrls.forEach((url) => URL.revokeObjectURL(url));
      activeUrls.clear();
    };
  }, []);
  const pdf = file.mimeType === 'application/pdf';
  async function open() {
    setError(undefined);
    try {
      const url = await download(file).unwrap();
      if (!mounted.current) {
        URL.revokeObjectURL(url);
        return;
      }
      urls.current.add(url);
      if (pdf) {
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name.toLowerCase().endsWith('.pdf')
          ? file.name
          : `${file.name}.pdf`;
        link.click();
        // Give the browser time to consume the download before revoking it.
        setTimeout(() => {
          URL.revokeObjectURL(url);
          urls.current.delete(url);
        }, 30000);
      } else {
        if (preview) {
          URL.revokeObjectURL(preview);
          urls.current.delete(preview);
        }
        setPreview(url);
      }
    } catch (err) {
      if (mounted.current)
        setError(
          (err as { data?: { message?: string } })?.data?.message ||
            'Could not open this file. Please try again.'
        );
    }
  }
  function close() {
    if (preview) {
      URL.revokeObjectURL(preview);
      urls.current.delete(preview);
    }
    setPreview(undefined);
  }
  const Icon = pdf ? FileText : Image;
  return (
    <div
      className="stack"
      style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}
    >
      <div className="row between wrap">
        <div className="row" style={{ gap: 10, minWidth: 0 }}>
          <Icon size={22} aria-hidden />
          <div style={{ minWidth: 0 }}>
            <div style={{ overflowWrap: 'anywhere' }}>{file.name}</div>
            <div className="small muted">
              {pdf ? 'PDF report' : 'Photo'} ·{' '}
              {Math.max(1, Math.round(file.sizeBytes / 1024))} KB
            </div>
          </div>
        </div>
        <button
          className="btn"
          disabled={isLoading}
          onClick={() => {
            void open();
          }}
        >
          <Download size={16} />
          {isLoading ? 'Opening…' : pdf ? 'Download report' : 'View photo'}
        </button>
      </div>
      {error ? (
        <div className="alert error" role="alert">
          {error}
        </div>
      ) : null}
      <Modal open={!!preview} onClose={close}>
        <div className="row between">
          <h3 style={{ overflowWrap: 'anywhere' }}>{file.name}</h3>
          <button className="btn icon" aria-label="Close photo" onClick={close}>
            <X size={18} />
          </button>
        </div>
        {preview ? (
          <img
            src={preview}
            alt={file.name}
            style={{
              width: '100%',
              maxHeight: '70vh',
              objectFit: 'contain',
              marginTop: 16,
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

export function AppointmentAttachments({
  appointmentId,
}: {
  appointmentId: string;
}) {
  const { data, error, isLoading, refetch } =
    useGetAppointmentsByAppointmentIdAttachmentsQuery(
      { appointmentId },
      { refetchOnMountOrArgChange: true }
    );
  return (
    <section className="card stack">
      <h3>Patient photos and reports</h3>
      {isLoading ? (
        <p className="muted">Loading attachments…</p>
      ) : error ? (
        <div role="alert">
          Could not load attachments.{' '}
          <button
            className="btn"
            onClick={() => {
              void refetch();
            }}
          >
            Retry
          </button>
        </div>
      ) : data?.length ? (
        data.map((file) => <Attachment key={file.id} file={file} />)
      ) : (
        <p className="muted">No files were shared with this appointment.</p>
      )}
    </section>
  );
}
