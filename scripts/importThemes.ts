// scripts/importThemes.ts
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import csvParser from 'csv-parser';
import unzipper from 'unzipper';

const prisma = new PrismaClient();

async function main() {
  const zipFilePath = 'lichess_db_puzzle.csv.zip';
  const csvFileNameInZip = 'lichess_db_puzzle.csv';
  const allThemes = new Set<string>();

  console.log('Finding all unique themes...');

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(zipFilePath)
      .pipe(unzipper.Parse())
      .on('entry', async (entry) => {
        if (entry.path === csvFileNameInZip) {
          const csvStream = entry.pipe(csvParser());
          for await (const row of csvStream) {
            const themes: string[] = row.Themes.split(' ');
            themes.forEach(theme => allThemes.add(theme));
          }
          resolve(); // We are done with the file
        } else {
          entry.autodrain();
        }
      })
      .on('error', reject);
  });

  console.log(`Found ${allThemes.size} unique themes. Seeding database...`);

  for (const theme of Array.from(allThemes)) {
    await prisma.theme.upsert({
      where: { slug: theme },
      update: {},
      create: {
        slug: theme,
        name: theme.charAt(0).toUpperCase() + theme.slice(1).replace(/([A-Z])/g, ' $1').trim(),
      },
    });
  }

  console.log('Themes seeded successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());