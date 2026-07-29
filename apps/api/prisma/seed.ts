import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const group = await prisma.group.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Dev Group',
    },
  });

  const owner = await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      displayName: 'Dev Owner',
      nativeLang: 'fr',
    },
  });

  await prisma.membership.upsert({
    where: { groupId_userId: { groupId: group.id, userId: owner.id } },
    update: {},
    create: {
      groupId: group.id,
      userId: owner.id,
      role: 'owner',
    },
  });

  console.log(`Seed OK : group "${group.name}" (${group.id}), owner "${owner.displayName}" (${owner.id})`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
