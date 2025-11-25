import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/supabase-points';

/**
 * GET /api/leaderboard?limit=100
 * Get points leaderboard
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');

    const leaderboard = await getLeaderboard(limit);

    return NextResponse.json({
      success: true,
      data: {
        leaderboard,
        total_users: leaderboard?.length || 0
      }
    });
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}