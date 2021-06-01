import { Platform } from 'react-native';
import PagerNative from './PagerNative';
import PagerDefault from './PagerDefault';

const Pager = Platform.select({
  android: () => PagerNative,
  ios: () => PagerNative,
  macos: () => PagerDefault,
  web: () => PagerDefault,
  windows: () => PagerDefault,
  default: () => PagerDefault,
})();

export default Pager;
