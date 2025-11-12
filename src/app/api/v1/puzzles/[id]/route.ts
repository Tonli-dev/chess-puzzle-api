import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;
    const apiKey = request.headers.get('X-API-Key');
    if (!process.env.API_KEY) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 500 });
    }

    if (!apiKey || apiKey !== process.env.API_KEY) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const puzzle = await prisma.puzzle.findUnique({
            where: { id: id },
        });

        if (!puzzle) {
            return NextResponse.json({ message: 'Puzzle not found' }, { status: 404 });
        }

        return NextResponse.json({ data: puzzle });
    } catch (error) {
        return NextResponse.json({ message: 'Something went wrong' }, { status: 500 });
    }
}