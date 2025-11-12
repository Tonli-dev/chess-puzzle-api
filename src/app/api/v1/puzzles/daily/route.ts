import { NextResponse, NextRequest } from 'next/server';
import { kv } from '@vercel/kv';
import { prisma } from '../../../../../../lib/prisma';

const DAILY_PUZZLE_KEY = 'puzzle_of_the_day_id';

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key');
  if (apiKey !== process.env.API_KEY) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const puzzleId = await kv.get<string>(DAILY_PUZZLE_KEY);

    if (!puzzleId) {
      return NextResponse.json({ message: 'Puzzle of the Day has not been set yet. Please check back later.' }, { status: 404 });
    }

    const puzzle = await prisma.puzzle.findUnique({
      where: { id: puzzleId },
      include: {
        themes: {
          select: {
            slug: true,
            name: true,
          },
        },
      },
    });

    if (!puzzle) {
      return NextResponse.json({ message: 'Could not retrieve the daily puzzle.' }, { status: 500 });
    }

    return NextResponse.json({ data: puzzle });

  } catch (error) {
    console.error('Error fetching daily puzzle:', error);
    return NextResponse.json({ message: 'Something went wrong' }, { status: 500 });
  }
}