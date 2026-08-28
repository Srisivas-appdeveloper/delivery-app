import { ImageSourcePropType } from 'react-native';

export interface Room {
  id: string;
  name: string;
  type: string;
  pricePerNight: number;
  guests: number;
  beds: string;
  sizeSqft: number;
  image: ImageSourcePropType;
}

export interface Store {
  id: string;
  name: string;
  category: string;
  rating: number;
  latitude: number;
  longitude: number;
  address: string;
  image: ImageSourcePropType;
  tag?: string;
  distanceKm?: number;
  walkingMinutes?: number;
  bikeMinutes?: number;
  rooms: Room[];
}

const ROOM_PHOTOS = {
  deluxe: require('../assets/rooms/deluxe-king.jpg'),
  twin: require('../assets/rooms/twin.jpg'),
  suite: require('../assets/rooms/suite.jpg'),
  executive: require('../assets/rooms/executive.jpg'),
};

function makeRooms(
  hotelId: string,
  pricing: { deluxe: number; twin: number; suite: number; executive: number },
): Room[] {
  return [
    {
      id: `${hotelId}_deluxe`,
      name: 'Deluxe King',
      type: 'Deluxe',
      pricePerNight: pricing.deluxe,
      guests: 2,
      beds: '1 king bed',
      sizeSqft: 320,
      image: ROOM_PHOTOS.deluxe,
    },
    {
      id: `${hotelId}_twin`,
      name: 'Superior Twin',
      type: 'Superior',
      pricePerNight: pricing.twin,
      guests: 2,
      beds: '2 twin beds',
      sizeSqft: 300,
      image: ROOM_PHOTOS.twin,
    },
    {
      id: `${hotelId}_exec`,
      name: 'Executive Room',
      type: 'Executive',
      pricePerNight: pricing.executive,
      guests: 2,
      beds: '1 queen bed',
      sizeSqft: 360,
      image: ROOM_PHOTOS.executive,
    },
    {
      id: `${hotelId}_suite`,
      name: 'Club Suite',
      type: 'Suite',
      pricePerNight: pricing.suite,
      guests: 3,
      beds: '1 king bed + sofa',
      sizeSqft: 520,
      image: ROOM_PHOTOS.suite,
    },
  ];
}

export const DEMO_STORES: Store[] = [
  {
    id: 'hotel_vivanta',
    name: 'Vivanta Coimbatore',
    category: 'Luxury hotel',
    rating: 4.4,
    latitude: 11.00203,
    longitude: 76.97362,
    address: '105 Race Course Road, Gopalapuram',
    image: require('../assets/hotels/vivanta.jpg'),
    tag: 'Race Course',
    rooms: makeRooms('hotel_vivanta', { deluxe: 7200, twin: 6800, executive: 8900, suite: 12400 }),
  },
  {
    id: 'hotel_welcomhotel',
    name: 'Welcomhotel Race Course',
    category: 'Premium hotel',
    rating: 4.4,
    latitude: 10.99627,
    longitude: 76.97376,
    address: '1266/14 West Club Road, Race Course',
    image: require('../assets/hotels/welcomhotel.jpg'),
    tag: 'Garden stay',
    rooms: makeRooms('hotel_welcomhotel', { deluxe: 6500, twin: 6100, executive: 8200, suite: 11800 }),
  },
  {
    id: 'hotel_residency',
    name: 'The Residency Towers',
    category: 'Business hotel',
    rating: 4.7,
    latitude: 11.0169,
    longitude: 76.9844,
    address: '1076 Avinashi Road, Coimbatore',
    image: require('../assets/hotels/residency.jpg'),
    tag: 'City centre',
    rooms: makeRooms('hotel_residency', { deluxe: 7800, twin: 7400, executive: 9600, suite: 14200 }),
  },
  {
    id: 'hotel_ikon',
    name: 'Ikon by Annapoorna',
    category: 'Boutique hotel',
    rating: 4.5,
    latitude: 11.0108,
    longitude: 76.9554,
    address: '75 East Arokiasamy Road, RS Puram',
    image: require('../assets/hotels/ikon.jpg'),
    tag: 'RS Puram',
    rooms: makeRooms('hotel_ikon', { deluxe: 5400, twin: 4900, executive: 6700, suite: 9800 }),
  },
  {
    id: 'hotel_radisson',
    name: 'Radisson Blu Coimbatore',
    category: 'Airport hotel',
    rating: 4.3,
    latitude: 11.02136,
    longitude: 76.99192,
    address: '164-165 Avinashi Road, Peelamedu',
    image: require('../assets/hotels/radisson.jpg'),
    tag: 'Peelamedu',
    rooms: makeRooms('hotel_radisson', { deluxe: 8100, twin: 7600, executive: 10200, suite: 15600 }),
  },
];

export function getHotelById(id: string): Store | undefined {
  return DEMO_STORES.find((hotel) => hotel.id === id);
}

export interface NearbyPlace {
  id: string;
  name: string;
  category: string;
  category_group?: string;
  latitude: number;
  longitude: number;
  address: string;
  distanceMeters: number;
  walking_minutes?: number;
  bike_minutes?: number;
  image_url?: string;
  icon?: string;
  color?: string;
  rating?: number;
  source?: string;
}

const PLACE_FALLBACK_IMAGES: Record<string, ImageSourcePropType> = {
  temple: { uri: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=900&q=75' },
  church: { uri: 'https://images.unsplash.com/photo-1548625361-16a7e08922c0?auto=format&fit=crop&w=900&q=75' },
  mosque: { uri: 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=900&q=75' },
  icecream: { uri: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=75' },
  silks: { uri: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=75' },
  supermarket: { uri: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=900&q=75' },
  southindianveg: { uri: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=900&q=75' },
  biryaninonveg: { uri: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=900&q=75' },
  hotel: require('../assets/hotels/residency.jpg'),
  apartment: { uri: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=75' },
  fuel: { uri: 'https://images.unsplash.com/photo-1545558014-8692077e9b5c?auto=format&fit=crop&w=900&q=75' },
  atm: { uri: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=75' },
  bank: { uri: 'https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?auto=format&fit=crop&w=900&q=75' },
  hospital: { uri: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=900&q=75' },
  pharmacy: { uri: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=900&q=75' },
  restaurant: { uri: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=75' },
  cafe: { uri: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=75' },
  mall: { uri: 'https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?auto=format&fit=crop&w=900&q=75' },
  jewelry: { uri: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=75' },
  transit: { uri: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=900&q=75' },
  school: { uri: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=900&q=75' },
  park: { uri: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=75' },
  office: { uri: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=75' },
  store: { uri: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=75' },
  place: { uri: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1f?auto=format&fit=crop&w=900&q=75' },
};

const CATEGORY_ICONS: Record<string, string> = {
  temple: '🛕',
  church: '⛪',
  mosque: '🕌',
  icecream: '🍨',
  silks: '🥻',
  supermarket: '🛒',
  southindianveg: '🥞',
  biryaninonveg: '🍗',
  hotel: '🏨',
  apartment: '🏢',
  fuel: '⛽',
  atm: '🏧',
  bank: '🏦',
  hospital: '🏥',
  pharmacy: '💊',
  restaurant: '🍽️',
  cafe: '☕',
  mall: '🏬',
  jewelry: '💎',
  transit: '🚆',
  school: '🎓',
  park: '🌳',
  office: '🏢',
  store: '🛒',
  place: '📍',
};

const CATEGORY_COLORS: Record<string, string> = {
  temple: '#f59e0b',
  church: '#3b82f6',
  mosque: '#10b981',
  icecream: '#f43f5e',
  silks: '#ec4899',
  supermarket: '#10b981',
  southindianveg: '#f97316',
  biryaninonveg: '#ea580c',
  hotel: '#8b5cf6',
  apartment: '#6366f1',
  fuel: '#f59e0b',
  atm: '#3b82f6',
  bank: '#3b82f6',
  hospital: '#ef4444',
  pharmacy: '#ef4444',
  restaurant: '#f97316',
  cafe: '#d97706',
  mall: '#ec4899',
  jewelry: '#eab308',
  transit: '#0ea5e9',
  school: '#6366f1',
  park: '#22c55e',
  office: '#64748b',
  store: '#10b981',
  place: '#0ea5e9',
};

function normalizePlaceText(value: string): string {
  return value.toLowerCase().replace(/[_-]/g, ' ');
}

export function placeImageKey(place: { category?: string; name?: string; address?: string }): string {
  const text = normalizePlaceText(`${place.category ?? ''} ${place.name ?? ''} ${place.address ?? ''}`);

  if (/\b(temple|kovil|koil|mandir|mariamman|amman kovil|murugan|vinayagar|ganapathi|perumal|devasthanam|sannidhi|sivan kovil|krishna temple|tirupati|hindu temple)\b/.test(text)) {
    return 'temple';
  }
  if (/\b(church|chapel|cathedral|basilica|jesus|christ|mary church)\b/.test(text)) {
    return 'church';
  }
  if (/\b(mosque|masjid|dargah|eidgah|jumma|islamic centre)\b/.test(text)) {
    return 'mosque';
  }
  if (/\b(pep and lip|pep & lip|pep lip|pep 'n' lip|pepncup|ibaco|polar bear|ice cream|dessert|waffle|gelato|kulfi|shake|juice|beverage|cream|pastry|cake|baskin|falooda)\b/.test(text)) {
    return 'icecream';
  }
  if (/\b(chennai silks|the chennai silks|pothys|rmkv|kalyan silks|nalli|kumaran silks|ganapathy silks|textile|textiles|silks|saree|sarees|clothing|garments|menswear|trends|pantaloons|fashion)\b/.test(text)) {
    return 'silks';
  }
  if (/\b(d mart|dmart|d-mart|spencer|reliance|more super|more retail|nilgiris|pazhamudhir|supermarket|hypermarket|grocery|mart|departmental|bazaar|provision)\b/.test(text)) {
    return 'supermarket';
  }
  if (/\b(adyar ananda bhavan|a2b|annapoorna|anandha bhavan|saravana bhavan|sree annapoorna|bhavan|shree|veg|vegetarian|tiffin|dosa|idli|sweets|mithai)\b/.test(text)) {
    return 'southindianveg';
  }
  if (/\b(junior kuppanna|kuppanna|thalappakatti|hari bhavanam|dindigul|biryani|briyani|mess|mutton|chicken|chettinad|non veg|barbeque|bbq|grill|fry|kebab)\b/.test(text)) {
    return 'biryaninonveg';
  }
  if (/\b(kalyan jewellers|malabar gold|tanishq|joyalukkas|jos alukkas|grt|lalitha|jewellers|jewellery|gold|diamond|silver|silversmith)\b/.test(text)) {
    return 'jewelry';
  }
  if (/\b(pharmacy|chemist|medicals|medical|drugstore|apothecary|apollo pharmacy|medplus)\b/.test(text)) {
    return 'pharmacy';
  }
  if (/\b(ganga|kmch|psg|ramakrishna|apollo|hospital|clinic|doctor|doctors|dentist|medical centre|healthcare|eye care|dental|nursing home)\b/.test(text)) {
    return 'hospital';
  }
  if (/\b(hotel|motel|hostel|guest house|lodge|residency|inn|resort|suites)\b/.test(text)) {
    return 'hotel';
  }
  if (/\b(apartment|apartments|flat|residential|residence|villas|enclave)\b/.test(text)) {
    return 'apartment';
  }
  if (/\b(fuel|petrol|diesel|gas station|bunk|indian oil|bharat petroleum|hp petrol|shell)\b/.test(text)) {
    return 'fuel';
  }
  if (/\batm|cash point\b/.test(text)) {
    return 'atm';
  }
  if (/\b(bank|finance|financial|sbi|hdfc|icici|axis)\b/.test(text)) {
    return 'bank';
  }
  if (/\b(cafe|coffee|tea|chai|bakery|bakes|bakers|filter coffee|starbucks|ccd)\b/.test(text)) {
    return 'cafe';
  }
  if (/\b(restaurant|food|diner|kitchen|eatery|fast food|canteen|dhaba)\b/.test(text)) {
    return 'restaurant';
  }
  if (/\b(mall|shopping centre|shopping center|marketplace|department store|complex)\b/.test(text)) {
    return 'mall';
  }
  if (/\b(bus|station|stop|railway|metro|terminal|transport|airport)\b/.test(text)) {
    return 'transit';
  }
  if (/\b(school|college|university|academy|polytechnic|institute)\b/.test(text)) {
    return 'school';
  }
  if (/\b(park|playground|garden|lake|stadium)\b/.test(text)) {
    return 'park';
  }
  if (/\b(office|agency|insurance|lawyer|government|foundation|technologies|company|service|it park)\b/.test(text)) {
    return 'office';
  }
  if (/\b(shop|store)\b/.test(text)) {
    return 'store';
  }
  return 'place';
}

export function getPlaceIcon(place: { category?: string; name?: string; address?: string }): string {
  const key = placeImageKey(place);
  return CATEGORY_ICONS[key] || '📍';
}

export function getPlaceColor(place: { category?: string; name?: string; address?: string }): string {
  const key = placeImageKey(place);
  return CATEGORY_COLORS[key] || '#0ea5e9';
}

export function nearbyPlaceToStore(place: NearbyPlace): Store {
  const imageKey = placeImageKey(place);
  const imageSource = place.image_url
    ? { uri: place.image_url }
    : PLACE_FALLBACK_IMAGES[imageKey] || PLACE_FALLBACK_IMAGES.place;

  const distMeters = place.distanceMeters ?? 0;
  const walkMins = place.walking_minutes ?? Math.max(1, Math.round(distMeters / (1.3 * 60)));
  const bikeMins = place.bike_minutes ?? Math.max(1, Math.round(distMeters / (7.0 * 60)));

  return {
    id: place.id,
    name: place.name,
    category: place.category,
    rating: place.rating ?? 4.5,
    latitude: place.latitude,
    longitude: place.longitude,
    address: place.address,
    image: imageSource,
    tag: `${distMeters} m`,
    distanceKm: Math.round(distMeters / 100) / 10,
    walkingMinutes: walkMins,
    bikeMinutes: bikeMins,
    rooms: [],
  };
}
