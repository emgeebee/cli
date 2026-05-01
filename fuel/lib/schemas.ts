import { z } from "zod";

const nullableBoolean = z.boolean().nullable().optional().transform((value) => value ?? null);
const nullableNumber = z.number().nullable().optional().transform((value) => value ?? null);
const nullableString = z.string().nullable().optional().transform((value) => value ?? null);

const DayOpeningSchema = z
  .object({
    close: nullableString,
    is_24_hours: nullableBoolean,
    open: nullableString
  })
  .passthrough();

const OpeningTimesSchema = z
  .object({
    bank_holiday: z
      .object({
        close_time: nullableString,
        is_24_hours: nullableBoolean,
        open_time: nullableString,
        type: nullableString
      })
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    usual_days: z
      .object({
        friday: DayOpeningSchema.optional(),
        monday: DayOpeningSchema.optional(),
        saturday: DayOpeningSchema.optional(),
        sunday: DayOpeningSchema.optional(),
        thursday: DayOpeningSchema.optional(),
        tuesday: DayOpeningSchema.optional(),
        wednesday: DayOpeningSchema.optional()
      })
      .partial()
      .default({})
  })
  .nullable()
  .optional()
  .transform((value) => value ?? null);

export const FuelFinderAccessTokenResponseSchema = z
  .object({
    data: z.object({
      access_token: z.string().min(1),
      expires_in: z.number().int().positive(),
      refresh_token: z.string().optional().nullable(),
      token_type: z.string().min(1)
    }),
    message: z.string().optional(),
    success: z.boolean().optional()
  })
  .passthrough();

const FuelFinderStationPagePayloadSchema = z
  .object({
    data: z.array(
      z
        .object({
          amenities: z.array(z.string()).optional().default([]),
          brand_name: nullableString,
          fuel_types: z.array(z.string()).optional().default([]),
          is_motorway_service_station: nullableBoolean,
          is_same_trading_and_brand_name: nullableBoolean,
          is_supermarket_service_station: nullableBoolean,
          location: z
            .object({
              address_line_1: nullableString,
              address_line_2: nullableString,
              city: nullableString,
              country: nullableString,
              county: nullableString,
              latitude: nullableNumber,
              longitude: nullableNumber,
              postcode: nullableString
            })
            .passthrough(),
          node_id: z.string().min(1),
          opening_times: OpeningTimesSchema,
          permanent_closure: nullableBoolean,
          permanent_closure_date: nullableString,
          public_phone_number: z.union([z.number(), z.string(), z.null()]).optional().transform((value) => value ?? null),
          temporary_closure: nullableBoolean,
          trading_name: nullableString
        })
        .passthrough()
    )
  });

const FuelFinderPricePagePayloadSchema = z
  .object({
    data: z.array(
      z
        .object({
          fuel_prices: z.array(
            z
              .object({
                fuel_type: z.string().min(1),
                price: z.coerce.number(),
                price_change_effective_timestamp: nullableString,
                price_last_updated: nullableString
              })
              .passthrough()
          ),
          node_id: z.string().min(1),
          public_phone_number: z.union([z.number(), z.string(), z.null()]).optional().transform((value) => value ?? null),
          trading_name: nullableString
        })
        .passthrough()
    )
  });

export const FuelFinderStationPageSchema = z.preprocess((input) => (Array.isArray(input) ? { data: input } : input), FuelFinderStationPagePayloadSchema);

export const FuelFinderPricePageSchema = z.preprocess((input) => (Array.isArray(input) ? { data: input } : input), FuelFinderPricePagePayloadSchema);

export const PostcodeLookupSchema = z
  .object({
    result: z.object({
      latitude: z.number(),
      longitude: z.number(),
      postcode: z.string().min(1)
    }),
    status: z.number()
  })
  .passthrough();
