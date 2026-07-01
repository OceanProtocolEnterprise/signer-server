export function normalizeOrigin(
  origin: string,
): string | undefined {
  const trimmedOrigin = origin.trim();
  if (!trimmedOrigin) {
    return undefined;
  }

  try {
    return new URL(trimmedOrigin).origin;
  } catch {
    return undefined;
  }
}

export function parseAllowedOrigins(
  value: string | undefined,
): string[] {
  if (!value?.trim()) {
    return [];
  }

  const rawOrigins = value.trim().startsWith('[')
    ? parseOriginArray(value)
    : value.split(',');

  const origins = rawOrigins.map((origin) => {
    if (typeof origin !== 'string') {
      throw new Error(
        'ALLOWED_ORIGINS must contain only strings',
      );
    }

    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) {
      throw new Error(
        `ALLOWED_ORIGINS contains invalid origin: ${origin}`,
      );
    }

    return normalizedOrigin;
  });

  return [...new Set(origins)];
}

function parseOriginArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('ALLOWED_ORIGINS must be an array');
    }

    return parsed;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'ALLOWED_ORIGINS must be an array'
    ) {
      throw error;
    }

    return parseQuotedOriginArray(value);
  }
}

function parseQuotedOriginArray(value: string): string[] {
  const trimmedValue = value.trim();
  if (
    !trimmedValue.startsWith('[') ||
    !trimmedValue.endsWith(']')
  ) {
    throw new Error('ALLOWED_ORIGINS must be an array');
  }

  const origins: string[] = [];
  const body = trimmedValue.slice(1, -1).trim();
  if (!body) {
    return origins;
  }

  let index = 0;
  while (index < body.length) {
    while (body[index] === ' ') {
      index += 1;
    }

    const quote = body[index];
    if (quote !== "'" && quote !== '"') {
      throw new Error('ALLOWED_ORIGINS must be an array');
    }
    index += 1;

    let origin = '';
    while (index < body.length && body[index] !== quote) {
      origin += body[index];
      index += 1;
    }

    if (body[index] !== quote) {
      throw new Error('ALLOWED_ORIGINS must be an array');
    }
    index += 1;

    origins.push(origin);

    while (body[index] === ' ') {
      index += 1;
    }

    if (index >= body.length) {
      break;
    }

    if (body[index] !== ',') {
      throw new Error('ALLOWED_ORIGINS must be an array');
    }
    index += 1;
  }

  return origins;
}
