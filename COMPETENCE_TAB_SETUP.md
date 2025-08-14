# CompetenceTab Component Setup Guide

## Overview
The CompetenceTab component has been updated to provide comprehensive hotel pricing analysis with Supabase integration. It now shows real-time data for user hotels and competitor analysis.

## Key Features
- **Real-time Data**: Integrates with Supabase to fetch user hotel data
- **Competitor Analysis**: Shows pricing comparison with other hotels in the same city
- **RevPAR Tracking**: Displays Revenue Per Available Room metrics
- **Position Analysis**: Shows where your hotel stands compared to competitors
- **USD Pricing**: All prices are displayed in US Dollars
- **Responsive Design**: Works on all device sizes

## Database Setup

### 1. Run the Database Schema
Execute the `database_schema.sql` file in your Supabase SQL editor to create the necessary tables and sample data.

### 2. Tables Created
- **hotels**: Stores hotel information (name, city, stars, user_id)
- **room_types**: Stores room type pricing and RevPAR data
- **competitor_hotels**: View for public competitor data

### 3. Row Level Security (RLS)
- Users can only see and modify their own hotel data
- Competitor data is publicly viewable for analysis
- Secure authentication required for hotel management

## Component Structure

### State Variables
- `roomTypeData`: Main comparison data
- `userHotel`: Current user's hotel information
- `competitorHotels`: List of competitor hotels
- `loading` & `error`: UI state management

### Key Functions
- `fetchHotelData()`: Retrieves user hotel and competitor data
- `generateComparisonData()`: Creates comparison analysis
- `calculateUserHotelRevpar()`: Calculates user hotel's average RevPAR

## Data Flow

1. **Authentication**: Component checks for authenticated user
2. **Hotel Fetch**: Retrieves user's hotel from Supabase
3. **Competitor Analysis**: Fetches competitor hotels in same city
4. **Data Processing**: Generates comparison metrics
5. **UI Rendering**: Displays analysis with filters and charts

## Usage

### For Hotel Owners
1. Log in to your account
2. Navigate to the Competence tab
3. View your hotel's pricing position
4. Analyze competitor pricing strategies
5. Monitor RevPAR performance

### For Developers
1. Ensure Supabase environment variables are set
2. Run the database schema
3. Test with sample data
4. Customize filters and analysis as needed

## Environment Variables Required
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Sample Data
The schema includes sample hotels with realistic pricing data:
- 5 sample hotels (A through E)
- 5 room types per hotel (Standard to Presidential)
- Realistic pricing ranges ($105 - $600)
- Calculated RevPAR values

## Customization
- Modify room types in the `generateComparisonData` function
- Adjust pricing position thresholds in `getPricePosition`
- Add new analysis metrics as needed
- Customize the UI styling and layout

## Troubleshooting
- **No data shown**: Check user authentication and hotel association
- **Database errors**: Verify Supabase connection and table creation
- **Performance issues**: Check database indexes and query optimization

## Future Enhancements
- Historical pricing trends
- Seasonal pricing analysis
- Market demand indicators
- Automated pricing recommendations
- Export functionality for reports
