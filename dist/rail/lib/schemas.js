"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StationBoardResponseSchema = exports.BoardServiceSchema = exports.CallingPointListSchema = exports.CallingPointSchema = exports.ServiceLocationSchema = exports.StationSearchResponseSchema = exports.StationSearchResultSchema = void 0;
const zod_1 = require("zod");
exports.StationSearchResultSchema = zod_1.z
    .object({
    crsCode: zod_1.z.string(),
    stationName: zod_1.z.string(),
})
    .passthrough();
exports.StationSearchResponseSchema = zod_1.z.array(exports.StationSearchResultSchema);
exports.ServiceLocationSchema = zod_1.z
    .object({
    assocIsCancelled: zod_1.z.boolean().optional(),
    crs: zod_1.z.string().optional().nullable(),
    futureChangeTo: zod_1.z.string().optional().nullable(),
    locationName: zod_1.z.string(),
    via: zod_1.z.string().optional().nullable(),
})
    .passthrough();
exports.CallingPointSchema = zod_1.z
    .object({
    at: zod_1.z.string().optional().nullable(),
    crs: zod_1.z.string().optional().nullable(),
    et: zod_1.z.string().optional().nullable(),
    isCancelled: zod_1.z.boolean().optional(),
    locationName: zod_1.z.string(),
    st: zod_1.z.string().optional().nullable(),
})
    .passthrough();
exports.CallingPointListSchema = zod_1.z
    .object({
    callingPoint: zod_1.z.array(exports.CallingPointSchema).optional().nullable().default([]),
})
    .passthrough();
exports.BoardServiceSchema = zod_1.z
    .object({
    ata: zod_1.z.string().optional().nullable(),
    atd: zod_1.z.string().optional().nullable(),
    cancelReason: zod_1.z.string().optional().nullable(),
    currentDestinations: zod_1.z.array(exports.ServiceLocationSchema).optional().nullable().default([]),
    currentOrigins: zod_1.z.array(exports.ServiceLocationSchema).optional().nullable().default([]),
    delayReason: zod_1.z.string().optional().nullable(),
    destination: zod_1.z.array(exports.ServiceLocationSchema).optional().nullable().default([]),
    eta: zod_1.z.string().optional().nullable(),
    etd: zod_1.z.string().optional().nullable(),
    filterLocationCancelled: zod_1.z.boolean().optional(),
    isCancelled: zod_1.z.boolean().optional(),
    operator: zod_1.z.string().optional().nullable(),
    operatorCode: zod_1.z.string().optional().nullable(),
    origin: zod_1.z.array(exports.ServiceLocationSchema).optional().nullable().default([]),
    platform: zod_1.z.string().optional().nullable(),
    previousCallingPoints: zod_1.z.array(exports.CallingPointListSchema).optional().nullable().default([]),
    rsid: zod_1.z.string().optional().nullable(),
    serviceID: zod_1.z.string().optional().nullable(),
    sta: zod_1.z.string().optional().nullable(),
    std: zod_1.z.string().optional().nullable(),
    subsequentCallingPoints: zod_1.z.array(exports.CallingPointListSchema).optional().nullable().default([]),
})
    .passthrough();
exports.StationBoardResponseSchema = zod_1.z
    .object({
    areServicesAvailable: zod_1.z.boolean().optional(),
    crs: zod_1.z.string(),
    filterLocationName: zod_1.z.string().optional().nullable(),
    filterType: zod_1.z.union([zod_1.z.enum(['from', 'to']), zod_1.z.number()]).optional().nullable(),
    filtercrs: zod_1.z.string().optional().nullable(),
    generatedAt: zod_1.z.string(),
    locationName: zod_1.z.string(),
    nrccMessages: zod_1.z.array(zod_1.z.unknown()).optional().nullable().default([]),
    platformAvailable: zod_1.z.boolean().optional(),
    trainServices: zod_1.z.array(exports.BoardServiceSchema).optional().nullable().default([]),
})
    .passthrough();
