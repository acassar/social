import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import type { EnvironmentVariables } from '../config/env';
import type { CurrentUserPayload, JwtPayload } from '../auth/jwt-payload';

export interface AuthenticatedSocket extends Socket {
  data: {
    user: CurrentUserPayload;
  };
}

function extractToken(client: Socket): string | undefined {
  const authToken = client.handshake.auth?.token as string | undefined;
  if (authToken) {
    return authToken;
  }

  const authorizationHeader = client.handshake.headers.authorization;
  if (!authorizationHeader) {
    return undefined;
  }
  const [scheme, token] = authorizationHeader.split(' ');
  return scheme === 'Bearer' && token ? token : undefined;
}

/**
 * Guard réutilisable pour l'auth JWT des sockets. `authenticate()` porte la
 * logique de vérification (partagée par le handshake du gateway et par un
 * éventuel usage `@UseGuards()` sur un futur `@SubscribeMessage`) ;
 * `canActivate()` l'adapte au contrat `CanActivate` de Nest.
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  async authenticate(client: Socket): Promise<CurrentUserPayload> {
    const token = extractToken(client);
    if (!token) {
      throw new WsException('Token manquant');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get('JWT_ACCESS_SECRET', { infer: true }),
      });
      return { id: payload.sub };
    } catch {
      throw new WsException('Token invalide ou expiré');
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const user = await this.authenticate(client);
    (client as AuthenticatedSocket).data.user = user;
    return true;
  }
}
