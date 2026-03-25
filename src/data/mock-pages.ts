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
};
