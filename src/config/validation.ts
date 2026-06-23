import { plainToClass } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsIn(['local', 'vault'])
  SIGNER_MODE: 'local' | 'vault';

  @IsOptional()
  @IsString()
  PRIVATE_KEYS?: string;

  @IsString()
  NODE_URI_MAP: string;

  @IsOptional()
  @IsNumber()
  @Min(100)
  SIGNER_FEE_BUMP_PERCENT?: number;

  @IsOptional()
  @IsString()
  VAULT_URL?: string;

  @IsOptional()
  @IsString()
  VAULT_TOKEN?: string;

  @IsOptional()
  @IsString()
  VAULT_ETHEREUM_MOUNT?: string;

  @IsOptional()
  @IsString()
  VAULT_KV_STORE_PATH?: string;

  @IsOptional()
  @IsNumber()
  VAULT_TIMEOUT_MS?: number;

  @IsString()
  AUTHENTIK_JWKS_URI: string;

  @IsString()
  AUTHENTIK_ISSUER: string;

  @IsString()
  AUTHENTIK_AUDIENCE: string;

  @IsOptional()
  @IsString()
  UPSTREAM_IDP?: string;

  @IsNumber()
  PORT: number;

  @IsOptional()
  @IsString()
  HTTP_CERT_PATH?: string;

  @IsOptional()
  @IsString()
  HTTP_KEY_PATH?: string;

  @IsOptional()
  @IsString()
  API_KEY_FALLBACK?: string;
}

export function validate(config: Record<string, unknown>) {
  if (
    config.SIGNER_MODE !== 'local' &&
    config.SIGNER_MODE !== 'vault'
  ) {
    throw new Error(
      'SIGNER_MODE must be either local or vault',
    );
  }

  const validatedConfig = plainToClass(
    EnvironmentVariables,
    config,
    {
      enableImplicitConversion: true,
    },
  );
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });
  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  const signerMode = validatedConfig.SIGNER_MODE;
  if (
    signerMode === 'local' &&
    !validatedConfig.PRIVATE_KEYS
  ) {
    throw new Error(
      'PRIVATE_KEYS is required when SIGNER_MODE=local',
    );
  }

  if (signerMode === 'vault') {
    const missingVaultVars = [
      'VAULT_URL',
      'VAULT_TOKEN',
    ].filter(
      (key) =>
        !validatedConfig[key as keyof EnvironmentVariables],
    );

    if (missingVaultVars.length) {
      throw new Error(
        `${missingVaultVars.join(', ')} required when SIGNER_MODE=vault`,
      );
    }
  }

  return validatedConfig;
}
