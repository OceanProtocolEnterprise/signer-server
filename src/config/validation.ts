import { plainToClass } from 'class-transformer';
import { IsString, IsOptional, IsNumber, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsString()
  PRIVATE_KEY: string;

  @IsString()
  ETHEREUM_RPC_URL: string;

  @IsNumber()
  CHAIN_ID: number;

  @IsString()
  AUTHENTIK_JWKS_URI: string;

  @IsString()
  AUTHENTIK_ISSUER: string;

  @IsString()
  AUTHENTIK_AUDIENCE: string;

  @IsNumber()
  PORT: number;

  @IsOptional()
  @IsString()
  API_KEY_FALLBACK?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}