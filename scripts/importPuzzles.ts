// scripts/importPuzzles.ts
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import csvParser from 'csv-parser';
import unzipper from 'unzipper';

interface PuzzleData {
  fen: string;
  solution_moves: string[];
  rating: number;
}

const prisma = new PrismaClient();
const BATCH_SIZE = 1000;

async function main() {
  // IMPORTANT: Update these paths to match your file names
  const zipFilePath = 'lichess_db_puzzle.csv.zip';
  const csvFileNameInZip = 'lichess_db_puzzle.csv';

  let puzzleBatch: PuzzleData[] = [];
  let counter = 0;

  console.log(`Starting puzzle import from ${zipFilePath}...`);

  // Create a stream to read the ZIP file from your disk
  const readStream = fs.createReadStream(zipFilePath);

  // Create a promise to handle the asynchronous stream processing
  await new Promise((resolve, reject) => {
    readStream
      // Pipe the ZIP file stream into the unzipper parser
      .pipe(unzipper.Parse())
      .on('entry', async (entry) => {
        // For each file found inside the ZIP archive...
        if (entry.path === csvFileNameInZip) {
          // This is the CSV file we want.
          console.log(`Found ${csvFileNameInZip}, starting to process rows...`);

          // Pipe the file's contents (decompressed on the fly) into the CSV parser
          const csvStream = entry.pipe(csvParser());

          // Process each row as it's parsed
          for await (const row of csvStream) {
            if (!row.FEN || !row.Moves || !row.Rating) {
              continue; // Skip any malformed rows
            }

            const puzzleData: PuzzleData = {
              fen: row.FEN,
              solution_moves: row.Moves.split(' '),
              rating: parseInt(row.Rating, 10),
            };
            puzzleBatch.push(puzzleData);
            counter++;

            // When the batch is full, insert it into the database
            if (puzzleBatch.length === BATCH_SIZE) {
              await prisma.puzzle.createMany({ data: puzzleBatch, skipDuplicates: true });
              console.log(`Inserted ${counter} total puzzles...`);
              puzzleBatch = []; // Reset the batch
            }
          }
        } else {
          // This is not the file we want (e.g., __MACOSX folders), so discard it.
          entry.autodrain();
        }
      })
      .on('finish', resolve) // The 'finish' event means we've processed the whole ZIP archive
      .on('error', reject); // Handle any errors during ZIP parsing
  });

  // Insert any remaining puzzles from the final batch
  if (puzzleBatch.length > 0) {
    await prisma.puzzle.createMany({ data: puzzleBatch, skipDuplicates: true });
    console.log(`Inserted final batch. Total puzzles: ${counter}.`);
  }

  console.log('Puzzle import finished!');
}

main()
  .catch((e) => {
    console.error('An error occurred during the import process:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });