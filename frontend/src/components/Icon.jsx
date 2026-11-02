const P = d => <path d={d} />;
const ICONS = {
  home: <>{P('M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z')}{P('M9 22V12h6v10')}</>,
  search: <><circle cx="11" cy="11" r="8" />{P('M21 21l-4.35-4.35')}</>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" />{P('M16 2v4M8 2v4M3 10h18')}</>,
  'calendar-plus': <><rect x="3" y="4" width="18" height="18" rx="2" />{P('M16 2v4M8 2v4M3 10h18M12 13v6M9 16h6')}</>,
  'file-text': <>{P('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z')}{P('M14 2v6h6M16 13H8M16 17H8M10 9H8')}</>,
  pill: <>{P('M10.5 20.5a5 5 0 0 1-7-7l10-10a5 5 0 0 1 7 7z')}{P('M8.5 8.5l7 7')}</>,
  folder: P('M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'),
  star: P('M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z'),
  bell: <>{P('M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9')}{P('M13.73 21a2 2 0 0 1-3.46 0')}</>,
  user: <>{P('M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2')}<circle cx="12" cy="7" r="4" /></>,
  users: <>{P('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2')}<circle cx="9" cy="7" r="4" />{P('M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75')}</>,
  'user-check': <>{P('M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2')}<circle cx="8.5" cy="7" r="4" />{P('M17 11l2 2 4-4')}</>,
  clock: <><circle cx="12" cy="12" r="10" />{P('M12 6v6l4 2')}</>,
  clipboard: <>{P('M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2')}<rect x="8" y="2" width="8" height="4" rx="1" /></>,
  package: <>{P('M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z')}{P('M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12')}</>,
  truck: <><rect x="1" y="3" width="15" height="13" />{P('M16 8h4l3 3v5h-7z')}<circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></>,
  'check-circle': <>{P('M22 11.08V12a10 10 0 1 1-5.93-9.14')}{P('M22 4L12 14.01l-3-3')}</>,
  'alert-circle': <><circle cx="12" cy="12" r="10" />{P('M12 8v4M12 16h.01')}</>,
  'bar-chart': P('M12 20V10M18 20V4M6 20v-4'),
  shield: P('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'),
  building: <><rect x="4" y="2" width="16" height="20" rx="2" />{P('M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01')}</>,
  layers: <>{P('M12 2L2 7l10 5 10-5z')}{P('M2 17l10 5 10-5')}{P('M2 12l10 5 10-5')}</>,
  list: P('M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'),
  sliders: P('M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6'),
  menu: P('M3 12h18M3 6h18M3 18h18'),
  sun: <><circle cx="12" cy="12" r="5" />{P('M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42')}</>,
  moon: P('M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'),
  logout: P('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'),
  activity: P('M22 12h-4l-3 9L9 3l-3 9H2'),
  heart: P('M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'),
  'trending-up': P('M23 6l-9.5 9.5-5-5L1 18M17 6h6v6'),
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" />{P('M7 11V7a5 5 0 0 1 10 0v4')}</>,
  upload: P('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12'),
  globe: <><circle cx="12" cy="12" r="10" />{P('M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z')}</>,
  smartphone: <><rect x="5" y="2" width="14" height="20" rx="2" />{P('M12 18h.01')}</>,
  inbox: <>{P('M22 12h-6l-2 3h-4l-2-3H2')}{P('M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z')}</>,
  plus: P('M12 5v14M5 12h14'),
  check: P('M20 6L9 17l-5-5'),
  x: P('M18 6L6 18M6 6l12 12'),
  'arrow-right': P('M5 12h14M12 5l7 7-7 7'),
  mail: <>{P('M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z')}{P('M22 6l-10 7L2 6')}</>,
};

export default function Icon({ name, size = 20, className = '', ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...rest}>
      {ICONS[name] || ICONS.activity}
    </svg>
  );
}
