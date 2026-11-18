import React from 'react';
import { Linking, TextInput } from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { DentalEducationScreen } from '../src/screens/DentalEducationScreen';
import { EducationArticleScreen } from '../src/screens/EducationArticleScreen';
import { FeaturedEducation } from '../src/components/education/featured-education';
import { Button, Card, ErrorState, TextLink } from '../src/components/ui';
import type { PatientScreenProps } from '../src/navigation/types';

const mockNavigate = jest.fn();
const mockBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
let tree: ReactTestRenderer;
const navigation = { navigate: mockNavigate, goBack: mockBack };
const props = {
  navigation,
  route: { params: undefined },
} as unknown as PatientScreenProps<'DentalEducation'>;
async function article(articleId: string) {
  await act(async () => {
    tree = Renderer.create(
      <EducationArticleScreen
        {...({
          navigation,
          route: { params: { articleId } },
        } as unknown as PatientScreenProps<'EducationArticle'>)}
      />,
    );
  });
}
function cards() {
  return tree.root.findAllByType(Card).filter(card => card.props.onPress);
}
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

test('education is searchable locally and categories open the right article without fetching data', async () => {
  await act(async () => {
    tree = Renderer.create(<DentalEducationScreen {...props} />);
  });
  await act(async () =>
    tree.root.findByType(TextInput).props.onChangeText('  CAVITIES  '),
  );
  expect(cards().map(card => card.props.label)).toContain(
    'Read Cavities and tooth decay',
  );
  await act(async () =>
    cards()
      .find(card => card.props.label === 'Read Cavities and tooth decay')!
      .props.onPress(),
  );
  expect(mockNavigate).toHaveBeenCalledWith('EducationArticle', {
    articleId: 'cavities',
  });
  await act(async () =>
    tree.root
      .findAll(
        node =>
          node.props.accessibilityLabel === 'Daily care topics' &&
          !!node.props.onPress,
      )[0]
      .props.onPress(),
  );
  expect(tree.root.findByType(TextInput).props.value).toBe('');
  expect(cards().map(card => card.props.label)).toEqual([
    'Read Brushing well',
    'Read Cleaning between your teeth',
    'Read Looking after your gums',
  ]);
  await act(async () =>
    tree.root.findByType(TextInput).props.onChangeText('zzzz-no-topic'),
  );
  expect(JSON.stringify(tree.toJSON())).toContain('No topics found');
});

test('featured cards open articles and View all opens the education hub', async () => {
  await act(async () => {
    tree = Renderer.create(<FeaturedEducation />);
  });
  await act(async () => cards()[0].props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('EducationArticle', {
    articleId: 'brushing',
  });
  await act(async () => tree.root.findByType(TextLink).props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('DentalEducation');
});

test('an article passes its booking reason to the existing booking flow', async () => {
  await article('missing-teeth');
  await act(async () => tree.root.findByType(Button).props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('Booking', {
    concern: 'Missing Tooth',
  });
});

test('urgent care keeps emergency guidance visible and does not offer routine booking', async () => {
  await article('urgent-care');
  const text = JSON.stringify(tree.toJSON());
  expect(text).toContain('Get emergency medical help immediately');
  expect(text).toContain('Do not wait for a routine app appointment');
  expect(tree.root.findAllByType(Button)).toHaveLength(0);
});

test('an unknown article ID does not crash or offer a booking', async () => {
  await article('missing-article');
  expect(JSON.stringify(tree.toJSON())).toContain('Article unavailable');
  expect(tree.root.findAllByType(Button)).toHaveLength(0);
});

test('source links open the browser and a failed launch shows a retryable message', async () => {
  const open = jest
    .spyOn(Linking, 'openURL')
    .mockRejectedValueOnce(new Error('No handler'));
  await article('brushing');
  const source = tree.root.findAll(
    node => node.props.accessibilityRole === 'link' && !!node.props.onPress,
  )[0];
  await act(async () => source.props.onPress());
  expect(open).toHaveBeenCalledWith(
    'https://www.nhs.uk/live-well/healthy-teeth-and-gums/how-to-keep-your-teeth-clean/',
  );
  expect(tree.root.findByType(ErrorState).props.message).toContain(
    'Couldn’t open this source',
  );
  open.mockResolvedValueOnce(undefined);
  await act(async () => source.props.onPress());
  expect(tree.root.findAllByType(ErrorState)).toHaveLength(0);
});
