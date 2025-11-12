import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { Prisma } from '@prisma/client';

const MIN_RATING = 0;
const MAX_RATING = 5000;
const MAX_THEMES = 10;

export async function GET(request: NextRequest) {
  if (!process.env.API_KEY) {
    console.error('API_KEY environment variable is not configured');
    return NextResponse.json(
      { message: 'Server configuration error' },
      { status: 500 }
    );
  }

  const apiKey = request.headers.get('X-API-Key');

  if (!apiKey || apiKey !== process.env.API_KEY) {
    return NextResponse.json(
      { message: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const themesParam = searchParams.get('themes');
    const ratingMinParam = searchParams.get('ratingMin');
    const ratingMaxParam = searchParams.get('ratingMax');

    const where: Prisma.PuzzleWhereInput = {};
    const ratingCondition: Prisma.IntFilter = {};

    if (ratingMinParam) {
      const ratingMin = parseInt(ratingMinParam, 10);

      if (isNaN(ratingMin)) {
        return NextResponse.json(
          { message: 'Invalid ratingMin: must be a number' },
          { status: 400 }
        );
      }

      if (ratingMin < MIN_RATING || ratingMin > MAX_RATING) {
        return NextResponse.json(
          { message: `Invalid ratingMin: must be between ${MIN_RATING} and ${MAX_RATING}` },
          { status: 400 }
        );
      }

      ratingCondition.gte = ratingMin;
    }

    if (ratingMaxParam) {
      const ratingMax = parseInt(ratingMaxParam, 10);

      if (isNaN(ratingMax)) {
        return NextResponse.json(
          { message: 'Invalid ratingMax: must be a number' },
          { status: 400 }
        );
      }

      if (ratingMax < MIN_RATING || ratingMax > MAX_RATING) {
        return NextResponse.json(
          { message: `Invalid ratingMax: must be between ${MIN_RATING} and ${MAX_RATING}` },
          { status: 400 }
        );
      }

      if (ratingCondition.gte && ratingMax < ratingCondition.gte) {
        return NextResponse.json(
          { message: 'ratingMax must be greater than or equal to ratingMin' },
          { status: 400 }
        );
      }

      ratingCondition.lte = ratingMax;
    }

    if (Object.keys(ratingCondition).length > 0) {
      where.rating = ratingCondition;
    }

    if (themesParam) {
      const themesArray = themesParam
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      if (themesArray.length > MAX_THEMES) {
        return NextResponse.json(
          { message: `Too many themes specified (maximum ${MAX_THEMES})` },
          { status: 400 }
        );
      }

      if (themesArray.length > 0) {
        // Use AND logic: puzzle must have ALL specified themes
        // Change to OR logic by using: where.themes = { some: { slug: { in: themesArray } } }
        where.AND = themesArray.map(themeSlug => ({
          themes: {
            some: {
              slug: themeSlug,
            },
          },
        }));
      }
    }

    const puzzleIds = await prisma.puzzle.findMany({
      where,
      select: { id: true },
      take: 100,
    });

    if (puzzleIds.length === 0) {
      return NextResponse.json(
        { message: 'No puzzle found matching your criteria' },
        { status: 404 }
      );
    }

    const randomIndex = Math.floor(Math.random() * puzzleIds.length);
    const selectedId = puzzleIds[randomIndex].id;

    const puzzle = await prisma.puzzle.findUnique({
      where: { id: selectedId },
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
      return NextResponse.json(
        { message: 'Could not retrieve puzzle, please try again' },
        { status: 404 }
      );
    }

    const response = NextResponse.json({ data: puzzle });
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=120'
    );

    // Optional: Add CORS headers if API is public
    // response.headers.set('Access-Control-Allow-Origin', '*');
    // response.headers.set('Access-Control-Allow-Methods', 'GET');

    return response;

  } catch (error) {
    console.error('Error fetching random puzzle:', error);

    if (process.env.NODE_ENV === 'development') {
      console.error('Full error details:', error);
    }

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'X-API-Key, Content-Type',
    },
  });
}