import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

const ACCESS_SECRET = 'access-secret';

describe('UploadsController', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const storeMock = jest.fn();

  beforeAll(async () => {
    jwtService = new JwtService();
    const configServiceMock = {
      get: jest.fn((key: string) => (key === 'JWT_ACCESS_SECRET' ? ACCESS_SECRET : undefined)),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [
        { provide: UploadsService, useValue: { store: storeMock } },
        JwtAuthGuard,
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    storeMock.mockReset();
  });

  async function accessTokenFor(userId: string): Promise<string> {
    return jwtService.signAsync({ sub: userId }, { secret: ACCESS_SECRET });
  }

  it('POST /uploads renvoie 401 sans token', async () => {
    const response = await request(app.getHttpServer())
      .post('/uploads')
      .attach('file', Buffer.from('fake'), 'test.png');

    expect(response.status).toBe(401);
    expect(storeMock).not.toHaveBeenCalled();
  });

  it('POST /uploads délègue au service et renvoie 201', async () => {
    const uploadResult = {
      url: '/uploads/abc.png',
      thumbUrl: '/uploads/abc-thumb.webp',
      mime: 'image/png',
      width: 100,
      height: 50,
    };
    storeMock.mockResolvedValue(uploadResult);
    const token = await accessTokenFor('user-1');

    const response = await request(app.getHttpServer())
      .post('/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('fake'), 'test.png');

    expect(response.status).toBe(201);
    expect(response.body).toEqual(uploadResult);
    expect(storeMock).toHaveBeenCalledTimes(1);
  });
});
