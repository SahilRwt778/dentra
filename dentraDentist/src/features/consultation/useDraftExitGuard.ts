import { Alert } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';

/** One guard covers every consultation section, including a section currently hidden. */
export function useDraftExitGuard(dirty: boolean, saving: boolean) {
  const navigation = useNavigation();
  usePreventRemove(dirty || saving, ({ data }) => {
    if (saving) {
      Alert.alert('Saving draft', 'Please wait for the save to finish.');
      return;
    }
    Alert.alert(
      'Discard unsaved changes?',
      'Your latest changes have not been saved.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard changes',
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    );
  });
}
