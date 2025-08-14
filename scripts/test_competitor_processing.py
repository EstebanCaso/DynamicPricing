#!/usr/bin/env python3
"""
Test competitor data processing logic
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

def clean_price(price_string):
    """Clean price string to extract numeric value"""
    if isinstance(price_string, (int, float)):
        return float(price_string)
    if not price_string:
        return 0
    
    # Clean MXN format: "MXN 1,358" -> 1358
    cleaned_price = str(price_string).replace('MXN', '').replace('$', '').replace(',', '').strip()
    try:
        price = float(cleaned_price)
        return price
    except ValueError:
        return 0

def test_competitor_processing():
    """Test the competitor data processing logic"""
    print("🚀 Testing Competitor Data Processing")
    print("=" * 50)
    
    # Fetch competitor data
    print("\n🔍 Fetching competitor data...")
    try:
        result = supabase.table('hoteles_parallel').select('*').limit(10).execute()
        
        if not result.data:
            print("❌ No competitor data found")
            return
        
        print(f"✅ Found {len(result.data)} competitors")
        
        # Filter by city in memory (Tijuana)
        competitors = [hotel for hotel in result.data if 
                      hotel.get('ciudad') and 'tijuana' in hotel.get('ciudad', '').lower()]
        
        print(f"✅ Filtered to {len(competitors)} Tijuana competitors")
        
        # Process competitor performance
        performance_data = []
        
        for i, competitor in enumerate(competitors[:5]):  # Process first 5
            try:
                print(f"\n🏨 Processing: {competitor.get('nombre', 'Unknown')}")
                
                rooms_json = competitor.get('rooms_jsonb')
                if not rooms_json:
                    print("   ⚠️  No rooms_jsonb data")
                    continue
                
                if isinstance(rooms_json, str):
                    try:
                        import json
                        rooms_json = json.loads(rooms_json)
                    except:
                        print("   ⚠️  Could not parse rooms_jsonb string")
                        continue
                
                if not isinstance(rooms_json, dict):
                    print(f"   ⚠️  rooms_jsonb is not a dict: {type(rooms_json)}")
                    continue
                
                # Get available dates
                available_dates = list(rooms_json.keys())
                if not available_dates:
                    print("   ⚠️  No dates available in rooms_jsonb")
                    continue
                
                print(f"   📅 Available dates: {len(available_dates)}")
                
                # Try current date first
                from datetime import datetime
                current_date = datetime.now().strftime('%Y-%m-%d')
                current_rooms = rooms_json.get(current_date, [])
                
                if current_rooms and isinstance(current_rooms, list):
                    print(f"   ✅ Found current date data: {current_date}")
                    total_price = 0
                    valid_prices = 0
                    
                    for room in current_rooms:
                        price = clean_price(room.get('price', room.get('rate', 0)))
                        if price > 0:
                            total_price += price
                            valid_prices += 1
                    
                    if valid_prices > 0:
                        avg_price = total_price / valid_prices
                        competitor_revenue = avg_price * 0.80  # 80% occupancy
                        
                        performance_data.append({
                            'hotel': competitor.get('nombre', f'Competitor {i+1}'),
                            'revenue': round(competitor_revenue),
                            'avg_price': round(avg_price, 2),
                            'date': current_date
                        })
                        
                        print(f"   💰 Avg Price: ${avg_price:.2f}")
                        print(f"   💵 Revenue (80% occupancy): ${competitor_revenue:.2f}")
                    else:
                        print("   ⚠️  No valid prices found for current date")
                        
                        # Try latest available date
                        latest_date = sorted(available_dates)[-1]
                        latest_rooms = rooms_json.get(latest_date, [])
                        
                        if latest_rooms and isinstance(latest_rooms, list):
                            print(f"   📅 Trying latest date: {latest_date}")
                            total_price = 0
                            valid_prices = 0
                            
                            for room in latest_rooms:
                                price = clean_price(room.get('price', room.get('rate', 0)))
                                if price > 0:
                                    total_price += price
                                    valid_prices += 1
                            
                            if valid_prices > 0:
                                avg_price = total_price / valid_prices
                                competitor_revenue = avg_price * 0.80
                                
                                performance_data.append({
                                    'hotel': f"{competitor.get('nombre', f'Competitor {i+1}')} ({latest_date})",
                                    'revenue': round(competitor_revenue),
                                    'avg_price': round(avg_price, 2),
                                    'date': latest_date
                                })
                                
                                print(f"   💰 Avg Price: ${avg_price:.2f}")
                                print(f"   💵 Revenue (80% occupancy): ${competitor_revenue:.2f}")
                            else:
                                print("   ⚠️  No valid prices found for latest date")
                
            except Exception as e:
                print(f"   ❌ Error processing competitor: {e}")
        
        # Sort by revenue
        performance_data.sort(key=lambda x: x['revenue'], reverse=True)
        
        print(f"\n📊 Revenue Performance Ranking:")
        print("=" * 40)
        for i, item in enumerate(performance_data):
            print(f"{i+1:2d}. {item['hotel']:<40} ${item['revenue']:>8} (${item['avg_price']:>6} avg)")
        
        if performance_data:
            print(f"\n✅ Successfully processed {len(performance_data)} competitors")
        else:
            print("\n❌ No competitor data could be processed")
            
    except Exception as e:
        print(f"❌ Error in competitor processing: {e}")

if __name__ == "__main__":
    test_competitor_processing()
