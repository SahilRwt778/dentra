/**
 * @format
 */

import { AppRegistry } from 'react-native';
import './src/video/register';
import App from './App';
import { installBackgroundPushHandler } from './src/notifications/native-push';

installBackgroundPushHandler();
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
