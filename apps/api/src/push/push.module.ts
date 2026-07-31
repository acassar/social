import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChannelsModule } from '../channels/channels.module';
import { ChannelNotificationsController } from './channel-notifications.controller';
import { PushController } from './push.controller';
import { PushService } from './push.service';

// Web Push VAPID opt-in par salon (M6-T2). Exporte PushService pour que
// PostsModule puisse déclencher l'envoi après création d'un post.
@Module({
  imports: [AuthModule, ChannelsModule],
  controllers: [PushController, ChannelNotificationsController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
