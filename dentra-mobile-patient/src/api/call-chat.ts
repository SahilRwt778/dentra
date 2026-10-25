import uuid from 'react-native-uuid';
import { Base64 } from 'js-base64';
import type { NativeChatClient } from '@dentra/video/src/CallChat';
import type { ChatAttachment, ChatMessage, ChatPage } from '@dentra/call-core';
import { pickChatFile } from '@dentra/video/src/pickChatFile';
import { requestPrivate } from './private-request';
import { signedInSession } from './private-download';
import { store } from '@/store/store';

export const callChat: NativeChatClient = {
  requestId: () => String(uuid.v4()),
  pick: pickChatFile,
  list: (id, cursor, signal) =>
    requestPrivate<ChatPage>(
      { url: `/appointments/${id}/video/chat`, params: cursor },
      signal,
    ),
  send: (id, draft, signal) => {
    const body = new FormData();
    body.append('requestId', draft.requestId);
    body.append('text', draft.text);
    if (draft.file) body.append('file', draft.file as unknown as Blob);
    return requestPrivate<ChatMessage>(
      {
        url: `/appointments/${id}/video/chat`,
        method: 'POST',
        body,
        timeout: 60000,
      },
      signal,
    );
  },
  async download(id: string, file: ChatAttachment, signal: AbortSignal) {
    const scope = signedInSession(store.getState());
    if (!scope) throw new Error('Please sign in again.');
    const bytes = await requestPrivate<ArrayBuffer>(
      {
        url: `/appointments/${id}/video/chat/${file.id}/content`,
        timeout: 60000,
        responseHandler: async response => {
          if (!response.ok) return response.json();
          if (
            response.headers.get('Content-Type')?.split(';')[0].trim() !==
            file.mimeType
          )
            throw new Error('The attachment type is invalid.');
          return response.arrayBuffer();
        },
      },
      signal,
    );
    if (signal.aborted || signedInSession(store.getState()) !== scope)
      throw new Error('Session ended.');
    if (
      !(bytes instanceof ArrayBuffer) ||
      bytes.byteLength !== file.sizeBytes ||
      bytes.byteLength > 10 * 1024 * 1024
    )
      throw new Error('The attachment is incomplete.');
    const { cachePrivateFile } =
      require('@/lib/private-files') as typeof import('@/lib/private-files');
    return cachePrivateFile(
      Base64.fromUint8Array(new Uint8Array(bytes)),
      file,
      () => !signal.aborted && signedInSession(store.getState()) === scope,
    );
  },
  async openFile(path, mime) {
    const { openPrivateFile } =
      require('@/lib/private-files') as typeof import('@/lib/private-files');
    await openPrivateFile(path, mime);
  },
};
