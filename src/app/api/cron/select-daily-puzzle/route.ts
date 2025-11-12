// src/app/api/cron/select-daily-puzzle/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { kv } from '@vercel/kv';
import { prisma } from '../../../../../lib/prisma';

const DAILY_PUZZLE_MIN_RATING = 1400;
const DAILY_PUZZLE_MAX_RATING = 1800;
const DAILY_PUZZLE_KEY = 'puzzle_of_the_day_id'; // The key we will use in our KV store

export async function GET(request: NextRequest) {
  // 1. Authenticate the Cron Job
  // This is a crucial security step.
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Find a suitable random puzzle from the database (the "heavy work")
    const puzzleCount = await prisma.puzzle.count({
      where: {
        rating: {
          gte: DAILY_PUZZLE_MIN_RATING,
          lte: DAILY_PUZZLE_MAX_RATING,
        },
      },
    });

    if (puzzleCount === 0) {
      throw new Error('No suitable puzzles found in the specified rating range.');
    }

    const skip = Math.floor(Math.random() * puzzleCount);
    const puzzle = await prisma.puzzle.findFirst({
      where: {
        rating: {
          gte: DAILY_PUZZLE_MIN_RATING,
          lte: DAILY_PUZZLE_MAX_RATING,
        },
      },
      skip: skip,
      select: { id: true }, // We only need the ID
    });

    if (!puzzle) {
      throw new Error('Could not select a puzzle.');
    }
    
    // 3. Store the chosen puzzle's ID in Vercel KV
    // The 'set' command will overwrite the previous day's ID.
    await kv.set(DAILY_PUZZLE_KEY, puzzle.id);

    console.log(`Successfully set Puzzle of the Day to: ${puzzle.id}`);
    return NextResponse.json({ message: `Successfully set Puzzle of the Day to: ${puzzle.id}` });

  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json({ message: 'Cron job failed' }, { status: 500 });
  }
}