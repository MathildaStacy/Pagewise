/* Pagewise 苹果风原型 · 图标（lucide 风格、圆头、1.9–2.4 线宽，接近 SF Symbols） */
'use strict';
const ICONS = (() => {
  const s = d => '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  return {
    back: s('<path d="M15 4l-8 8 8 8"/>'),
    more: s('<circle cx="12" cy="12" r="9.5"/><circle cx="7.5" cy="12" r=".6" fill="currentColor"/><circle cx="12" cy="12" r=".6" fill="currentColor"/><circle cx="16.5" cy="12" r=".6" fill="currentColor"/>'),
    search: s('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
    add: s('<path d="M12 5v14M5 12h14"/>'),
    close: s('<path d="M6 6l12 12M18 6L6 18"/>'),
    check: s('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    skip: s('<path d="M5 6l7 6-7 6zM13 6l7 6-7 6"/>'),
    next: s('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    mic: s('<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/>'),
    send: s('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    stop: s('<rect x="6" y="6" width="12" height="12" rx="2.5"/>'),
    book: s('<path d="M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0z"/><path d="M12 5.5V19"/>'),
    derive: s('<path d="M17 5H7l6 7-6 7h10"/>'),
    spark: s('<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'),
    clock: s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>'),
    chev: s('<path d="M9 5l7 7-7 7"/>'),
    chevDown: s('<path d="M5 9l7 7 7-7"/>'),
    updown: s('<path d="M8 9l4-4 4 4M8 15l4 4 4-4"/>'),
    branch: s('<path d="M6 3v10a5 5 0 005 5h7M14 14l4 4-4 4"/>'),
    pin: s('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/>'),
    flag: s('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
    question: s('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 015 .9c0 1.7-2.5 2.2-2.5 3.8M12 17.2v.1"/>'),
    shelf: s('<rect x="4" y="4" width="4" height="16" rx="1"/><rect x="10" y="4" width="4" height="16" rx="1"/><path d="M15.6 5.4l3.5-.9 3 14.5-3.5.9z"/>'),
    cards: s('<rect x="3.5" y="7" width="13" height="13" rx="2.5"/><path d="M8 4h10a2.5 2.5 0 012.5 2.5V16"/>'),
    note: s('<path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14 3v5h5M9 12.5h7M9 16.5h5"/>'),
    person: s('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>'),
    doc: s('<path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14 3v5h5"/>'),
    cpu: s('<rect x="6" y="6" width="12" height="12" rx="2.5"/><path d="M9.5 2.5v3M14.5 2.5v3M9.5 18.5v3M14.5 18.5v3M2.5 9.5h3M2.5 14.5h3M18.5 9.5h3M18.5 14.5h3"/>'),
    sliders: s('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
    paint: s('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 000 18z" fill="currentColor"/>'),
    drive: s('<rect x="3" y="13" width="18" height="7" rx="2"/><path d="M5 13l2.5-8h9L19 13M7 16.5h.01"/>'),
    info: s('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.1"/>'),
    layers: s('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'),
    map: s('<path d="M3 6l6-2.5 6 2.5 6-2.5V18l-6 2.5L9 18l-6 2.5z"/><path d="M9 3.5V18M15 6v14.5"/>'),
    export: s('<path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7.5h14V12"/>'),
    trash: s('<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>'),
    cloud: s('<path d="M7 18.5a4.5 4.5 0 01-.6-9A6 6 0 0118 9a4.8 4.8 0 01-1 9.5z"/>'),
    teach: s('<path d="M4 5.5h16v10H9l-5 4z"/><path d="M8.5 10.5h7"/>'),
    bookopen: s('<path d="M3 5.5c3-1.5 6-1.5 9 .5 3-2 6-2 9-.5V19c-3-1.5-6-1.5-9 .5-3-2-6-2-9-.5z"/>'),
    retry: s('<path d="M4 12a8 8 0 0113.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 01-13.7 5.6L4 15M4 20v-5h5"/>'),
    logo: s('<path d="M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0z"/><path d="M12 5.5V19M15 9.5l1.2-1.2M15.5 13h1.7"/>')
  };
})();
const I = n => ICONS[n] || '';
