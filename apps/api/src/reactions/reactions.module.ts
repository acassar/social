import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { PostMemberGuard } from './post-member.guard';
import { ReactionsController } from './reactions.controller';
import { ReactionsService } from './reactions.service';

// Réactions emoji sur un post (M3-T2).
@Module({
  imports: [RealtimeModule],
  controllers: [ReactionsController],
  providers: [ReactionsService, PostMemberGuard],
})
export class ReactionsModule {}
