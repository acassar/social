import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChannelsModule } from '../channels/channels.module';
import { PushModule } from '../push/push.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

// Messages texte (M3-T1) + mot du jour (M4-T1) + mèmes (M5-T2). Après
// création, émet post:created (RealtimeModule) et notifie les users opt-in
// du salon (PushModule, M6-T2).
@Module({
  imports: [AuthModule, ChannelsModule, RealtimeModule, PushModule],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
