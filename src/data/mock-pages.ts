export interface MockPageDef {
  id: string;
  title: string;
  url: string;
}

export const MOCK_PAGES: Record<string, MockPageDef> = {
  login: {
    id: 'login',
    title: 'Sign In — AcmeCorp Comply',
    url: 'https://comply.acmecorp.io/login',
  },
  dashboard: {
    id: 'dashboard',
    title: 'Case Management Dashboard — AcmeCorp Comply',
    url: 'https://comply.acmecorp.io/dashboard',
  },
  'customer-profile': {
    id: 'customer-profile',
    title: 'Customer Profile — Marcus Chen — AcmeCorp Comply',
    url: 'https://comply.acmecorp.io/customers/4892',
  },
  'alert-review': {
    id: 'alert-review',
    title: 'AML Alert AML-2024-8891 — AcmeCorp Comply',
    url: 'https://comply.acmecorp.io/alerts/AML-2024-8891',
  },
  'document-viewer': {
    id: 'document-viewer',
    title: 'Document Verification — Marcus Chen — AcmeCorp Comply',
    url: 'https://comply.acmecorp.io/customers/4892/documents',
  },
};
