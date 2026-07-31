import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { GlossaryController } from './glossary.controller';
import { GlossaryService } from './glossary.service';

// Glossaire (M4-T3) : lecture agrégée des mots du group, réutilise
// GroupMemberGuard exporté par GroupsModule.
@Module({
  imports: [GroupsModule],
  controllers: [GlossaryController],
  providers: [GlossaryService],
})
export class GlossaryModule {}
