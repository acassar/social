import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  NativeLang,
  PostDto,
  PostsPageDto,
  TextPostDto,
  UpdateTextPostRequestDto,
} from '@social/shared';
import type { CreatePostDto } from './dto/create-post.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
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
  wordEntry: { term: string; lang: string; translation: string; note: string | null } | null;
  attachments: {
    url: string;
    thumbUrl: string | null;
    mime: string;
    width: number | null;
    height: number | null;
  }[];
}

const POST_INCLUDE = { textMessage: true, wordEntry: true, attachments: true } as const;

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeEvents: RealtimeEventsService,
    private readonly pushService: PushService,
  ) {}

  // Fire-and-forget : PushService ne rejette jamais (elle catch en interne),
  // mais on ne veut de toute façon jamais bloquer/faire échouer la création
  // d'un post à cause de l'envoi de notifications.
  private notifyChannelPost(channelId: string, authorId: string, post: PostDto): void {
    void this.pushService.notifyChannelPost(channelId, authorId, post);
  }

  async create(channelId: string, authorId: string, dto: CreatePostDto): Promise<PostDto> {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new NotFoundException('Salon introuvable');
    }

    if (channel.type === 'text') {
      if (!dto.body) {
        throw new BadRequestException('body requis pour un salon de type text');
      }
      const post = await this.prisma.post.create({
        data: { channelId, authorId, type: 'text', textMessage: { create: { body: dto.body } } },
        include: POST_INCLUDE,
      });
      const result = this.toDto(post);
      this.realtimeEvents.emitPostCreated(channelId, { post: result });
      this.notifyChannelPost(channelId, authorId, result);
      return result;
    }

    if (channel.type === 'word_of_day') {
      if (!dto.term || !dto.lang || !dto.translation) {
        throw new BadRequestException(
          'term, lang et translation sont requis pour un salon de type word_of_day',
        );
      }
      const post = await this.prisma.post.create({
        data: {
          channelId,
          authorId,
          type: 'word_of_day',
          wordEntry: {
            create: {
              term: dto.term,
              lang: dto.lang,
              translation: dto.translation,
              note: dto.note ?? null,
            },
          },
        },
        include: POST_INCLUDE,
      });
      const result = this.toDto(post);
      this.realtimeEvents.emitPostCreated(channelId, { post: result });
      this.notifyChannelPost(channelId, authorId, result);
      return result;
    }

    if (channel.type === 'memes') {
      if (!dto.url || !dto.mime) {
        throw new BadRequestException('url et mime sont requis pour un salon de type memes');
      }
      const post = await this.prisma.post.create({
        data: {
          channelId,
          authorId,
          type: 'memes',
          attachments: {
            create: {
              url: dto.url,
              thumbUrl: dto.thumbUrl ?? null,
              mime: dto.mime,
              width: dto.width ?? null,
              height: dto.height ?? null,
            },
          },
          ...(dto.body ? { textMessage: { create: { body: dto.body } } } : {}),
        },
        include: POST_INCLUDE,
      });
      const result = this.toDto(post);
      this.realtimeEvents.emitPostCreated(channelId, { post: result });
      this.notifyChannelPost(channelId, authorId, result);
      return result;
    }

    throw new BadRequestException("Ce salon n'accepte pas encore la création de post");
  }

  async list(channelId: string, cursor: string | undefined, limit: number): Promise<PostsPageDto> {
    const posts = await this.prisma.post.findMany({
      where: { channelId, deletedAt: null },
      include: POST_INCLUDE,
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
    const existing = await this.findOwnedPost(channelId, postId, requesterId);
    if (existing.type !== 'text') {
      throw new BadRequestException("L'édition n'est supportée que pour les messages texte");
    }

    const post = await this.prisma.post.update({
      where: { id: postId },
      data: { editedAt: new Date(), textMessage: { update: { body: dto.body } } },
      include: POST_INCLUDE,
    });

    const result = this.toDto(post) as TextPostDto;
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
      include: POST_INCLUDE,
    });
    if (!post || post.channelId !== channelId || post.deletedAt) {
      throw new NotFoundException('Message introuvable dans ce salon');
    }
    if (post.authorId !== requesterId) {
      throw new ForbiddenException("Seul l'auteur peut modifier ce message");
    }
    return post;
  }

  private toDto(post: PostRow): PostDto {
    const base = {
      id: post.id,
      channelId: post.channelId,
      authorId: post.authorId,
      createdAt: post.createdAt.toISOString(),
      editedAt: post.editedAt ? post.editedAt.toISOString() : null,
      deletedAt: post.deletedAt ? post.deletedAt.toISOString() : null,
    };

    if (post.type === 'word_of_day' && post.wordEntry) {
      return {
        ...base,
        type: 'word_of_day',
        term: post.wordEntry.term,
        lang: post.wordEntry.lang as NativeLang,
        translation: post.wordEntry.translation,
        note: post.wordEntry.note,
      };
    }

    if (post.type === 'memes' && post.attachments[0]) {
      const attachment = post.attachments[0];
      return {
        ...base,
        type: 'memes',
        attachment: {
          url: attachment.url,
          thumbUrl: attachment.thumbUrl,
          mime: attachment.mime,
          width: attachment.width,
          height: attachment.height,
        },
        caption: post.textMessage?.body ?? null,
      };
    }

    return {
      ...base,
      type: 'text',
      body: post.textMessage?.body ?? '',
    };
  }
}
