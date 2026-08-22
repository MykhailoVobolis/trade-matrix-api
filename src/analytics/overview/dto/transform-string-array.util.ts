import type { TransformFnParams } from 'class-transformer';

export function transformStringArray({
  value,
}: TransformFnParams): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0);
  }

  const normalized = String(value).trim();

  return normalized.length > 0 ? [normalized] : undefined;
}
