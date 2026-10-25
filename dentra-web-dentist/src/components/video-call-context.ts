import { createContext, useContext } from 'react';
import type { VideoSession } from '@/api/generated-api';

export type JoinOptions = {
  appointmentId: string;
  patientName: string;
  microphone: boolean;
  camera: boolean;
};
export type ActiveVideoCall = JoinOptions & {
  session: VideoSession;
  scope: string;
};
export type CallMount = { appointmentId: string; element: HTMLDivElement };
type VideoCalls = {
  call: ActiveVideoCall | undefined;
  joining: boolean;
  notice: string | undefined;
  join: (options: JoinOptions) => Promise<void>;
  attach: (appointmentId: string, element: HTMLDivElement) => () => void;
};
export const VideoCallContext = createContext<VideoCalls | null>(null);

export function useVideoCall() {
  const value = useContext(VideoCallContext);
  if (!value) throw new Error('VideoCallProvider is required.');
  return value;
}
