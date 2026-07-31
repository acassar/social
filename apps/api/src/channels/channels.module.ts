import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GroupsModule } from '../groups/groups.module';
import { ChannelMemberGuard } from './channel-member.guard';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';

@Module({
  imports: [AuthModule, GroupsModule],
  controllers: [ChannelsController],
  providers: [ChannelsService, ChannelMemberGuard],
  exports: [ChannelMemberGuard],
})
export class ChannelsModule {}
