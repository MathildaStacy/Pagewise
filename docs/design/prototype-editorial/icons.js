/* Pagewise 书页排版风原型 · 图标
 * 1）线条图标 I(name)：1.35 线宽、圆头，24 网格，单色（currentColor）。用于按钮、Tab、顶栏、chip。
 * 2）T3(name, size)：同一套线条图标，外面套一个发丝线小方框（.ico3d）。名字沿用 Win11 稿的 3D 图标名，方便对照；
 *    这套皮肤不用彩色图标，颜色只用来表达语义：AI 朱、主线墨蓝、对绿、卡点赭、错红、岔路紫、推导青，其他是墨灰。
 *    size：默认 36 / sm 30 / lg 56（圆框，空状态用）/ xs 只有图标没有框（卡片标题里）。 */
'use strict';
const ICONS = (() => {
  const s = d => '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  const f = d => '<svg class="i f" viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>';
  return {
    back: s('<path d="M10.5 5.5L4 12l6.5 6.5M4.5 12H20"/>'),
    more: s('<circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor"/>'),
    search: s('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>'),
    add: s('<path d="M12 5v14M5 12h14"/>'),
    close: s('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
    check: s('<path d="M5 12.5l4 4L19 7"/>'),
    skip: s('<path d="M5.5 5.8v12.4a.6.6 0 00.95.5l8.4-6.2a.6.6 0 000-1L6.45 5.3a.6.6 0 00-.95.5zM18.5 5v14"/>'),
    next: s('<path d="M5 12.5l4 4L19 7"/>'),
    arrow: s('<path d="M13.5 5.5L20 12l-6.5 6.5M19.5 12H4"/>'),
    mic: s('<rect x="8.75" y="3" width="6.5" height="11" rx="3.25"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/>'),
    send: s('<path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/>'),
    stop: f('M7.5 6h9A1.5 1.5 0 0118 7.5v9a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 016 16.5v-9A1.5 1.5 0 017.5 6z'),
    play: f('M8 5.6v12.8c0 .8.9 1.3 1.6.8l9.6-6.4c.6-.4.6-1.2 0-1.6L9.6 4.8C8.9 4.3 8 4.8 8 5.6z'),
    book: s('<path d="M12 6.5c-1.8-1.5-4.6-2-8-1.6v13.6c3.4-.4 6.2.1 8 1.6 1.8-1.5 4.6-2 8-1.6V4.9c-3.4-.4-6.2.1-8 1.6zM12 6.5V20"/>'),
    bookopen: s('<path d="M12 6.5c-1.8-1.5-4.6-2-8-1.6v13.6c3.4-.4 6.2.1 8 1.6 1.8-1.5 4.6-2 8-1.6V4.9c-3.4-.4-6.2.1-8 1.6zM12 6.5V20"/>'),
    listen: s('<path d="M4 13v-1a8 8 0 0116 0v1"/><rect x="3.5" y="13" width="4.5" height="7" rx="2"/><rect x="16" y="13" width="4.5" height="7" rx="2"/>'),
    derive: s('<path d="M17.5 5H6.5l6 7-6 7h11"/>'),
    spark: f('M12 2.5c.5 0 .8.3 1 .8l1.4 4.2c.3.9 1 1.6 1.9 1.9l4.2 1.4c.5.2.8.5.8 1s-.3.8-.8 1l-4.2 1.4c-.9.3-1.6 1-1.9 1.9L13 20.9c-.2.5-.5.8-1 .8s-.8-.3-1-.8l-1.4-4.2c-.3-.9-1-1.6-1.9-1.9L3.5 13.4c-.5-.2-.8-.5-.8-1s.3-.8.8-1l4.2-1.4c.9-.3 1.6-1 1.9-1.9L11 3.3c.2-.5.5-.8 1-.8z'),
    clock: s('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    chev: s('<path d="M9 5.5l6.5 6.5L9 18.5"/>'),
    chevDown: s('<path d="M6 9.5l6 6 6-6"/>'),
    updown: s('<path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4"/>'),
    branch: s('<circle cx="6.5" cy="5.5" r="2"/><circle cx="6.5" cy="18.5" r="2"/><circle cx="17.5" cy="8.5" r="2"/><path d="M6.5 7.5v9M17.5 10.5c0 3.5-3 4.5-11 6"/>'),
    pin: s('<path d="M5 5.5h14v10H10l-5 4z"/><path d="M9 9.5h6M9 12.5h4"/>'),
    flag: s('<path d="M5.5 20.5V4.5M5.5 5h11l-2.5 4 2.5 4h-11"/>'),
    question: s('<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 014.9.7c0 1.7-2.5 2-2.5 3.6M12 16.6v.2"/>'),
    home: s('<path d="M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1h-4.5v-5.5h-5V20H5a1 1 0 01-1-1z"/>'),
    shelf: s('<path d="M4 4h3.5v16H4zM9.5 4H13v16H9.5zM15 5.2l3.3-.9 3 15.2-3.3.8z"/>'),
    cards: s('<rect x="4" y="6" width="13" height="15" rx="2.5"/><path d="M8 3h9.5A2.5 2.5 0 0120 5.5V17"/>'),
    note: s('<path d="M6.5 3.5h7.5l4.5 4.5v12.5h-12z"/><path d="M13.5 3.5V8.5h5M9 12.5h6M9 16h4"/>'),
    person: s('<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20c1-3.6 4-5.5 7.5-5.5s6.5 1.9 7.5 5.5"/>'),
    doc: s('<path d="M6.5 3.5h7.5l4.5 4.5v12.5h-12z"/><path d="M13.5 3.5V8.5h5"/>'),
    cpu: s('<rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/><path d="M9.5 3v3M14.5 3v3M9.5 18v3M14.5 18v3M3 9.5h3M3 14.5h3M18 9.5h3M18 14.5h3"/>'),
    sliders: s('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
    paint: s('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 000 17z" fill="currentColor"/>'),
    drive: s('<rect x="3.5" y="13" width="17" height="6.5" rx="2"/><path d="M5.5 13l2.5-7.5h8l2.5 7.5M7.5 16.3h.01"/>'),
    info: s('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>'),
    layers: s('<path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z"/><path d="M3.5 12.5l8.5 4.5 8.5-4.5"/>'),
    map: s('<path d="M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z"/><path d="M9 4.5v13M15 6.5v13"/>'),
    export: s('<path d="M12 14.5V3.5M7.5 8L12 3.5 16.5 8"/><path d="M5 12v7.5h14V12"/>'),
    download: s('<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"/><path d="M5 15.5v4h14v-4"/>'),
    trash: s('<path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5"/>'),
    cloud: s('<path d="M7 18.5a4.5 4.5 0 01-.6-9A6 6 0 0118 9a4.8 4.8 0 01-1 9.5z"/>'),
    teach: s('<path d="M4 5.5h16v10H9l-5 4z"/><path d="M8.5 10.5h7"/>'),
    retry: s('<path d="M4 12a8 8 0 0113.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 01-13.7 5.6L4 15.5M4 20v-4.5h4.5"/>'),
    alt: s('<path d="M4 12a8 8 0 0113.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 01-13.7 5.6L4 15.5M4 20v-4.5h4.5"/>'),
    bulb: s('<path d="M12 4a6 6 0 00-3.5 10.9c.5.3.8.9.8 1.5V17h5.4v-.6c0-.6.3-1.2.8-1.5A6 6 0 0012 4zM9.5 20h5"/>'),
    fire: s('<path d="M12 3.5c1 3 5.5 5.5 5.5 11a5.5 5.5 0 01-11 0c0-2.5 1.2-4.2 2.5-5.5.3 1.7 1 2.5 1.9 2.8C10.3 8.5 10.7 5.5 12 3.5z"/>'),
    chart: s('<path d="M4 20h16M7 16.5v-5M11.5 16.5V7M16 16.5v-8"/>'),
    calendar: s('<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>'),
    filter: s('<path d="M4 6h16M7 12h10M10 18h4"/>'),
    grid: s('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
    list: s('<path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/>'),
    key: s('<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16 7l2.5 2.5M14 9l2 2"/>'),
    wifiOff: s('<path d="M4 4l16 16M8.5 16a5 5 0 017 0M5 12.5a10 10 0 015-2.6M14.5 10a10 10 0 014.5 2.5M2 9a14 14 0 015.5-3M12 5a14 14 0 0110 4M12 19.5h.01"/>'),
    warn: s('<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.5M12 17v.2"/>'),
    edit: s('<path d="M4.5 19.5l1-4L15.5 5.5l3 3-10 10z"/><path d="M13.5 7.5l3 3"/>'),
    copy: s('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>'),
    star: s('<path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>'),
    target: s('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>'),
    lock: s('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5"/>'),
    link: s('<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>'),
    sun: s('<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>'),
    moon: s('<path d="M19.5 14.5A8 8 0 019.5 4.5a8 8 0 1010 10z"/>'),
    globe: s('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z"/>'),
    history: s('<path d="M4 12a8 8 0 102.3-5.7L4 8.5M4 4v4.5h4.5"/><path d="M12 8v4l3 2"/>'),
    open: s('<path d="M13.5 4.5H19.5V10.5M19.5 4.5l-8 8M17 14v5.5H4.5V7H10"/>'),
    minimize: s('<path d="M5 12h14"/>'),
    folder: s('<path d="M3.5 7a1.5 1.5 0 011.5-1.5h4.5l2 2H19a1.5 1.5 0 011.5 1.5v8.5A1.5 1.5 0 0119 19H5a1.5 1.5 0 01-1.5-1.5z"/>'),
    camera: s('<path d="M3.5 8.5A1.5 1.5 0 015 7h2.5l1.5-2h6l1.5 2H19a1.5 1.5 0 011.5 1.5v9A1.5 1.5 0 0119 19H5a1.5 1.5 0 01-1.5-1.5z"/><circle cx="12" cy="12.5" r="3.5"/>'),
    shield: s('<path d="M12 3.5l7 2.8v5.2c0 4.4-3 7.6-7 9.5-4-1.9-7-5.1-7-9.5V6.3z"/><path d="M9 12l2.2 2.2L15.5 10"/>'),
    error: s('<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>'),
    logo: s('<path d="M12 6.5c-1.8-1.5-4.6-2-8-1.6v13.6c3.4-.4 6.2.1 8 1.6 1.8-1.5 4.6-2 8-1.6V4.9c-3.4-.4-6.2.1-8 1.6zM12 6.5V20"/><path d="M15 10l1.2-1.2M15.4 13.3h1.8"/>')
  };
})();
const I = n => ICONS[n] || '';

// T3 用的图标：[线条图标名, 语义色]。语义色对应 base.css 的 .ico3d.t-*（ai / acc / ok / stuck / bad / dt / dv / pin），空字符串是墨灰
const ICONS3 = {
  fire: ['fire', 'ai'], cards: ['cards', ''], pin: ['pin', 'stuck'], bulb: ['bulb', 'ai'], question: ['question', ''], check: ['check', 'ok'],
  warn: ['warn', 'stuck'], error: ['error', 'bad'], folder: ['folder', ''], book: ['book', 'acc'], pdf: ['doc', ''], epub: ['doc', ''],
  gear: ['sliders', ''], cpu: ['cpu', ''], sliders: ['sliders', ''], paint: ['paint', ''], drive: ['drive', ''], info: ['info', ''],
  map: ['map', 'acc'], note: ['note', ''], export: ['export', ''], chart: ['chart', ''], calendar: ['calendar', ''], key: ['key', ''],
  shield: ['shield', ''], cloud: ['cloud', ''], ai: ['spark', 'ai'], listen: ['listen', 'acc'], search: ['search', ''], trash: ['trash', 'bad'],
  trophy: ['star', 'ai'], clock: ['clock', 'ai'], layers: ['layers', ''], branch: ['branch', 'dt'], derive: ['derive', 'dv'], rocket: ['arrow', ''],
  camera: ['camera', ''], wifiOff: ['wifiOff', 'bad']
};
const I3 = n => I((ICONS3[n] || ICONS3.info)[0]);
const T3 = (n, cls) => { const t = (ICONS3[n] || ICONS3.info)[1]; return '<span class="ico3d' + (cls ? ' ' + cls : '') + (t ? ' t-' + t : '') + '">' + I3(n) + '</span>'; };
