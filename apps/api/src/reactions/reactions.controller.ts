import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { ReactionDto } from '@social/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { CurrentUserPayload } from '../auth/jwt-payload';
import { CreateReactionDto } from './dto/create-reaction.dto';
import { PostMemberGuard } from './post-member.guard';
import { ReactionsService } from './reactions.service';

// Réactions emoji sur un post (M3-T2) : réservées aux membres du group
// auquel appartient le salon du post (PostMemberGuard). Ajout idempotent
// (contrainte unique post/user/emoji) ; suppression idempotente également.
@Controller('posts/:id/reactions')
@UseGuards(JwtAuthGuard, PostMemberGuard)
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  add(
    @Param('id') postId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateReactionDto,
  ): Promise<ReactionDto> {
    return this.reactionsService.add(postId, user.id, dto.emoji);
  }

  @Delete(':emoji')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') postId: string,
    @Param('emoji') emoji: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    return this.reactionsService.remove(postId, user.id, emoji);
  }
}
