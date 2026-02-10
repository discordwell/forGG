import { nanoid } from 'nanoid';
import type { AutomationStep } from '../types/automation';

export const SCENARIO_ID = 'chichijima-competitive-research';
export const SCENARIO_NAME = 'Chichijima Accommodation — Competitive Research';
export const SCENARIO_DESCRIPTION =
  'Automated competitive research workflow for Chichijima island accommodations: scraping Wix guesthouse sites, cross-referencing OTA listings on Booking.com and Agoda, and logging findings to a research tracker.';

export function createScenario(): AutomationStep[] {
  return [
    // 1. Google Search
    {
      id: nanoid(),
      type: 'navigate',
      label: 'Open Google Search',
      value: 'https://www.google.com',
      page: 'google-search',
      targetCoords: { x: 400, y: 200 },
    },
    {
      id: nanoid(),
      type: 'type',
      label: 'Search for Chichijima accommodations',
      target: '#search-input',
      value: 'chichijima island accommodation english booking',
      page: 'google-search',
      targetCoords: { x: 400, y: 200 },
    },
    {
      id: nanoid(),
      type: 'click',
      label: 'Click Search',
      target: 'button[aria-label="Google Search"]',
      page: 'google-search',
      targetCoords: { x: 490, y: 260 },
    },
    {
      id: nanoid(),
      type: 'assert',
      label: 'Verify search results loaded',
      target: '.search-results',
      value: 'Sea Glass Inn',
      assertion: 'contains',
      page: 'google-search',
      targetCoords: { x: 380, y: 340 },
    },
    {
      id: nanoid(),
      type: 'click',
      label: 'Click Sea Glass Inn result',
      target: 'a[href*="seaglassinn-chichijima"]',
      page: 'google-search',
      targetCoords: { x: 350, y: 340 },
    },

    // 2. Wix Guesthouse Page
    {
      id: nanoid(),
      type: 'wait',
      label: 'Wait for Wix page to load',
      value: '1200',
      page: 'wix-guesthouse',
      targetCoords: { x: 400, y: 250 },
      duration: 1200,
    },
    {
      id: nanoid(),
      type: 'scroll',
      label: 'Scroll to room listings',
      target: '.room-listings',
      page: 'wix-guesthouse',
      targetCoords: { x: 400, y: 380 },
    },
    {
      id: nanoid(),
      type: 'extract',
      label: 'Extract room pricing data',
      target: '.room-card',
      page: 'wix-guesthouse',
      targetCoords: { x: 350, y: 350 },
      extractedData: {
        propertyName: 'Sea Glass Inn',
        oceanViewRoom: '¥18,500/night',
        gardenRoom: '¥14,000/night',
        dormBed: '¥5,500/night',
        checkInTime: '15:00',
        checkOutTime: '10:00',
        languages: ['Japanese', 'English'],
      },
    },
    {
      id: nanoid(),
      type: 'screenshot',
      label: 'Screenshot Wix guesthouse page',
      page: 'wix-guesthouse',
      targetCoords: { x: 400, y: 300 },
    },

    // 3. Booking.com
    {
      id: nanoid(),
      type: 'navigate',
      label: 'Open Booking.com',
      value: 'https://www.booking.com',
      page: 'booking-listing',
      targetCoords: { x: 400, y: 200 },
    },
    {
      id: nanoid(),
      type: 'type',
      label: 'Search for Sea Glass Inn',
      target: '#booking-search',
      value: 'Sea Glass Inn Chichijima',
      page: 'booking-listing',
      targetCoords: { x: 350, y: 135 },
    },
    {
      id: nanoid(),
      type: 'click',
      label: 'Click Search button',
      target: 'button.search-btn',
      page: 'booking-listing',
      targetCoords: { x: 580, y: 135 },
    },
    {
      id: nanoid(),
      type: 'extract',
      label: 'Extract Booking.com listing data',
      target: '.property-card',
      page: 'booking-listing',
      targetCoords: { x: 400, y: 300 },
      extractedData: {
        propertyName: 'Sea Glass Inn',
        rating: 8.7,
        reviewCount: 142,
        pricePerNight: '¥16,800',
        location: 'Chichijima, Ogasawara',
        freeCancel: true,
        breakfastIncluded: true,
        lastBooked: '2 hours ago',
      },
    },
    {
      id: nanoid(),
      type: 'assert',
      label: 'Verify listing has reviews',
      target: '.review-count',
      value: '> 50',
      assertion: 'greaterThan',
      page: 'booking-listing',
      targetCoords: { x: 520, y: 260 },
    },
    {
      id: nanoid(),
      type: 'screenshot',
      label: 'Screenshot Booking.com listing',
      page: 'booking-listing',
      targetCoords: { x: 400, y: 300 },
    },

    // 4. Agoda
    {
      id: nanoid(),
      type: 'navigate',
      label: 'Open Agoda listing',
      value: 'https://www.agoda.com/sea-glass-inn-chichijima',
      page: 'agoda-listing',
      targetCoords: { x: 400, y: 200 },
    },
    {
      id: nanoid(),
      type: 'extract',
      label: 'Extract Agoda pricing data',
      target: '.agoda-pricing',
      page: 'agoda-listing',
      targetCoords: { x: 400, y: 280 },
      extractedData: {
        propertyName: 'Sea Glass Inn',
        agodaRating: 8.9,
        agodaPrice: '¥15,900',
        discountPercent: '12%',
        memberDeal: true,
        roomsLeft: 3,
        includesTax: false,
      },
    },
    {
      id: nanoid(),
      type: 'assert',
      label: 'Verify Agoda price within range',
      target: '[data-field="agodaPrice"]',
      value: '¥15,900',
      assertion: 'equals',
      page: 'agoda-listing',
      targetCoords: { x: 530, y: 230 },
    },

    // 5. Research Tracker
    {
      id: nanoid(),
      type: 'navigate',
      label: 'Open research tracker',
      value: 'https://docs.google.com/spreadsheets/d/chichijima-research',
      page: 'research-tracker',
      targetCoords: { x: 400, y: 200 },
    },
    {
      id: nanoid(),
      type: 'type',
      label: 'Add research notes',
      target: '#tracker-notes',
      value: 'Strong English site. OTA parity OK. Wix — candidate for pitch.',
      page: 'research-tracker',
      targetCoords: { x: 400, y: 355 },
    },
    {
      id: nanoid(),
      type: 'select',
      label: 'Set outreach status — Ready to Pitch',
      target: '#tracker-status',
      value: 'Ready to Pitch',
      page: 'research-tracker',
      targetCoords: { x: 550, y: 315 },
    },
    {
      id: nanoid(),
      type: 'screenshot',
      label: 'Screenshot completed tracker entry',
      page: 'research-tracker',
      targetCoords: { x: 400, y: 300 },
    },
  ];
}
