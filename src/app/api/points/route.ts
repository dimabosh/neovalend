import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPoints, awardPoints, getPointsHistory } from '@/lib/supabase-points';

/**
 * GET /api/points?address=0x...
 * Get user points information
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

    const userData = await getUserWithPoints(address);
    const pointsHistory = await getPointsHistory(address, 20);

    return NextResponse.json({
      success: true,
      data: {
        user: userData,
        recent_transactions: pointsHistory
      }
    });
  } catch (error: any) {
    console.error('Error fetching points:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/points
 * Award points to user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_address, category, points, activity_type, usd_value, tx_hash } = body;

    if (!user_address || !category || !points) {
      return NextResponse.json(
        { error: 'Missing required fields: user_address, category, points' },
        { status: 400 }
      );
    }

    const result = await awardPoints(
      user_address,
      category,
      points,
      activity_type,
      usd_value,
      tx_hash
    );

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Error awarding points:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}