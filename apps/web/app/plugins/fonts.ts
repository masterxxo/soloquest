// Preload the Inter Latin variable font. Importing the woff2 with `?url` yields the exact
// bundled asset URL that @fontsource's @font-face also resolves to, so the preload hits the
// same file the CSS asks for — no duplicate download, and the UI font is ready before first
// paint (no FOUT). Inter is the only family preloaded; the display/mono faces load on demand.
import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';

export default defineNuxtPlugin(() => {
  useHead({
    link: [
      {
        rel: 'preload',
        as: 'font',
        type: 'font/woff2',
        href: interLatin,
        crossorigin: '',
      },
    ],
  });
});
