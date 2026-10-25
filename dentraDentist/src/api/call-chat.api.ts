import { encode } from 'base64-arraybuffer';
import type { NativeChatClient } from '@dentra/video/src/CallChat';
import type { ChatMessage, ChatPage } from '@dentra/call-core';
import { pickChatFile } from '@dentra/video/src/pickChatFile';
import { api } from './client';
import { session } from '../features/auth/session';
import { createRequestId } from '../common/utils/request-id';
import {
  cachePrivateFile,
  openPrivatePdf,
} from '../common/services/private-files';

export const callChat: NativeChatClient = {
  requestId: createRequestId,
  pick: pickChatFile,
  async list(id, cursor, signal) {
    return (
      await api.get<ChatPage>(`/appointments/${id}/video/chat`, {
        params: cursor,
        signal,
      })
    ).data;
  },
  async send(id, draft, signal) {
    const body = new FormData();
    body.append('requestId', draft.requestId);
    body.append('text', draft.text);
    if (draft.file) body.append('file', draft.file as unknown as Blob);
    return (
      await api.post<ChatMessage>(`/appointments/${id}/video/chat`, body, {
        signal,
        timeout: 60000,
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    ).data;
  },
  async download(id, file, signal) {
    const version = session.getVersion();
    const current = () =>
      !signal.aborted &&
      session.isSignedIn() &&
      session.getVersion() === version;
    const result = await api.get<ArrayBuffer>(
      `/appointments/${id}/video/chat/${file.id}/content`,
      { responseType: 'arraybuffer', signal, timeout: 60000 },
    );
    if (
      String(result.headers['content-type'] ?? '')
        .split(';')[0]
        .trim() !== file.mimeType
    )
      throw new Error('The attachment type is invalid.');
    if (
      !(result.data instanceof ArrayBuffer) ||
      result.data.byteLength !== file.sizeBytes ||
      result.data.byteLength > 10 * 1024 * 1024
    )
      throw new Error('The attachment is incomplete.');
    return cachePrivateFile(encode(result.data), file, current);
  },
  openFile: path => openPrivatePdf(path),
};
