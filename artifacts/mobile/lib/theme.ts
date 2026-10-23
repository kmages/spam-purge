import { useColorScheme } from 'react-native';

const light = {
  background: '#F6F7F9',
  card: '#FFFFFF',
  text: '#111418',
  muted: '#5F6B7A',
  border: '#E1E5EA',
  primary: '#D93025',
  primaryText: '#FFFFFF',
  danger: '#B3261E',
  dangerSoft: '#FCE8E6',
  ok: '#188038',
};

const dark: typeof light = {
  background: '#0F1115',
  card: '#181B21',
  text: '#ECEFF3',
  muted: '#9AA4B2',
  border: '#2A2F37',
  primary: '#F2665C',
  primaryText: '#111418',
  danger: '#F2B8B5',
  dangerSoft: '#3A1D1C',
  ok: '#81C995',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}
