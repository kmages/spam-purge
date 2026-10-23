// Matches the website (artifacts/spam-purge/src/index.css): dark, with the mint-green accent.
// The app is dark-only, like the site. Red is kept for the real warnings and destructive actions.
const colors = {
  background: '#050505',
  card: '#0A0A0A',
  text: '#FAFAFA',
  muted: '#A6A6A6',
  border: '#1F1F1F',
  primary: '#00FFAA',
  primaryText: '#000000',
  danger: '#F87171',
  dangerSoft: '#2A0F0F',
  ok: '#00FFAA',
};

export type Colors = typeof colors;

export function useColors(): Colors {
  return colors;
}
