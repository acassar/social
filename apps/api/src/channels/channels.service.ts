import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ChannelDto,
  ChannelType,
  CreateChannelRequestDto,
  UpdateChannelRequestDto,
} from '@social/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(groupId: string, dto: CreateChannelRequestDto): Promise<ChannelDto> {
    const channel = await this.prisma.channel.create({
      data: {
        groupId,
        name: dto.name,
        type: dto.type,
        position: dto.position,
      },
    });
    return this.toDto(channel);
  }

  async list(groupId: string): Promise<ChannelDto[]> {
    const channels = await this.prisma.channel.findMany({
      where: { groupId },
      orderBy: { position: 'asc' },
    });
    return channels.map((channel) => this.toDto(channel));
  }

  async update(
    groupId: string,
    channelId: string,
    dto: UpdateChannelRequestDto,
  ): Promise<ChannelDto> {
    await this.assertBelongsToGroup(groupId, channelId);
    const channel = await this.prisma.channel.update({
      where: { id: channelId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
      },
    });
    return this.toDto(channel);
  }

  async remove(groupId: string, channelId: string): Promise<void> {
    await this.assertBelongsToGroup(groupId, channelId);
    await this.prisma.channel.delete({ where: { id: channelId } });
  }

  private async assertBelongsToGroup(groupId: string, channelId: string): Promise<void> {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel || channel.groupId !== groupId) {
      throw new NotFoundException('Salon introuvable dans ce group');
    }
  }

  private toDto(channel: {
    id: string;
    groupId: string;
    name: string;
    type: string;
    position: number;
    createdAt: Date;
  }): ChannelDto {
    return {
      id: channel.id,
      groupId: channel.groupId,
      name: channel.name,
      type: channel.type as ChannelType,
      position: channel.position,
      createdAt: channel.createdAt.toISOString(),
    };
  }
}
