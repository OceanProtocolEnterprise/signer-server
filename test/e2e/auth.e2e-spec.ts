import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { AppModule } from '../../src/app.module';

describe('JWT Authentication', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /address should reject requests without JWT', async () => {
    const res = await request(app.getHttpServer()).get(
      '/address',
    );

    expect(res.status).toBe(401);
  });

  it('GET /address should reject malformed JWT', async () => {
    const res = await request(app.getHttpServer())
      .get('/address')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
  });

  it('GET /health should work without token', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200);
  });

  it('GET /nonce should reject requests without JWT', async () => {
    const res = await request(app.getHttpServer()).get(
      '/nonce',
    );

    expect(res.status).toBe(401);
  });

  it('POST /sign-message should reject requests without JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/sign-message')
      .send({
        message: 'hello',
      });

    expect(res.status).toBe(401);
  });
});
