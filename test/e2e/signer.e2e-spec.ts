import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ConfigService } from '@nestjs/config';

describe('SignerController (e2e)', () => {
  let app: INestApplication;
  let validJwt: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Generate a mock JWT for testing (you would normally get it from Authentik)
    // For e2e tests you can either use an actual test token or mock the guard.
    // Here we'll simply test that the guard rejects missing token.
  });

  it('/address (GET) - no token -> 401', () => {
    return request(app.getHttpServer()).get('/address').expect(401);
  });

  it('/address (GET) - invalid token -> 401', () => {
    return request(app.getHttpServer())
      .get('/address')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
  });

  // To test with a valid token, you need to obtain one from Authentik test instance
  // or mock the AuthGuard. For brevity, we skip full integration here.

  afterAll(async () => {
    await app.close();
  });
});