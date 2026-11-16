import React from 'react';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ChatAttachmentMenu } from '../src/components/chat-attachment-menu';
import { ChatCameraCapture } from '../src/components/chat-camera-capture';

let tree: ReactTestRenderer;
const galleryClick = vi.fn(),
  fileClick = vi.fn(),
  focus = vi.fn();
const media = { getUserMedia: vi.fn() };
const video = {
  srcObject: null as unknown,
  play: vi.fn(async () => undefined),
  videoWidth: 1280,
  videoHeight: 720,
};
const documentMock = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  createElement: vi.fn(),
};
class PhotoStream {
  constructor(private tracks: { stop(): void }[]) {}
  getTracks() {
    return this.tracks;
  }
}
const nodeMock = (element: {
  type: unknown;
  props: Record<string, unknown>;
}) => {
  if (element.type === 'video') return video;
  if (element.type === 'input')
    return {
      click:
        element.props['aria-label'] === 'Choose chat photo'
          ? galleryClick
          : fileClick,
    };
  if (element.type === 'button') return { focus };
  if (element.type === 'div') return { contains: () => false };
  return null;
};
async function press(label: string) {
  const button = tree.root.findAll(
    (node) =>
      node.type === 'button' &&
      (node.props['aria-label'] === label || node.children.includes(label))
  )[0];
  await act(async () => button.props.onClick());
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('document', documentMock);
  vi.stubGlobal('window', { document: documentMock });
  vi.stubGlobal('navigator', { mediaDevices: media });
  vi.stubGlobal('MediaStream', PhotoStream);
  documentMock.createElement.mockReturnValue({
    getContext: () => ({ drawImage: vi.fn() }),
    toBlob: (callback: (blob: Blob) => void) =>
      callback(new Blob(['synthetic photo'], { type: 'image/jpeg' })),
  });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  vi.unstubAllGlobals();
});

test('the paperclip opens Gallery, Camera and File and each routes to the right picker', async () => {
  const onSelect = vi.fn(),
    onCamera = vi.fn();
  await act(async () => {
    tree = Renderer.create(
      <ChatAttachmentMenu active onSelect={onSelect} onCamera={onCamera} />,
      { createNodeMock: nodeMock }
    );
  });
  expect(tree.root.findAllByProps({ role: 'group' })).toHaveLength(0);
  await press('Add attachment');
  expect(tree.root.findAllByProps({ role: 'group' })).toHaveLength(1);
  await press('Gallery');
  expect(galleryClick).toHaveBeenCalledOnce();
  expect(tree.root.findAllByProps({ role: 'group' })).toHaveLength(0);
  await press('Add attachment');
  await press('File');
  expect(fileClick).toHaveBeenCalledOnce();
  const file = new File(['synthetic report'], 'Report.pdf', {
    type: 'application/pdf',
  });
  const input = tree.root.findByProps({ 'aria-label': 'Choose chat file' });
  await act(async () =>
    input.props.onChange({ target: { files: [file], value: 'chosen' } })
  );
  expect(onSelect).toHaveBeenCalledWith(file);
  await press('Add attachment');
  await press('Camera');
  expect(onCamera).toHaveBeenCalledOnce();
});

test('Escape closes the attachment menu and returning focus does not choose a file', async () => {
  const onSelect = vi.fn();
  await act(async () => {
    tree = Renderer.create(
      <ChatAttachmentMenu active onSelect={onSelect} onCamera={vi.fn()} />,
      { createNodeMock: nodeMock }
    );
  });
  await press('Add attachment');
  await act(async () =>
    tree.root
      .findByProps({ className: 'chat-attachment-picker' })
      .props.onKeyDown({ key: 'Escape', stopPropagation: vi.fn() })
  );
  expect(tree.root.findAllByProps({ role: 'group' })).toHaveLength(0);
  expect(focus).toHaveBeenCalled();
  expect(onSelect).not.toHaveBeenCalled();
});

test('camera capture clones the live call track and never stops the original call camera', async () => {
  const stopOriginal = vi.fn(),
    stopClone = vi.fn(),
    onCapture = vi.fn();
  const track = {
    readyState: 'live',
    clone: vi.fn(() => ({ stop: stopClone })),
    stop: stopOriginal,
  } as unknown as MediaStreamTrack;
  await act(async () => {
    tree = Renderer.create(
      <ChatCameraCapture
        sourceTrack={track}
        onCapture={onCapture}
        onClose={vi.fn()}
      />,
      { createNodeMock: nodeMock }
    );
  });
  expect(media.getUserMedia).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType('video').props.onLoadedMetadata());
  await press('Take photo');
  expect(onCapture).toHaveBeenCalledOnce();
  expect(onCapture.mock.calls[0][0]).toMatchObject({ type: 'image/jpeg' });
  await act(async () => tree.unmount());
  expect(stopClone).toHaveBeenCalledOnce();
  expect(stopOriginal).not.toHaveBeenCalled();
});

test('closing camera before permission resolves releases the late photo stream', async () => {
  let resolve!: (stream: PhotoStream) => void;
  const stop = vi.fn(),
    onCapture = vi.fn();
  media.getUserMedia.mockReturnValue(
    new Promise<PhotoStream>((done) => {
      resolve = done;
    })
  );
  await act(async () => {
    tree = Renderer.create(
      <ChatCameraCapture onCapture={onCapture} onClose={vi.fn()} />,
      { createNodeMock: nodeMock }
    );
  });
  expect(media.getUserMedia).toHaveBeenCalledWith({
    audio: false,
    video: { facingMode: 'environment' },
  });
  await act(async () => tree.unmount());
  await act(async () => resolve(new PhotoStream([{ stop }])));
  expect(stop).toHaveBeenCalledOnce();
  expect(onCapture).not.toHaveBeenCalled();
});
