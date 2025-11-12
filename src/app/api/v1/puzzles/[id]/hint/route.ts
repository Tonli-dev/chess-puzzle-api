import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '../../../../../../../lib/prisma';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const apiKey = request.headers.get('X-API-Key');
    if (apiKey !== process.env.API_KEY) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const puzzleId = (await params).id;

    if (!puzzleId) {
        return NextResponse.json({ message: 'Bad Request: Could not parse Puzzle ID from the URL.' }, { status: 400 });
    }

    try {
        let body;
        try {
            body = await request.json();
        } catch (error) {
            return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
        }

        const playedMoves = body.played_moves;
        if (!playedMoves || !Array.isArray(playedMoves)) {
            return NextResponse.json({ message: "Bad Request: 'played_moves' array is missing or invalid." }, { status: 400 });
        }

        const puzzle = await prisma.puzzle.findUnique({
            where: { id: puzzleId },
            select: { solution_moves: true },
        });

        if (!puzzle) {
            return NextResponse.json({ message: 'Puzzle not found' }, { status: 404 });
        }

        const correctSolution = puzzle.solution_moves;

        if (playedMoves.length === 0) {
            return NextResponse.json({ hint: correctSolution[0] });
        }

        for (let i = 0; i < playedMoves.length; i++) {
            if (playedMoves[i] !== correctSolution[i]) {
                return NextResponse.json({ message: 'Invalid sequence of played moves.' }, { status: 400 });
            }
        }

        if (playedMoves.length >= correctSolution.length) {
            return NextResponse.json({ message: 'Puzzle is already solved, no more hints available.' });
        }

        const nextMove = correctSolution[playedMoves.length];

        return NextResponse.json({ hint: nextMove });

    } catch (error) {
        console.error(`Error getting hint for puzzle ${puzzleId}:`, error);
        return NextResponse.json({ message: 'Something went wrong' }, { status: 500 });
    }
}