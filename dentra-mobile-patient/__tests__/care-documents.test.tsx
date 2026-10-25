import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import BlobUtil from 'react-native-blob-util';
import { CareDocumentDownloads } from '../src/components/care-document-downloads';
import { Button } from '../src/components/ui';

const mockDownload = jest.fn();
jest.mock('../src/api/care-documents', () => ({
  useDownloadCareDocument: () => mockDownload,
}));
let tree: Renderer.ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  mockDownload.mockResolvedValue('/private-cache/visit.pdf');
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});
async function render(hasPrescription = true) {
  await act(async () => {
    tree = Renderer.create(
      <CareDocumentDownloads
        appointmentId="completed-visit"
        hasPrescription={hasPrescription}
      />,
    );
  });
}
async function press(title: string) {
  await act(async () => {
    tree.root
      .findAllByType(Button)
      .find(button => button.props.title === title)!
      .props.onPress();
  });
}
test('completed visit PDFs open with the phone viewer after the protected download succeeds', async () => {
  await render();
  await press('Download visit summary PDF');
  expect(mockDownload).toHaveBeenCalledWith('completed-visit', 'visit-summary');
  expect(BlobUtil.ios.openDocument).toHaveBeenCalledWith(
    '/private-cache/visit.pdf',
  );
  await press('Download prescription PDF');
  expect(mockDownload).toHaveBeenLastCalledWith(
    'completed-visit',
    'prescription',
  );
});
test('an unsigned or absent prescription offers only the visit-summary document', async () => {
  await render(false);
  expect(
    tree.root.findAllByType(Button).map(button => button.props.title),
  ).toEqual(['Download visit summary PDF']);
});
test('server refusals are shown and never open an error response as a document', async () => {
  mockDownload.mockRejectedValueOnce({
    data: { message: 'A signed prescription is required.' },
  });
  await render();
  await press('Download prescription PDF');
  expect(
    tree.root
      .findAllByType(Text)
      .flatMap(text => text.props.children)
      .join(' '),
  ).toContain('A signed prescription is required.');
  expect(BlobUtil.ios.openDocument).not.toHaveBeenCalled();
});
