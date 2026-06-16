import { BadRequestException } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let filter: HttpExceptionFilter;
  let status: jest.Mock;
  let json: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    status = jest.fn().mockReturnThis();
    json = jest.fn();
    host = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest
          .fn()
          .mockReturnValue({ status, json }),
        getRequest: jest.fn().mockReturnValue({
          method: 'POST',
          url: '/sign-message?walletId=1',
        }),
      }),
    } as unknown as ArgumentsHost;
    jest
      .spyOn(filter['logger'], 'error')
      .mockImplementation();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('returns the message for unexpected errors outside production', () => {
    process.env.NODE_ENV = 'test';

    filter.catch(
      new Error('Could not determine recovery id'),
      host,
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        path: '/sign-message?walletId=1',
        message: 'Could not determine recovery id',
      }),
    );
  });

  it('sanitizes unexpected error messages in production', () => {
    process.env.NODE_ENV = 'production';

    filter.catch(
      new Error(
        'Vault request failed (500): upstream secret detail',
      ),
      host,
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        path: '/sign-message?walletId=1',
        message: 'Internal server error',
      }),
    );
  });

  it('keeps HttpException response messages', () => {
    process.env.NODE_ENV = 'production';

    filter.catch(
      new BadRequestException(
        'walletId must be a positive integer',
      ),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'walletId must be a positive integer',
      }),
    );
  });
});
