import { z } from 'zod';

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid MongoDB ObjectID' });

export const idSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const userIdSchema = z.object({
  params: z.object({
    userId: objectIdSchema,
  }),
});

export const productIdSchema = z.object({
  params: z.object({
    productId: objectIdSchema,
  }),
});

export const productIdBodySchema = z.object({
  body: z
    .object({
      product: objectIdSchema.optional(),
    })
    .strict()
    .optional(),
});

export const variantIdSchema = z.object({
  params: z.object({
    variantId: objectIdSchema,
  }),
});

export const slugSchema = z.object({
  params: z.object({
    slug: z.string(),
  }),
});

const sortSchema = z.string().trim().optional();
const fieldsSchema = z.string().trim().optional();
const pageSchema = z
  .string()
  .trim()
  .transform((val) => (val ? parseInt(val, 10) : 1))
  .refine((n) => Number.isInteger(n) && n > 0, {
    message: 'page must be a postive number',
    path: ['page'],
  })
  .optional();
const limitSchema = z
  .string()
  .trim()
  .transform((val) => (val ? parseInt(val, 10) : 100))
  .refine((n) => Number.isInteger(n) && n > 0 && n <= 100, {
    message: 'limit must be between 1 and 100',
    path: ['limit'],
  })
  .optional();

export const querySchema = z.object({
  query: z.object({
    sort: sortSchema,
    fields: fieldsSchema,
    page: pageSchema,
    limit: limitSchema,
  }),
});

export const imagesSchema = z.object({
  body: z.object({ images: z.array(z.string()) }).strict(),
});

export const stringOrBoolSchema = z
  .union([z.boolean(), z.string()])
  .transform((val) => {
    if (typeof val === 'string') return val.toLowerCase() === 'true';
    return val;
  })
  .default(true);
