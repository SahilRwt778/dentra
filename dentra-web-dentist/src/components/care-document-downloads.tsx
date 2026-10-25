import { useEffect, useRef, useState } from 'react';
import { Download, FileText, X } from 'lucide-react';
import {
  useDownloadCareDocumentMutation,
  type CareDocumentKind,
} from '@/api/care-documents';

export function CareDocumentDownloads({
  appointmentId,
  hasPrescription,
  showSummary = true,
}: {
  appointmentId: string;
  hasPrescription: boolean;
  showSummary?: boolean;
}) {
  const [download] = useDownloadCareDocumentMutation();
  const [preview, setPreview] = useState<{
    url: string;
    kind: CareDocumentKind;
  }>();
  const [busy, setBusy] = useState<CareDocumentKind>();
  const [error, setError] = useState<string>();
  const mounted = useRef(true),
    locked = useRef(false);
  const urls = useRef(new Set<string>());
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    mounted.current = true;
    const active = urls.current;
    return () => {
      mounted.current = false;
      active.forEach((url) => URL.revokeObjectURL(url));
      active.clear();
    };
  }, []);
  useEffect(() => {
    if (preview && !dialog.current?.open) dialog.current?.showModal();
    if (!preview && dialog.current?.open) dialog.current.close();
  }, [preview]);
  async function open(kind: CareDocumentKind) {
    if (locked.current) return;
    locked.current = true;
    setBusy(kind);
    setError(undefined);
    try {
      const url = await download({ appointmentId, kind }).unwrap();
      if (!mounted.current) {
        URL.revokeObjectURL(url);
        return;
      }
      if (preview) {
        URL.revokeObjectURL(preview.url);
        urls.current.delete(preview.url);
      }
      urls.current.add(url);
      setPreview({ url, kind });
    } catch (err) {
      if (mounted.current)
        setError(
          (err as { data?: { message?: string } })?.data?.message ||
            'Could not open the PDF. Please try again.'
        );
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(undefined);
    }
  }
  function close() {
    if (preview) {
      URL.revokeObjectURL(preview.url);
      urls.current.delete(preview.url);
    }
    setPreview(undefined);
  }
  return (
    <div className="stack">
      <div className="row wrap">
        {showSummary ? (
          <button
            className="btn"
            disabled={!!busy}
            onClick={() => {
              void open('visit-summary');
            }}
          >
            <FileText size={16} />
            {busy === 'visit-summary' ? 'Loading PDF…' : 'Visit summary PDF'}
          </button>
        ) : null}
        {hasPrescription ? (
          <button
            className="btn"
            disabled={!!busy}
            onClick={() => {
              void open('prescription');
            }}
          >
            <FileText size={16} />
            {busy === 'prescription' ? 'Loading PDF…' : 'Prescription PDF'}
          </button>
        ) : null}
      </div>
      {error ? (
        <div className="alert error" role="alert">
          {error}
        </div>
      ) : null}
      <dialog
        ref={dialog}
        className="care-document-dialog"
        onCancel={close}
        onClose={close}
        aria-label="Care document preview"
      >
        <div className="row between wrap" style={{ marginBottom: 16 }}>
          <h3>
            {preview?.kind === 'prescription'
              ? 'Prescription'
              : 'Visit summary'}
          </h3>
          <div className="row">
            {preview ? (
              <a
                className="btn primary"
                href={preview.url}
                download={`dentra-${preview.kind}-${appointmentId}.pdf`}
              >
                <Download size={16} />
                Download PDF
              </a>
            ) : null}
            <button
              className="btn icon"
              aria-label="Close PDF preview"
              onClick={close}
            >
              <X size={20} />
            </button>
          </div>
        </div>
        {preview ? (
          <iframe
            src={preview.url}
            title={
              preview.kind === 'prescription'
                ? 'Prescription PDF preview'
                : 'Visit summary PDF preview'
            }
            style={{
              display: 'block',
              width: '100%',
              height: '68dvh',
              border: 0,
            }}
          />
        ) : null}
      </dialog>
    </div>
  );
}
