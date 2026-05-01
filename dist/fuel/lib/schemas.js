"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostcodeLookupSchema = exports.FuelFinderPricePageSchema = exports.FuelFinderStationPageSchema = exports.FuelFinderAccessTokenResponseSchema = void 0;
const zod_1 = require("zod");
const nullableBoolean = zod_1.z.boolean().nullable().optional().transform((value) => value ?? null);
const nullableNumber = zod_1.z.number().nullable().optional().transform((value) => value ?? null);
const nullableString = zod_1.z.string().nullable().optional().transform((value) => value ?? null);
const DayOpeningSchema = zod_1.z
    .object({
    close: nullableString,
    is_24_hours: nullableBoolean,
    open: nullableString
})
    .passthrough();
const OpeningTimesSchema = zod_1.z
    .object({
    bank_holiday: zod_1.z
        .object({
        close_time: nullableString,
        is_24_hours: nullableBoolean,
        open_time: nullableString,
        type: nullableString
    })
        .nullable()
        .optional()
        .transform((value) => value ?? null),
    usual_days: zod_1.z
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
exports.FuelFinderAccessTokenResponseSchema = zod_1.z
    .object({
    data: zod_1.z.object({
        access_token: zod_1.z.string().min(1),
        expires_in: zod_1.z.number().int().positive(),
        refresh_token: zod_1.z.string().optional().nullable(),
        token_type: zod_1.z.string().min(1)
    }),
    message: zod_1.z.string().optional(),
    success: zod_1.z.boolean().optional()
})
    .passthrough();
const FuelFinderStationPagePayloadSchema = zod_1.z
    .object({
    data: zod_1.z.array(zod_1.z
        .object({
        amenities: zod_1.z.array(zod_1.z.string()).optional().default([]),
        brand_name: nullableString,
        fuel_types: zod_1.z.array(zod_1.z.string()).optional().default([]),
        is_motorway_service_station: nullableBoolean,
        is_same_trading_and_brand_name: nullableBoolean,
        is_supermarket_service_station: nullableBoolean,
        location: zod_1.z
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
        node_id: zod_1.z.string().min(1),
        opening_times: OpeningTimesSchema,
        permanent_closure: nullableBoolean,
        permanent_closure_date: nullableString,
        public_phone_number: zod_1.z.union([zod_1.z.number(), zod_1.z.string(), zod_1.z.null()]).optional().transform((value) => value ?? null),
        temporary_closure: nullableBoolean,
        trading_name: nullableString
    })
        .passthrough())
});
const FuelFinderPricePagePayloadSchema = zod_1.z
    .object({
    data: zod_1.z.array(zod_1.z
        .object({
        fuel_prices: zod_1.z.array(zod_1.z
            .object({
            fuel_type: zod_1.z.string().min(1),
            price: zod_1.z.coerce.number(),
            price_change_effective_timestamp: nullableString,
            price_last_updated: nullableString
        })
            .passthrough()),
        node_id: zod_1.z.string().min(1),
        public_phone_number: zod_1.z.union([zod_1.z.number(), zod_1.z.string(), zod_1.z.null()]).optional().transform((value) => value ?? null),
        trading_name: nullableString
    })
        .passthrough())
});
exports.FuelFinderStationPageSchema = zod_1.z.preprocess((input) => (Array.isArray(input) ? { data: input } : input), FuelFinderStationPagePayloadSchema);
exports.FuelFinderPricePageSchema = zod_1.z.preprocess((input) => (Array.isArray(input) ? { data: input } : input), FuelFinderPricePagePayloadSchema);
exports.PostcodeLookupSchema = zod_1.z
    .object({
    result: zod_1.z.object({
        latitude: zod_1.z.number(),
        longitude: zod_1.z.number(),
        postcode: zod_1.z.string().min(1)
    }),
    status: zod_1.z.number()
})
    .passthrough();
