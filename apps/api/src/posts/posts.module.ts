import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

// Messages texte (M3-T1) + mot du jour (M4-T1). Le type `memes` étendra ce
// module (M5-T2).
@Module({
  imports: [ChannelsModule, RealtimeModule],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
