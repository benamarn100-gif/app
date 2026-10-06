import { z } from 'zod';

import { HttpError } from './http.ts';

export const uuid = z.uuid();
export const reasonCategory = z.enum([
  'acute',
  'checkup',
  'follow_up',
  'prescription',
  'vaccination',
  'certificate',
  'other',
]);
export const insurance = z.enum(['public', 'private']);
export const idempotencyKey = z
  .string()
  .min(8)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/);

export const contactSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()/-]{6,20}$/),
  insurance,
});

export const bookingDetails = z.object({
  dependentId: uuid.nullable().default(null),
  reasonCategory: reasonCategory.nullable().default(null),
  contact: contactSchema,
  consentVersion: z.string().min(1).max(20),
});

export function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError('invalid_input');
  return result.data;
}

/** Idempotency-Key aus Header oder Body. */
export function readIdempotencyKey(req: Request, body: { idempotencyKey?: unknown }): string {
  return parse(idempotencyKey, req.headers.get('Idempotency-Key') ?? body.idempotencyKey);
}
