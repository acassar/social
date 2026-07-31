import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import type { GlossaryPageDto } from '@social/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GroupMemberGuard } from '../groups/group-member.guard';
import { GlossaryQueryDto } from './dto/glossary-query.dto';
import { GlossaryService } from './glossary.service';

// Vue dérivée en lecture seule des `word_entries` du group (M4-T3) : aucune
// nouvelle table, agrège les posts `word_of_day` déjà créés via
// `POST /channels/:id/posts` (M4-T1). Réservé aux membres du group, comme
// les salons (voir ChannelsController).
@Controller('groups/:id/glossary')
@UseGuards(JwtAuthGuard, GroupMemberGuard)
export class GlossaryController {
  constructor(private readonly glossaryService: GlossaryService) {}

  @Get()
  list(@Param('id') groupId: string, @Query() query: GlossaryQueryDto): Promise<GlossaryPageDto> {
    return this.glossaryService.list(
      groupId,
      query.lang,
      query.search,
      query.cursor,
      query.limit,
    );
  }
}
