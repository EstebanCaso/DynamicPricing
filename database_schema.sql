-- Hotel Database Schema for Dynamic Pricing Application
-- Updated to match actual table usage in the application

-- Create hotel_usuario table (user's own hotel data)
CREATE TABLE IF NOT EXISTS hotel_usuario (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    hotel_name VARCHAR(255) NOT NULL,
    nombre_hotel VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    room_type VARCHAR(100) NOT NULL,
    checkin_date DATE NOT NULL,
    estrellas INTEGER CHECK (estrellas >= 1 AND estrellas <= 5),
    ubicacion VARCHAR(255),
    scrape_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create hotels_parallel table (competitor hotel data)
CREATE TABLE IF NOT EXISTS hotels_parallel (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    ciudad VARCHAR(100) NOT NULL,
    estrellas INTEGER CHECK (estrellas >= 1 AND estrellas <= 5),
    ubicacion TEXT,
    rooms_jsonb JSONB, -- Stores room types and prices by date
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create eventos table (local events data)
CREATE TABLE IF NOT EXISTS eventos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fecha DATE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    tipo VARCHAR(100) NOT NULL,
    ubicacion VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_hotel_usuario_user_id ON hotel_usuario(user_id);
CREATE INDEX IF NOT EXISTS idx_hotel_usuario_checkin_date ON hotel_usuario(checkin_date);
CREATE INDEX IF NOT EXISTS idx_hotel_usuario_hotel_name ON hotel_usuario(hotel_name);
CREATE INDEX IF NOT EXISTS idx_hotels_parallel_ciudad ON hotels_parallel(ciudad);
CREATE INDEX IF NOT EXISTS idx_hotels_parallel_estrellas ON hotels_parallel(estrellas);
CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON eventos(fecha);
CREATE INDEX IF NOT EXISTS idx_eventos_user_id ON eventos(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE hotel_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels_parallel ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;

-- Create policies for hotel_usuario table
CREATE POLICY "Users can view their own hotel data" ON hotel_usuario
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own hotel data" ON hotel_usuario
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own hotel data" ON hotel_usuario
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own hotel data" ON hotel_usuario
    FOR DELETE USING (auth.uid() = user_id);

-- Create policies for hotels_parallel table (public competitor data)
CREATE POLICY "Anyone can view competitor hotels" ON hotels_parallel
    FOR SELECT USING (true);

-- Create policies for eventos table
CREATE POLICY "Users can view their own events" ON eventos
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own events" ON eventos
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own events" ON eventos
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own events" ON eventos
    FOR DELETE USING (auth.uid() = user_id);

-- Create a view for competitor analysis (public data)
CREATE OR REPLACE VIEW competitor_hotels AS
SELECT 
    h.id,
    h.nombre as name,
    h.ciudad as city,
    h.estrellas as stars,
    h.ubicacion as location,
    h.rooms_jsonb,
    h.created_at
FROM hotels_parallel h;

-- Grant access to the view
GRANT SELECT ON competitor_hotels TO authenticated;

-- Create a view for user hotel summary
CREATE OR REPLACE VIEW user_hotel_summary AS
SELECT 
    user_id,
    hotel_name,
    COUNT(DISTINCT checkin_date) as total_dates,
    COUNT(*) as total_rooms,
    AVG(price) as avg_price,
    MIN(price) as min_price,
    MAX(price) as max_price,
    AVG(estrellas) as avg_stars
FROM hotel_usuario
GROUP BY user_id, hotel_name;

-- Grant access to the view
GRANT SELECT ON user_hotel_summary TO authenticated;

-- Insert sample competitor data for testing (only if table is empty)
INSERT INTO hotels_parallel (nombre, ciudad, estrellas, ubicacion, rooms_jsonb) 
SELECT * FROM (VALUES
    ('Grand Plaza Hotel', 'New York', 4, '123 Main St, New York, NY', '{"2024-12-15": [{"room_type": "Standard", "price": "189"}, {"room_type": "Deluxe", "price": "265"}, {"room_type": "Suite", "price": "350"}]}'::jsonb),
    ('Riverside Inn', 'New York', 3, '456 Broadway, New York, NY', '{"2024-12-15": [{"room_type": "Standard", "price": "145"}, {"room_type": "Deluxe", "price": "195"}, {"room_type": "Suite", "price": "250"}]}'::jsonb),
    ('City Center Suites', 'New York', 4, '789 5th Ave, New York, NY', '{"2024-12-15": [{"room_type": "Standard", "price": "132"}, {"room_type": "Deluxe", "price": "185"}, {"room_type": "Suite", "price": "280"}]}'::jsonb),
    ('Business Lodge', 'New York', 3, '321 Park Ave, New York, NY', '{"2024-12-15": [{"room_type": "Standard", "price": "128"}, {"room_type": "Deluxe", "price": "175"}, {"room_type": "Suite", "price": "220"}]}'::jsonb),
    ('Luxury Tower', 'New York', 5, '654 Madison Ave, New York, NY', '{"2024-12-15": [{"room_type": "Standard", "price": "280"}, {"room_type": "Deluxe", "price": "380"}, {"room_type": "Suite", "price": "520"}]}'::jsonb)
) AS v(nombre, ciudad, estrellas, ubicacion, rooms_jsonb)
WHERE NOT EXISTS (SELECT 1 FROM hotels_parallel LIMIT 1);
