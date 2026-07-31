import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type {
  AccessTokenDto,
  AuthTokensDto,
  MeResponseDto,
  RegisterResponseDto,
} from '@social/shared';
import type { EnvironmentVariables } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './jwt-payload';
import { hashPassword, verifyPassword } from './password';

// Le client Prisma généré (ESM-only, cf. auth.service.spec.ts) n'est jamais
// importé ici : on détecte l'erreur de contrainte unique par duck-typing
// plutôt que via `Prisma.PrismaClientKnownRequestError`.
function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const invite = await this.prisma.invite.findUnique({ where: { code: dto.inviteCode } });

    if (!invite) {
      throw new BadRequestException("Code d'invitation invalide");
    }
    if (invite.usedById) {
      throw new ConflictException("Code d'invitation déjà utilisé");
    }
    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Code d'invitation expiré");
    }

    const passwordHash = await hashPassword(dto.password);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            displayName: dto.displayName,
            nativeLang: dto.nativeLang,
            passwordHash,
          },
        });

        await tx.membership.create({
          data: { groupId: invite.groupId, userId: user.id, role: 'member' },
        });

        // Guard contre la course entre la lecture ci-dessus et cette transaction :
        // si un autre enregistrement a consommé le code entre-temps, ce update ne
        // touche aucune ligne et on annule toute la transaction (409).
        const claimed = await tx.invite.updateMany({
          where: { id: invite.id, usedById: null },
          data: { usedById: user.id },
        });

        if (claimed.count === 0) {
          throw new ConflictException("Code d'invitation déjà utilisé");
        }

        return {
          id: user.id,
          displayName: user.displayName,
          nativeLang: user.nativeLang,
          groupId: invite.groupId,
        };
      });
    } catch (error) {
      // `displayName` est unique (requis par le login, M1-T2) : une violation
      // de cette contrainte est un conflit utilisateur, pas une erreur serveur.
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException('Ce nom est déjà utilisé');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthTokensDto> {
    const user = await this.prisma.user.findUnique({ where: { displayName: dto.displayName } });

    if (!user || !(await verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    return this.issueTokens(user.id);
  }

  async refresh(refreshToken: string): Promise<AccessTokenDto> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }

    const accessToken = await this.signAccessToken(payload.sub);
    return { accessToken };
  }

  async me(userId: string): Promise<MeResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException();
    }

    // MVP à un seul group actif (doc/SPEC.md §1) : la première membership du
    // user porte le group à afficher côté front (shell M2-T4). Le modèle
    // reste multi-group ; une sélection explicite de group n'est pas
    // demandée par le backlog actuel.
    const membership = await this.prisma.membership.findFirst({ where: { userId } });
    if (!membership) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      displayName: user.displayName,
      nativeLang: user.nativeLang,
      avatarUrl: user.avatarUrl ?? undefined,
      groupId: membership.groupId,
    };
  }

  private async issueTokens(userId: string): Promise<AuthTokensDto> {
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(userId),
      this.signRefreshToken(userId),
    ]);
    return { accessToken, refreshToken };
  }

  private signAccessToken(userId: string): Promise<string> {
    const payload: JwtPayload = { sub: userId };
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN', { infer: true }),
    });
  }

  private signRefreshToken(userId: string): Promise<string> {
    const payload: JwtPayload = { sub: userId };
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET', { infer: true }),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', { infer: true }),
    });
  }
}
