import { Star, MapPin, Check, Clock } from 'lucide-react';
import { useAutomation } from '../context/AutomationContext';

export function BookingListingPage() {
  const { execution } = useAutomation();
  const isTypingSearch = execution.typingTarget === '#booking-search';
  const searchDone = execution.stepStatuses[10] === 'passed';
  const resultsDone = execution.stepStatuses[11] === 'passed';

  return (
    <div className="h-full bg-surface-50 overflow-auto">
      {/* Booking.com header */}
      <div className="bg-[#003580] px-6 py-3">
        <div className="flex items-center gap-4">
          <span className="text-white font-bold text-sm">
            Booking.com
          </span>
          <div className="flex items-center gap-2 text-[10px] text-blue-200">
            <span>JPY</span>
            <span>·</span>
            <span>English</span>
          </div>
        </div>

        {/* Search bar */}
        <div className="mt-3 flex items-center gap-2">
          <div
            id="booking-search"
            className={`flex-1 flex items-center gap-2 bg-white rounded px-3 py-2 transition-all ${
              isTypingSearch ? 'ring-2 ring-amber-400' : ''
            }`}
          >
            <MapPin className="w-4 h-4 text-surface-400 flex-shrink-0" />
            <span className="text-sm flex-1">
              {isTypingSearch ? (
                <span className="text-surface-800">
                  {execution.typingText}
                  <span className="inline-block w-0.5 h-4 bg-blue-600 animate-pulse ml-px align-middle" />
                </span>
              ) : searchDone ? (
                <span className="text-surface-800">Sea Glass Inn Chichijima</span>
              ) : (
                <span className="text-surface-400">Where are you going?</span>
              )}
            </span>
          </div>
          <div className="bg-white rounded px-3 py-2 text-xs text-surface-600 w-32 text-center">
            Feb 14 — Feb 16
          </div>
          <div className="bg-white rounded px-3 py-2 text-xs text-surface-600 w-28 text-center">
            2 guests, 1 room
          </div>
          <button className="search-btn px-5 py-2 bg-[#0071c2] hover:bg-[#005999] text-white text-sm font-medium rounded transition-colors">
            Search
          </button>
        </div>
      </div>

      {/* Results */}
      {resultsDone && (
        <div className="p-6">
          <div className="text-xs text-surface-500 mb-3">
            Chichijima, Ogasawara: 1 property found
          </div>

          {/* Property Card */}
          <div className="property-card bg-white rounded-lg border border-surface-200 p-4 flex gap-4">
            <div className="w-36 h-28 rounded-lg bg-gradient-to-br from-teal-100 to-cyan-50 flex items-center justify-center flex-shrink-0">
              <div className="text-center">
                <div className="text-2xl">🏠</div>
                <div className="text-[9px] text-teal-600 mt-1">Sea Glass Inn</div>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-bold text-blue-700 hover:underline cursor-pointer">
                    Sea Glass Inn
                  </h2>
                  <p className="text-[10px] text-surface-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    Chichijima, Ogasawara · 200m from beach
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-[10px] text-surface-600">Fabulous</div>
                    <div className="review-count text-[10px] text-surface-500">142 reviews</div>
                  </div>
                  <div className="w-8 h-8 rounded-md bg-[#003580] text-white flex items-center justify-center text-xs font-bold">
                    8.7
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2 text-[10px]">
                <span className="flex items-center gap-0.5 text-green-700">
                  <Check className="w-3 h-3" /> Free cancellation
                </span>
                <span className="flex items-center gap-0.5 text-green-700">
                  <Check className="w-3 h-3" /> Breakfast included
                </span>
              </div>

              <div className="flex items-center gap-1 mt-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3 h-3 ${i < 4 ? 'text-amber-400 fill-amber-400' : 'text-surface-300'}`}
                  />
                ))}
              </div>

              <div className="flex items-end justify-between mt-3">
                <div className="flex items-center gap-1 text-[10px] text-red-600">
                  <Clock className="w-3 h-3" />
                  Last booked 2 hours ago
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-surface-500">2 nights, 2 guests</div>
                  <div className="text-lg font-bold text-surface-900">¥33,600</div>
                  <div className="text-[10px] text-surface-500">¥16,800 /night</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!resultsDone && searchDone && (
        <div className="flex items-center justify-center h-40">
          <div className="text-sm text-surface-400">Searching...</div>
        </div>
      )}
    </div>
  );
}
