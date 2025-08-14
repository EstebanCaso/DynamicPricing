#!/usr/bin/env python3
"""
Database Migration Script for Arkus Dynamic Pricing
This script helps migrate from old schema to new schema and sets up initial data.
"""

import os
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client
import json

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def create_tables():
    """Create the new database tables if they don't exist"""
    print("🔧 Creating database tables...")
    
    # Note: In production, you would run the SQL from database_schema.sql
    # This is just a helper script to verify the setup
    
    try:
        # Test if tables exist by trying to select from them
        result = supabase.table('hotel_usuario').select('*').limit(1).execute()
        print("✅ hotel_usuario table exists")
    except Exception as e:
        print(f"❌ hotel_usuario table error: {e}")
        print("Please run the SQL commands from database_schema.sql first")
        return False
    
    try:
        result = supabase.table('hotels_parallel').select('*').limit(1).execute()
        print("✅ hotels_parallel table exists")
    except Exception as e:
        print(f"❌ hotels_parallel table error: {e}")
        print("Please run the SQL commands from database_schema.sql first")
        return False
    
    try:
        result = supabase.table('eventos').select('*').limit(1).execute()
        print("✅ eventos table exists")
    except Exception as e:
        print(f"❌ eventos table error: {e}")
        print("Please run the SQL commands from database_schema.sql first")
        return False
    
    return True

def insert_sample_data():
    """Insert sample data for testing"""
    print("📊 Inserting sample data...")
    
    # Sample competitor hotels data
    sample_competitors = [
        {
            "nombre": "Grand Plaza Hotel",
            "ciudad": "New York",
            "estrellas": 4,
            "ubicacion": "123 Main St, New York, NY",
            "rooms_jsonb": {
                "2024-12-15": [
                    {"room_type": "Standard", "price": "189"},
                    {"room_type": "Deluxe", "price": "265"},
                    {"room_type": "Suite", "price": "350"}
                ],
                "2024-12-16": [
                    {"room_type": "Standard", "price": "195"},
                    {"room_type": "Deluxe", "price": "275"},
                    {"room_type": "Suite", "price": "365"}
                ]
            }
        },
        {
            "nombre": "Riverside Inn",
            "ciudad": "New York",
            "estrellas": 3,
            "ubicacion": "456 Broadway, New York, NY",
            "rooms_jsonb": {
                "2024-12-15": [
                    {"room_type": "Standard", "price": "145"},
                    {"room_type": "Deluxe", "price": "195"},
                    {"room_type": "Suite", "price": "250"}
                ],
                "2024-12-16": [
                    {"room_type": "Standard", "price": "150"},
                    {"room_type": "Deluxe", "price": "200"},
                    {"room_type": "Suite", "price": "255"}
                ]
            }
        },
        {
            "nombre": "City Center Suites",
            "ciudad": "New York",
            "estrellas": 4,
            "ubicacion": "789 5th Ave, New York, NY",
            "rooms_jsonb": {
                "2024-12-15": [
                    {"room_type": "Standard", "price": "132"},
                    {"room_type": "Deluxe", "price": "185"},
                    {"room_type": "Suite", "price": "280"}
                ],
                "2024-12-16": [
                    {"room_type": "Standard", "price": "138"},
                    {"room_type": "Deluxe", "price": "190"},
                    {"room_type": "Suite", "price": "285"}
                ]
            }
        }
    ]
    
    try:
        for competitor in sample_competitors:
            # Check if hotel already exists
            existing = supabase.table('hotels_parallel').select('id').eq('nombre', competitor['nombre']).execute()
            
            if not existing.data:
                result = supabase.table('hotels_parallel').insert(competitor).execute()
                print(f"✅ Inserted {competitor['nombre']}")
            else:
                print(f"⏭️  {competitor['nombre']} already exists")
                
    except Exception as e:
        print(f"❌ Error inserting sample competitors: {e}")
        return False
    
    return True

def verify_data_integrity():
    """Verify that the data is properly structured"""
    print("🔍 Verifying data integrity...")
    
    try:
        # Check competitor data
        competitors = supabase.table('hotels_parallel').select('*').execute()
        print(f"✅ Found {len(competitors.data)} competitor hotels")
        
        for hotel in competitors.data:
            if hotel.get('rooms_jsonb'):
                rooms_data = hotel['rooms_jsonb']
                if isinstance(rooms_data, str):
                    try:
                        rooms_data = json.loads(rooms_data)
                    except:
                        print(f"⚠️  Warning: Invalid JSON in rooms_jsonb for {hotel['nombre']}")
                        continue
                
                dates = list(rooms_data.keys())
                print(f"   📅 {hotel['nombre']}: {len(dates)} dates, {len(rooms_data.get(dates[0] or [], []))} room types")
            else:
                print(f"⚠️  Warning: No rooms data for {hotel['nombre']}")
        
        # Check if we have any user hotel data
        user_hotels = supabase.table('hotel_usuario').select('*').limit(1).execute()
        if user_hotels.data:
            print(f"✅ Found {len(user_hotels.data)} user hotel records")
        else:
            print("ℹ️  No user hotel data found yet (this is normal for new installations)")
        
        return True
        
    except Exception as e:
        print(f"❌ Error verifying data integrity: {e}")
        return False

def main():
    """Main migration function"""
    print("🚀 Starting Arkus Dynamic Pricing Database Migration")
    print("=" * 50)
    
    # Step 1: Verify tables exist
    if not create_tables():
        print("\n❌ Migration failed: Tables not properly set up")
        print("Please run the SQL commands from database_schema.sql first")
        sys.exit(1)
    
    print()
    
    # Step 2: Insert sample data
    if not insert_sample_data():
        print("\n❌ Migration failed: Could not insert sample data")
        sys.exit(1)
    
    print()
    
    # Step 3: Verify data integrity
    if not verify_data_integrity():
        print("\n❌ Migration failed: Data integrity check failed")
        sys.exit(1)
    
    print()
    print("🎉 Migration completed successfully!")
    print("\nNext steps:")
    print("1. Run your Python scraping scripts to collect real hotel data")
    print("2. Test the Competitors tab in your application")
    print("3. Verify that all data is being displayed correctly")
    
    print("\nSample data has been inserted for testing purposes.")
    print("You can now test the Competitors tab with real data from Supabase!")

if __name__ == "__main__":
    main()
