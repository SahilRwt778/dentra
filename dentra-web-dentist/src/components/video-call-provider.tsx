import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { store } from '@/store/store';
import { useGetAppointmentsByAppointmentIdVideoQuery } from '@/api/generated-api';
import { joinVideo } from '@/api/video-session';
import { ConsultationWorkspace } from './consultation-workspace';
import { videoStatusText } from './video-status';
import {
  VideoCallContext,
  type ActiveVideoCall,
  type CallMount,
  type JoinOptions,
} from './video-call-context';

const ConnectedVideoCall = lazy(() => import('./connected-video-call'));
function sessionScope() {
  try {
    const token = store.getState().auth.accessToken;
    if (!token) return null;
    const payload = JSON.parse(
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
    );
    return `${payload.sub}:${payload.sid}`;
  } catch {
    return null;
  }
}

/** Own the media connection above Outlet, so changing pages cannot destroy it. */
export function VideoCallProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [call, setCall] = useState<ActiveVideoCall>();
  const active = useRef<ActiveVideoCall | undefined>(undefined);
  const [joining, setJoining] = useState(false);
  const joiningLock = useRef(false);
  const live = useRef(true);
  const [notice, setNotice] = useState<string>();
  const [routeMount, setRouteMount] = useState<CallMount | null>(null);
  const [floatingMount, setFloatingMount] = useState<HTMLDivElement | null>(
    null
  );
  const { currentData: status, error } =
    useGetAppointmentsByAppointmentIdVideoQuery(
      { appointmentId: call?.appointmentId ?? '' },
      { skip: !call, pollingInterval: 5000, refetchOnMountOrArgChange: true }
    );
  const end = useCallback((expected: ActiveVideoCall, message?: string) => {
    if (active.current !== expected) return;
    active.current = undefined;
    setCall(undefined);
    setNotice(message);
    if (message) toast.info(message);
  }, []);
  const attach = useCallback(
    (appointmentId: string, element: HTMLDivElement) => {
      setRouteMount({ appointmentId, element });
      return () =>
        setRouteMount((current) =>
          current?.element === element ? null : current
        );
    },
    []
  );

  useEffect(() => {
    live.current = true;
    const unsubscribe = store.subscribe(() => {
      const current = active.current;
      if (current && current.scope !== sessionScope())
        end(current, 'Sign in again to join this consultation.');
    });
    return () => {
      live.current = false;
      unsubscribe();
    };
  }, [end]);
  useEffect(() => {
    if (!call) return;
    if (
      error ||
      (status &&
        status.serverNow >= call.session.issuedAt &&
        (!status.canJoin || status.roomName !== call.session.roomName))
    ) {
      end(
        call,
        error
          ? 'Could not verify the appointment. Check your connection and rejoin.'
          : videoStatusText(status)
      );
    }
  }, [call, status, error, end]);
  useEffect(() => {
    if (!call) return;
    const duration =
      Date.parse(call.session.closesAt) - Date.parse(call.session.issuedAt);
    const timer = setTimeout(
      () => end(call, 'The video consultation window has ended.'),
      Math.max(0, duration)
    );
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [call, end]);

  async function join(options: JoinOptions) {
    if (joiningLock.current) return;
    if (active.current) {
      navigate(`/consult/${active.current.appointmentId}`);
      if (active.current.appointmentId !== options.appointmentId)
        toast.info(
          'Leave your current call before opening another consultation.'
        );
      return;
    }
    const scope = sessionScope();
    if (!scope) return;
    joiningLock.current = true;
    setJoining(true);
    setNotice(undefined);
    try {
      const session = await joinVideo(options.appointmentId);
      if (!live.current || scope !== sessionScope()) return;
      const next = { ...options, session, scope };
      active.current = next;
      setCall(next);
    } catch (failure) {
      if (!live.current || scope !== sessionScope()) return;
      const message = (failure as { data?: { message?: string | string[] } })
        .data?.message;
      setNotice(
        Array.isArray(message)
          ? message.join('. ')
          : message ?? 'Could not join the call. Try again.'
      );
    } finally {
      joiningLock.current = false;
      if (live.current) setJoining(false);
    }
  }
  const onConsultationPage =
    !!call && routeMount?.appointmentId === call.appointmentId;
  const target = onConsultationPage ? routeMount.element : floatingMount;
  return (
    <VideoCallContext.Provider value={{ call, joining, notice, join, attach }}>
      {children}
      {call && (
        <>
          <div hidden={onConsultationPage}>
            <ConsultationWorkspace
              active
              floating
              patientName={call.patientName}
              panels={[]}
              actions={null}
              onExpand={() => navigate(`/consult/${call.appointmentId}`)}
              call={
                <div
                  className="video-consultation"
                  aria-label="Video consultation"
                  ref={setFloatingMount}
                />
              }
            />
          </div>
          <Suspense fallback={null}>
            <ConnectedVideoCall
              call={call}
              target={target}
              end={end}
              report={setNotice}
            />
          </Suspense>
        </>
      )}
    </VideoCallContext.Provider>
  );
}
