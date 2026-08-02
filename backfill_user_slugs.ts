import { PrismaClient } from "@prisma/client";
import { generateUniqueUserSlug } from "./lib/slugs";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting user slug backfill...");

  const users = await prisma.user.findMany({
    where: {
      slug: null,
    },
  });

  console.log(`Found ${users.length} users without a slug.`);

  for (const user of users) {
    const slug = await generateUniqueUserSlug(prisma, user.name, user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { slug },
    });
    console.log(`Backfilled user ${user.name} (${user.id}) with slug: ${slug}`);
  }

  console.log("Backfill complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
