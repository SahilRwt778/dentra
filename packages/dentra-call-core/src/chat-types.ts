export const CHAT_ATTACHMENT_LIMIT = 3;

export type ChatAttachment = {
  id: string;
  name: string;
  mimeType: 'image/jpeg' | 'image/png' | 'application/pdf';
  sizeBytes: number;
};
export type ChatMessage = {
  id: string;
  sequence: string;
  requestId: string;
  text: string;
  senderRole: 'patient' | 'dentist';
  own: boolean;
  createdAt: string;
  attachment: ChatAttachment | null;
};
export type ChatPage = {
  items: ChatMessage[];
  hasMore: boolean;
  canSend?: boolean;
  expiresAt?: string | null;
  serverNow?: string;
};
export type ChatFile = {
  uri: string;
  name: string;
  type: string;
  size?: number | null;
};
export type ChatDraft = {
  requestId: string;
  text: string;
  file?: ChatFile | Blob;
};
export type ChatClient = {
  read?(id: string, sequence: string, signal: AbortSignal): Promise<unknown>;
  list(
    id: string,
    cursor: { after?: string; before?: string },
    signal: AbortSignal,
  ): Promise<ChatPage>;
  send(id: string, draft: ChatDraft, signal: AbortSignal): Promise<ChatMessage>;
};
