import { Star, MapPin, Tag, Users } from 'lucide-react';

export function AgodaListingPage() {
  return (
    <div className="h-full bg-white overflow-auto">
      {/* Agoda header */}
      <div className="bg-[#5C2D91] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-sm">agoda</span>
          <div className="flex items-center gap-4 text-[10px] text-purple-200 ml-4">
            <span className="hover:text-white cursor-pointer">Hotels</span>
            <span className="hover:text-white cursor-pointer">Flights</span>
            <span className="hover:text-white cursor-pointer">Activities</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-purple-200">
          <span>JPY</span>
          <span>·</span>
          <span>EN</span>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="px-6 py-2 bg-surface-50 border-b border-surface-200">
        <div className="text-[10px] text-surface-500">
          Japan &gt; Tokyo &gt; Ogasawara &gt; Chichijima &gt; Sea Glass Inn
        </div>
      </div>

      {/* Property header */}
      <div className="px-6 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-base font-bold text-surface-900">Sea Glass Inn</h1>
            <p className="text-xs text-surface-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" />
              Chichijima, Ogasawara, Tokyo 100-2101
            </p>
            <div className="flex items-center gap-1 mt-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-3 h-3 ${i < 4 ? 'text-amber-400 fill-amber-400' : 'text-surface-300'}`}
                />
              ))}
              <span className="text-[10px] text-surface-500 ml-1">Guesthouse</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[10px] text-surface-600">Excellent</div>
              <div className="text-[10px] text-surface-500">128 reviews</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#5C2D91] text-white flex items-center justify-center text-sm font-bold">
              8.9
            </div>
          </div>
        </div>
      </div>

      {/* Gallery placeholder */}
      <div className="px-6 pb-4">
        <div className="grid grid-cols-4 gap-1.5 rounded-xl overflow-hidden">
          <div className="col-span-2 row-span-2 bg-gradient-to-br from-teal-200 to-cyan-100 h-32 flex items-center justify-center">
            <span className="text-3xl">🌊</span>
          </div>
          <div className="bg-gradient-to-br from-teal-100 to-blue-50 h-[62px] flex items-center justify-center">
            <span className="text-lg">🏠</span>
          </div>
          <div className="bg-gradient-to-br from-green-100 to-teal-50 h-[62px] flex items-center justify-center">
            <span className="text-lg">🌴</span>
          </div>
          <div className="bg-gradient-to-br from-amber-100 to-orange-50 h-[62px] flex items-center justify-center">
            <span className="text-lg">🍳</span>
          </div>
          <div className="bg-gradient-to-br from-blue-100 to-purple-50 h-[62px] flex items-center justify-center text-[10px] text-surface-500">
            +12 photos
          </div>
        </div>
      </div>

      {/* Pricing section */}
      <div className="agoda-pricing px-6 pb-4">
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-surface-800">Room Options</h2>
            <span className="flex items-center gap-1 text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full font-medium">
              <Tag className="w-3 h-3" />
              Member Deal
            </span>
          </div>

          <div className="space-y-2">
            <div className="price-display bg-white rounded-lg p-3 border border-surface-200 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-surface-800">Ocean View Room</h3>
                <div className="text-[10px] text-surface-500 mt-0.5">Queen bed · Breakfast included</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-surface-400 line-through">¥18,100</div>
                <div className="text-base font-bold text-red-600">¥15,900</div>
                <div className="text-[10px] text-green-600 font-medium">12% off</div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 border border-surface-200 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-surface-800">Garden Room</h3>
                <div className="text-[10px] text-surface-500 mt-0.5">Double bed · Shared bathroom</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-surface-400 line-through">¥13,200</div>
                <div className="text-base font-bold text-red-600">¥11,600</div>
                <div className="text-[10px] text-green-600 font-medium">12% off</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 text-[10px]">
            <span className="text-red-600 flex items-center gap-1 font-medium">
              <Users className="w-3 h-3" />
              Only 3 rooms left!
            </span>
            <span className="text-surface-500">Price excludes tax</span>
          </div>
        </div>
      </div>
    </div>
  );
}
