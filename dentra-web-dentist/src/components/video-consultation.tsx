import { useLayoutEffect, useState, type ReactNode } from 'react';
import { Camera, CameraOff, Mic, MicOff, Video } from 'lucide-react';
import { useGetAppointmentsByAppointmentIdVideoQuery } from '@/api/generated-api';
import { ConsultationWorkspace, type ConsultationPanel } from './consultation-workspace';
import { useVideoCall } from './video-call-context';
import { videoStatusText } from './video-status';

/** Register a visual home for the persistent room; this page never owns its connection. */
export function VideoConsultation({
  appointmentId,
  patientName,
  panels,
  actions,
}: {
  appointmentId: string;
  patientName: string;
  panels: ConsultationPanel[];
  actions: ReactNode;
}) {
  const { call, joining, notice, join, attach } = useVideoCall();
  const {
    currentData: status,
    error,
    refetch,
  } = useGetAppointmentsByAppointmentIdVideoQuery(
    { appointmentId },
    { pollingInterval: 5000, refetchOnMountOrArgChange: true },
  );
  const [microphone, setMicrophone] = useState(true);
  const [camera, setCamera] = useState(true);
  const [mount, setMount] = useState<HTMLDivElement | null>(null);
  const active = call?.appointmentId === appointmentId;
  useLayoutEffect(() => {
    if (mount) return attach(appointmentId, mount);
  }, [mount, appointmentId, attach]);
  return (
    <ConsultationWorkspace
      active={active}
      patientName={patientName}
      panels={panels}
      actions={actions}
      call={
        <div className="video-consultation" aria-label="Video consultation">
          <div className="consult-live-room" ref={setMount} hidden={!active} />
          {!active && (
            <div className="consult-lobby stack">
              <p className="muted">{videoStatusText(status)}</p>
              <div className="row video-options">
                <button
                  type="button"
                  className="btn"
                  aria-pressed={!microphone}
                  onClick={() => setMicrophone((value) => !value)}
                >
                  {microphone ? <Mic size={18} /> : <MicOff size={18} />}
                  Microphone {microphone ? 'on' : 'off'}
                </button>
                <button
                  type="button"
                  className="btn"
                  aria-pressed={!camera}
                  onClick={() => setCamera((value) => !value)}
                >
                  {camera ? <Camera size={18} /> : <CameraOff size={18} />}
                  Camera {camera ? 'on' : 'off'}
                </button>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={joining || !status?.canJoin}
                onClick={() => {
                  void join({ appointmentId, patientName, microphone, camera });
                }}
              >
                <Video size={17} />
                {joining ? 'Joining…' : call ? 'Return to current call' : 'Join video call'}
              </button>
              {error && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    void refetch();
                  }}
                >
                  Check appointment again
                </button>
              )}
            </div>
          )}
          {notice && (
            <p className="video-notice" role="status">
              {notice}
            </p>
          )}
        </div>
      }
    />
  );
}
