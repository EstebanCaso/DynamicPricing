#!/usr/bin/env python3
"""
Database Setup Script for Arkus Dynamic Pricing
This script creates the required tables in Supabase
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

def create_hotels_parallel_table():
    """Create the hotels_parallel table"""
    print("🔧 Creating hotels_parallel table...")
    
    # SQL to create the table
    sql = """
    CREATE TABLE IF NOT EXISTS hotels_parallel (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        ciudad VARCHAR(100) NOT NULL,
        estrellas INTEGER CHECK (estrellas >= 1 AND estrellas <= 5),
        ubicacion TEXT,
        rooms_jsonb JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """
    
    try:
        # Execute the SQL using Supabase's RPC function
        result = supabase.rpc('exec_sql', {'sql': sql}).execute()
        print("✅ hotels_parallel table created successfully")
        return True
    except Exception as e:
        print(f"❌ Error creating hotels_parallel table: {e}")
        return False

def create_eventos_table():
    """Create the eventos table"""
    print("🔧 Creating eventos table...")
    
    # SQL to create the table
    sql = """
    CREATE TABLE IF NOT EXISTS eventos (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        fecha DATE NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        tipo VARCHAR(100) NOT NULL,
        ubicacion VARCHAR(255) NOT NULL,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """
    
    try:
        # Execute the SQL using Supabase's RPC function
        result = supabase.rpc('exec_sql', {'sql': sql}).execute()
        print("✅ eventos table created successfully")
        return True
    except Exception as e:
        print(f"❌ Error creating eventos table: {e}")
        return False

def insert_sample_competitor_data():
    """Insert sample competitor data"""
    print("📊 Inserting sample competitor data...")
    
    sample_data = [
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
        for hotel in sample_data:
            # Check if hotel already exists
            existing = supabase.table('hotels_parallel').select('id').eq('nombre', hotel['nombre']).execute()
            
            if not existing.data:
                result = supabase.table('hotels_parallel').insert(hotel).execute()
                print(f"✅ Inserted {hotel['nombre']}")
            else:
                print(f"⏭️  {hotel['nombre']} already exists")
                
        return True
    except Exception as e:
        print(f"❌ Error inserting sample data: {e}")
        return False

def verify_tables():
    """Verify that all tables exist and have data"""
    print("🔍 Verifying tables...")
    
    try:
        # Check hotels_parallel
        result = supabase.table('hotels_parallel').select('count').execute()
        print(f"✅ hotels_parallel: {result.data[0]['count']} records")
        
        # Check hotel_usuario
        result = supabase.table('hotel_usuario').select('count').execute()
        print(f"✅ hotel_usuario: {result.data[0]['count']} records")
        
        # Check eventos
        result = supabase.table('eventos').select('count').execute()
        print(f"✅ eventos: {result.data[0]['count']} records")
        
        return True
    except Exception as e:
        print(f"❌ Error verifying tables: {e}")
        return False

def main():
    """Main setup function"""
    print("🚀 Setting up Arkus Dynamic Pricing Database")
    print("=" * 50)
    
    # Step 1: Create tables
    if not create_hotels_parallel_table():
        print("❌ Failed to create hotels_parallel table")
        return
    
    if not create_eventos_table():
        print("❌ Failed to create eventos table")
        return
    
    print()
    
    # Step 2: Insert sample data
    if not insert_sample_competitor_data():
        print("❌ Failed to insert sample data")
        return
    
    print()
    
    # Step 3: Verify setup
    if not verify_tables():
        print("❌ Table verification failed")
        return
    
    print()
    print("🎉 Database setup completed successfully!")
    print("\nNext steps:")
    print("1. Test the API: python scripts/test_api.py")
    print("2. Run the migration script: python scripts/migrate_database.py")
    print("3. Test the Competitors tab in your web application")

if __name__ == "__main__":
    main()
