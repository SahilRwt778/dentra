/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { getVideoSdk } from './src/common/services/native-video';
import App from './App';

getVideoSdk();
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
