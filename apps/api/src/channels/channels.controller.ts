import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { ChannelDto } from '@social/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GroupMemberGuard } from '../groups/group-member.guard';
import { GroupOwnerGuard } from '../groups/group-owner.guard';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';

// CRUD des salons d'un group : lecture ouverte aux membres, écriture
// (création/édition/suppression) réservée au owner (voir M2-T1).
@Controller('groups/:id/channels')
@UseGuards(JwtAuthGuard)
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  @UseGuards(GroupMemberGuard)
  list(@Param('id') groupId: string): Promise<ChannelDto[]> {
    return this.channelsService.list(groupId);
  }

  @Post()
  @UseGuards(GroupOwnerGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@Param('id') groupId: string, @Body() dto: CreateChannelDto): Promise<ChannelDto> {
    return this.channelsService.create(groupId, dto);
  }

  @Patch(':channelId')
  @UseGuards(GroupOwnerGuard)
  update(
    @Param('id') groupId: string,
    @Param('channelId') channelId: string,
    @Body() dto: UpdateChannelDto,
  ): Promise<ChannelDto> {
    return this.channelsService.update(groupId, channelId, dto);
  }

  @Delete(':channelId')
  @UseGuards(GroupOwnerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') groupId: string, @Param('channelId') channelId: string): Promise<void> {
    return this.channelsService.remove(groupId, channelId);
  }
}
