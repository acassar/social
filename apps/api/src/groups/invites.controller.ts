import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { InviteDto } from '@social/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { CurrentUserPayload } from '../auth/jwt-payload';
import { CreateInviteDto } from './dto/create-invite.dto';
import { GroupOwnerGuard } from './group-owner.guard';
import { InvitesService } from './invites.service';

// Génération et consultation des invitations : réservé au owner du group
// (voir GroupOwnerGuard). Un membre non-owner reçoit 403.
@Controller('groups/:id/invites')
@UseGuards(JwtAuthGuard, GroupOwnerGuard)
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('id') groupId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateInviteDto,
  ): Promise<InviteDto> {
    return this.invitesService.create(groupId, user.id, dto);
  }

  @Get()
  list(@Param('id') groupId: string): Promise<InviteDto[]> {
    return this.invitesService.list(groupId);
  }
}
