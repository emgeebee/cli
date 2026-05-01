"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTerminalWidth = exports.joinAligned = exports.wrapText = exports.padVisibleStart = exports.padVisibleEnd = exports.visibleWidth = exports.stripAnsi = exports.createTextStyler = void 0;
const ESCAPE_CHARACTER = String.fromCharCode(27);
const ANSI_PATTERN = new RegExp(`${ESCAPE_CHARACTER}\\[[0-9;]*m`, 'g');
const ANSI_RESET = '\u001B[0m';
const ANSI_BOLD = '\u001B[1m';
const ANSI_DIM = '\u001B[2m';
const PALETTE = {
    amber: '#F47738',
    blue: '#003078',
    cyan: '#0077AD',
    dimGrey: '#6B7280',
    green: '#00A651',
    red: '#E21836',
    white: '#F9FAFB',
};
const getAnsiRgbCode = (hex) => {
    const normalizedHex = hex.startsWith('#') ? hex.slice(1) : hex;
    const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
    const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
    const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);
    return `\u001B[38;2;${red};${green};${blue}m`;
};
const applyCode = (value, code, enabled) => enabled ? `${code}${value}${ANSI_RESET}` : value;
const createTextStyler = (enabled) => ({
    bold: (value) => applyCode(value, ANSI_BOLD, enabled),
    cyan: (value) => applyCode(value, getAnsiRgbCode(PALETTE.cyan), enabled),
    danger: (value) => applyCode(value, getAnsiRgbCode(PALETTE.red), enabled),
    dim: (value) => applyCode(value, `${ANSI_DIM}${getAnsiRgbCode(PALETTE.dimGrey)}`, enabled),
    header: (value) => applyCode(applyCode(value, getAnsiRgbCode(PALETTE.blue), enabled), ANSI_BOLD, enabled),
    primary: (value) => applyCode(value, getAnsiRgbCode(PALETTE.white), enabled),
    rgb: (value, hex) => applyCode(value, getAnsiRgbCode(hex), enabled),
    status: (value, status) => {
        const normalizedStatus = status.trim().toLowerCase();
        if (normalizedStatus === 'cancelled' || normalizedStatus === 'delayed') {
            return applyCode(value, getAnsiRgbCode(PALETTE.red), enabled);
        }
        if (normalizedStatus === 'on time' || normalizedStatus === 'on-time') {
            return applyCode(value, getAnsiRgbCode(PALETTE.green), enabled);
        }
        if (normalizedStatus.startsWith('exp ') || normalizedStatus === 'expected') {
            return applyCode(value, getAnsiRgbCode(PALETTE.amber), enabled);
        }
        return applyCode(value, getAnsiRgbCode(PALETTE.dimGrey), enabled);
    },
    success: (value) => applyCode(value, getAnsiRgbCode(PALETTE.green), enabled),
    warning: (value) => applyCode(value, getAnsiRgbCode(PALETTE.amber), enabled),
});
exports.createTextStyler = createTextStyler;
const stripAnsi = (value) => value.replaceAll(ANSI_PATTERN, '');
exports.stripAnsi = stripAnsi;
const visibleWidth = (value) => Array.from((0, exports.stripAnsi)(value)).length;
exports.visibleWidth = visibleWidth;
const padVisibleEnd = (value, width) => `${value}${' '.repeat(Math.max(0, width - (0, exports.visibleWidth)(value)))}`;
exports.padVisibleEnd = padVisibleEnd;
const padVisibleStart = (value, width) => `${' '.repeat(Math.max(0, width - (0, exports.visibleWidth)(value)))}${value}`;
exports.padVisibleStart = padVisibleStart;
const chunkWord = (value, size) => {
    if (value.length <= size) {
        return [value];
    }
    const characters = Array.from(value);
    return characters.reduce((chunks, character) => {
        const currentChunk = chunks.at(-1) ?? '';
        if ((0, exports.visibleWidth)(currentChunk) >= size) {
            return [...chunks, character];
        }
        return [...chunks.slice(0, -1), `${currentChunk}${character}`];
    }, ['']);
};
const wrapText = (value, options) => {
    const firstIndent = options.firstIndent ?? '';
    const continuationIndent = options.continuationIndent ?? firstIndent;
    const width = Math.max(1, options.width);
    const paragraphs = value.split('\n');
    return paragraphs.flatMap((paragraph, paragraphIndex) => {
        const normalizedParagraph = paragraph.trim().replaceAll(/\s+/g, ' ');
        if (normalizedParagraph.length === 0) {
            return paragraphIndex === paragraphs.length - 1 ? [] : [''];
        }
        const words = normalizedParagraph.split(' ');
        const lines = [];
        let currentIndent = firstIndent;
        let currentWords = [];
        const flushLine = () => {
            lines.push(`${currentIndent}${currentWords.join(' ')}`.trimEnd());
            currentIndent = continuationIndent;
            currentWords = [];
        };
        words.forEach((word) => {
            const maxContentWidth = Math.max(1, width - (0, exports.visibleWidth)(currentIndent));
            const wordChunks = (0, exports.visibleWidth)(word) > maxContentWidth ? chunkWord(word, maxContentWidth) : [word];
            wordChunks.forEach((wordChunk) => {
                const nextContent = currentWords.length === 0 ? wordChunk : `${currentWords.join(' ')} ${wordChunk}`;
                if ((0, exports.visibleWidth)(nextContent) <= maxContentWidth) {
                    currentWords = currentWords.length === 0 ? [wordChunk] : [...currentWords, wordChunk];
                    return;
                }
                if (currentWords.length > 0) {
                    flushLine();
                }
                currentWords = [wordChunk];
            });
        });
        if (currentWords.length > 0) {
            flushLine();
        }
        if (paragraphIndex === paragraphs.length - 1) {
            return lines;
        }
        return [...lines, ''];
    });
};
exports.wrapText = wrapText;
const joinAligned = (left, right, width, gap = 2) => {
    const leftWidth = (0, exports.visibleWidth)(left);
    const rightWidth = (0, exports.visibleWidth)(right);
    const availableGap = width - leftWidth - rightWidth;
    if (availableGap >= gap) {
        return `${left}${' '.repeat(availableGap)}${right}`;
    }
    return `${left}${' '.repeat(gap)}${right}`;
};
exports.joinAligned = joinAligned;
const getTerminalWidth = () => process.stdout.columns ?? 80;
exports.getTerminalWidth = getTerminalWidth;
