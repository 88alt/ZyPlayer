import { isElectron, platform } from '@/utils/systemInfo';

export const dom = () => {
  document.documentElement.setAttribute('platform', platform);
  document.documentElement.setAttribute('desktop', String(isElectron));
};
