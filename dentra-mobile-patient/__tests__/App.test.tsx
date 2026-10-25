/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('@react-navigation/native-stack', () => {
  const ReactModule = require('react');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }: { children: React.ReactNode }) => {
        const first = ReactModule.Children.toArray(children)[0];
        return ReactModule.createElement(first.props.component);
      },
      Screen: () => null,
    }),
  };
});

test('shows the patient login when secure storage has no session', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  expect(JSON.stringify(tree!.toJSON())).toContain('Send code');
  await ReactTestRenderer.act(async () => tree!.unmount());
});
