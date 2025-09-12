#!/usr/bin/env python3
"""
Check what users exist in the Supabase database
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

def check_users():
    """Check what users exist in the database"""
    print("🔍 Checking users in database...")
    
    try:
        # Check auth.users table
        result = supabase.auth.admin.list_users()
        print(f"✅ Found {len(result.users)} users in auth.users")
        
        for user in result.users:
            print(f"   👤 User ID: {user.id}")
            print(f"      Email: {user.email}")
            print(f"      Created: {user.created_at}")
            print()
            
    except Exception as e:
        print(f"⚠️  Could not access auth.users: {e}")
        
        # Try to get users from hotel_usuario table
        try:
            result = supabase.table('hotel_usuario').select('user_id').execute()
            unique_users = set()
            for record in result.data:
                unique_users.add(record['user_id'])
            
            print(f"✅ Found {len(unique_users)} unique user_ids in hotel_usuario table:")
            for user_id in unique_users:
                print(f"   👤 User ID: {user_id}")
                
        except Exception as e2:
            print(f"❌ Error accessing hotel_usuario: {e2}")

def main():
    """Main function"""
    print("🚀 User Check")
    print("=" * 50)
    
    check_users()
    
    print("\n💡 Next steps:")
    print("1. Use one of the valid user_ids above in your hotel_propio.js script")
    print("2. Example: node hotel_propio.js 19609844-eb33-490d-9ead-c8f56f6ed790 \"Hilton Mexico City\" --headless")

if __name__ == "__main__":
    main()
