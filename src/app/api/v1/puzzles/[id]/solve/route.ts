import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '../../../../../../../lib/prisma';

export async function POST(
    request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const apiKey = request.headers.get('X-API-Key');
    if (apiKey !== process.env.API_KEY) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const puzzleId  = (await params).id;

    if (!puzzleId) {
        return NextResponse.json({ message: 'Bad Request: Could not parse Puzzle ID from the URL.' }, { status: 400 });
    }

    try {
        let body;
        try {
            body = await request.json();
        } catch (_error) {
            return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
        }

        const { moves: userMoves } = body;
        if (!userMoves || !Array.isArray(userMoves) || userMoves.some(m => typeof m !== 'string')) {
            return NextResponse.json({ message: "Bad Request: 'moves' array is missing or invalid." }, { status: 400 });
        }

        const puzzle = await prisma.puzzle.findUnique({
            where: { id: puzzleId },
            select: {
                solution_moves: true,
            },
        });

        if (!puzzle) {
            return NextResponse.json({ message: 'Puzzle not found' }, { status: 404 });
        }

        const correctSolution = puzzle.solution_moves;
        const isCorrect = JSON.stringify(userMoves) === JSON.stringify(correctSolution);

        if (isCorrect) {
            return NextResponse.json({ correct: true, status: 'solved' });
        } else {
            return NextResponse.json({ correct: false, status: 'incorrect_move' });
        }

    } catch (error) {
        console.error(`Error solving puzzle ${puzzleId}:`, error);
        return NextResponse.json({ message: 'Something went wrong' }, { status: 500 });
    }
}
