#!/usr/bin/env python3
"""
Simple query test for hoteles_parallel table
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

def test_simple_queries():
    """Test simple queries on hoteles_parallel"""
    print("🚀 Testing Simple Queries on hoteles_parallel")
    print("=" * 50)
    
    # Test 1: Basic count
    print("\n🔍 Test 1: Basic Count")
    try:
        result = supabase.table('hoteles_parallel').select('count').execute()
        print(f"✅ Count result: {result.data}")
    except Exception as e:
        print(f"❌ Count error: {e}")
    
    # Test 2: Select just id and nombre
    print("\n🔍 Test 2: Select Limited Fields")
    try:
        result = supabase.table('hoteles_parallel').select('id, nombre').limit(3).execute()
        if result.data:
            print(f"✅ Found {len(result.data)} records")
            for item in result.data:
                print(f"   - {item.get('nombre', 'Unknown')} (ID: {item.get('id', 'Unknown')})")
        else:
            print("❌ No data returned")
    except Exception as e:
        print(f"❌ Limited select error: {e}")
    
    # Test 3: Check table structure
    print("\n🔍 Test 3: Check Table Structure")
    try:
        result = supabase.table('hoteles_parallel').select('*').limit(1).execute()
        if result.data and len(result.data) > 0:
            print("✅ Table structure:")
            for key, value in result.data[0].items():
                if isinstance(value, dict):
                    print(f"   {key}: {type(value).__name__} (complex data)")
                elif isinstance(value, list):
                    print(f"   {key}: {type(value).__name__} (array data)")
                else:
                    print(f"   {key}: {value}")
        else:
            print("❌ No data to check structure")
    except Exception as e:
        print(f"❌ Structure check error: {e}")
    
    # Test 4: Try different city filter
    print("\n🔍 Test 4: Try Different City Filter")
    try:
        result = supabase.table('hoteles_parallel').select('nombre, ciudad').limit(5).execute()
        if result.data:
            print(f"✅ Found {len(result.data)} records")
            cities = set()
            for item in result.data:
                cities.add(item.get('ciudad', 'Unknown'))
            print(f"   Available cities: {', '.join(cities)}")
        else:
            print("❌ No data returned")
    except Exception as e:
        print(f"❌ City filter error: {e}")

if __name__ == "__main__":
    test_simple_queries()
