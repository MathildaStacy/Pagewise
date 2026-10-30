/** Verbatim Fluent color glyphs from prototype-win11/icons.js and shell.html. */
export const colorGlyphs: Record<string, [string, string]> = {
  fire: [
    '<path d="M14 3c1 3.5 6.5 6.5 6.5 13A6.5 6.5 0 017.5 16c0-3 1.5-5 3-6.5.3 2 1.2 3 2.2 3.3C12 9.5 12.5 5.8 14 3z" fill="url(#gfire)"/><path d="M14 14.5c.6 1.6 3 2.6 3 5a3 3 0 01-6 0c0-1.4.9-2.4 1.6-3 .1.8.5 1.3 1 1.4-.2-1.3 0-2.5.4-3.4z" fill="#FFE68A"/>',
    'rgba(255,138,61,.14)',
  ],
  cards: [
    '<rect x="9" y="4" width="15" height="19" rx="3" fill="url(#gpurple)" transform="rotate(12 16 14)"/><rect x="4" y="6" width="15" height="19" rx="3" fill="url(#gblue)"/><path d="M8 12h7M8 16h5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".9"/>',
    'rgba(70,100,240,.12)',
  ],
  pin: [
    '<path d="M14 3.5a7 7 0 017 7c0 4.6-5 9.6-6.3 11.2a1 1 0 01-1.4 0C12 20.1 7 15.1 7 10.5a7 7 0 017-7z" fill="url(#gpink)"/><circle cx="14" cy="10.5" r="2.6" fill="#fff"/>',
    'rgba(226,60,110,.1)',
  ],
  bulb: [
    '<path d="M14 3.5a7.5 7.5 0 00-4.4 13.6c.6.4.9 1 .9 1.7V20h7v-1.2c0-.7.3-1.3.9-1.7A7.5 7.5 0 0014 3.5z" fill="url(#gyellow)"/><rect x="10.5" y="21" width="7" height="3.5" rx="1.5" fill="#9AA0B4"/>',
    'rgba(255,176,32,.14)',
  ],
  question: [
    '<circle cx="14" cy="14" r="10.5" fill="url(#ggreen)"/><path d="M11.2 11.3a2.9 2.9 0 015.6.9c0 2-2.8 2.4-2.8 4.1" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="14" cy="19.8" r="1.2" fill="#fff"/>',
    'rgba(16,158,104,.12)',
  ],
  check: [
    '<circle cx="14" cy="14" r="10.5" fill="url(#ggreen)"/><path d="M9.5 14.3l3.1 3.1 6-6.3" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    'rgba(16,158,104,.12)',
  ],
  warn: [
    '<path d="M12.3 4.5a2 2 0 013.4 0l9 15.5a2 2 0 01-1.7 3H5a2 2 0 01-1.7-3z" fill="url(#gorange)"/><path d="M14 10.5v5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="14" cy="19" r="1.3" fill="#fff"/>',
    'rgba(240,122,26,.12)',
  ],
  error: [
    '<circle cx="14" cy="14" r="10.5" fill="url(#gred)"/><path d="M10.5 10.5l7 7M17.5 10.5l-7 7" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
    'rgba(214,58,42,.1)',
  ],
  folder: [
    '<path d="M3 8a2 2 0 012-2h5.5l2 2H23a2 2 0 012 2v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" fill="url(#gyellow)"/><path d="M3 12h22" stroke="#E09A0E" stroke-width="1"/>',
    'rgba(255,176,32,.14)',
  ],
  book: [
    '<path d="M5 5.5c3-.8 6-.4 9 1.5v16c-3-1.9-6-2.3-9-1.5z" fill="url(#gblue)"/><path d="M23 5.5c-3-.8-6-.4-9 1.5v16c3-1.9 6-2.3 9-1.5z" fill="url(#gpurple)"/><path d="M14 7v16" stroke="#fff" stroke-width="1" opacity=".6"/>',
    'rgba(70,100,240,.12)',
  ],
  pdf: [
    '<path d="M7 3h10l5 5v15a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" fill="url(#gred)"/><path d="M17 3v5h5" fill="#FFB3A6"/><text x="13.5" y="19.5" font-size="6.5" font-weight="800" fill="#fff" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif">PDF</text>',
    'rgba(214,58,42,.1)',
  ],
  epub: [
    '<path d="M7 3h10l5 5v15a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" fill="url(#gteal)"/><path d="M17 3v5h5" fill="#A6F0E6"/><text x="13.5" y="19.5" font-size="5.6" font-weight="800" fill="#fff" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif">EPUB</text>',
    'rgba(14,154,140,.1)',
  ],
  gear: [
    '<path d="M14 3.5l2 .4.6 2.4 1.9 1.1 2.4-.7 1.4 1.5-.7 2.4 1.1 1.9 2.4.6.3 2-2.4.9-.7 2.1 1 2.3-1.3 1.6-2.4-.6-1.8 1.3-.4 2.4-2 .3-1-2.3-2.2-.3-1.8 1.7-1.7-1.1.6-2.4-1.4-1.6-2.5.1-.6-2 2.1-1.2.1-2.2-1.9-1.6.8-1.8 2.4.3 1.3-1.8-.2-2.5 1.9-.8 1.6 1.9 2.2-.1z" fill="url(#ggray)"/><circle cx="14" cy="14" r="4" fill="#fff"/>',
    'rgba(110,120,150,.12)',
  ],
  cpu: [
    '<rect x="6" y="6" width="16" height="16" rx="4" fill="url(#gpurple)"/><rect x="10" y="10" width="8" height="8" rx="2" fill="#fff" opacity=".9"/><path d="M10 3v3M14 3v3M18 3v3M10 22v3M14 22v3M18 22v3M3 10h3M3 14h3M3 18h3M22 10h3M22 14h3M22 18h3" stroke="#9C84FF" stroke-width="1.6" stroke-linecap="round"/>',
    'rgba(124,92,255,.12)',
  ],
  sliders: [
    '<rect x="4" y="7" width="20" height="3" rx="1.5" fill="#C9D1E3"/><rect x="4" y="18" width="20" height="3" rx="1.5" fill="#C9D1E3"/><circle cx="17.5" cy="8.5" r="3.5" fill="url(#ggreen)"/><circle cx="10" cy="19.5" r="3.5" fill="url(#gblue)"/>',
    'rgba(16,158,104,.1)',
  ],
  paint: [
    '<path d="M14 3.5C8.2 3.5 3.5 8 3.5 13.6c0 5.2 4 9 8.6 9 1.4 0 2-1 2-2 0-1.4-1.2-1.8-1.2-3 0-1.1.9-1.8 2-1.8h2.8c3.6 0 6.8-2.6 6.8-6.2 0-4.6-4.6-6.1-10.5-6.1z" fill="url(#gpaper)" stroke="#C9D1E3"/><circle cx="9" cy="12" r="2" fill="#2B7BFF"/><circle cx="12.5" cy="7.8" r="2" fill="#7C5CFF"/><circle cx="17.5" cy="8" r="2" fill="#E2549F"/><circle cx="20.5" cy="12" r="1.8" fill="#FF9A4D"/>',
    'rgba(124,92,255,.1)',
  ],
  drive: [
    '<rect x="3.5" y="14" width="21" height="9" rx="3" fill="url(#ggray)"/><path d="M6 14l3-8.5h10L22 14z" fill="#E3E7EF"/><circle cx="8" cy="18.5" r="1.4" fill="#5FD49A"/>',
    'rgba(110,120,150,.12)',
  ],
  info: [
    '<circle cx="14" cy="14" r="10.5" fill="url(#gblue)"/><path d="M14 12.5v6.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="14" cy="9" r="1.4" fill="#fff"/>',
    'rgba(45,107,240,.12)',
  ],
  map: [
    '<path d="M3.5 7l6.5-2.5 8 2.5 6.5-2.5v16.5L18 23.5l-8-2.5-6.5 2.5z" fill="url(#gteal)"/><path d="M10 4.5V21M18 7v16.5" stroke="#fff" stroke-width="1.2" opacity=".7"/><circle cx="14" cy="12" r="2.6" fill="#FF6A3D"/>',
    'rgba(14,154,140,.1)',
  ],
  note: [
    '<path d="M7 3.5h10.5l5 5V22a2.5 2.5 0 01-2.5 2.5H7A2.5 2.5 0 014.5 22V6A2.5 2.5 0 017 3.5z" fill="url(#gpaper)" stroke="#C9D1E3"/><path d="M17.5 3.5v5h5" fill="#DDE3EE"/><path d="M8.5 13h10M8.5 17h7" stroke="#2D6BF0" stroke-width="1.8" stroke-linecap="round"/>',
    'rgba(45,107,240,.1)',
  ],
  export: [
    '<rect x="4" y="12" width="20" height="12" rx="3" fill="url(#gblue)"/><path d="M14 17V4.5M9.5 9L14 4.5 18.5 9" stroke="#5FD49A" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    'rgba(45,107,240,.12)',
  ],
  chart: [
    '<rect x="4" y="15" width="5" height="9" rx="1.5" fill="url(#gblue)"/><rect x="11.5" y="9" width="5" height="15" rx="1.5" fill="url(#gpurple)"/><rect x="19" y="4" width="5" height="20" rx="1.5" fill="url(#gpink)"/>',
    'rgba(124,92,255,.12)',
  ],
  calendar: [
    '<rect x="3.5" y="5.5" width="21" height="19" rx="4" fill="url(#gpaper)" stroke="#C9D1E3"/><path d="M3.5 9.5a4 4 0 014-4h13a4 4 0 014 4v1.5h-21z" fill="url(#gred)"/><circle cx="10" cy="16" r="1.5" fill="#2D6BF0"/><circle cx="14" cy="16" r="1.5" fill="#9AA0B4"/><circle cx="18" cy="16" r="1.5" fill="#9AA0B4"/><circle cx="10" cy="20" r="1.5" fill="#9AA0B4"/>',
    'rgba(214,58,42,.08)',
  ],
  key: [
    '<circle cx="9.5" cy="18" r="5.5" fill="url(#gyellow)"/><circle cx="9.5" cy="18" r="2" fill="#fff"/><path d="M13.5 14L23 4.5M19 8.5l3 3M16.5 11l2 2" stroke="#E2A400" stroke-width="2.6" stroke-linecap="round"/>',
    'rgba(255,176,32,.14)',
  ],
  shield: [
    '<path d="M14 3l9 3.5v6.5c0 5.6-3.8 9.7-9 12-5.2-2.3-9-6.4-9-12V6.5z" fill="url(#gblue)"/><path d="M10 14l3 3 5.5-6" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    'rgba(45,107,240,.12)',
  ],
  cloud: [
    '<path d="M8.5 22.5a5.5 5.5 0 01-.8-10.9A7.5 7.5 0 0122.2 12a5.5 5.5 0 01-.7 10.5z" fill="url(#gblue)"/><path d="M11 17h6" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/>',
    'rgba(45,107,240,.12)',
  ],
  ai: [
    '<path d="M14 2.5c.6 0 .9.3 1.1.9l1.6 4.9c.3 1 1.2 1.9 2.2 2.2l4.9 1.6c.6.2.9.5.9 1.1s-.3.9-.9 1.1l-4.9 1.6c-1 .3-1.9 1.2-2.2 2.2l-1.6 4.9c-.2.6-.5.9-1.1.9s-.9-.3-1.1-.9l-1.6-4.9c-.3-1-1.2-1.9-2.2-2.2l-4.9-1.6c-.6-.2-.9-.5-.9-1.1s.3-.9.9-1.1l4.9-1.6c1-.3 1.9-1.2 2.2-2.2l1.6-4.9c.2-.6.5-.9 1.1-.9z" fill="url(#gai)"/>',
    'rgba(124,92,255,.1)',
  ],
  listen: [
    '<path d="M5 15v-1.5a9 9 0 0118 0V15" stroke="url(#gblue)" stroke-width="2.6" fill="none" stroke-linecap="round"/><rect x="3.5" y="14" width="6" height="9" rx="2.5" fill="url(#gblue)"/><rect x="18.5" y="14" width="6" height="9" rx="2.5" fill="url(#gpurple)"/>',
    'rgba(45,107,240,.12)',
  ],
  search: [
    '<circle cx="12" cy="12" r="7.5" fill="url(#gblue)"/><circle cx="12" cy="12" r="4.5" fill="#fff" opacity=".85"/><path d="M17.5 17.5l6 6" stroke="#5B6380" stroke-width="3.2" stroke-linecap="round"/>',
    'rgba(45,107,240,.12)',
  ],
  trash: [
    '<path d="M7 9h14l-1.2 13.5a2 2 0 01-2 1.8h-7.6a2 2 0 01-2-1.8z" fill="url(#ggray)"/><rect x="5" y="6" width="18" height="3.5" rx="1.5" fill="url(#gred)"/><path d="M11.5 4.5h5" stroke="#D63A2A" stroke-width="2" stroke-linecap="round"/>',
    'rgba(214,58,42,.08)',
  ],
  trophy: [
    '<path d="M8 4h12v6a6 6 0 01-12 0z" fill="url(#gyellow)"/><path d="M8 6H4.5a3.5 3.5 0 003.8 4.5M20 6h3.5a3.5 3.5 0 01-3.8 4.5" stroke="#F2A814" stroke-width="2" fill="none"/><rect x="12.5" y="15.5" width="3" height="4.5" fill="#E2A400"/><rect x="9" y="20" width="10" height="4" rx="1.5" fill="url(#ggray)"/>',
    'rgba(255,176,32,.14)',
  ],
  clock: [
    '<circle cx="14" cy="14" r="10.5" fill="url(#gpaper)" stroke="#C9D1E3"/><path d="M14 8v6.5l4 2.5" stroke="#2D6BF0" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
    'rgba(45,107,240,.1)',
  ],
  layers: [
    '<path d="M14 15.5l10-5-10-5-10 5z" fill="url(#gpurple)"/><path d="M4 15l10 5 10-5" stroke="url(#gblue)" stroke-width="2.4" fill="none" stroke-linejoin="round"/><path d="M4 19.5l10 5 10-5" stroke="url(#gteal)" stroke-width="2.4" fill="none" stroke-linejoin="round"/>',
    'rgba(124,92,255,.1)',
  ],
  branch: [
    '<circle cx="8" cy="6" r="3" fill="url(#gpurple)"/><circle cx="8" cy="22" r="3" fill="url(#gpurple)"/><circle cx="20.5" cy="10" r="3" fill="url(#gpink)"/><path d="M8 9v10M20.5 13c0 4-3.5 5.5-12 7.5" stroke="#9C84FF" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
    'rgba(124,92,255,.12)',
  ],
  derive: [
    '<rect x="4" y="4" width="20" height="20" rx="5" fill="url(#gteal)"/><path d="M18.5 8.5h-9l5 5.5-5 5.5h9" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    'rgba(14,154,140,.12)',
  ],
  rocket: [
    '<path d="M14 3c4 2.5 6 6.5 6 11l-2.5 4h-7L8 14c0-4.5 2-8.5 6-11z" fill="url(#gpaper)" stroke="#C9D1E3"/><circle cx="14" cy="11" r="2.5" fill="url(#gblue)"/><path d="M10.5 18L7 22.5l1-5M17.5 18l3.5 4.5-1-5" fill="url(#gred)"/><path d="M12 19.5h4l-2 5z" fill="url(#gfire)"/>',
    'rgba(45,107,240,.1)',
  ],
  camera: [
    '<rect x="3" y="8" width="22" height="15" rx="4" fill="url(#ggray)"/><path d="M9.5 8l1.5-3h6l1.5 3z" fill="#8A92A6"/><circle cx="14" cy="15.5" r="4.6" fill="#fff"/><circle cx="14" cy="15.5" r="3" fill="url(#gblue)"/>',
    'rgba(110,120,150,.12)',
  ],
  wifiOff: [
    '<path d="M3 11a16 16 0 0122 0M7 15a10 10 0 0114 0M11 19a4 4 0 016 0" stroke="#9AA0B4" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M5 4l18 20" stroke="url(#gred)" stroke-width="2.8" stroke-linecap="round"/>',
    'rgba(214,58,42,.08)',
  ],
};
export const colorDefs =
  '\n    <linearGradient id="gai" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2B7BFF"/><stop offset=".45" stop-color="#7C5CFF"/><stop offset=".75" stop-color="#E2549F"/><stop offset="1" stop-color="#FF9A4D"/></linearGradient>\n    <linearGradient id="gline" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2B7BFF"/><stop offset=".6" stop-color="#7C5CFF"/><stop offset="1" stop-color="#E2549F"/></linearGradient>\n    <linearGradient id="gfire" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD25A"/><stop offset=".55" stop-color="#FF8A3D"/><stop offset="1" stop-color="#E8432E"/></linearGradient>\n    <linearGradient id="gblue" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7FB6FF"/><stop offset="1" stop-color="#2D6BF0"/></linearGradient>\n    <linearGradient id="gpurple" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C6A8FF"/><stop offset="1" stop-color="#7A4BE6"/></linearGradient>\n    <linearGradient id="gpink" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF9EB8"/><stop offset="1" stop-color="#E23C6E"/></linearGradient>\n    <linearGradient id="gyellow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE97A"/><stop offset="1" stop-color="#FFB020"/></linearGradient>\n    <linearGradient id="ggreen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#66D9A8"/><stop offset="1" stop-color="#109E68"/></linearGradient>\n    <linearGradient id="gorange" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC27A"/><stop offset="1" stop-color="#F07A1A"/></linearGradient>\n    <linearGradient id="gred" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF9A8A"/><stop offset="1" stop-color="#D63A2A"/></linearGradient>\n    <linearGradient id="gteal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6FE3D6"/><stop offset="1" stop-color="#0E9A8C"/></linearGradient>\n    <linearGradient id="ggray" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D5D9E2"/><stop offset="1" stop-color="#8A92A6"/></linearGradient>\n    <linearGradient id="gpaper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E6EAF2"/></linearGradient>\n    <linearGradient id="gstart" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4FB4FF"/><stop offset="1" stop-color="#0A62D8"/></linearGradient>\n  ';
