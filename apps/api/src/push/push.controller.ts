import { Body, Controller, Delete, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { CurrentUserPayload } from '../auth/jwt-payload';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import { UnsubscribePushDto } from './dto/unsubscribe-push.dto';
import { PushService } from './push.service';

// Abonnement Push du navigateur (M6-T2) : un endpoint par appareil, propre à
// l'user courant. Réservé aux users authentifiés, pas de notion de salon ici
// (voir ChannelNotificationsController pour l'opt-in par salon).
@Controller('push/subscribe')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  subscribe(@CurrentUser() user: CurrentUserPayload, @Body() dto: SubscribePushDto): Promise<void> {
    return this.pushService.subscribe(user.id, dto.endpoint, dto.keys);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  unsubscribe(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UnsubscribePushDto,
  ): Promise<void> {
    return this.pushService.unsubscribe(user.id, dto.endpoint);
  }
}
