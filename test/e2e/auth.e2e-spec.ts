import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { AppModule } from '../../src/app.module';
import { API_PREFIX } from '../../src/common/constants/api.constants';

describe('JWT Authentication', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/v1/address should reject requests without JWT', async () => {
    const res = await request(app.getHttpServer()).get(
      `/${API_PREFIX}/address`,
    );

    expect(res.status).toBe(401);
  });

  it('GET /api/v1/address should reject malformed JWT', async () => {
    const res = await request(app.getHttpServer())
      .get(`/${API_PREFIX}/address`)
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
  });

  it('GET /api/v1/health should work without token', () => {
    return request(app.getHttpServer())
      .get(`/${API_PREFIX}/health`)
      .expect(200);
  });

  it('GET /api/v1/nonce should reject requests without JWT', async () => {
    const res = await request(app.getHttpServer()).get(
      `/${API_PREFIX}/nonce`,
    );

    expect(res.status).toBe(401);
  });

  it('POST /api/v1/sign-message should reject requests without JWT', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/sign-message`)
      .send({
        message: 'hello',
      });

    expect(res.status).toBe(401);
  });
});
