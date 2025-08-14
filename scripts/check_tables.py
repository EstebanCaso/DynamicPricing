#!/usr/bin/env python3
"""
Check what tables exist in the Supabase database
"""

import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing Supabase environment variables")
    exit(1)

try:
    from supabase import create_client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
except ImportError:
    print("❌ Supabase Python client not installed")
    exit(1)

def check_table_names():
    """Check what tables exist by trying to access them"""
    print("🔍 Checking available tables...")
    
    # List of possible table names to check
    possible_tables = [
        'hotel_usuario',
        'hotels_parallel', 
        'hoteles_parallel',
        'eventos',
        'hotels',
        'room_types'
    ]
    
    existing_tables = {}
    
    for table_name in possible_tables:
        try:
            result = supabase.table(table_name).select('count').execute()
            count = result.data[0]['count'] if result.data else 0
            existing_tables[table_name] = count
            print(f"✅ {table_name}: {count} records")
        except Exception as e:
            if "does not exist" in str(e):
                print(f"❌ {table_name}: table does not exist")
            else:
                print(f"⚠️  {table_name}: error - {e}")
    
    return existing_tables

def check_table_structure(table_name):
    """Check the structure of a specific table"""
    print(f"\n🔍 Checking structure of {table_name}...")
    
    try:
        # Get a few sample records to see the structure
        result = supabase.table(table_name).select('*').limit(2).execute()
        
        if result.data:
            print(f"✅ Table {table_name} has data")
            for i, record in enumerate(result.data):
                print(f"   Record {i+1} columns:")
                for key, value in record.items():
                    if isinstance(value, dict) or isinstance(value, list):
                        print(f"     {key}: {type(value).__name__} (complex data)")
                    else:
                        print(f"     {key}: {value}")
        else:
            print(f"⚠️  Table {table_name} exists but has no data")
            
    except Exception as e:
        print(f"❌ Error checking {table_name}: {e}")

def main():
    """Main function"""
    print("🚀 Database Table Check")
    print("=" * 50)
    
    # Check what tables exist
    existing_tables = check_table_names()
    
    print(f"\n📊 Summary: Found {len(existing_tables)} tables with data")
    
    # Check structure of main tables
    if 'hotel_usuario' in existing_tables:
        check_table_structure('hotel_usuario')
    
    if 'hotels_parallel' in existing_tables:
        check_table_structure('hotels_parallel')
    
    if 'hoteles_parallel' in existing_tables:
        check_table_structure('hoteles_parallel')
    
    print("\n💡 Next steps:")
    print("1. Verify the table names match what the API expects")
    print("2. Check if the API needs to be updated to use the correct table names")
    print("3. Ensure the data structure matches what the API expects")

if __name__ == "__main__":
    main()
