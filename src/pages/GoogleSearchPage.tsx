import { Search } from 'lucide-react';
import { useAutomation } from '../context/AutomationContext';

export function GoogleSearchPage() {
  const { execution } = useAutomation();
  const isTypingSearch = execution.typingTarget === '#search-input';
  const searchDone = execution.stepStatuses[1] === 'passed';
  const resultsDone = execution.stepStatuses[2] === 'passed';

  return (
    <div className="h-full bg-white overflow-auto">
      {/* Google-like header */}
      <div className={`flex flex-col items-center transition-all duration-500 ${resultsDone ? 'pt-6' : 'pt-24'}`}>
        {!resultsDone && (
          <div className="mb-6">
            <span className="text-3xl font-medium">
              <span className="text-blue-500">G</span>
              <span className="text-red-500">o</span>
              <span className="text-amber-500">o</span>
              <span className="text-blue-500">g</span>
              <span className="text-green-500">l</span>
              <span className="text-red-500">e</span>
            </span>
          </div>
        )}

        {/* Search bar */}
        <div className={`w-full max-w-xl px-6 ${resultsDone ? 'flex items-center gap-4 mb-4' : ''}`}>
          {resultsDone && (
            <span className="text-lg font-medium flex-shrink-0">
              <span className="text-blue-500">G</span>
              <span className="text-red-500">o</span>
              <span className="text-amber-500">o</span>
              <span className="text-blue-500">g</span>
              <span className="text-green-500">l</span>
              <span className="text-red-500">e</span>
            </span>
          )}
          <div
            id="search-input"
            className={`w-full flex items-center gap-2 px-4 py-2.5 border rounded-full shadow-sm hover:shadow transition-all ${
              isTypingSearch
                ? 'border-forge-400 ring-2 ring-forge-100 shadow-md'
                : 'border-surface-300'
            }`}
          >
            <Search className="w-4 h-4 text-surface-400 flex-shrink-0" />
            <span className="text-sm flex-1">
              {isTypingSearch ? (
                <span>
                  {execution.typingText}
                  <span className="inline-block w-0.5 h-4 bg-blue-500 animate-pulse ml-px align-middle" />
                </span>
              ) : searchDone ? (
                <span className="text-surface-800">chichijima island accommodation english booking</span>
              ) : (
                <span className="text-surface-400">Search Google or type a URL</span>
              )}
            </span>
          </div>

          {!resultsDone && (
            <div className="flex justify-center gap-3 mt-4">
              <button className="px-4 py-2 bg-surface-100 hover:bg-surface-200 text-sm text-surface-700 rounded-md transition-colors">
                Google Search
              </button>
              <button className="px-4 py-2 bg-surface-100 hover:bg-surface-200 text-sm text-surface-700 rounded-md transition-colors">
                I'm Feeling Lucky
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search Results */}
      {resultsDone && (
        <div className="max-w-xl px-6 ml-[88px]">
          <div className="text-xs text-surface-500 mb-4">
            About 24,600 results (0.42 seconds)
          </div>

          {/* Result 1 — Sea Glass Inn */}
          <div className="search-results mb-6">
            <div className="text-xs text-surface-500 mb-0.5">
              https://www.seaglassinn-chichijima.com
            </div>
            <a href="#" className="text-lg text-blue-700 hover:underline font-medium leading-tight">
              Sea Glass Inn — Chichijima Island Guesthouse
            </a>
            <p className="text-sm text-surface-600 mt-1 leading-relaxed">
              Ocean-facing guesthouse on Chichijima Island, Ogasawara. English-speaking staff. Rooms from ¥5,500/night. Free snorkeling gear. Book direct for best rates.
            </p>
          </div>

          {/* Result 2 */}
          <div className="mb-6">
            <div className="text-xs text-surface-500 mb-0.5">
              https://www.booking.com › Ogasawara › Chichijima
            </div>
            <a href="#" className="text-lg text-blue-700 hover:underline font-medium leading-tight">
              10 Best Chichijima Hotels — Booking.com
            </a>
            <p className="text-sm text-surface-600 mt-1 leading-relaxed">
              Great savings on hotels in Chichijima, Japan. Book online, pay at the hotel. Read real guest reviews and pick the best deal for your stay.
            </p>
          </div>

          {/* Result 3 */}
          <div className="mb-6">
            <div className="text-xs text-surface-500 mb-0.5">
              https://www.tripadvisor.com › Ogasawara_Islands
            </div>
            <a href="#" className="text-lg text-blue-700 hover:underline font-medium leading-tight">
              Ogasawara / Chichijima Accommodation — TripAdvisor
            </a>
            <p className="text-sm text-surface-600 mt-1 leading-relaxed">
              Find and compare accommodation in Chichijima, Ogasawara Islands. Read reviews, see photos, and find great deals on holiday rentals.
            </p>
          </div>

          {/* Result 4 */}
          <div className="mb-6">
            <div className="text-xs text-surface-500 mb-0.5">
              https://www.agoda.com › Ogasawara
            </div>
            <a href="#" className="text-lg text-blue-700 hover:underline font-medium leading-tight">
              Chichijima Guesthouses — Agoda Deals from ¥4,800
            </a>
            <p className="text-sm text-surface-600 mt-1 leading-relaxed">
              Save up to 75% on Chichijima guesthouses. Free cancellation on most rooms. Member-only prices available.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
