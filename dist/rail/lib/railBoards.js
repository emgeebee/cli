"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureStationInput = exports.formatRailBoardText = exports.normalizeRailBoardData = void 0;
const errors_1 = require("./errors");
const terminal_1 = require("../../lib/terminal");
const normalizeRailBoardData = ({ board, boardKind, expand, requestedFilter, requestedStation, resolvedFilter, resolvedStation, }) => ({
    filter: resolvedFilter
        ? {
            crs: normalizeOptionalValue(board.filtercrs) ?? resolvedFilter.crs,
            name: normalizeOptionalValue(board.filterLocationName) ?? resolvedFilter.name,
            type: boardKind === 'departures' ? 'to' : 'from',
        }
        : undefined,
    requestedFilter,
    requestedStation,
    services: (board.trainServices ?? []).map((service) => normalizeBoardService(service, boardKind, expand)),
    station: {
        crs: normalizeOptionalValue(board.crs) ?? resolvedStation.crs,
        name: normalizeOptionalValue(board.locationName) ?? resolvedStation.name,
    },
});
exports.normalizeRailBoardData = normalizeRailBoardData;
const formatRailBoardText = (data, boardKind, context) => {
    if (data.services.length === 0) {
        return `No live ${boardKind} currently available for ${data.station.name}.`;
    }
    const scheduledWidth = Math.max(...data.services.map((service) => service.scheduledTime.length));
    const serviceLines = data.services.flatMap((service) => {
        const scheduledLabel = context.text.style.primary(context.text.padVisibleStart(service.scheduledTime, scheduledWidth));
        const counterpartLabel = context.text.style.primary(service.counterpartName);
        const platformLabel = service.platform
            ? context.text.style.bold(context.text.style.cyan(`Plat ${service.platform}`))
            : '';
        const statusLabel = context.text.style.status(getServiceEmoji(service.status, service.statusLabel), service.statusLabel);
        const leftColumn = [scheduledLabel, counterpartLabel, platformLabel]
            .filter((value) => value.length > 0)
            .join('  ');
        const serviceRow = context.text.visibleWidth(leftColumn) + context.text.visibleWidth(statusLabel) + 2 <= (0, terminal_1.getTerminalWidth)()
            ? context.text.joinAligned(leftColumn, statusLabel, (0, terminal_1.getTerminalWidth)())
            : context.text
                .wrapText(`${leftColumn}  ${statusLabel}`, {
                width: (0, terminal_1.getTerminalWidth)(),
            })
                .join('\n');
        const callingPointLines = service.callingPoints
            ? context.text
                .wrapText(service.callingPoints.join(', '), {
                continuationIndent: '    ',
                firstIndent: '    ',
                width: (0, terminal_1.getTerminalWidth)(),
            })
                .map((line) => context.text.style.dim(line))
            : [];
        return [serviceRow, ...callingPointLines];
    });
    const headerLines = [context.text.style.header(context.text.style.bold(data.station.name))];
    const filterLine = data.filter
        ? context.text.style.dim(`${boardKind === 'departures' ? 'To' : 'From'} ${data.filter.name} (${data.filter.crs})`)
        : undefined;
    if (filterLine) {
        headerLines.push(filterLine);
    }
    return [...headerLines, ...serviceLines].join('\n');
};
exports.formatRailBoardText = formatRailBoardText;
const ensureStationInput = (value, label) => {
    const normalizedValue = value.trim();
    if (normalizedValue.length === 0) {
        throw (0, errors_1.createAppError)('INVALID_INPUT', `${label} must not be empty.`);
    }
    return normalizedValue;
};
exports.ensureStationInput = ensureStationInput;
const normalizeBoardService = (service, boardKind, expand) => {
    const scheduledTime = normalizeOptionalValue(boardKind === 'departures' ? service.std : service.sta) ?? 'Unknown';
    const rawExpectedTime = normalizeOptionalValue(boardKind === 'departures' ? service.etd : service.eta);
    const statusSummary = normalizeServiceStatus(service, scheduledTime, rawExpectedTime);
    const counterpartName = formatServiceLocations(chooseLocations(boardKind === 'departures' ? service.currentDestinations : service.currentOrigins, boardKind === 'departures' ? service.destination : service.origin)) ?? (boardKind === 'departures' ? 'Unknown destination' : 'Unknown origin');
    const callingPoints = expand ? getCallingPoints(service, boardKind) : undefined;
    return {
        callingPoints,
        counterpartName,
        expectedTime: statusSummary.expectedTime,
        operatorName: normalizeOptionalValue(service.operator) ?? 'Unknown operator',
        platform: normalizeOptionalValue(service.platform),
        scheduledTime,
        status: statusSummary.status,
        statusLabel: statusSummary.statusLabel,
    };
};
const normalizeServiceStatus = (service, scheduledTime, expectedTime) => {
    if (service.isCancelled || service.filterLocationCancelled) {
        return {
            status: 'cancelled',
            statusLabel: 'Cancelled',
        };
    }
    if (!expectedTime) {
        return {
            status: 'unknown',
            statusLabel: 'No estimate',
        };
    }
    const normalizedExpectedTime = expectedTime.replace(/^\*/, '');
    const loweredExpectedTime = normalizedExpectedTime.toLowerCase();
    if (loweredExpectedTime === 'cancelled' || loweredExpectedTime === 'canceled') {
        return {
            status: 'cancelled',
            statusLabel: 'Cancelled',
        };
    }
    if (loweredExpectedTime === 'delayed') {
        return {
            status: 'delayed',
            statusLabel: 'Delayed',
        };
    }
    if (loweredExpectedTime === 'on time') {
        return {
            status: 'on-time',
            statusLabel: 'On time',
        };
    }
    if (/^\d{2}:\d{2}$/.test(normalizedExpectedTime)) {
        if (normalizedExpectedTime === scheduledTime) {
            return {
                expectedTime: normalizedExpectedTime,
                status: 'on-time',
                statusLabel: 'On time',
            };
        }
        return {
            expectedTime: normalizedExpectedTime,
            status: 'expected',
            statusLabel: `Exp ${normalizedExpectedTime}`,
        };
    }
    return {
        status: 'unknown',
        statusLabel: expectedTime,
    };
};
const chooseLocations = (currentLocations, originalLocations) => (currentLocations?.length ?? 0) > 0 ? currentLocations ?? [] : originalLocations ?? [];
const formatServiceLocations = (locations) => {
    const formattedLocations = (locations ?? [])
        .flatMap((location) => {
        const normalizedName = normalizeOptionalValue(location?.locationName);
        if (!normalizedName) {
            return [];
        }
        const normalizedVia = normalizeOptionalValue(location?.via ?? undefined);
        return [normalizedVia ? `${normalizedName} ${normalizedVia}` : normalizedName];
    })
        .filter(Boolean);
    return formattedLocations.length > 0 ? formattedLocations.join(' / ') : undefined;
};
const getCallingPoints = (service, boardKind) => {
    const preferredCallingPoints = boardKind === 'departures' ? service.subsequentCallingPoints : service.previousCallingPoints;
    const fallbackCallingPoints = boardKind === 'departures' ? service.previousCallingPoints : service.subsequentCallingPoints;
    const flattenedCallingPoints = flattenCallingPoints(preferredCallingPoints);
    const finalCallingPoints = flattenedCallingPoints.length > 0 ? flattenedCallingPoints : flattenCallingPoints(fallbackCallingPoints);
    return finalCallingPoints.length > 0 ? finalCallingPoints : undefined;
};
const flattenCallingPoints = (callingPointLists) => (callingPointLists ?? [])
    .flatMap((callingPointList) => callingPointList.callingPoint ?? [])
    .map((callingPoint) => callingPoint.locationName.trim())
    .filter(Boolean)
    .reduce((uniqueCallingPoints, callingPoint) => uniqueCallingPoints.includes(callingPoint)
    ? uniqueCallingPoints
    : [...uniqueCallingPoints, callingPoint], []);
const getServiceEmoji = (status, statusLabel) => {
    if (status === 'on-time') {
        return `✅ ${statusLabel}`;
    }
    if (status === 'expected') {
        return `⚠️ ${statusLabel}`;
    }
    if (status === 'delayed' || status === 'cancelled') {
        return `🔴 ${statusLabel}`;
    }
    return statusLabel;
};
const normalizeOptionalValue = (value) => {
    const normalizedValue = value?.trim();
    return normalizedValue ? normalizedValue : undefined;
};
