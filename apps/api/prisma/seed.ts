import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/auth/password';

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
      // Dev only : seed local, jamais utilisé en prod.
      passwordHash: await hashPassword('devpassword'),
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

  // Un salon par type, sinon le shell est vide une fois connecté et rien de
  // M3/M4/M5 n'est atteignable (aucun endpoint de création de group/salon
  // n'est exposé au premier lancement).
  const channels = [
    { id: '00000000-0000-0000-0000-000000000010', name: 'général', type: 'text' as const },
    {
      id: '00000000-0000-0000-0000-000000000011',
      name: 'mot-du-jour',
      type: 'word_of_day' as const,
    },
    { id: '00000000-0000-0000-0000-000000000012', name: 'mèmes', type: 'memes' as const },
  ];

  for (const [position, channel] of channels.entries()) {
    await prisma.channel.upsert({
      where: { id: channel.id },
      update: {},
      create: { ...channel, groupId: group.id, position },
    });
  }

  console.log(
    `Seed OK : group "${group.name}" (${group.id}), owner "${owner.displayName}" (${owner.id}), ` +
      `salons ${channels.map((channel) => `#${channel.name}`).join(', ')}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
