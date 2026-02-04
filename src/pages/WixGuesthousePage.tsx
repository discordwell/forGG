import { MapPin, Waves, Sun, Wifi, Coffee } from 'lucide-react';

export function WixGuesthousePage() {
  const rooms = [
    {
      name: 'Ocean View Room',
      price: '¥18,500',
      desc: 'Wake up to panoramic ocean views. Private balcony, AC, en-suite bathroom.',
      beds: 'Queen bed',
      size: '24m²',
    },
    {
      name: 'Garden Room',
      price: '¥14,000',
      desc: 'Quiet garden-facing room surrounded by tropical plants. AC, shared bathroom.',
      beds: 'Double bed',
      size: '18m²',
    },
    {
      name: 'Dorm Bed',
      price: '¥5,500',
      desc: 'Mixed dormitory with personal reading light, locker, and USB charging.',
      beds: 'Single bunk',
      size: 'Shared',
    },
  ];

  return (
    <div className="h-full bg-white overflow-auto">
      {/* Wix-style navigation */}
      <div className="bg-white border-b border-surface-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Waves className="w-5 h-5 text-teal-600" />
          <span className="text-sm font-bold text-surface-800 tracking-wide">SEA GLASS INN</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-surface-600">
          <span className="hover:text-teal-600 cursor-pointer">Home</span>
          <span className="hover:text-teal-600 cursor-pointer font-medium text-teal-600">Rooms</span>
          <span className="hover:text-teal-600 cursor-pointer">Gallery</span>
          <span className="hover:text-teal-600 cursor-pointer">Access</span>
          <span className="hover:text-teal-600 cursor-pointer">Contact</span>
          <button className="px-3 py-1.5 bg-teal-600 text-white rounded text-xs font-medium">
            Book Now
          </button>
        </div>
      </div>

      {/* Hero section */}
      <div className="relative h-36 bg-gradient-to-r from-teal-700 via-cyan-600 to-teal-500 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-4 left-8 w-32 h-20 rounded-lg bg-white/10" />
          <div className="absolute bottom-4 right-12 w-24 h-16 rounded-lg bg-white/10" />
        </div>
        <div className="relative text-center text-white">
          <h1 className="text-xl font-bold tracking-wide">Sea Glass Inn</h1>
          <p className="text-xs mt-1 opacity-90 flex items-center justify-center gap-1">
            <MapPin className="w-3 h-3" />
            Chichijima Island, Ogasawara, Tokyo
          </p>
          <div className="flex items-center justify-center gap-4 mt-3 text-[10px] opacity-80">
            <span className="flex items-center gap-1"><Wifi className="w-3 h-3" /> Free WiFi</span>
            <span className="flex items-center gap-1"><Coffee className="w-3 h-3" /> Breakfast</span>
            <span className="flex items-center gap-1"><Sun className="w-3 h-3" /> Ocean View</span>
          </div>
        </div>
      </div>

      {/* Room Listings */}
      <div className="room-listings px-6 py-5">
        <h2 className="text-sm font-bold text-surface-800 mb-1">Our Rooms</h2>
        <p className="text-xs text-surface-500 mb-4">
          Check-in 15:00 · Check-out 10:00 · English & Japanese spoken
        </p>

        <div className="room-card space-y-3">
          {rooms.map((room) => (
            <div
              key={room.name}
              className="flex items-start gap-4 p-4 border border-surface-200 rounded-xl hover:border-teal-300 transition-colors"
            >
              <div className="w-24 h-16 rounded-lg bg-gradient-to-br from-teal-100 to-cyan-50 flex items-center justify-center flex-shrink-0">
                <Sun className="w-6 h-6 text-teal-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-surface-800">{room.name}</h3>
                  <div className="text-right">
                    <span className="text-sm font-bold text-teal-700">{room.price}</span>
                    <span className="text-[10px] text-surface-500">/night</span>
                  </div>
                </div>
                <p className="text-[10px] text-surface-600 mt-1 leading-relaxed">{room.desc}</p>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-surface-500">
                  <span>{room.beds}</span>
                  <span>·</span>
                  <span>{room.size}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-surface-400 mt-4 text-center">
          Powered by Wix.com · Sea Glass Inn &copy; 2024
        </p>
      </div>
    </div>
  );
}
