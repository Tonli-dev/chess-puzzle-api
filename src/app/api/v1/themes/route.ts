import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export async function GET(request: NextRequest) {
    const apiKey = request.headers.get('X-API-Key');
    if (!process.env.API_KEY) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 500 });
    }

    if (!apiKey || apiKey !== process.env.API_KEY) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const themes = await prisma.theme.findMany({
            orderBy: { name: 'asc' },
        });
        return NextResponse.json({ data: themes });
    } catch (error) {
        return NextResponse.json({ message: 'Something went wrong' }, { status: 500 });
    }
}