#!/usr/bin/env python3
"""
Test script for the Competitors API endpoint
This helps debug authentication and data flow issues
"""

import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

def test_api_without_auth():
    """Test the API without authentication"""
    print("🔍 Testing API without authentication...")
    
    url = "http://localhost:3000/api/competitors/real-data"
    data = {
        "selectedStars": "All",
        "selectedRoomType": "All Types", 
        "selectedDateRange": "30 Days",
        "city": "New York"
    }
    
    try:
        response = requests.post(url, json=data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 401:
            print("✅ Expected: API correctly returns 401 for unauthenticated requests")
        else:
            print("❌ Unexpected: API should return 401 for unauthenticated requests")
            
    except Exception as e:
        print(f"❌ Error testing API: {e}")

def test_supabase_connection():
    """Test direct Supabase connection"""
    print("\n🔍 Testing Supabase connection...")
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Missing Supabase environment variables")
        return
    
    print(f"✅ Supabase URL: {supabase_url}")
    print(f"✅ Supabase Key: {supabase_key[:20]}...")
    
    # Test basic connection
    try:
        import supabase
        client = supabase.create_client(supabase_url, supabase_key)
        
        # Test if we can query the tables
        print("\n📊 Testing table access...")
        
        # Check if tables exist
        try:
            result = client.table('hotels_parallel').select('count').execute()
            print(f"✅ hotels_parallel table accessible: {result.data}")
        except Exception as e:
            print(f"❌ hotels_parallel table error: {e}")
        
        try:
            result = client.table('hoteles_parallel').select('count').execute()
            print(f"✅ hoteles_parallel table accessible: {result.data}")
        except Exception as e:
            print(f"❌ hoteles_parallel table error: {e}")
        
        try:
            result = client.table('hotel_usuario').select('count').execute()
            print(f"✅ hotel_usuario table accessible: {result.data}")
        except Exception as e:
            print(f"❌ hotel_usuario table error: {e}")
            
        try:
            result = client.table('eventos').select('count').execute()
            print(f"✅ eventos table accessible: {result.data}")
        except Exception as e:
            print(f"❌ eventos table error: {e}")
            
    except ImportError:
        print("❌ Supabase Python client not installed. Run: pip install supabase")
    except Exception as e:
        print(f"❌ Supabase connection error: {e}")

def check_sample_data():
    """Check if sample data exists"""
    print("\n📊 Checking sample data...")
    
    try:
        import supabase
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_ANON_KEY")
        
        if not supabase_url or not supabase_key:
            print("❌ Missing Supabase environment variables")
            return
            
        client = supabase.create_client(supabase_url, supabase_key)
        
        # Check competitor data
        result = client.table('hotels_parallel').select('*').limit(5).execute()
        print(f"✅ hotels_parallel: {len(result.data)} records")
        
        if result.data:
            for hotel in result.data[:3]:
                print(f"   - {hotel.get('nombre', 'Unknown')} in {hotel.get('ciudad', 'Unknown')}")
        
        # Check hoteles_parallel data
        result = client.table('hoteles_parallel').select('*').limit(5).execute()
        print(f"✅ hoteles_parallel: {len(result.data)} records")
        
        if result.data:
            for hotel in result.data[:3]:
                print(f"   - {hotel.get('nombre', 'Unknown')} in {hotel.get('ciudad', 'Unknown')}")
        
        # Check user hotel data
        result = client.table('hotel_usuario').select('*').limit(5).execute()
        print(f"✅ hotel_usuario: {len(result.data)} records")
        
        if result.data:
            for hotel in result.data[:3]:
                print(f"   - {hotel.get('hotel_name', 'Unknown')} for user {hotel.get('user_id', 'Unknown')[:8]}...")
        
    except Exception as e:
        print(f"❌ Error checking sample data: {e}")

def main():
    """Main test function"""
    print("🚀 Arkus Dynamic Pricing API Test")
    print("=" * 50)
    
    # Test 1: API without authentication
    test_api_without_auth()
    
    # Test 2: Supabase connection
    test_supabase_connection()
    
    # Test 3: Sample data check
    check_sample_data()
    
    print("\n" + "=" * 50)
    print("📋 Summary of findings:")
    print("- If API returns 401: Authentication is working correctly")
    print("- If tables are accessible: Database connection is working")
    print("- If sample data exists: You can test the full flow")
    print("\n💡 Next steps:")
    print("1. Ensure you're logged in to the web application")
    print("2. Run the migration script: python scripts/migrate_database.py")
    print("3. Run scraping scripts to collect real data")
    print("4. Test the Competitors tab in the web interface")

if __name__ == "__main__":
    main()
