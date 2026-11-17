import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { X } from 'lucide-react-native';
import { DentalChart } from '../src/components/dental-chart';
import { Tooth } from '../src/components/tooth-icon';

let tree: Renderer.ReactTestRenderer;
afterEach(async () => {
  await act(async () => tree?.unmount());
});

test('uses distinct cavity and extraction colours and labels without cross overlays', async () => {
  await act(async () => {
    tree = Renderer.create(
      <DentalChart
        entries={[
          { toothNumber: '15', status: 'caries' },
          { toothNumber: '16', status: 'extract' },
          { toothNumber: '12', status: 'crown' },
          { toothNumber: '13', status: 'rct' },
        ]}
      />,
    );
  });
  const cavity = tree.root.findByProps({
    accessibilityLabel: 'Tooth 15: Cavity',
  });
  const extraction = tree.root.findByProps({
    accessibilityLabel: 'Tooth 16: To be extracted',
  });
  expect(cavity.findByType(Tooth).props.color).toBe('#8B641D');
  expect(extraction.findByType(Tooth).props.color).toBe('#C63430');
  expect(cavity.findAllByType(X)).toHaveLength(0);
  expect(extraction.findAllByType(X)).toHaveLength(0);
  expect(
    tree.root
      .findByProps({ accessibilityLabel: 'Tooth 12: Crown' })
      .findByType(Tooth).props.color,
  ).toBe('#0C7D76');
  expect(
    tree.root
      .findByProps({ accessibilityLabel: 'Tooth 13: Root canal treated' })
      .findByType(Tooth).props.color,
  ).toBe('#7758AE');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Caries');
});

test('keeps all 32 teeth and distinguishes an unrecorded tooth from a healthy assessment', async () => {
  await act(async () => {
    tree = Renderer.create(
      <DentalChart entries={[{ toothNumber: '15', status: 'healthy' }]} />,
    );
  });
  expect(tree.root.findAllByType(Tooth)).toHaveLength(32);
  expect(
    tree.root.findByProps({ accessibilityLabel: 'Tooth 15: Healthy' }),
  ).toBeDefined();
  expect(
    tree.root.findByProps({ accessibilityLabel: 'Tooth 16: Not recorded' }),
  ).toBeDefined();
});
