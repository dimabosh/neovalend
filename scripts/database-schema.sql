-- RubleN Protocol Database Schema Extensions
-- Adds referral system and enhanced points management

-- ============================================
-- 1. REFERRAL SYSTEM TABLES
-- ============================================

-- Referral codes table
CREATE TABLE IF NOT EXISTS referral_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    user_address VARCHAR(42) NOT NULL REFERENCES users(address),
    max_uses INTEGER DEFAULT NULL, -- NULL = unlimited
    current_uses INTEGER DEFAULT 0,
    expires_at TIMESTAMP DEFAULT NULL, -- NULL = no expiry
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Referral relationships table
CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referrer_address VARCHAR(42) NOT NULL REFERENCES users(address),
    referred_address VARCHAR(42) NOT NULL REFERENCES users(address),
    referral_code VARCHAR(20) REFERENCES referral_codes(code),
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, completed
    total_points_earned DECIMAL(18,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(referrer_address, referred_address)
);

-- ============================================
-- 2. ENHANCED POINTS SYSTEM
-- ============================================

-- Points balances by category
CREATE TABLE IF NOT EXISTS user_point_balances (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(42) NOT NULL REFERENCES users(address),
    category VARCHAR(20) NOT NULL, -- 'deposit', 'borrow', 'swap', 'liquidate', 'wrap', 'referral'
    balance DECIMAL(18,2) DEFAULT 0,
    lifetime_earned DECIMAL(18,2) DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_address, category)
);

-- Daily points summary for analytics
CREATE TABLE IF NOT EXISTS daily_points_summary (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    user_address VARCHAR(42) NOT NULL REFERENCES users(address),
    deposit_points DECIMAL(18,2) DEFAULT 0,
    borrow_points DECIMAL(18,2) DEFAULT 0,
    swap_points DECIMAL(18,2) DEFAULT 0,
    liquidation_points DECIMAL(18,2) DEFAULT 0,
    wrap_points DECIMAL(18,2) DEFAULT 0,
    referral_points DECIMAL(18,2) DEFAULT 0,
    total_daily_points DECIMAL(18,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(date, user_address)
);

-- ============================================
-- 3. ACTIVITY TRACKING
-- ============================================

-- User activity log
CREATE TABLE IF NOT EXISTS user_activities (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(42) NOT NULL REFERENCES users(address),
    activity_type VARCHAR(30) NOT NULL, -- 'deposit', 'withdraw', 'borrow', 'repay', 'swap', 'liquidate', 'wrap', 'unwrap'
    token_address VARCHAR(42),
    amount DECIMAL(18,6),
    usd_value DECIMAL(18,2),
    tx_hash VARCHAR(66),
    block_number BIGINT,
    gas_used INTEGER,
    points_earned DECIMAL(18,2) DEFAULT 0,
    metadata JSONB, -- Additional activity-specific data
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 4. POINTS MULTIPLIERS & CAMPAIGNS
-- ============================================

-- Points multipliers for different activities
CREATE TABLE IF NOT EXISTS points_multipliers (
    id SERIAL PRIMARY KEY,
    activity_type VARCHAR(30) NOT NULL,
    base_rate DECIMAL(10,4) NOT NULL, -- Points per $100
    multiplier DECIMAL(4,2) DEFAULT 1.0, -- Current multiplier
    min_amount DECIMAL(18,6) DEFAULT 0,
    max_daily_points DECIMAL(18,2) DEFAULT NULL, -- NULL = unlimited
    is_active BOOLEAN DEFAULT true,
    valid_from TIMESTAMP DEFAULT NOW(),
    valid_until TIMESTAMP DEFAULT NULL, -- NULL = permanent
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Seasonal campaigns/events
CREATE TABLE IF NOT EXISTS points_campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    campaign_type VARCHAR(20) NOT NULL, -- 'bonus', 'multiplier', 'referral_boost'
    target_activity VARCHAR(30), -- NULL = all activities
    bonus_points DECIMAL(18,2) DEFAULT 0,
    multiplier DECIMAL(4,2) DEFAULT 1.0,
    min_amount DECIMAL(18,6) DEFAULT 0,
    max_participants INTEGER DEFAULT NULL, -- NULL = unlimited
    current_participants INTEGER DEFAULT 0,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User participation in campaigns
CREATE TABLE IF NOT EXISTS campaign_participants (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES points_campaigns(id),
    user_address VARCHAR(42) NOT NULL REFERENCES users(address),
    points_earned DECIMAL(18,2) DEFAULT 0,
    activities_completed INTEGER DEFAULT 0,
    joined_at TIMESTAMP DEFAULT NOW(),
    last_activity TIMESTAMP DEFAULT NOW(),
    UNIQUE(campaign_id, user_address)
);

-- ============================================
-- 5. INDEXES FOR PERFORMANCE
-- ============================================

-- Referral system indexes
CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes(user_address);
CREATE INDEX IF NOT EXISTS idx_referral_codes_active ON referral_codes(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_address);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_address);

-- Points system indexes
CREATE INDEX IF NOT EXISTS idx_user_point_balances_user ON user_point_balances(user_address);
CREATE INDEX IF NOT EXISTS idx_user_point_balances_category ON user_point_balances(category);
CREATE INDEX IF NOT EXISTS idx_daily_points_date ON daily_points_summary(date);
CREATE INDEX IF NOT EXISTS idx_daily_points_user ON daily_points_summary(user_address);

-- Activity tracking indexes
CREATE INDEX IF NOT EXISTS idx_user_activities_user ON user_activities(user_address);
CREATE INDEX IF NOT EXISTS idx_user_activities_type ON user_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activities_tx ON user_activities(tx_hash);
CREATE INDEX IF NOT EXISTS idx_user_activities_created ON user_activities(created_at);

-- Campaign indexes
CREATE INDEX IF NOT EXISTS idx_points_multipliers_activity ON points_multipliers(activity_type, is_active);
CREATE INDEX IF NOT EXISTS idx_points_campaigns_active ON points_campaigns(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_campaign_participants_campaign ON campaign_participants(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_participants_user ON campaign_participants(user_address);

-- ============================================
-- 6. FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update user total points when point balances change
CREATE OR REPLACE FUNCTION update_user_total_points()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users 
    SET total_points = (
        SELECT COALESCE(SUM(balance), 0) 
        FROM user_point_balances 
        WHERE user_address = NEW.user_address
    ),
    updated_at = NOW()
    WHERE address = NEW.user_address;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update total points
DROP TRIGGER IF EXISTS trigger_update_total_points ON user_point_balances;
CREATE TRIGGER trigger_update_total_points
    AFTER INSERT OR UPDATE ON user_point_balances
    FOR EACH ROW
    EXECUTE FUNCTION update_user_total_points();

-- Function to award points and handle referrals
CREATE OR REPLACE FUNCTION award_points(
    p_user_address VARCHAR(42),
    p_category VARCHAR(20),
    p_points DECIMAL(18,2),
    p_activity_type VARCHAR(30) DEFAULT NULL,
    p_usd_value DECIMAL(18,2) DEFAULT NULL,
    p_tx_hash VARCHAR(66) DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    referrer_address VARCHAR(42);
    referral_points DECIMAL(18,2);
BEGIN
    -- Insert/Update user points balance
    INSERT INTO user_point_balances (user_address, category, balance, lifetime_earned)
    VALUES (p_user_address, p_category, p_points, p_points)
    ON CONFLICT (user_address, category)
    DO UPDATE SET 
        balance = user_point_balances.balance + p_points,
        lifetime_earned = user_point_balances.lifetime_earned + p_points,
        last_updated = NOW();
    
    -- Record the points transaction
    INSERT INTO points_transactions (user_address, amount, type, source_tx_hash)
    VALUES (p_user_address, p_points, p_category, p_tx_hash);
    
    -- Handle referral bonus (10% to referrer)
    SELECT referrer_address INTO referrer_address
    FROM referrals 
    WHERE referred_address = p_user_address AND status = 'active'
    LIMIT 1;
    
    IF referrer_address IS NOT NULL THEN
        referral_points := p_points * 0.1; -- 10% referral bonus
        
        -- Award referral points to referrer
        INSERT INTO user_point_balances (user_address, category, balance, lifetime_earned)
        VALUES (referrer_address, 'referral', referral_points, referral_points)
        ON CONFLICT (user_address, category)
        DO UPDATE SET 
            balance = user_point_balances.balance + referral_points,
            lifetime_earned = user_point_balances.lifetime_earned + referral_points,
            last_updated = NOW();
        
        -- Record referral transaction
        INSERT INTO points_transactions (user_address, amount, type, source_tx_hash)
        VALUES (referrer_address, referral_points, 'referral', p_tx_hash);
        
        -- Update referral statistics
        UPDATE referrals 
        SET total_points_earned = total_points_earned + referral_points,
            updated_at = NOW()
        WHERE referrer_address = referrer_address AND referred_address = p_user_address;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. DEFAULT DATA
-- ============================================

-- Insert default points multipliers
INSERT INTO points_multipliers (activity_type, base_rate, multiplier) VALUES
('deposit', 1.0, 1.0),      -- 1 point per $100 deposited
('borrow', 0.5, 1.0),       -- 0.5 points per $100 borrowed
('swap', 0.1, 1.0),         -- 0.1 points per $100 swapped
('liquidate', 0.25, 1.0),   -- 0.25 points per $100 liquidated
('wrap', 0.1, 1.0),         -- 0.1 points per $100 wrapped
('liquidity', 0.2, 1.0)     -- 0.2 points per $100 liquidity added
ON CONFLICT DO NOTHING;

-- ============================================
-- 8. VIEWS FOR ANALYTICS
-- ============================================

-- User leaderboard view
CREATE OR REPLACE VIEW user_leaderboard AS
SELECT 
    u.address,
    u.total_points,
    u.created_at as join_date,
    COALESCE(r.referral_count, 0) as referrals_made,
    COALESCE(r.referral_points, 0) as points_from_referrals,
    RANK() OVER (ORDER BY u.total_points DESC) as rank
FROM users u
LEFT JOIN (
    SELECT 
        referrer_address,
        COUNT(*) as referral_count,
        SUM(total_points_earned) as referral_points
    FROM referrals
    WHERE status = 'active'
    GROUP BY referrer_address
) r ON u.address = r.referrer_address
ORDER BY u.total_points DESC;

-- Daily protocol activity view
CREATE OR REPLACE VIEW daily_protocol_activity AS
SELECT 
    DATE(created_at) as activity_date,
    activity_type,
    COUNT(*) as transaction_count,
    COUNT(DISTINCT user_address) as unique_users,
    SUM(usd_value) as total_volume_usd,
    SUM(points_earned) as total_points_awarded
FROM user_activities
GROUP BY DATE(created_at), activity_type
ORDER BY activity_date DESC, activity_type;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;