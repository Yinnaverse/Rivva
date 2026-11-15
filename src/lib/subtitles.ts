export const SUBTITLE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'yo', label: 'Yoruba' },
  { code: 'ig', label: 'Igbo' },
  { code: 'ha', label: 'Hausa' },
  { code: 'ar', label: 'Arabic' },
];

/** Accepts .vtt as-is and converts .srt to WebVTT. */
export function toVtt(text: string): string {
  const t = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (t.startsWith('WEBVTT')) return `${t}\n`;
  return `WEBVTT\n\n${t.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}\n`;
}
