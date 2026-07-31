import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { ChannelNotificationPreferenceDto } from '@social/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { CurrentUserPayload } from '../auth/jwt-payload';
import { ChannelMemberGuard } from '../channels/channel-member.guard';
import { PushService } from './push.service';

// Opt-in aux notifications d'un salon (M6-T2) : réservé aux membres du group
// (ChannelMemberGuard). Désactivé par défaut — l'absence de préférence vaut
// `enabled: false`, jamais l'inverse (voir doc/SPEC.md §8/§9, zéro forcing).
@Controller('channels/:id/notifications')
@UseGuards(JwtAuthGuard, ChannelMemberGuard)
export class ChannelNotificationsController {
  constructor(private readonly pushService: PushService) {}

  @Get()
  get(
    @Param('id') channelId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ChannelNotificationPreferenceDto> {
    return this.pushService.getChannelPreference(channelId, user.id);
  }

  @Post()
  enable(
    @Param('id') channelId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ChannelNotificationPreferenceDto> {
    return this.pushService.enableChannelPreference(channelId, user.id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  disable(@Param('id') channelId: string, @CurrentUser() user: CurrentUserPayload): Promise<void> {
    return this.pushService.disableChannelPreference(channelId, user.id);
  }
}
