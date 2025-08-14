#!/usr/bin/env python3
"""
Test complete revenue performance calculation
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

def test_full_revenue_performance():
    """Test the complete revenue performance calculation"""
    print("🚀 Testing Complete Revenue Performance Calculation")
    print("=" * 60)
    
    performance_data = []
    
    # 1. Get user hotel data
    print("\n🔍 Step 1: User Hotel Data")
    try:
        user_result = supabase.table('hotel_usuario').select('*').limit(10).execute()
        
        if user_result.data:
            print(f"✅ Found {len(user_result.data)} user hotel records")
            
            # Calculate average price
            total_price = 0
            valid_prices = 0
            for item in user_result.data:
                price = clean_price(item.get('price', 0))
                if price > 0:
                    total_price += price
                    valid_prices += 1
            
            if valid_prices > 0:
                user_avg_price = total_price / valid_prices
                user_revenue = user_avg_price * 0.85  # 85% occupancy for user's hotel
                
                performance_data.append({
                    'hotel': 'Our Hotel (BW PLUS OTAY VALLEY)',
                    'revenue': round(user_revenue),
                    'avg_price': round(user_avg_price, 2),
                    'occupancy': '85%',
                    'type': 'user'
                })
                
                print(f"✅ Our Hotel Revenue: ${user_revenue:.2f} (${user_avg_price:.2f} avg, 85% occupancy)")
            else:
                print("❌ No valid prices found for user hotel")
        else:
            print("❌ No user hotel data found")
    except Exception as e:
        print(f"❌ Error fetching user hotel data: {e}")
    
    # 2. Get competitor data
    print("\n🔍 Step 2: Competitor Data")
    try:
        competitor_result = supabase.table('hoteles_parallel').select('*').limit(15).execute()
        
        if competitor_result.data:
            # Filter to Tijuana competitors
            tijuana_competitors = [hotel for hotel in competitor_result.data if 
                                  hotel.get('ciudad') and 'tijuana' in hotel.get('ciudad', '').lower()]
            
            print(f"✅ Found {len(tijuana_competitors)} Tijuana competitors")
            
            processed_count = 0
            for competitor in tijuana_competitors:
                if processed_count >= 8:  # Limit to top 8 competitors
                    break
                    
                try:
                    rooms_json = competitor.get('rooms_jsonb')
                    if isinstance(rooms_json, str):
                        import json
                        rooms_json = json.loads(rooms_json)
                    
                    if isinstance(rooms_json, dict):
                        # Try current date first
                        from datetime import datetime
                        current_date = datetime.now().strftime('%Y-%m-%d')
                        current_rooms = rooms_json.get(current_date, [])
                        
                        if current_rooms and isinstance(current_rooms, list):
                            total_price = 0
                            valid_prices = 0
                            
                            for room in current_rooms:
                                price = clean_price(room.get('price', room.get('rate', 0)))
                                if price > 0:
                                    total_price += price
                                    valid_prices += 1
                            
                            if valid_prices > 0:
                                avg_price = total_price / valid_prices
                                competitor_revenue = avg_price * 0.80  # 80% occupancy for competitors
                                
                                performance_data.append({
                                    'hotel': competitor.get('nombre', 'Unknown'),
                                    'revenue': round(competitor_revenue),
                                    'avg_price': round(avg_price, 2),
                                    'occupancy': '80%',
                                    'type': 'competitor'
                                })
                                
                                processed_count += 1
                                print(f"   ✅ {competitor.get('nombre', 'Unknown')}: ${competitor_revenue:.2f} (${avg_price:.2f} avg)")
                                
                        else:
                            # Try latest available date
                            available_dates = list(rooms_json.keys())
                            if available_dates:
                                latest_date = sorted(available_dates)[-1]
                                latest_rooms = rooms_json.get(latest_date, [])
                                
                                if latest_rooms and isinstance(latest_rooms, list):
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
                                            'hotel': f"{competitor.get('nombre', 'Unknown')} ({latest_date})",
                                            'revenue': round(competitor_revenue),
                                            'avg_price': round(avg_price, 2),
                                            'occupancy': '80%',
                                            'type': 'competitor'
                                        })
                                        
                                        processed_count += 1
                                        print(f"   ✅ {competitor.get('nombre', 'Unknown')} ({latest_date}): ${competitor_revenue:.2f} (${avg_price:.2f} avg)")
                
                except Exception as e:
                    print(f"   ⚠️  Error processing {competitor.get('nombre', 'Unknown')}: {e}")
        else:
            print("❌ No competitor data found")
            
    except Exception as e:
        print(f"❌ Error fetching competitor data: {e}")
    
    # 3. Calculate final ranking
    print(f"\n🔍 Step 3: Final Revenue Performance Ranking")
    print("=" * 70)
    
    if performance_data:
        # Sort by revenue (highest first)
        performance_data.sort(key=lambda x: x['revenue'], reverse=True)
        
        print(f"{'Rank':<4} {'Hotel Name':<45} {'Revenue':<10} {'Avg Price':<12} {'Occupancy':<10}")
        print("-" * 85)
        
        for i, item in enumerate(performance_data):
            rank = i + 1
            hotel_name = item['hotel'][:44] + "..." if len(item['hotel']) > 44 else item['hotel']
            revenue = f"${item['revenue']:,}"
            avg_price = f"${item['avg_price']:,}"
            occupancy = item['occupancy']
            
            # Highlight our hotel
            if item['type'] == 'user':
                print(f"{rank:<4} {hotel_name:<45} {revenue:<10} {avg_price:<12} {occupancy:<10} 🏠")
            else:
                print(f"{rank:<4} {hotel_name:<45} {revenue:<10} {avg_price:<12} {occupancy:<10}")
        
        # Calculate our position and performance vs peers
        our_hotel = next((item for item in performance_data if item['type'] == 'user'), None)
        if our_hotel and len(performance_data) > 1:
            our_position = performance_data.index(our_hotel) + 1
            total_hotels = len(performance_data)
            
            competitors = [item for item in performance_data if item['type'] == 'competitor']
            if competitors:
                avg_competitor_revenue = sum(item['revenue'] for item in competitors) / len(competitors)
                delta = our_hotel['revenue'] - avg_competitor_revenue
                delta_percentage = (delta / avg_competitor_revenue) * 100 if avg_competitor_revenue > 0 else 0
                
                print(f"\n🏆 Performance Summary:")
                print(f"   Our Position: {our_position} of {total_hotels}")
                print(f"   Our Revenue: ${our_hotel['revenue']:,}")
                print(f"   Competitor Average: ${avg_competitor_revenue:,.0f}")
                print(f"   Difference: ${delta:+,.0f} ({delta_percentage:+.1f}%)")
                
                if delta > 0:
                    print(f"   🎉 We're performing ABOVE the market average!")
                elif delta < 0:
                    print(f"   📉 We're performing BELOW the market average")
                else:
                    print(f"   ➖ We're performing at the market average")
        
        print(f"\n✅ Successfully calculated revenue performance for {len(performance_data)} hotels")
    else:
        print("❌ No performance data available")

if __name__ == "__main__":
    test_full_revenue_performance()
