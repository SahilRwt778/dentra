import { Download, FileText, ImageOff, LoaderCircle } from 'lucide-react';
import {
  attachmentSize,
  useChatPhoto,
  type ChatAttachment as Attachment,
  type ChatMediaLoader,
} from '@dentra/call-core';

export function ChatAttachment({
  file,
  loader,
  visible,
  opening,
  onOpen,
}: {
  file: Attachment;
  loader: ChatMediaLoader;
  visible: boolean;
  opening: boolean;
  onOpen(): void;
}) {
  const photo = useChatPhoto(loader, file, visible);
  const image = file.mimeType.startsWith('image/');
  return (
    <button
      type="button"
      className={image ? 'chat-photo-preview' : 'call-chat-file'}
      aria-label={`${photo.error ? 'Retry photo' : image ? 'View photo' : 'Open PDF'}: ${file.name}`}
      disabled={opening}
      onClick={photo.error ? photo.retry : onOpen}
    >
      {image ? (
        photo.uri ? (
          <img
            src={photo.uri}
            alt={file.name}
            onError={photo.fail}
            draggable={false}
          />
        ) : (
          <span className="chat-photo-placeholder">
            {photo.error ? (
              <ImageOff size={26} />
            ) : (
              <LoaderCircle size={25} className="chat-media-spinner" />
            )}
            <span>
              {photo.error
                ? 'Photo unavailable · Click to retry'
                : 'Loading photo…'}
            </span>
          </span>
        )
      ) : (
        <>
          <span className="chat-file-icon">
            <FileText size={25} />
          </span>
          <span className="chat-file-details">
            <strong className="chat-document-name" title={file.name}>
              {file.name}
            </strong>
            <small>PDF · {attachmentSize(file.sizeBytes)}</small>
            <span className="chat-file-action">
              {opening ? 'Opening…' : 'Open document'}
            </span>
          </span>
          {opening ? (
            <LoaderCircle size={19} className="chat-media-spinner" />
          ) : (
            <Download size={19} />
          )}
        </>
      )}
      {image && opening && (
        <span className="chat-photo-opening">
          <LoaderCircle size={24} className="chat-media-spinner" />
        </span>
      )}
    </button>
  );
}
