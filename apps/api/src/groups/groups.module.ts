import { Module } from '@nestjs/common';
import { GroupOwnerGuard } from './group-owner.guard';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';

// Groups/memberships restent à implémenter (M2-T1) ; seules les
// invitations (M1-T3) sont câblées ici pour l'instant.
@Module({
  controllers: [InvitesController],
  providers: [InvitesService, GroupOwnerGuard],
})
export class GroupsModule {}
