"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensurePositiveInteger = exports.parseIntegerOption = void 0;
const errors_1 = require("./errors");
const parseIntegerOption = (value) => {
    const parsedValue = Number.parseInt(value, 10);
    if (Number.isNaN(parsedValue)) {
        throw (0, errors_1.createAppError)('INVALID_INPUT', `Expected a whole number but received "${value}".`);
    }
    return parsedValue;
};
exports.parseIntegerOption = parseIntegerOption;
const ensurePositiveInteger = (value, label) => {
    if (!Number.isInteger(value) || value <= 0) {
        throw (0, errors_1.createAppError)('INVALID_INPUT', `${label} must be a positive whole number.`);
    }
    return value;
};
exports.ensurePositiveInteger = ensurePositiveInteger;
