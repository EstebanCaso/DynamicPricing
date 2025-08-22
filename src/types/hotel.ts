export interface Hotel {
  name: string
  hotelId: string
  latitude: number
  longitude: number
  address: {
    cityName: string
    countryCode: string
    postalCode?: string
    street?: string
  }
  distance?: number
}

export interface HotelSearchParams {
  latitude: number
  longitude: number
  radius?: number
  keyword?: string
}

export interface HotelSearchResponse {
  success: boolean
  hotels: Hotel[]
  error?: string
}
