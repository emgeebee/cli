"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTerminalWidth = void 0;
const getTerminalWidth = () => {
    const columns = process.stdout.columns;
    if (columns === undefined) {
        return 80;
    }
    return Math.min(columns, 80);
};
exports.getTerminalWidth = getTerminalWidth;
