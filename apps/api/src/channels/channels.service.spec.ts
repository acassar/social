jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { ChannelsService } from './channels.service';

function createService(prismaMock: Record<string, unknown>): ChannelsService {
  return new ChannelsService(prismaMock as unknown as PrismaService);
}

const CHANNEL_ROW = {
  id: 'channel-1',
  groupId: 'group-1',
  name: 'général',
  type: 'text',
  position: 0,
  createdAt: new Date('2026-07-30T00:00:00.000Z'),
};

describe('ChannelsService.create', () => {
  it('crée un salon du type demandé et le renvoie', async () => {
    const create = jest.fn().mockResolvedValue(CHANNEL_ROW);
    const prismaMock = { channel: { create } };

    const result = await createService(prismaMock).create('group-1', {
      name: 'général',
      type: 'text',
      position: 0,
    });

    expect(create).toHaveBeenCalledWith({
      data: { groupId: 'group-1', name: 'général', type: 'text', position: 0 },
    });
    expect(result).toEqual({
      id: 'channel-1',
      groupId: 'group-1',
      name: 'général',
      type: 'text',
      position: 0,
      createdAt: '2026-07-30T00:00:00.000Z',
    });
  });
});

describe('ChannelsService.list', () => {
  it("liste les salons d'un group, triés par position", async () => {
    const findMany = jest.fn().mockResolvedValue([CHANNEL_ROW]);
    const prismaMock = { channel: { findMany } };

    const result = await createService(prismaMock).list('group-1');

    expect(findMany).toHaveBeenCalledWith({
      where: { groupId: 'group-1' },
      orderBy: { position: 'asc' },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'channel-1', type: 'text' });
  });
});

describe('ChannelsService.update', () => {
  it('met à jour un salon appartenant au group', async () => {
    const findUnique = jest.fn().mockResolvedValue(CHANNEL_ROW);
    const update = jest.fn().mockResolvedValue({ ...CHANNEL_ROW, name: 'nouveau-nom' });
    const prismaMock = { channel: { findUnique, update } };

    const result = await createService(prismaMock).update('group-1', 'channel-1', {
      name: 'nouveau-nom',
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'channel-1' },
      data: { name: 'nouveau-nom' },
    });
    expect(result.name).toBe('nouveau-nom');
  });

  it("rejette (404) un salon inexistant ou n'appartenant pas au group", async () => {
    const findUnique = jest.fn().mockResolvedValue({ ...CHANNEL_ROW, groupId: 'other-group' });
    const update = jest.fn();
    const prismaMock = { channel: { findUnique, update } };

    await expect(
      createService(prismaMock).update('group-1', 'channel-1', { name: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('ChannelsService.remove', () => {
  it('supprime un salon appartenant au group', async () => {
    const findUnique = jest.fn().mockResolvedValue(CHANNEL_ROW);
    const deleteMock = jest.fn().mockResolvedValue(CHANNEL_ROW);
    const prismaMock = { channel: { findUnique, delete: deleteMock } };

    await createService(prismaMock).remove('group-1', 'channel-1');

    expect(deleteMock).toHaveBeenCalledWith({ where: { id: 'channel-1' } });
  });

  it("rejette (404) un salon inexistant ou n'appartenant pas au group", async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const deleteMock = jest.fn();
    const prismaMock = { channel: { findUnique, delete: deleteMock } };

    await expect(createService(prismaMock).remove('group-1', 'channel-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
