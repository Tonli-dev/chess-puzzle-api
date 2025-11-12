import { PrismaClient, Prisma } from '@prisma/client';
import fs from 'fs';
import csvParser from 'csv-parser';
import unzipper from 'unzipper';

const prisma = new PrismaClient();
const BATCH_SIZE = 500; // Batches of 500 puzzles at a time

interface PuzzleUpdateData {
  fen: string;
  themes: string[];
}

async function processBatch(batch: PuzzleUpdateData[]) {
  const fensInBatch = batch.map(p => p.fen);
  const themesInBatch = new Set(batch.flatMap(p => p.themes));

  const puzzlesInDb = await prisma.puzzle.findMany({
    where: { fen: { in: fensInBatch } },
    select: { id: true, fen: true },
  });

  const themesInDb = await prisma.theme.findMany({
    where: { slug: { in: Array.from(themesInBatch) } },
    select: { id: true, slug: true },
  });

  const fenToIdMap = new Map(puzzlesInDb.map((p: { fen: string; id: string }) => [p.fen, p.id]));
  const slugToIdMap = new Map(themesInDb.map((t: { slug: string; id: number }) => [t.slug, t.id]));

  // 4. Prepare all the database update operations
  // 💡 --- START OF FIX ---
  // Replace 'any' with the specific 'Puzzle' type that the update operation returns.
  const transactionPayload: Prisma.PrismaPromise< Prisma.PuzzleUpdateInput>[] = [];
  // 💡 --- END OF FIX ---

  for (const puzzleData of batch) {
    const puzzleId = fenToIdMap.get(puzzleData.fen);
    if (!puzzleId) continue;

    const themeIdsToConnect = puzzleData.themes
      .map(slug => slugToIdMap.get(slug))
      .filter((id): id is number => id !== undefined);

    if (themeIdsToConnect.length > 0) {
      transactionPayload.push(
        prisma.puzzle.update({
          where: { id: puzzleId },
          data: {
            themes: {
              connect: themeIdsToConnect.map(id => ({ id })),
            },
          },
        })
      );
    }
  }

  // 5. Execute all updates for this batch in a single transaction
  if (transactionPayload.length > 0) {
    await prisma.$transaction(transactionPayload);
  }
}


async function main() {
  const zipFilePath = 'lichess_db_puzzle.csv.zip'; // Make sure this path is correct
  const csvFileNameInZip = 'lichess_db_puzzle.csv';

  let puzzleBatch: PuzzleUpdateData[] = [];
  let totalProcessed = 0;

  console.log(`Starting theme connection from ${zipFilePath}...`);

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(zipFilePath)
      .pipe(unzipper.Parse())
      .on('entry', async (entry) => {
        if (entry.path === csvFileNameInZip) {
          const csvStream = entry.pipe(csvParser());
          for await (const row of csvStream) {
            if (!row.FEN || !row.Themes) continue;

            puzzleBatch.push({
              fen: row.FEN,
              themes: row.Themes.split(' ').filter(Boolean), // Filter out empty strings
            });

            if (puzzleBatch.length >= BATCH_SIZE) {
              await processBatch(puzzleBatch);
              totalProcessed += puzzleBatch.length;
              console.log(`Processed ${totalProcessed} total puzzles...`);
              puzzleBatch = []; // Reset the batch
            }
          }
          // The file stream has ended for this entry
          resolve();
        } else {
          entry.autodrain();
        }
      })
      .on('error', reject);
  });

  // Process any remaining puzzles in the last batch
  if (puzzleBatch.length > 0) {
    await processBatch(puzzleBatch);
    totalProcessed += puzzleBatch.length;
    console.log(`Processed final batch. Total puzzles: ${totalProcessed}.`);
  }

  console.log('Theme connection finished!');
}

main()
  .catch((e) => {
    console.error('An error occurred during the theme connection process:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });