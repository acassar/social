import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { PostMemberGuard } from './post-member.guard';
import { ReactionsController } from './reactions.controller';
import { ReactionsService } from './reactions.service';

// Réactions emoji sur un post (M3-T2).
@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [ReactionsController],
  providers: [ReactionsService, PostMemberGuard],
})
export class ReactionsModule {}
