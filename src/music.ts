const modules = import.meta.glob('./assets/music/*.{mp3,wav,ogg,m4a,aac}', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>;

export const MUSIC_TRACKS = Object.entries(modules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, url]) => url);
