import React from 'react';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createChatMediaLoader, type ChatAttachment } from '@dentra/call-core';
import { ChatAttachment as AttachmentCard } from '../src/components/messages/chat-attachment';
import { ChatAttachmentViewer } from '../src/components/messages/chat-attachment-viewer';

const photo: ChatAttachment = {
  id: 'photo',
  name: 'Photo.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 1024,
};
const pdf: ChatAttachment = {
  id: 'pdf',
  name: 'Report.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024 * 1200,
};
let tree: ReactTestRenderer | undefined;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = undefined;
  vi.unstubAllGlobals();
});

test('thumbnail and full-screen opening share one protected download', async () => {
  const dispose = vi.fn();
  const download = vi.fn(async () => ({ uri: 'blob:private-photo', dispose }));
  const loader = createChatMediaLoader(download);
  const first = loader.load(photo),
    second = loader.load(photo);
  expect(first).toBe(second);
  expect(await first).toMatchObject({ uri: 'blob:private-photo' });
  expect(download).toHaveBeenCalledTimes(1);
  loader.clear();
  loader.clear();
  expect(dispose).toHaveBeenCalledOnce();
});

test('downloads are limited to two at a time and clearing cancels queued and in-flight work', async () => {
  const finish: ((value: { uri: string; dispose(): void }) => void)[] = [];
  const download = vi.fn(
    () =>
      new Promise<{ uri: string; dispose(): void }>((resolve) =>
        finish.push(resolve),
      ),
  );
  const loader = createChatMediaLoader(download);
  const pending = [
    photo,
    { ...photo, id: 'second' },
    { ...photo, id: 'third' },
  ].map((file) => loader.load(file));
  const settled = Promise.allSettled(pending);
  expect(download).toHaveBeenCalledTimes(2);
  loader.clear();
  const dispose = vi.fn();
  finish.forEach((resolve) => resolve({ uri: 'blob:late', dispose }));
  expect((await settled).every((result) => result.status === 'rejected')).toBe(
    true,
  );
  expect(dispose).toHaveBeenCalledTimes(2);
  expect(download).toHaveBeenCalledTimes(2);
});

test('failed media can be retried without keeping a rejected cached promise', async () => {
  const download = vi
    .fn()
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValue({ uri: 'blob:retry' });
  const loader = createChatMediaLoader(download);
  await expect(loader.load(photo)).rejects.toThrow('Offline');
  expect(await loader.load(photo)).toMatchObject({ uri: 'blob:retry' });
  expect(download).toHaveBeenCalledTimes(2);
  loader.clear();
});

test('a chat photo renders inline and opens on click', async () => {
  const loader = createChatMediaLoader(async () => ({
    uri: 'blob:private-photo',
  }));
  const open = vi.fn();
  await act(async () => {
    tree = Renderer.create(
      <AttachmentCard
        file={photo}
        loader={loader}
        visible
        opening={false}
        onOpen={open}
      />,
    );
  });
  expect(tree!.root.findByType('img').props.src).toBe('blob:private-photo');
  const button = tree!.root.findByType('button');
  expect(button.props['aria-label']).toBe('View photo: Photo.jpg');
  await act(async () => button.props.onClick());
  expect(open).toHaveBeenCalledOnce();
  loader.clear();
});

test('PDF cards show the document name and size, and never download until opened', async () => {
  const download = vi.fn();
  const loader = createChatMediaLoader(download);
  const open = vi.fn();
  await act(async () => {
    tree = Renderer.create(
      <AttachmentCard
        file={pdf}
        loader={loader}
        visible
        opening={false}
        onOpen={open}
      />,
    );
  });
  const text = JSON.stringify(tree!.toJSON());
  expect(text).toContain('Report.pdf');
  expect(text).toContain('1.2 MB');
  expect(download).not.toHaveBeenCalled();
  await act(async () => tree!.root.findByType('button').props.onClick());
  expect(open).toHaveBeenCalledOnce();
});

test('a failed photo exposes retry and decode failure releases the broken preview', async () => {
  const dispose = vi.fn();
  const download = vi
    .fn()
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValue({ uri: 'blob:photo', dispose });
  const loader = createChatMediaLoader(download);
  await act(async () => {
    tree = Renderer.create(
      <AttachmentCard
        file={photo}
        loader={loader}
        visible
        opening={false}
        onOpen={vi.fn()}
      />,
    );
  });
  expect(tree!.root.findByType('button').props['aria-label']).toContain(
    'Retry photo',
  );
  await act(async () => tree!.root.findByType('button').props.onClick());
  expect(tree!.root.findByType('img').props.src).toBe('blob:photo');
  await act(async () => tree!.root.findByType('img').props.onError());
  expect(dispose).toHaveBeenCalledOnce();
  expect(tree!.root.findAllByType('img')).toHaveLength(0);
  loader.clear();
});

test('the full photo viewer supports zoom/reset, download and Escape without exposing an API URL', async () => {
  vi.stubGlobal('document', { activeElement: null });
  vi.stubGlobal('HTMLElement', class {});
  const close = vi.fn();
  await act(async () => {
    tree = Renderer.create(
      <ChatAttachmentViewer
        file={{
          url: 'blob:private-photo',
          name: photo.name,
          mime: photo.mimeType,
        }}
        onClose={close}
      />,
    );
  });
  async function press(label: string) {
    await act(async () =>
      tree!.root.findByProps({ 'aria-label': label }).props.onClick(),
    );
  }
  expect(tree!.root.findByType('img').props.style.transform).toContain(
    'scale(1)',
  );
  await press('Zoom in');
  expect(tree!.root.findByType('img').props.style.transform).toContain(
    'scale(1.5)',
  );
  await press('Reset zoom');
  expect(tree!.root.findByType('img').props.style.transform).toContain(
    'scale(1)',
  );
  expect(
    tree!.root.findByProps({ 'aria-label': 'Download attachment' }).props,
  ).toMatchObject({ href: 'blob:private-photo', download: 'Photo.jpg' });
  await act(async () =>
    tree!.root
      .findByProps({ role: 'dialog' })
      .props.onKeyDown({ key: 'Escape', stopPropagation: vi.fn() }),
  );
  expect(close).toHaveBeenCalledOnce();
});

test('PDF viewing uses the downloaded blob and exposes download and a separate-tab action', async () => {
  vi.stubGlobal('document', { activeElement: null });
  vi.stubGlobal('HTMLElement', class {});
  await act(async () => {
    tree = Renderer.create(
      <ChatAttachmentViewer
        file={{
          url: 'blob:private-pdf',
          name: 'Report.pdf',
          mime: 'application/pdf',
        }}
        onClose={vi.fn()}
      />,
    );
  });
  expect(tree!.root.findByType('iframe').props).toMatchObject({
    src: 'blob:private-pdf',
    title: 'Report.pdf',
  });
  expect(
    tree!.root.findByProps({ 'aria-label': 'Open PDF in new tab' }).props,
  ).toMatchObject({
    href: 'blob:private-pdf',
    target: '_blank',
    rel: 'noreferrer',
  });
  expect(
    tree!.root.findByProps({ 'aria-label': 'Download attachment' }).props
      .download,
  ).toBe('Report.pdf');
});
