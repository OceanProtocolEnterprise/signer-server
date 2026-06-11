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
    await app.close();
  });

  it('GET /address without token should fail', () => {
    return request(app.getHttpServer())
      .get('/address')
      .expect(401);
  });

  it('GET /address with invalid token should fail', () => {
    return request(app.getHttpServer())
      .get('/address')
      .set(
        'Authorization',
        'Bearer invalid-token',
      )
      .expect(401);
  });

  it('GET /health should work without token', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200);
  });

  it('GET /nonce without token should fail', () => {
    return request(app.getHttpServer())
      .get('/nonce')
      .expect(401);
  });

  it('POST /sign-message without token should fail', () => {
    return request(app.getHttpServer())
      .post('/sign-message')
      .send({
        message: 'hello',
      })
      .expect(401);
  });
});