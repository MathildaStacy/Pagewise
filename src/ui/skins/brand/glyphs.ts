/** Verbatim vector paths from the three prototype icons.js files. */
export const brandGlyphs: Record<string, Record<string, string>> = {
  meta: {
    back: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 12h-15M11 5l-7 7 7 7"/></svg>',
    more: '<svg class="i f" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10a2 2 0 110 4 2 2 0 010-4zm6 0a2 2 0 110 4 2 2 0 010-4zm6 0a2 2 0 110 4 2 2 0 010-4z"/></svg>',
    search:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/></svg>',
    add: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    close:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    check:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    skip: '<svg class="i f" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6.2v11.6c0 .8.9 1.3 1.6.8l8.2-5.8c.6-.4.6-1.2 0-1.6L6.6 5.4C5.9 4.9 5 5.4 5 6.2zM16.5 5h2.5v14h-2.5z"/></svg>',
    next: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12h15M13 5l7 7-7 7"/></svg>',
    mic: '<svg class="i f" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3.5 3.5 0 003.5-3.5v-5a3.5 3.5 0 00-7 0v5A3.5 3.5 0 0012 15zm6.5-4a.9.9 0 00-1.8 0 4.7 4.7 0 01-9.4 0 .9.9 0 00-1.8 0 6.5 6.5 0 005.6 6.4V20H9a.9.9 0 000 1.8h6a.9.9 0 000-1.8h-2.1v-2.6a6.5 6.5 0 005.6-6.4z"/></svg>',
    send: '<svg class="i f" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.3 3.6a.8.8 0 011.1-.9l16.4 8.5a.9.9 0 010 1.6L4.4 21.3a.8.8 0 01-1.1-.9L5 13l8-1-8-1z"/></svg>',
    stop: '<svg class="i f" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 5.5h9a2 2 0 012 2v9a2 2 0 01-2 2h-9a2 2 0 01-2-2v-9a2 2 0 012-2z"/></svg>',
    book: '<svg class="i f" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 4.6c2.7-1 5.8-.8 7.7.8v14.4c-2.1-1.3-5-1.5-7.7-.7zm9.3.8c1.9-1.6 5-1.8 7.7-.8v14.5c-2.7-.8-5.6-.6-7.7.7z"/></svg>',
    derive:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 5H6.5l6 7-6 7h11"/></svg>',
    spark:
      '<svg class="i f" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.1 5.4 5.4 2.1-5.4 2.1L12 17.5l-2.1-5.4L4.5 10l5.4-2.1zM19 15.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"/></svg>',
    clock:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
    chev: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5.5l6.5 6.5L9 18.5"/></svg>',
    chevDown:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 9l6.5 6.5L18.5 9"/></svg>',
    updown:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 9l4-4 4 4M8 15l4 4 4-4"/></svg>',
    branch:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v10a5 5 0 005 5h7M14 14l4 4-4 4"/></svg>',
    pin: '<svg class="i f" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C6.5 3 2 6.9 2 11.7c0 2.6 1.3 4.9 3.4 6.5V22l3.7-2.1c.9.2 1.9.4 2.9.4 5.5 0 10-3.9 10-8.6S17.5 3 12 3z"/></svg>',
    flag: '<svg class="i f" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3.5c.6 0 1 .4 1 1V5h11.6c.8 0 1.2.9.8 1.5L16 10l2.4 3.5c.4.6 0 1.5-.8 1.5H6v6a1 1 0 01-2 0V4.5c0-.6.4-1 1-1z"/></svg>',
    question:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 015 .9c0 1.7-2.5 2.2-2.5 3.8M12 17.2v.1"/></svg>',
    shelf:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.5h4v15H4zM10 4.5h4v15h-4z"/><path d="M15.8 5.6l3.6-1 3 14.2-3.6 1z"/></svg>',
    shelfF:
      '<svg class="i f" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4.5A1.5 1.5 0 014.5 3h3A1.5 1.5 0 019 4.5v15A1.5 1.5 0 017.5 21h-3A1.5 1.5 0 013 19.5zm7 0A1.5 1.5 0 0111.5 3h2A1.5 1.5 0 0115 4.5v15a1.5 1.5 0 01-1.5 1.5h-2a1.5 1.5 0 01-1.5-1.5zm5.6 1.6a1.3 1.3 0 011-1.5l2.4-.6a1.3 1.3 0 011.6 1l2.9 13.6a1.3 1.3 0 01-1 1.5l-2.4.6a1.3 1.3 0 01-1.6-1z"/></svg>',
    cards:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="7" width="13" height="13" rx="2.5"/><path d="M8 4h10a2.5 2.5 0 012.5 2.5V16"/></svg>',
    cardsF:
      '<svg class="i f" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6.5h8.5A2.5 2.5 0 0117 9v10.5a2.5 2.5 0 01-2.5 2.5H6a2.5 2.5 0 01-2.5-2.5V9A2.5 2.5 0 016 6.5zM8.5 2.5h9A3 3 0 0120.5 5.5V16a1 1 0 01-2 0V5.5a1 1 0 00-1-1h-9a1 1 0 010-2z"/></svg>',
    note: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14 3v5h5M9 12.5h7M9 16.5h5"/></svg>',
    noteF:
      '<svg class="i f" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 2h7.4c.5 0 1 .2 1.4.6l4.1 4.1c.4.4.6.9.6 1.4V20a2 2 0 01-2 2h-11.5a2 2 0 01-2-2V4a2 2 0 012-2zM9 12a1 1 0 000 2h6a1 1 0 000-2zm0 4a1 1 0 000 2h4a1 1 0 000-2zm5-12v3.5c0 .6.4 1 1 1h3.5z"/></svg>',
    person:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>',
    personF:
      '<svg class="i f" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a5 5 0 110 10 5 5 0 010-10zm0 11.5c4.8 0 9 2.6 9 6.5a1 1 0 01-1 1H4a1 1 0 01-1-1c0-3.9 4.2-6.5 9-6.5z"/></svg>',
    doc: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14 3v5h5"/></svg>',
    cpu: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5"/><path d="M9.5 2.5v3M14.5 2.5v3M9.5 18.5v3M14.5 18.5v3M2.5 9.5h3M2.5 14.5h3M18.5 9.5h3M18.5 14.5h3"/></svg>',
    sliders:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
    paint:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 000 18z" fill="currentColor"/></svg>',
    drive:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M5 13l2.5-8h9L19 13M7 16.5h.01"/></svg>',
    info: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.1"/></svg>',
    layers:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
    map: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6l6-2.5 6 2.5 6-2.5V18l-6 2.5L9 18l-6 2.5z"/><path d="M9 3.5V18M15 6v14.5"/></svg>',
    export:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7.5h14V12"/></svg>',
    trash:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/></svg>',
    cloud:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18.5a4.5 4.5 0 01-.6-9A6 6 0 0118 9a4.8 4.8 0 01-1 9.5z"/></svg>',
    teach:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v10H9l-5 4z"/><path d="M8.5 10.5h7"/></svg>',
    bookopen:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5.5c3-1.5 6-1.5 9 .5 3-2 6-2 9-.5V19c-3-1.5-6-1.5-9 .5-3-2-6-2-9-.5z"/></svg>',
    retry:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0113.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 01-13.7 5.6L4 15M4 20v-5h5"/></svg>',
    logo: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0z"/><path d="M12 5.5V19M15 9.5l1.2-1.2M15.5 13h1.7"/></svg>',
  },
  google: {
    back: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 5l-7 7 7 7"/></svg>',
    more: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="18.5" r="1.2" fill="currentColor"/></svg>',
    search:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="M20 20l-5.6-5.6"/></svg>',
    add: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    close:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
    check:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    skip: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6l7 6-7 6zM13 6l7 6-7 6"/></svg>',
    next: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    mic: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/></svg>',
    send: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.5l16.5 7.5L4 19.5l2.5-7.5z"/><path d="M6.5 12h6"/></svg>',
    stop: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>',
    book: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0z"/><path d="M12 5.5V19"/></svg>',
    derive:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 5H7l6 7-6 7h10"/></svg>',
    spark:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c.6 4.9 4.6 8.9 9.5 9.5-4.9.6-8.9 4.6-9.5 9.5-.6-4.9-4.6-8.9-9.5-9.5 4.9-.6 8.9-4.6 9.5-9.5z"/></svg>',
    clock:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
    chev: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6.5l5.5 5.5-5.5 5.5"/></svg>',
    chevDown:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9l7 7 7-7"/></svg>',
    updown:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 9l4-4 4 4M8 15l4 4 4-4"/></svg>',
    branch:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v10a5 5 0 005 5h7M14 14l4 4-4 4"/></svg>',
    pin: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/></svg>',
    flag: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
    question:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 015 .9c0 1.7-2.5 2.2-2.5 3.8M12 17.2v.1"/></svg>',
    shelf:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="4" height="16" rx="1"/><rect x="10" y="4" width="4" height="16" rx="1"/><path d="M15.6 5.4l3.5-.9 3 14.5-3.5.9z"/></svg>',
    cards:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="7" width="13" height="13" rx="2.5"/><path d="M8 4h10a2.5 2.5 0 012.5 2.5V16"/></svg>',
    note: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14 3v5h5M9 12.5h7M9 16.5h5"/></svg>',
    person:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>',
    doc: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14 3v5h5"/></svg>',
    cpu: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5"/><path d="M9.5 2.5v3M14.5 2.5v3M9.5 18.5v3M14.5 18.5v3M2.5 9.5h3M2.5 14.5h3M18.5 9.5h3M18.5 14.5h3"/></svg>',
    sliders:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
    paint:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 000 18z" fill="currentColor"/></svg>',
    drive:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M5 13l2.5-8h9L19 13M7 16.5h.01"/></svg>',
    info: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.1"/></svg>',
    layers:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
    map: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6l6-2.5 6 2.5 6-2.5V18l-6 2.5L9 18l-6 2.5z"/><path d="M9 3.5V18M15 6v14.5"/></svg>',
    export:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7.5h14V12"/></svg>',
    trash:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/></svg>',
    cloud:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18.5a4.5 4.5 0 01-.6-9A6 6 0 0118 9a4.8 4.8 0 01-1 9.5z"/></svg>',
    teach:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v10H9l-5 4z"/><path d="M8.5 10.5h7"/></svg>',
    bookopen:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5.5c3-1.5 6-1.5 9 .5 3-2 6-2 9-.5V19c-3-1.5-6-1.5-9 .5-3-2-6-2-9-.5z"/></svg>',
    retry:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0113.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 01-13.7 5.6L4 15M4 20v-5h5"/></svg>',
    logo: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0z"/><path d="M12 5.5V19M15 9.5l1.2-1.2M15.5 13h1.7"/></svg>',
  },
  win11: {
    back: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 5.5L4 12l6.5 6.5M4.5 12H20"/></svg>',
    more: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor"/></svg>',
    search:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/></svg>',
    add: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    close:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
    check:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4 4L19 7"/></svg>',
    skip: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 5.8v12.4a.6.6 0 00.95.5l8.4-6.2a.6.6 0 000-1L6.45 5.3a.6.6 0 00-.95.5zM18.5 5v14"/></svg>',
    next: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4 4L19 7"/></svg>',
    arrow:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 5.5L20 12l-6.5 6.5M19.5 12H4"/></svg>',
    mic: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="8.75" y="3" width="6.5" height="11" rx="3.25"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/></svg>',
    send: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/></svg>',
    stop: '<svg class="i f" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 6h9A1.5 1.5 0 0118 7.5v9a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 016 16.5v-9A1.5 1.5 0 017.5 6z"/></svg>',
    play: '<svg class="i f" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8c0 .8.9 1.3 1.6.8l9.6-6.4c.6-.4.6-1.2 0-1.6L9.6 4.8C8.9 4.3 8 4.8 8 5.6z"/></svg>',
    book: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5c-1.8-1.5-4.6-2-8-1.6v13.6c3.4-.4 6.2.1 8 1.6 1.8-1.5 4.6-2 8-1.6V4.9c-3.4-.4-6.2.1-8 1.6zM12 6.5V20"/></svg>',
    bookopen:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5c-1.8-1.5-4.6-2-8-1.6v13.6c3.4-.4 6.2.1 8 1.6 1.8-1.5 4.6-2 8-1.6V4.9c-3.4-.4-6.2.1-8 1.6zM12 6.5V20"/></svg>',
    listen:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13v-1a8 8 0 0116 0v1"/><rect x="3.5" y="13" width="4.5" height="7" rx="2"/><rect x="16" y="13" width="4.5" height="7" rx="2"/></svg>',
    derive:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 5H6.5l6 7-6 7h11"/></svg>',
    spark:
      '<svg class="i f" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c.5 0 .8.3 1 .8l1.4 4.2c.3.9 1 1.6 1.9 1.9l4.2 1.4c.5.2.8.5.8 1s-.3.8-.8 1l-4.2 1.4c-.9.3-1.6 1-1.9 1.9L13 20.9c-.2.5-.5.8-1 .8s-.8-.3-1-.8l-1.4-4.2c-.3-.9-1-1.6-1.9-1.9L3.5 13.4c-.5-.2-.8-.5-.8-1s.3-.8.8-1l4.2-1.4c.9-.3 1.6-1 1.9-1.9L11 3.3c.2-.5.5-.8 1-.8z"/></svg>',
    clock:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    chev: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5.5l6.5 6.5L9 18.5"/></svg>',
    chevDown:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9.5l6 6 6-6"/></svg>',
    updown:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4"/></svg>',
    branch:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6.5" cy="5.5" r="2"/><circle cx="6.5" cy="18.5" r="2"/><circle cx="17.5" cy="8.5" r="2"/><path d="M6.5 7.5v9M17.5 10.5c0 3.5-3 4.5-11 6"/></svg>',
    pin: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14v10H10l-5 4z"/><path d="M9 9.5h6M9 12.5h4"/></svg>',
    flag: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 20.5V4.5M5.5 5h11l-2.5 4 2.5 4h-11"/></svg>',
    question:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 014.9.7c0 1.7-2.5 2-2.5 3.6M12 16.6v.2"/></svg>',
    home: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1h-4.5v-5.5h-5V20H5a1 1 0 01-1-1z"/></svg>',
    shelf:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h3.5v16H4zM9.5 4H13v16H9.5zM15 5.2l3.3-.9 3 15.2-3.3.8z"/></svg>',
    cards:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="13" height="15" rx="2.5"/><path d="M8 3h9.5A2.5 2.5 0 0120 5.5V17"/></svg>',
    note: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h7.5l4.5 4.5v12.5h-12z"/><path d="M13.5 3.5V8.5h5M9 12.5h6M9 16h4"/></svg>',
    person:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20c1-3.6 4-5.5 7.5-5.5s6.5 1.9 7.5 5.5"/></svg>',
    doc: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h7.5l4.5 4.5v12.5h-12z"/><path d="M13.5 3.5V8.5h5"/></svg>',
    cpu: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/><path d="M9.5 3v3M14.5 3v3M9.5 18v3M14.5 18v3M3 9.5h3M3 14.5h3M18 9.5h3M18 14.5h3"/></svg>',
    sliders:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>',
    paint:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 000 17z" fill="currentColor"/></svg>',
    drive:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="13" width="17" height="6.5" rx="2"/><path d="M5.5 13l2.5-7.5h8l2.5 7.5M7.5 16.3h.01"/></svg>',
    info: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/></svg>',
    layers:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z"/><path d="M3.5 12.5l8.5 4.5 8.5-4.5"/></svg>',
    map: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z"/><path d="M9 4.5v13M15 6.5v13"/></svg>',
    export:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14.5V3.5M7.5 8L12 3.5 16.5 8"/><path d="M5 12v7.5h14V12"/></svg>',
    download:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"/><path d="M5 15.5v4h14v-4"/></svg>',
    trash:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5"/></svg>',
    cloud:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18.5a4.5 4.5 0 01-.6-9A6 6 0 0118 9a4.8 4.8 0 01-1 9.5z"/></svg>',
    teach:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v10H9l-5 4z"/><path d="M8.5 10.5h7"/></svg>',
    retry:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0113.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 01-13.7 5.6L4 15.5M4 20v-4.5h4.5"/></svg>',
    alt: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0113.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 01-13.7 5.6L4 15.5M4 20v-4.5h4.5"/></svg>',
    bulb: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a6 6 0 00-3.5 10.9c.5.3.8.9.8 1.5V17h5.4v-.6c0-.6.3-1.2.8-1.5A6 6 0 0012 4zM9.5 20h5"/></svg>',
    fire: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5c1 3 5.5 5.5 5.5 11a5.5 5.5 0 01-11 0c0-2.5 1.2-4.2 2.5-5.5.3 1.7 1 2.5 1.9 2.8C10.3 8.5 10.7 5.5 12 3.5z"/></svg>',
    chart:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16M7 16.5v-5M11.5 16.5V7M16 16.5v-8"/></svg>',
    calendar:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></svg>',
    filter:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
    grid: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
    list: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/></svg>',
    key: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16 7l2.5 2.5M14 9l2 2"/></svg>',
    wifiOff:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4l16 16M8.5 16a5 5 0 017 0M5 12.5a10 10 0 015-2.6M14.5 10a10 10 0 014.5 2.5M2 9a14 14 0 015.5-3M12 5a14 14 0 0110 4M12 19.5h.01"/></svg>',
    warn: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l9 15.5H3z"/><path d="M12 10v4.5M12 17v.2"/></svg>',
    edit: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 19.5l1-4L15.5 5.5l3 3-10 10z"/><path d="M13.5 7.5l3 3"/></svg>',
    copy: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/></svg>',
    star: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/></svg>',
    target:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/></svg>',
    lock: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5"/></svg>',
    link: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/></svg>',
    sun: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>',
    moon: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.5A8 8 0 019.5 4.5a8 8 0 1010 10z"/></svg>',
    globe:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z"/></svg>',
    history:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 102.3-5.7L4 8.5M4 4v4.5h4.5"/><path d="M12 8v4l3 2"/></svg>',
    open: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 4.5H19.5V10.5M19.5 4.5l-8 8M17 14v5.5H4.5V7H10"/></svg>',
    minimize:
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
    logo: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5c-1.8-1.5-4.6-2-8-1.6v13.6c3.4-.4 6.2.1 8 1.6 1.8-1.5 4.6-2 8-1.6V4.9c-3.4-.4-6.2.1-8 1.6zM12 6.5V20"/><path d="M15 10l1.2-1.2M15.4 13.3h1.8"/></svg>',
  },
};
