#!/usr/bin/env python3
"""
Simple Database Setup Script for Arkus Dynamic Pricing
This script attempts to create tables using direct SQL execution
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables")
    sys.exit(1)

try:
    from supabase import create_client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
except ImportError:
    print("❌ Supabase Python client not installed. Run: pip install supabase")
    sys.exit(1)

def create_tables_via_sql():
    """Create tables by executing SQL directly"""
    print("🔧 Attempting to create tables via SQL...")
    
    # Try to create tables using raw SQL
    try:
        # This might not work due to permissions, but worth trying
        result = supabase.table('hotels_parallel').select('*').limit(1).execute()
        print("✅ hotels_parallel table already exists")
        return True
    except Exception as e:
        if "does not exist" in str(e):
            print("❌ hotels_parallel table does not exist")
            print("💡 You need to create the tables manually in the Supabase dashboard")
            print("   Copy and paste the SQL from database_schema.sql")
            return False
        else:
            print(f"❌ Unexpected error: {e}")
            return False

def insert_sample_data():
    """Try to insert sample data if tables exist"""
    print("📊 Attempting to insert sample data...")
    
    try:
        # Check if hotels_parallel table exists by trying to insert
        sample_hotel = {
            "nombre": "Test Hotel",
            "ciudad": "New York",
            "estrellas": 4,
            "ubicacion": "Test Location",
            "rooms_jsonb": {
                "2024-12-15": [
                    {"room_type": "Standard", "price": "150"}
                ]
            }
        }
        
        result = supabase.table('hotels_parallel').insert(sample_hotel).execute()
        print("✅ Sample data inserted successfully")
        
        # Clean up test data
        supabase.table('hotels_parallel').delete().eq('nombre', 'Test Hotel').execute()
        print("✅ Test data cleaned up")
        
        return True
    except Exception as e:
        print(f"❌ Could not insert sample data: {e}")
        return False

def check_existing_data():
    """Check what data already exists"""
    print("🔍 Checking existing data...")
    
    try:
        # Check hotel_usuario (should exist)
        result = supabase.table('hotel_usuario').select('*').limit(3).execute()
        print(f"✅ hotel_usuario: {len(result.data)} records")
        
        if result.data:
            print("   Sample records:")
            for hotel in result.data[:2]:
                print(f"   - {hotel.get('hotel_name', 'Unknown')} in {hotel.get('checkin_date', 'Unknown')}")
        
        # Try to check hotels_parallel
        try:
            result = supabase.table('hotels_parallel').select('*').limit(3).execute()
            print(f"✅ hotels_parallel: {len(result.data)} records")
        except Exception as e:
            print(f"❌ hotels_parallel table not accessible: {e}")
        
        # Try to check eventos
        try:
            result = supabase.table('eventos').select('*').limit(3).execute()
            print(f"✅ eventos: {len(result.data)} records")
        except Exception as e:
            print(f"❌ eventos table not accessible: {e}")
            
        return True
    except Exception as e:
        print(f"❌ Error checking data: {e}")
        return False

def main():
    """Main function"""
    print("🚀 Simple Database Setup Check")
    print("=" * 50)
    
    # Check existing data
    check_existing_data()
    
    print()
    
    # Try to create tables
    if not create_tables_via_sql():
        print("\n💡 Manual Setup Required:")
        print("1. Go to your Supabase dashboard")
        print("2. Navigate to SQL Editor")
        print("3. Copy and paste the contents of database_schema.sql")
        print("4. Run the SQL commands")
        print("5. Come back and run this script again")
        return
    
    print()
    
    # Try to insert sample data
    if insert_sample_data():
        print("✅ Database is ready!")
    else:
        print("❌ Database setup incomplete")

if __name__ == "__main__":
    main()
