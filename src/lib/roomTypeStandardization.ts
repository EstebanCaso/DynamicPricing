/**
 * Room Type Standardization System
 * Maps all room type variations to 5 standardized types for consistent analysis
 */

export type StandardizedRoomType = 'Double Room' | 'King Room' | 'Queen Room' | 'Single Room' | 'Suite';

export interface RoomTypeMapping {
  keywords: string[];
  standardizedType: StandardizedRoomType;
  description: string;
}

// Comprehensive room type mapping system
export const ROOM_TYPE_MAPPINGS: RoomTypeMapping[] = [
  {
    keywords: ['double', 'doble', 'twin', 'matrimonial', 'matrimoniales', 'two bed', 'two-bed', '2 bed', '2-bed'],
    standardizedType: 'Double Room',
    description: 'Rooms with two beds or double bed'
  },
  {
    keywords: ['king', 'king size', 'king-size', 'king bed', 'king bed', 'cama king', 'king room'],
    standardizedType: 'King Room',
    description: 'Rooms with king-size bed'
  },
  {
    keywords: ['queen', 'queen size', 'queen-size', 'queen bed', 'queen bed', 'cama queen', 'queen room'],
    standardizedType: 'Queen Room',
    description: 'Rooms with queen-size bed'
  },
  {
    keywords: ['single', 'individual', 'solo', 'one bed', 'one-bed', '1 bed', '1-bed', 'twin single', 'cama individual'],
    standardizedType: 'Single Room',
    description: 'Rooms with single bed for one person'
  },
  {
    keywords: ['suite', 'junior suite', 'presidential suite', 'master suite', 'executive suite', 'deluxe suite', 'superior suite', 'penthouse', 'villa', 'apartment'],
    standardizedType: 'Suite',
    description: 'Luxury rooms with separate living areas'
  }
];

/**
 * Standardizes a room type name to one of the 5 standardized types
 * @param roomType - The original room type name
 * @returns The standardized room type
 */
export function standardizeRoomType(roomType: string): StandardizedRoomType {
  if (!roomType || typeof roomType !== 'string') {
    return 'Single Room'; // Default fallback
  }

  const normalizedRoomType = roomType.toLowerCase().trim();
  
  // Check each mapping for keyword matches
  for (const mapping of ROOM_TYPE_MAPPINGS) {
    for (const keyword of mapping.keywords) {
      if (normalizedRoomType.includes(keyword.toLowerCase())) {
        return mapping.standardizedType;
      }
    }
  }

  // Additional fuzzy matching for common variations
  if (normalizedRoomType.includes('standard') || normalizedRoomType.includes('regular') || normalizedRoomType.includes('classic')) {
    return 'Single Room';
  }
  
  if (normalizedRoomType.includes('deluxe') || normalizedRoomType.includes('superior') || normalizedRoomType.includes('premium')) {
    return 'King Room';
  }

  if (normalizedRoomType.includes('family') || normalizedRoomType.includes('familiar')) {
    return 'Double Room';
  }

  // Default fallback
  return 'Single Room';
}

/**
 * Gets all standardized room types
 * @returns Array of all standardized room types
 */
export function getAllStandardizedRoomTypes(): StandardizedRoomType[] {
  return ['Double Room', 'King Room', 'Queen Room', 'Single Room', 'Suite'];
}

/**
 * Gets the description for a standardized room type
 * @param roomType - The standardized room type
 * @returns Description of the room type
 */
export function getRoomTypeDescription(roomType: StandardizedRoomType): string {
  const mapping = ROOM_TYPE_MAPPINGS.find(m => m.standardizedType === roomType);
  return mapping?.description || 'Standard room type';
}

/**
 * Checks if a room type is one of the standardized types
 * @param roomType - The room type to check
 * @returns True if it's a standardized room type
 */
export function isStandardizedRoomType(roomType: string): roomType is StandardizedRoomType {
  return getAllStandardizedRoomTypes().includes(roomType as StandardizedRoomType);
}

/**
 * Groups room data by standardized room types
 * @param roomData - Array of room data with room_type field
 * @returns Object with standardized room types as keys
 */
export function groupRoomsByStandardizedType<T extends { room_type: string }>(roomData: T[]): Record<StandardizedRoomType, T[]> {
  const grouped: Record<StandardizedRoomType, T[]> = {
    'Double Room': [],
    'King Room': [],
    'Queen Room': [],
    'Single Room': [],
    'Suite': []
  };

  roomData.forEach(room => {
    const standardizedType = standardizeRoomType(room.room_type);
    grouped[standardizedType].push(room);
  });

  return grouped;
}

/**
 * Standardizes room type names in competitor data
 * @param competitorData - Competitor data with rooms_jsonb
 * @returns Standardized competitor data
 */
export function standardizeCompetitorRoomTypes(competitorData: any): any {
  if (!competitorData?.rooms_jsonb) return competitorData;

  const standardizedData = { ...competitorData };
  const standardizedRooms: Record<string, any[]> = {};

  Object.entries(competitorData.rooms_jsonb).forEach(([date, rooms]: [string, any]) => {
    if (Array.isArray(rooms)) {
      standardizedRooms[date] = rooms.map((room: any) => ({
        ...room,
        room_type: standardizeRoomType(room.room_type || ''),
        original_room_type: room.room_type // Keep original for reference
      }));
    }
  });

  standardizedData.rooms_jsonb = standardizedRooms;
  return standardizedData;
}

/**
 * Standardizes room type names in hotel user data
 * @param hotelData - Hotel user data
 * @returns Standardized hotel data
 */
export function standardizeHotelRoomTypes(hotelData: any[]): any[] {
  return hotelData.map(room => ({
    ...room,
    room_type: standardizeRoomType(room.room_type || ''),
    original_room_type: room.room_type // Keep original for reference
  }));
}
