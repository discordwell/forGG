export interface GhlIntegration {
  accessToken: string;
  companyId?: string;
  userId?: string;
  locationId?: string;
  // Some services.* endpoints use token-id (Firebase ID token). Optional.
  tokenId?: string;
  capturedAt: number;
}

export interface GhlLocation {
  _id: string;
  name?: string;
  companyId?: string;
  timezone?: string;
  [k: string]: unknown;
}

