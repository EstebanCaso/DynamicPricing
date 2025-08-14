#!/usr/bin/env python3
"""
Test Revenue Performance calculation logic
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

def test_revenue_performance():
    """Test the revenue performance calculation logic"""
    print("🚀 Testing Revenue Performance Calculation")
    print("=" * 50)
    
    # Test 1: Check user hotel data
    print("\n🔍 Test 1: User Hotel Data")
    try:
        result = supabase.table('hotel_usuario').select('*').limit(5).execute()
        if result.data:
            print(f"✅ Found {len(result.data)} user hotel records")
            
            # Calculate average price
            total_price = 0
            valid_prices = 0
            for item in result.data:
                price_str = item.get('price', '0')
                if price_str and isinstance(price_str, str):
                    # Clean price string
                    cleaned_price = price_str.replace('MXN', '').replace('$', '').replace(',', '').strip()
                    try:
                        price = float(cleaned_price)
                        total_price += price
                        valid_prices += 1
                    except ValueError:
                        print(f"⚠️  Could not parse price: {price_str}")
            
            if valid_prices > 0:
                avg_price = total_price / valid_prices
                user_revenue = avg_price * 0.85  # 85% occupancy
                print(f"✅ Average Price: ${avg_price:.2f}")
                print(f"✅ Estimated Revenue (85% occupancy): ${user_revenue:.2f}")
            else:
                print("❌ No valid prices found")
        else:
            print("❌ No user hotel data found")
    except Exception as e:
        print(f"❌ Error fetching user hotel data: {e}")
    
    # Test 2: Check competitor data
    print("\n🔍 Test 2: Competitor Data")
    try:
        # Try hoteles_parallel first
        result = supabase.table('hoteles_parallel').select('*').ilike('ciudad', '%Tijuana%').limit(5).execute()
        if result.data:
            print(f"✅ Found {len(result.data)} competitors in hoteles_parallel")
            
            for i, competitor in enumerate(result.data[:3]):
                print(f"   Competitor {i+1}: {competitor.get('nombre', 'Unknown')}")
                
                # Check rooms_jsonb structure
                rooms_json = competitor.get('rooms_jsonb')
                if rooms_json:
                    if isinstance(rooms_json, dict):
                        dates = list(rooms_json.keys())
                        print(f"     Available dates: {len(dates)}")
                        if dates:
                            latest_date = sorted(dates)[-1]
                            latest_rooms = rooms_json[latest_date]
                            if isinstance(latest_rooms, list) and latest_rooms:
                                total_price = 0
                                for room in latest_rooms:
                                    price = room.get('price', room.get('rate', 0))
                                    if price:
                                        total_price += float(price)
                                avg_price = total_price / len(latest_rooms)
                                competitor_revenue = avg_price * 0.80  # 80% occupancy
                                print(f"     Latest date: {latest_date}")
                                print(f"     Average price: ${avg_price:.2f}")
                                print(f"     Estimated revenue: ${competitor_revenue:.2f}")
                    else:
                        print(f"     rooms_jsonb is not a dict: {type(rooms_json)}")
                else:
                    print("     No rooms_jsonb data")
        else:
            print("❌ No competitor data found in hoteles_parallel")
            
            # Try hotels_parallel as fallback
            result = supabase.table('hotels_parallel').select('*').ilike('ciudad', '%New York%').limit(3).execute()
            if result.data:
                print(f"✅ Found {len(result.data)} competitors in hotels_parallel (fallback)")
            else:
                print("❌ No competitor data found in either table")
                
    except Exception as e:
        print(f"❌ Error fetching competitor data: {e}")
    
    # Test 3: Revenue Performance Calculation
    print("\n🔍 Test 3: Revenue Performance Calculation")
    try:
        # Simulate the calculation logic
        performance_data = []
        
        # Get user hotel data
        user_result = supabase.table('hotel_usuario').select('*').limit(10).execute()
        if user_result.data:
            total_price = 0
            valid_prices = 0
            for item in user_result.data:
                price_str = item.get('price', '0')
                if price_str and isinstance(price_str, str):
                    cleaned_price = price_str.replace('MXN', '').replace('$', '').replace(',', '').strip()
                    try:
                        price = float(cleaned_price)
                        total_price += price
                        valid_prices += 1
                    except ValueError:
                        continue
            
            if valid_prices > 0:
                user_avg_price = total_price / valid_prices
                user_revenue = user_avg_price * 0.85
                performance_data.append({
                    'hotel': 'Our Hotel',
                    'revenue': round(user_revenue)
                })
                print(f"✅ Our Hotel Revenue: ${user_revenue:.2f}")
        
        # Get competitor data
        competitor_result = supabase.table('hoteles_parallel').select('*').ilike('ciudad', '%Tijuana%').limit(5).execute()
        if competitor_result.data:
            for competitor in competitor_result.data:
                try:
                    rooms_json = competitor.get('rooms_jsonb')
                    if isinstance(rooms_json, dict):
                        dates = list(rooms_json.keys())
                        if dates:
                            latest_date = sorted(dates)[-1]
                            latest_rooms = rooms_json[latest_date]
                            if isinstance(latest_rooms, list) and latest_rooms:
                                total_price = 0
                                for room in latest_rooms:
                                    price = room.get('price', room.get('rate', 0))
                                    if price:
                                        total_price += float(price)
                                if total_price > 0:
                                    avg_price = total_price / len(latest_rooms)
                                    competitor_revenue = avg_price * 0.80
                                    performance_data.append({
                                        'hotel': competitor.get('nombre', 'Unknown'),
                                        'revenue': round(competitor_revenue)
                                    })
                except Exception as e:
                    print(f"⚠️  Error processing competitor {competitor.get('nombre', 'Unknown')}: {e}")
        
        # Sort by revenue
        performance_data.sort(key=lambda x: x['revenue'], reverse=True)
        
        print(f"\n📊 Revenue Performance Ranking:")
        for i, item in enumerate(performance_data[:5]):
            print(f"   {i+1}. {item['hotel']}: ${item['revenue']}")
        
        if len(performance_data) > 1:
            # Calculate our position
            our_hotel = next((item for item in performance_data if item['hotel'] == 'Our Hotel'), None)
            if our_hotel:
                our_position = performance_data.index(our_hotel) + 1
                total_hotels = len(performance_data)
                print(f"\n🏆 Our Position: {our_position} of {total_hotels}")
                
                # Calculate vs peers
                others = [item for item in performance_data if item['hotel'] != 'Our Hotel']
                if others:
                    avg_others = sum(item['revenue'] for item in others) / len(others)
                    delta = our_hotel['revenue'] - avg_others
                    sign = "+" if delta > 0 else ""
                    print(f"📈 vs Peers: {sign}${delta:.2f}")
        
    except Exception as e:
        print(f"❌ Error in revenue performance calculation: {e}")
    
    print("\n✅ Revenue Performance test completed!")

if __name__ == "__main__":
    test_revenue_performance()
