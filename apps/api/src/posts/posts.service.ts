import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateTextPostRequestDto,
  PostsPageDto,
  TextPostDto,
  UpdateTextPostRequestDto,
} from '@social/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';

interface PostRow {
  id: string;
  channelId: string;
  authorId: string;
  type: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  textMessage: { body: string } | null;
}

const TEXT_MESSAGE_INCLUDE = { textMessage: true } as const;

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  async createTextPost(
    channelId: string,
    authorId: string,
    dto: CreateTextPostRequestDto,
  ): Promise<TextPostDto> {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new NotFoundException('Salon introuvable');
    }
    if (channel.type !== 'text') {
      throw new BadRequestException("Ce salon n'accepte pas les messages texte");
    }

    const post = await this.prisma.post.create({
      data: {
        channelId,
        authorId,
        type: 'text',
        textMessage: { create: { body: dto.body } },
      },
      include: TEXT_MESSAGE_INCLUDE,
    });

    const result = this.toDto(post);
    this.realtimeEvents.emitPostCreated(channelId, { post: result });
    return result;
  }

  async list(channelId: string, cursor: string | undefined, limit: number): Promise<PostsPageDto> {
    const posts = await this.prisma.post.findMany({
      where: { channelId, deletedAt: null },
      include: TEXT_MESSAGE_INCLUDE,
      orderBy: { createdAt: 'asc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = posts.length > limit;
    const page = hasMore ? posts.slice(0, limit) : posts;

    return {
      posts: page.map((post) => this.toDto(post)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async update(
    channelId: string,
    postId: string,
    requesterId: string,
    dto: UpdateTextPostRequestDto,
  ): Promise<TextPostDto> {
    await this.findOwnedPost(channelId, postId, requesterId);

    const post = await this.prisma.post.update({
      where: { id: postId },
      data: { editedAt: new Date(), textMessage: { update: { body: dto.body } } },
      include: TEXT_MESSAGE_INCLUDE,
    });

    const result = this.toDto(post);
    this.realtimeEvents.emitPostUpdated(channelId, { post: result });
    return result;
  }

  async remove(channelId: string, postId: string, requesterId: string): Promise<void> {
    await this.findOwnedPost(channelId, postId, requesterId);

    await this.prisma.post.update({ where: { id: postId }, data: { deletedAt: new Date() } });
    this.realtimeEvents.emitPostDeleted(channelId, { postId, channelId });
  }

  private async findOwnedPost(
    channelId: string,
    postId: string,
    requesterId: string,
  ): Promise<PostRow> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: TEXT_MESSAGE_INCLUDE,
    });
    if (!post || post.channelId !== channelId || post.deletedAt) {
      throw new NotFoundException('Message introuvable dans ce salon');
    }
    if (post.authorId !== requesterId) {
      throw new ForbiddenException("Seul l'auteur peut modifier ce message");
    }
    return post;
  }

  private toDto(post: PostRow): TextPostDto {
    return {
      id: post.id,
      channelId: post.channelId,
      authorId: post.authorId,
      type: 'text',
      body: post.textMessage?.body ?? '',
      createdAt: post.createdAt.toISOString(),
      editedAt: post.editedAt ? post.editedAt.toISOString() : null,
      deletedAt: post.deletedAt ? post.deletedAt.toISOString() : null,
    };
  }
}
