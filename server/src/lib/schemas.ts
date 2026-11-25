import { z } from 'zod';

const MAX_RATE = 999_999_999;
const MAX_QUANTITY = 1_000_000;

export const categoryNameSchema = z
  .string({ required_error: 'Category name is required.' })
  .trim()
  .min(1, 'Category name is required.')
  .max(80, 'Category name must be 80 characters or fewer.');

export const itemNameSchema = z
  .string({ required_error: 'Item name is required.' })
  .trim()
  .min(1, 'Item name is required.')
  .max(120, 'Item name must be 120 characters or fewer.');

export const rateSchema = z
  .number({ required_error: 'Unit rate is required.', invalid_type_error: 'Unit rate is required.' })
  .int('Unit rate must be a whole number of poisha.')
  .min(0, 'Unit rate cannot be negative.')
  .max(MAX_RATE, 'Unit rate is too large.');

export const createCategorySchema = z.object({
  name: categoryNameSchema,
});

export const updateCategorySchema = z.object({
  name: categoryNameSchema,
});

export const createItemSchema = z.object({
  categoryId: z.string({ required_error: 'Category is required.' }).trim().min(1, 'Category is required.'),
  name: itemNameSchema,
  defaultRate: rateSchema,
});

export const updateItemSchema = z
  .object({
    name: itemNameSchema.optional(),
    defaultRate: rateSchema.optional(),
  })
  .refine((data) => data.name !== undefined || data.defaultRate !== undefined, {
    message: 'Provide a name or a unit rate to update.',
  });

export const updateSettingsSchema = z.object({
  printHeading: z
    .string({ required_error: 'Memo print heading is required.' })
    .trim()
    .min(1, 'Memo print heading is required.')
    .max(120, 'Memo print heading must be 120 characters or fewer.'),
});

export const memoLineSchema = z.object({
  itemId: z.string({ required_error: 'Item is required.' }).trim().min(1, 'Item is required.'),
  rate: rateSchema,
  quantity: z
    .number({ required_error: 'Quantity is required.' })
    .int('Quantity must be a whole number.')
    .min(1, 'Quantity must be a whole number greater than 0.')
    .max(MAX_QUANTITY, 'Quantity is too large.'),
});

export const createMemoSchema = z.object({
  clientRequestId: z
    .string({ required_error: 'Request identifier is required.' })
    .trim()
    .min(8, 'Request identifier is invalid.')
    .max(128, 'Request identifier is invalid.'),
  shopName: z
    .string({ required_error: 'Customer shop name is required.' })
    .trim()
    .min(1, 'Customer shop name is required.')
    .max(200, 'Customer shop name must be 200 characters or fewer.'),
  address: z.string().trim().max(300, 'Address must be 300 characters or fewer.').default(''),
  note: z.string().trim().max(2000, 'Note must be 2000 characters or fewer.').default(''),
  discount: z
    .object({
      type: z.enum(['none', 'fixed', 'percentage'], {
        errorMap: () => ({ message: 'Choose a valid discount type.' }),
      }),
      value: z.number().min(0, 'Discount cannot be negative.').optional().default(0),
    })
    .default({ type: 'none', value: 0 }),
  lines: z
    .array(memoLineSchema)
    .min(1, 'Add at least one item to the order.')
    .max(200, 'An order cannot contain more than 200 items.'),
});

export type CreateMemoInput = z.infer<typeof createMemoSchema>;
