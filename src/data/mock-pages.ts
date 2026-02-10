export interface MockPageDef {
  id: string;
  title: string;
  url: string;
}

export const MOCK_PAGES: Record<string, MockPageDef> = {
  'maxlevel-ops': {
    id: 'maxlevel-ops',
    title: 'MaxLevel Ops Console',
    url: 'https://app.maxlevel.ai/ops',
  },
  'google-search': {
    id: 'google-search',
    title: 'chichijima island accommodation english booking - Google Search',
    url: 'https://www.google.com/search?q=chichijima+island+accommodation+english+booking',
  },
  'wix-guesthouse': {
    id: 'wix-guesthouse',
    title: 'Sea Glass Inn — Chichijima Island Guesthouse',
    url: 'https://www.seaglassinn-chichijima.com',
  },
  'booking-listing': {
    id: 'booking-listing',
    title: 'Sea Glass Inn, Chichijima — Booking.com',
    url: 'https://www.booking.com/hotel/jp/sea-glass-inn-chichijima.html',
  },
  'agoda-listing': {
    id: 'agoda-listing',
    title: 'Sea Glass Inn (Chichijima) — Agoda',
    url: 'https://www.agoda.com/sea-glass-inn-chichijima/hotel/ogasawara-jp.html',
  },
  'research-tracker': {
    id: 'research-tracker',
    title: 'Chichijima Accommodation Research — Google Sheets',
    url: 'https://docs.google.com/spreadsheets/d/1a2b3c/chichijima-research',
  },
};
