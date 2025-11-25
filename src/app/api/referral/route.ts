import { NextRequest, NextResponse } from 'next/server';
import { 
  generateReferralCode, 
  useReferralCode, 
  getReferralStats 
} from '@/lib/supabase-points';

/**
 * GET /api/referral?address=0x...
 * Get user referral statistics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const referralStats = await getReferralStats(address);

    return NextResponse.json({
      success: true,
      data: referralStats
    });
  } catch (error: any) {
    console.error('Error fetching referral stats:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/referral
 * Generate referral code or use existing code
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, user_address, referral_code, custom_code, max_uses, expires_at } = body;

    if (action === 'generate') {
      if (!user_address) {
        return NextResponse.json(
          { error: 'user_address is required for generating referral code' },
          { status: 400 }
        );
      }

      const code = await generateReferralCode(
        user_address,
        custom_code,
        max_uses,
        expires_at
      );

      return NextResponse.json({
        success: true,
        data: code
      });
    }

    if (action === 'use') {
      if (!user_address || !referral_code) {
        return NextResponse.json(
          { error: 'user_address and referral_code are required' },
          { status: 400 }
        );
      }

      const referral = await useReferralCode(referral_code, user_address);

      return NextResponse.json({
        success: true,
        data: referral
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "generate" or "use"' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error handling referral:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}