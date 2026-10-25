import type { ChatClient, ChatMessage, ChatPage } from '@dentra/call-core';
import { requestPrivate } from './private-request';

export const callChat: ChatClient = {
  list: (id, cursor, signal) =>
    requestPrivate<ChatPage>(
      { url: `/appointments/${id}/video/chat`, params: cursor },
      signal
    ),
  send: (id, draft, signal) => {
    const body = new FormData();
    body.append('requestId', draft.requestId);
    body.append('text', draft.text);
    if (draft.file) body.append('file', draft.file as Blob);
    return requestPrivate<ChatMessage>(
      {
        url: `/appointments/${id}/video/chat`,
        method: 'POST',
        body,
        timeout: 60000,
      },
      signal
    );
  },
};
export function downloadChatAttachment(
  id: string,
  messageId: string,
  signal: AbortSignal
) {
  return requestPrivate<Blob>(
    {
      url: `/appointments/${id}/video/chat/${messageId}/content`,
      timeout: 60000,
      responseHandler: (response) =>
        response.ok ? response.blob() : response.json(),
    },
    signal
  );
}
