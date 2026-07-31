import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { PostDto, PostsPageDto, TextPostDto } from '@social/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { CurrentUserPayload } from '../auth/jwt-payload';
import { ChannelMemberGuard } from '../channels/channel-member.guard';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { UpdateTextPostDto } from './dto/update-text-post.dto';
import { PostsService } from './posts.service';

// Posts d'un salon `text` (M3-T1) ou `word_of_day` (M4-T1) : lecture/écriture
// réservées aux membres du group auquel le salon appartient (ChannelMemberGuard) ;
// édition/suppression en plus réservées à l'auteur du post (vérifié dans PostsService).
@Controller('channels/:id/posts')
@UseGuards(JwtAuthGuard, ChannelMemberGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  list(@Param('id') channelId: string, @Query() query: ListPostsQueryDto): Promise<PostsPageDto> {
    return this.postsService.list(channelId, query.cursor, query.limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('id') channelId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreatePostDto,
  ): Promise<PostDto> {
    return this.postsService.create(channelId, user.id, dto);
  }

  @Patch(':postId')
  update(
    @Param('id') channelId: string,
    @Param('postId') postId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateTextPostDto,
  ): Promise<TextPostDto> {
    return this.postsService.update(channelId, postId, user.id, dto);
  }

  @Delete(':postId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') channelId: string,
    @Param('postId') postId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    return this.postsService.remove(channelId, postId, user.id);
  }
}
