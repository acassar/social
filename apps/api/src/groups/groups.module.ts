import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GroupMemberGuard } from './group-member.guard';
import { GroupOwnerGuard } from './group-owner.guard';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';

// CRUD des groups/memberships eux-mêmes reste à implémenter (hors périmètre
// de M2-T1, qui ne porte que sur les salons) ; invitations (M1-T3) et les
// guards de membership réutilisés par ChannelsModule (M2-T1) sont câblés ici.
@Module({
  imports: [AuthModule],
  controllers: [InvitesController],
  providers: [InvitesService, GroupOwnerGuard, GroupMemberGuard],
  exports: [GroupOwnerGuard, GroupMemberGuard],
})
export class GroupsModule {}
