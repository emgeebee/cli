#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/.pnpm/ansi-regex@5.0.1/node_modules/ansi-regex/index.js
var require_ansi_regex = __commonJS({
  "node_modules/.pnpm/ansi-regex@5.0.1/node_modules/ansi-regex/index.js"(exports2, module2) {
    "use strict";
    module2.exports = ({ onlyFirst = false } = {}) => {
      const pattern = [
        "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
        "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))"
      ].join("|");
      return new RegExp(pattern, onlyFirst ? void 0 : "g");
    };
  }
});

// node_modules/.pnpm/strip-ansi@6.0.1/node_modules/strip-ansi/index.js
var require_strip_ansi = __commonJS({
  "node_modules/.pnpm/strip-ansi@6.0.1/node_modules/strip-ansi/index.js"(exports2, module2) {
    "use strict";
    var ansiRegex = require_ansi_regex();
    module2.exports = (string) => typeof string === "string" ? string.replace(ansiRegex(), "") : string;
  }
});

// node_modules/.pnpm/is-fullwidth-code-point@3.0.0/node_modules/is-fullwidth-code-point/index.js
var require_is_fullwidth_code_point = __commonJS({
  "node_modules/.pnpm/is-fullwidth-code-point@3.0.0/node_modules/is-fullwidth-code-point/index.js"(exports2, module2) {
    "use strict";
    var isFullwidthCodePoint = (codePoint) => {
      if (Number.isNaN(codePoint)) {
        return false;
      }
      if (codePoint >= 4352 && (codePoint <= 4447 || // Hangul Jamo
      codePoint === 9001 || // LEFT-POINTING ANGLE BRACKET
      codePoint === 9002 || // RIGHT-POINTING ANGLE BRACKET
      // CJK Radicals Supplement .. Enclosed CJK Letters and Months
      11904 <= codePoint && codePoint <= 12871 && codePoint !== 12351 || // Enclosed CJK Letters and Months .. CJK Unified Ideographs Extension A
      12880 <= codePoint && codePoint <= 19903 || // CJK Unified Ideographs .. Yi Radicals
      19968 <= codePoint && codePoint <= 42182 || // Hangul Jamo Extended-A
      43360 <= codePoint && codePoint <= 43388 || // Hangul Syllables
      44032 <= codePoint && codePoint <= 55203 || // CJK Compatibility Ideographs
      63744 <= codePoint && codePoint <= 64255 || // Vertical Forms
      65040 <= codePoint && codePoint <= 65049 || // CJK Compatibility Forms .. Small Form Variants
      65072 <= codePoint && codePoint <= 65131 || // Halfwidth and Fullwidth Forms
      65281 <= codePoint && codePoint <= 65376 || 65504 <= codePoint && codePoint <= 65510 || // Kana Supplement
      110592 <= codePoint && codePoint <= 110593 || // Enclosed Ideographic Supplement
      127488 <= codePoint && codePoint <= 127569 || // CJK Unified Ideographs Extension B .. Tertiary Ideographic Plane
      131072 <= codePoint && codePoint <= 262141)) {
        return true;
      }
      return false;
    };
    module2.exports = isFullwidthCodePoint;
    module2.exports.default = isFullwidthCodePoint;
  }
});

// node_modules/.pnpm/emoji-regex@8.0.0/node_modules/emoji-regex/index.js
var require_emoji_regex = __commonJS({
  "node_modules/.pnpm/emoji-regex@8.0.0/node_modules/emoji-regex/index.js"(exports2, module2) {
    "use strict";
    module2.exports = function() {
      return /\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62(?:\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67|\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74|\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73)\uDB40\uDC7F|\uD83D\uDC68(?:\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFB|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFE])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83D\uDC68|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D[\uDC66\uDC67])|[\u2695\u2696\u2708]\uFE0F|\uD83D[\uDC66\uDC67]|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|(?:\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708])\uFE0F|\uD83C\uDFFB\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C[\uDFFB-\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)\uD83C\uDFFB|\uD83E\uDDD1(?:\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])|\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1)|(?:\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFE])|(?:\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)(?:\uD83C[\uDFFB\uDFFC])|\uD83D\uDC69(?:\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFB\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFC-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|(?:\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)(?:\uD83C[\uDFFB-\uDFFD])|\uD83D\uDC69\u200D\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8|\uD83D\uDC69(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|(?:(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)\uFE0F|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF])\u200D[\u2640\u2642]|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD6-\uDDDD])(?:(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|\u200D[\u2640\u2642])|\uD83C\uDFF4\u200D\u2620)\uFE0F|\uD83D\uDC69\u200D\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08|\uD83D\uDC15\u200D\uD83E\uDDBA|\uD83D\uDC69\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC67|\uD83C\uDDFD\uD83C\uDDF0|\uD83C\uDDF4\uD83C\uDDF2|\uD83C\uDDF6\uD83C\uDDE6|[#\*0-9]\uFE0F\u20E3|\uD83C\uDDE7(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF])|\uD83C\uDDF9(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF])|\uD83C\uDDEA(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA])|\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])|\uD83C\uDDF7(?:\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC])|\uD83D\uDC69(?:\uD83C[\uDFFB-\uDFFF])|\uD83C\uDDF2(?:\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF])|\uD83C\uDDE6(?:\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF])|\uD83C\uDDF0(?:\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF])|\uD83C\uDDED(?:\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA])|\uD83C\uDDE9(?:\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF])|\uD83C\uDDFE(?:\uD83C[\uDDEA\uDDF9])|\uD83C\uDDEC(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE])|\uD83C\uDDF8(?:\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF])|\uD83C\uDDEB(?:\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7])|\uD83C\uDDF5(?:\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE])|\uD83C\uDDFB(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA])|\uD83C\uDDF3(?:\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF])|\uD83C\uDDE8(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF])|\uD83C\uDDF1(?:\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE])|\uD83C\uDDFF(?:\uD83C[\uDDE6\uDDF2\uDDFC])|\uD83C\uDDFC(?:\uD83C[\uDDEB\uDDF8])|\uD83C\uDDFA(?:\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF])|\uD83C\uDDEE(?:\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9])|\uD83C\uDDEF(?:\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5])|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u261D\u270A-\u270D]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC70\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDCAA\uDD74\uDD7A\uDD90\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD36\uDDB5\uDDB6\uDDBB\uDDD2-\uDDD5])(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFCA\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF4\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE4F\uDE80-\uDEC5\uDECC\uDED0-\uDED2\uDED5\uDEEB\uDEEC\uDEF4-\uDEFA\uDFE0-\uDFEB]|\uD83E[\uDD0D-\uDD3A\uDD3C-\uDD45\uDD47-\uDD71\uDD73-\uDD76\uDD7A-\uDDA2\uDDA5-\uDDAA\uDDAE-\uDDCA\uDDCD-\uDDFF\uDE70-\uDE73\uDE78-\uDE7A\uDE80-\uDE82\uDE90-\uDE95])|(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC04\uDCCF\uDD70\uDD71\uDD7E\uDD7F\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE02\uDE1A\uDE2F\uDE32-\uDE3A\uDE50\uDE51\uDF00-\uDF21\uDF24-\uDF93\uDF96\uDF97\uDF99-\uDF9B\uDF9E-\uDFF0\uDFF3-\uDFF5\uDFF7-\uDFFF]|\uD83D[\uDC00-\uDCFD\uDCFF-\uDD3D\uDD49-\uDD4E\uDD50-\uDD67\uDD6F\uDD70\uDD73-\uDD7A\uDD87\uDD8A-\uDD8D\uDD90\uDD95\uDD96\uDDA4\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA-\uDE4F\uDE80-\uDEC5\uDECB-\uDED2\uDED5\uDEE0-\uDEE5\uDEE9\uDEEB\uDEEC\uDEF0\uDEF3-\uDEFA\uDFE0-\uDFEB]|\uD83E[\uDD0D-\uDD3A\uDD3C-\uDD45\uDD47-\uDD71\uDD73-\uDD76\uDD7A-\uDDA2\uDDA5-\uDDAA\uDDAE-\uDDCA\uDDCD-\uDDFF\uDE70-\uDE73\uDE78-\uDE7A\uDE80-\uDE82\uDE90-\uDE95])\uFE0F|(?:[\u261D\u26F9\u270A-\u270D]|\uD83C[\uDF85\uDFC2-\uDFC4\uDFC7\uDFCA-\uDFCC]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66-\uDC78\uDC7C\uDC81-\uDC83\uDC85-\uDC87\uDC8F\uDC91\uDCAA\uDD74\uDD75\uDD7A\uDD90\uDD95\uDD96\uDE45-\uDE47\uDE4B-\uDE4F\uDEA3\uDEB4-\uDEB6\uDEC0\uDECC]|\uD83E[\uDD0F\uDD18-\uDD1F\uDD26\uDD30-\uDD39\uDD3C-\uDD3E\uDDB5\uDDB6\uDDB8\uDDB9\uDDBB\uDDCD-\uDDCF\uDDD1-\uDDDD])/g;
    };
  }
});

// node_modules/.pnpm/string-width@4.2.3/node_modules/string-width/index.js
var require_string_width = __commonJS({
  "node_modules/.pnpm/string-width@4.2.3/node_modules/string-width/index.js"(exports2, module2) {
    "use strict";
    var stripAnsi = require_strip_ansi();
    var isFullwidthCodePoint = require_is_fullwidth_code_point();
    var emojiRegex = require_emoji_regex();
    var stringWidth2 = (string) => {
      if (typeof string !== "string" || string.length === 0) {
        return 0;
      }
      string = stripAnsi(string);
      if (string.length === 0) {
        return 0;
      }
      string = string.replace(emojiRegex(), "  ");
      let width = 0;
      for (let i = 0; i < string.length; i++) {
        const code = string.codePointAt(i);
        if (code <= 31 || code >= 127 && code <= 159) {
          continue;
        }
        if (code >= 768 && code <= 879) {
          continue;
        }
        if (code > 65535) {
          i++;
        }
        width += isFullwidthCodePoint(code) ? 2 : 1;
      }
      return width;
    };
    module2.exports = stringWidth2;
    module2.exports.default = stringWidth2;
  }
});

// ball.ts
var ball_exports = {};
module.exports = __toCommonJS(ball_exports);

// bbc.ts
function toYmd(date) {
  return date.toISOString().slice(0, 10);
}
async function fetchBbcJson(url, refDate, sport) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Priority: "u=1, i",
      Referer: `https://www.bbc.co.uk/sport/${sport}/scores-fixtures/${refDate}`
    }
  });
  if (!response.ok) {
    throw new Error(`API request failed (${response.status})`);
  }
  return await response.json();
}

// config.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var import_node_os = require("node:os");
var CONFIG_FILE = ".phone_cli.json";
function getConfigPath() {
  return (0, import_node_path.join)((0, import_node_os.homedir)(), CONFIG_FILE);
}
function readPhoneCliConfig() {
  const path = getConfigPath();
  try {
    const raw = (0, import_node_fs.readFileSync)(path, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Top-level JSON must be an object.");
    }
    return parsed;
  } catch (error) {
    if (typeof error === "object" && error != null && "code" in error && error.code === "ENOENT") {
      return {};
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read config at ${path}: ${message}`);
  }
}

// lib/ballEvents.ts
var import_string_width = __toESM(require_string_width());
var COLUMN_GAP = 8;
function parseMinuteSortKey(label) {
  const match = String(label).match(/^(\d+)'\s*(?:\+\s*(\d+))?/);
  if (!match) return 99999;
  const base = Number.parseInt(match[1], 10);
  const extra = match[2] ? Number.parseInt(match[2], 10) : 0;
  return base * 100 + extra;
}
function kindForActionType(type) {
  switch (type) {
    case "Goal":
      return "";
    case "Penalty":
      return "pen";
    case "Own Goal":
      return "og";
    case "Red Card":
      return "RC";
    case "Two Yellow Cards":
      return "2YC";
    default:
      if (type.toLowerCase().includes("miss")) return "pen missed";
      return type.toLowerCase();
  }
}
function displayPlayerName(name) {
  const parts = name.trim().split(/\s+/);
  const surname = parts[parts.length - 1] || name;
  return surname.charAt(0).toUpperCase() + surname.slice(1).toLowerCase();
}
function displayMinute(label) {
  return label.replace(/'/g, "");
}
function padEndDisplay(text, width) {
  const w = (0, import_string_width.default)(text);
  if (w >= width) return text;
  return text + " ".repeat(width - w);
}
function collectSideEvents(side) {
  const byPlayer = /* @__PURE__ */ new Map();
  for (const entry of side?.actions || []) {
    const player = String(entry.playerName || "").trim();
    if (!player) continue;
    for (const action of entry.actions || []) {
      const type = String(action.type || "").trim();
      if (!type) continue;
      const rawMinute = String(action.timeLabel?.value || "").trim();
      const sortKey = parseMinuteSortKey(rawMinute);
      const minute = displayMinute(rawMinute || "?");
      const kind = kindForActionType(type);
      let group = byPlayer.get(player);
      if (!group) {
        group = {
          sortKey,
          displayName: displayPlayerName(player),
          items: []
        };
        byPlayer.set(player, group);
      }
      group.sortKey = Math.min(group.sortKey, sortKey);
      group.items.push({ sortKey, minute, kind });
    }
  }
  return [...byPlayer.values()].sort((a, b) => a.sortKey - b.sortKey);
}
function formatPlayerGroup(group) {
  const sorted = [...group.items].sort((a, b) => a.sortKey - b.sortKey);
  const times = sorted.map((item) => item.kind ? `${item.minute} ${item.kind}` : item.minute).join(", ");
  return `${group.displayName} ${times}`;
}
function matchEventLines(homeTeam, awayTeam, indent = "    ") {
  const homeLines = collectSideEvents(homeTeam).map(formatPlayerGroup);
  const awayLines = collectSideEvents(awayTeam).map(formatPlayerGroup);
  if (homeLines.length === 0 && awayLines.length === 0) return [];
  const leftWidth = Math.max(
    ...homeLines.map((line) => (0, import_string_width.default)(line)),
    16
  );
  const rows = Math.max(homeLines.length, awayLines.length);
  const lines = [];
  for (let i = 0; i < rows; i++) {
    const left = homeLines[i] || "";
    const right = awayLines[i] || "";
    lines.push(`${indent}${padEndDisplay(left, leftWidth + COLUMN_GAP)}${right}`);
  }
  return lines;
}

// ball.ts
var DAY_MS = 24 * 60 * 60 * 1e3;
var TEAM_QUERY_ALIASES = {
  avfc: "aston-villa"
};
var COMPETITION_ALLOWLIST = /* @__PURE__ */ new Set([
  "premierleague",
  "championship",
  "leagueone",
  "facup",
  "leaguecup",
  "championsleague",
  "europaleague",
  "scottishpremiership",
  "englishpremierleague",
  "englishchampionship",
  "englishleagueone",
  "eflcup",
  "uefachampionsleague",
  "uefaeuropaleague",
  "worldcup",
  "fifaworldcup"
]);
var COMPETITION_ORDER = [
  "FIFA World Cup",
  "Premier League",
  "FA Cup",
  "League Cup",
  "UEFA Champions League",
  "UEFA Europa League",
  "Championship",
  "League One",
  "Scottish Premiership"
];
var BBC_BASE_URL = "https://www.bbc.co.uk/wc-data/container/sport-data-scores-fixtures";
var PL_STANDINGS_URL = "https://premier-league-standings1.p.rapidapi.com/";
var PL_RAPID_HOST = "premier-league-standings1.p.rapidapi.com";
var ANSI_RESET = "\x1B[0m";
var ANSI_DARK_GREEN = "\x1B[32m";
var ANSI_DARK_RED = "\x1B[31m";
var ANSI_DARK_YELLOW = "\x1B[33m";
var ANSI_PALE_YELLOW = "\x1B[38;5;227m";
var ANSI_BRIGHT_GREEN = "\x1B[92m";
var ANSI_BRIGHT_RED = "\x1B[91m";
var ANSI_BG_CLARET = "\x1B[48;5;88m";
var ANSI_VILLA_BLUE = "\x1B[38;5;39m";
var ANSI_PURPLE = "\x1B[35m";
var ANSI_ORANGE = "\x1B[38;5;208m";
var ANSI_BLUE = "\x1B[94m";
var ANSI_REGEX = /\x1b\[[0-9;]*m/g;
var urlForDaysGames = (today, end, start) => `${BBC_BASE_URL}?selectedEndDate=${end}&selectedStartDate=${start}&todayDate=${today}&urn=${encodeURIComponent("urn:bbc:sportsdata:football:tournament-collection:collated")}`;
var urlForTeamGames = (today, end, start, teamUrn) => `${BBC_BASE_URL}?selectedEndDate=${end}&selectedStartDate=${start}&todayDate=${today}&urn=${encodeURIComponent(teamUrn)}`;
function usage() {
  console.log("Usage:");
  console.log("  ball   (yesterday, then tomorrow, then today)");
  console.log("  ball pl");
  console.log("  ball YYYY-MM-DD");
  console.log("  ball DD/MM");
  console.log("  ball today|tomorrow|mon|tues|wed|thurs|fri|sat|sun");
  console.log("  ball TEAM");
}
function parseYmd(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const d = /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return toYmd(d) === value ? d : null;
}
function startOfMostRecentAugust(reference = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "numeric"
  }).formatToParts(reference);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const augustYear = month >= 8 ? year : year - 1;
  return parseYmd(`${augustYear}-08-01`) ?? /* @__PURE__ */ new Date(`${augustYear}-08-01T00:00:00Z`);
}
function parseDayMonthInput(value) {
  const m = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/.exec(String(value || ""));
  if (!m) {
    return null;
  }
  const day = Number.parseInt(m[1], 10);
  const month = Number.parseInt(m[2], 10);
  const year = m[3] ? Number.parseInt(m[3], 10) : null;
  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return null;
  }
  const now = /* @__PURE__ */ new Date();
  const nowY = now.getFullYear();
  const y = year || nowY;
  const candidate = new Date(Date.UTC(y, month - 1, day));
  if (candidate.getUTCFullYear() !== y || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) {
    return null;
  }
  if (!year) {
    const startOfTodayUtc = new Date(Date.UTC(nowY, now.getMonth(), now.getDate()));
    if (candidate < startOfTodayUtc) {
      const nextYear = new Date(Date.UTC(nowY + 1, month - 1, day));
      if (nextYear.getUTCMonth() === month - 1 && nextYear.getUTCDate() === day) {
        return nextYear;
      }
    }
  }
  return candidate;
}
function parseRelativeDayInput(value) {
  const v = String(value || "").trim().toLowerCase();
  const now = /* @__PURE__ */ new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  if (v === "today") return today;
  if (v === "tomorrow") return new Date(today.getTime() + DAY_MS);
  const weekdayMap = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tues: 2,
    tuesday: 2,
    wed: 3,
    weds: 3,
    wednesday: 3,
    thu: 4,
    thur: 4,
    thurs: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6
  };
  if (weekdayMap[v] == null) return null;
  const targetDow = weekdayMap[v];
  const currentDow = today.getUTCDay();
  let delta = (targetDow - currentDow + 7) % 7;
  if (delta === 0) delta = 7;
  return new Date(today.getTime() + delta * DAY_MS);
}
function defaultThreeDayRows() {
  const now = /* @__PURE__ */ new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const yesterday = new Date(today.getTime() - DAY_MS);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  return [
    { relative: "yesterday", ymd: toYmd(yesterday) },
    { relative: "tomorrow", ymd: toYmd(tomorrow) },
    { relative: "today", ymd: toYmd(today) }
  ];
}
var WEEKDAY_HEADING_SPELLING = {
  Tue: "Tues",
  Thu: "Thurs"
};
function formatYmdLondonShort(dayYmd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayYmd);
  if (!m) return dayYmd;
  const y = Number.parseInt(m[1], 10);
  const mo = Number.parseInt(m[2], 10) - 1;
  const d = Number.parseInt(m[3], 10);
  const date = new Date(Date.UTC(y, mo, d, 12, 0, 0));
  const weekday = date.toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "Europe/London"
  });
  const dayNum = date.toLocaleDateString("en-GB", { day: "2-digit", timeZone: "Europe/London" });
  const monthNum = date.toLocaleDateString("en-GB", { month: "2-digit", timeZone: "Europe/London" });
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1).toLowerCase();
  const wday = WEEKDAY_HEADING_SPELLING[cap] ?? cap;
  return `${wday} ${dayNum}/${monthNum}`;
}
function formatFixtureDate(isoDateTime) {
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return "unknown-date";
  const weekday = d.toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "Europe/London"
  });
  const day = d.toLocaleDateString("en-GB", { day: "2-digit", timeZone: "Europe/London" });
  const month = d.toLocaleDateString("en-GB", { month: "2-digit", timeZone: "Europe/London" });
  const dayName = weekday.charAt(0).toUpperCase() + weekday.slice(1).toLowerCase();
  return `${dayName} ${day}/${month}`;
}
function formatPrintedAtTimestamp(date = /* @__PURE__ */ new Date()) {
  const weekday = date.toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "Europe/London"
  });
  const day = date.toLocaleDateString("en-GB", { day: "2-digit", timeZone: "Europe/London" });
  const month = date.toLocaleDateString("en-GB", { month: "2-digit", timeZone: "Europe/London" });
  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London"
  });
  const dayName = weekday.charAt(0).toUpperCase() + weekday.slice(1).toLowerCase();
  return `${dayName} ${day}/${month} ${time}`;
}
function eventTime(event) {
  const dateValue = event.startTime || event.startDateTime;
  if (!dateValue) return "??:?? UK";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "??:?? UK";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short"
  }).formatToParts(d);
  const hh = parts.find((p) => p.type === "hour")?.value || "??";
  const mm = parts.find((p) => p.type === "minute")?.value || "??";
  const tz = parts.find((p) => p.type === "timeZoneName")?.value || "UK";
  return `${hh}:${mm} ${tz}`;
}
function teamLabel(team) {
  const base = team?.name?.shortName || team?.shortName || team?.name?.abbreviation || team?.name?.fullName || team?.fullName || team?.key || "unknown-team";
  return highlightEngland(highlightAstonVilla(base));
}
function isAstonVillaName(name) {
  const n = normalizeText(name);
  return n === "astonvilla" || n === "avfc" || n === "avl";
}
function highlightAstonVilla(name) {
  if (!shouldUseColor() || !isAstonVillaName(name)) return name;
  return `${ANSI_BG_CLARET}${ANSI_VILLA_BLUE}AVFC${ANSI_RESET}`;
}
function isEnglandName(name) {
  const n = normalizeText(name);
  return n === "england" || n === "eng";
}
function highlightEngland(name) {
  if (!shouldUseColor() || !isEnglandName(name)) return name;
  return `${ANSI_PURPLE}${name}${ANSI_RESET}`;
}
function competitionLabel(event) {
  return event?.tournament?.disambiguatedName || event?.tournament?.name || event?.eventGroupingLabel || "Other";
}
function competitionAllowed(event) {
  const candidates = [
    event?.tournament?.disambiguatedName,
    event?.tournament?.name,
    urnSlug(event?.tournament?.urn)
  ].filter(Boolean).map(normalizeText);
  return candidates.some((candidate) => COMPETITION_ALLOWLIST.has(candidate));
}
function teamScore(team, event) {
  const direct = team?.scores?.score ?? team?.runningScores?.score ?? team?.score ?? null;
  if (direct != null) return String(direct);
  const participant = (event.participants || []).find((p) => {
    return p.alignment === (team === event.homeTeam ? "home" : "away");
  });
  const participantScore = participant?.score ?? participant?.runningScore ?? null;
  return participantScore != null ? String(participantScore) : null;
}
function isResultState(event) {
  const status = String(event.status || "").toLowerCase();
  return Boolean(status) && status !== "preevent";
}
function isFinishedState(event) {
  const status = String(event.status || "").toLowerCase();
  if (status === "postevent") return true;
  const note = String(event.eventStatusNote || "").toLowerCase();
  return note === "ft" || note.includes("full time") || note.includes("final") || note.includes("aet") || note.includes("pens");
}
function shouldUseColor() {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}
function scoreNumber(score) {
  if (score == null) return null;
  const parsed = Number.parseInt(String(score), 10);
  return Number.isNaN(parsed) ? null : parsed;
}
function colorTeamName(name, role, isLive) {
  if (isAstonVillaName(name)) return highlightAstonVilla(name);
  if (isEnglandName(name)) return highlightEngland(name);
  if (!shouldUseColor()) return name;
  if (role === "win") return `${isLive ? ANSI_DARK_GREEN : ANSI_BRIGHT_GREEN}${name}${ANSI_RESET}`;
  if (role === "loss") return `${isLive ? ANSI_DARK_RED : ANSI_BRIGHT_RED}${name}${ANSI_RESET}`;
  return `${isLive ? ANSI_DARK_YELLOW : ANSI_PALE_YELLOW}${name}${ANSI_RESET}`;
}
function fixtureLine(event, options = {}) {
  const home = teamLabel(event.homeTeam);
  const away = teamLabel(event.awayTeam);
  const statusLabel = event.eventStatusNote || event.statusText || "scheduled";
  const competitionTag = competitionLabel(event);
  const homeScore = teamScore(event.homeTeam, event);
  const awayScore = teamScore(event.awayTeam, event);
  const hasScore = homeScore != null && awayScore != null;
  const includeDate = options.includeDate === true;
  const showCompetitionTag = options.showCompetitionTag === true;
  const datePrefix = includeDate ? `${formatFixtureDate(event.startTime || event.startDateTime)} ` : "";
  const isLive = isResultState(event) && !isFinishedState(event);
  const time = eventTime(event);
  const timeDisplay = time;
  const isScheduled = normalizeText(statusLabel) === "scheduled";
  const liveStatusLabel = shouldUseColor() && isLive ? `${ANSI_BLUE}${statusLabel}${ANSI_RESET}` : statusLabel;
  const suffix = showCompetitionTag ? `(${competitionTag})` : isScheduled ? "" : `(${liveStatusLabel})`;
  const suffixWithSpace = suffix ? ` ${suffix}` : "";
  if (isResultState(event) && hasScore) {
    const homeN = scoreNumber(homeScore);
    const awayN = scoreNumber(awayScore);
    let homeDisplay = home;
    let awayDisplay = away;
    if (homeN != null && awayN != null) {
      if (homeN === awayN && (isLive || isFinishedState(event))) {
        homeDisplay = colorTeamName(home, "draw", isLive);
        awayDisplay = colorTeamName(away, "draw", isLive);
      } else if (homeN !== awayN) {
        homeDisplay = colorTeamName(home, homeN > awayN ? "win" : "loss", isLive);
        awayDisplay = colorTeamName(away, awayN > homeN ? "win" : "loss", isLive);
      }
    }
    return `${datePrefix}${timeDisplay} ${homeDisplay} ${homeScore}-${awayScore} ${awayDisplay}${suffixWithSpace}`;
  }
  return `${datePrefix}${timeDisplay} ${home} vs ${away}${suffixWithSpace}`;
}
function eventTeamSide(event, teamUrn) {
  const homeUrn = String(event.homeTeam?.urn || "");
  const awayUrn = String(event.awayTeam?.urn || "");
  if (homeUrn === teamUrn) return "home";
  if (awayUrn === teamUrn) return "away";
  const targetSlug = urnSlug(teamUrn);
  if (!targetSlug) return null;
  if (urnSlug(homeUrn) === targetSlug) return "home";
  if (urnSlug(awayUrn) === targetSlug) return "away";
  return null;
}
function teamResultOutcome(event, side) {
  if (!isResultState(event) || !isFinishedState(event)) return null;
  const homeN = scoreNumber(teamScore(event.homeTeam, event));
  const awayN = scoreNumber(teamScore(event.awayTeam, event));
  if (homeN == null || awayN == null) return null;
  const ours = side === "home" ? homeN : awayN;
  const theirs = side === "home" ? awayN : homeN;
  if (ours > theirs) return "win";
  if (ours < theirs) return "loss";
  return "draw";
}
function buildTeamCompetitionRecords(events, teamUrn) {
  const stats = /* @__PURE__ */ new Map();
  for (const event of events) {
    const side = eventTeamSide(event, teamUrn);
    if (!side) continue;
    const outcome = teamResultOutcome(event, side);
    if (!outcome) continue;
    const comp = competitionLabel(event);
    const venue = side === "home" ? "H" : "A";
    const key = `${comp}\0${venue}`;
    let row = stats.get(key);
    if (!row) {
      row = { comp, venue, wins: 0, draws: 0, losses: 0 };
      stats.set(key, row);
    }
    if (outcome === "win") row.wins += 1;
    else if (outcome === "draw") row.draws += 1;
    else row.losses += 1;
  }
  return [...stats.values()].sort((a, b) => {
    const aRank = COMPETITION_ORDER.findIndex((name) => normalizeText(name) === normalizeText(a.comp));
    const bRank = COMPETITION_ORDER.findIndex((name) => normalizeText(name) === normalizeText(b.comp));
    const aOrder = aRank === -1 ? Number.MAX_SAFE_INTEGER : aRank;
    const bOrder = bRank === -1 ? Number.MAX_SAFE_INTEGER : bRank;
    if (aOrder !== bOrder) return aOrder - bOrder;
    if (a.venue !== b.venue) return a.venue === "H" ? -1 : 1;
    return a.comp.localeCompare(b.comp);
  });
}
function printTeamCompetitionSummary(events, teamUrn) {
  const records = buildTeamCompetitionRecords(events, teamUrn);
  if (records.length === 0) return;
  const rows = records.map((row) => [
    `${row.comp} (${row.venue})`,
    String(row.wins),
    String(row.draws),
    String(row.losses)
  ]);
  console.log("");
  console.log("Record by competition (finished matches)");
  for (const line of makeAsciiTable(["Comp", "W", "D", "L"], rows)) {
    console.log(line);
  }
}
function printFixtureEvents(event) {
  if (!isResultState(event)) return;
  for (const line of matchEventLines(event.homeTeam, event.awayTeam)) {
    console.log(line);
  }
}
function printGroupedFixtures(events, heading, options = {}) {
  console.log(heading);
  if (events.length === 0) {
    console.log(options.emptyMessage || "No fixtures.");
    return;
  }
  const groups = /* @__PURE__ */ new Map();
  for (const event of events) {
    const key = competitionLabel(event);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }
  const sortedGroups = [...groups.entries()].sort(([a], [b]) => {
    const ai = COMPETITION_ORDER.findIndex((name) => normalizeText(name) === normalizeText(a));
    const bi = COMPETITION_ORDER.findIndex((name) => normalizeText(name) === normalizeText(b));
    const aRank = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
    const bRank = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
    if (aRank !== bRank) return bRank - aRank;
    return b.localeCompare(a);
  });
  for (const [competition, list] of sortedGroups) {
    list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    console.log("");
    console.log(`${competition}`);
    for (const event of list) {
      console.log(`- ${fixtureLine(event, options)}`);
      printFixtureEvents(event);
    }
  }
}
function printFlatFixtures(events, heading, options = {}) {
  console.log(heading);
  if (options.teamUrn) {
    printTeamCompetitionSummary(events, options.teamUrn);
  }
  if (events.length === 0) {
    console.log(options.emptyMessage || "No fixtures.");
    return;
  }
  const sorted = [...events].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
  for (const event of sorted) {
    console.log(`- ${fixtureLine(event, options)}`);
    printFixtureEvents(event);
  }
}
function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function slugifyTeam(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function teamUrnFromQuery(query) {
  if (String(query || "").startsWith("urn:bbc:sportsdata:football:team:")) {
    return query;
  }
  const slug = slugifyTeam(query);
  return `urn:bbc:sportsdata:football:team:${slug}`;
}
function urnSlug(urn) {
  if (!urn) return "";
  const parts = String(urn).split(":");
  return parts[parts.length - 1] || "";
}
function normalizeEvent(raw) {
  const home = raw.homeTeam || raw.home;
  const away = raw.awayTeam || raw.away;
  return {
    ...raw,
    startTime: raw.startTime || raw.startDateTime || "",
    eventStatusNote: raw.eventStatusNote || raw.statusComment?.value || raw.periodLabel?.value || raw.status || raw.statusText || "",
    homeTeam: {
      ...home,
      key: home?.key || home?.id || home?.urn || "",
      name: {
        abbreviation: home?.name?.abbreviation || home?.name?.shortName || home?.shortName || home?.fullName || "",
        shortName: home?.name?.shortName || home?.shortName || "",
        fullName: home?.name?.fullName || home?.fullName || ""
      },
      urn: home?.urn || ""
    },
    awayTeam: {
      ...away,
      key: away?.key || away?.id || away?.urn || "",
      name: {
        abbreviation: away?.name?.abbreviation || away?.name?.shortName || away?.shortName || away?.fullName,
        shortName: away?.name?.shortName || away?.shortName || "",
        fullName: away?.name?.fullName || away?.fullName || ""
      },
      urn: away?.urn || ""
    },
    participants: raw.participants || []
  };
}
function flattenEvents(matchData) {
  const events = [];
  for (const tournament of matchData || []) {
    const dateMap = tournament.tournamentDatesWithEvents || {};
    for (const slotList of Object.values(dateMap)) {
      for (const slot of slotList || []) {
        for (const event of slot.events || []) {
          events.push(normalizeEvent(event));
        }
      }
    }
  }
  events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  return events;
}
function flattenEventsFromContainer(root) {
  const events = [];
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (Array.isArray(node)) {
      for (const item of node) stack.push(item);
      continue;
    }
    if (!node || typeof node !== "object") continue;
    const n = node;
    if ((n.home || n.homeTeam) && (n.away || n.awayTeam) && (n.startTime || n.startDateTime)) {
      events.push(normalizeEvent(n));
    }
    for (const value of Object.values(n)) {
      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }
  events.sort(
    (a, b) => new Date(a.startTime || a.startDateTime).getTime() - new Date(b.startTime || b.startDateTime).getTime()
  );
  return events;
}
async function fetchMatchData(url, dayYmd) {
  const refDate = dayYmd || toYmd(/* @__PURE__ */ new Date());
  const data = await fetchBbcJson(url, refDate, "football");
  const batchShape = data?.payload?.[0]?.body?.matchData;
  if (batchShape) return flattenEvents(batchShape);
  return flattenEventsFromContainer(data);
}
function padCell(value, width) {
  const visible = value.replace(ANSI_REGEX, "").length;
  return value + " ".repeat(Math.max(0, width - visible));
}
function makeAsciiTable(headers, rows) {
  const widths = headers.map(
    (header, idx) => Math.max(
      header.replace(ANSI_REGEX, "").length,
      ...rows.map((row) => (row[idx] || "").replace(ANSI_REGEX, "").length)
    )
  );
  const border = `+-${widths.map((w) => "-".repeat(w)).join("-+-")}-+`;
  const headerLine = `| ${headers.map((h, i) => padCell(h, widths[i])).join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map((v, i) => padCell(v || "", widths[i])).join(" | ")} |`);
  return [border, headerLine, border, ...body, border];
}
function toRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}
function valueByPath(record, path) {
  const parts = path.split(".");
  let cursor = record;
  for (const part of parts) {
    const rec = toRecord(cursor);
    if (!rec) return void 0;
    cursor = rec[part];
  }
  return cursor;
}
function firstValue(record, keys) {
  for (const key of keys) {
    const v = key.includes(".") ? valueByPath(record, key) : record[key];
    if (v != null && v !== "") return v;
  }
  return void 0;
}
function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
function asString(value) {
  if (value == null) return "";
  return String(value);
}
function normalizePlRows(payload) {
  const rowsSource = Array.isArray(payload) ? payload : (() => {
    const rec = toRecord(payload);
    if (!rec) return [];
    const candidates = [
      rec.standings,
      rec.table,
      rec.data,
      rec.results,
      valueByPath(rec, "response.standings"),
      valueByPath(rec, "response.table"),
      valueByPath(rec, "response.data")
    ];
    for (const c of candidates) {
      if (Array.isArray(c)) return c;
    }
    return [];
  })();
  const normalized = [];
  for (const row of rowsSource) {
    const rec = toRecord(row);
    if (!rec) continue;
    const teamRaw = firstValue(rec, [
      "team.name",
      "team.shortName",
      "team.abbreviation"
    ]) ?? firstValue(rec, [
      "team",
      "teamName",
      "name",
      "club",
      "team.name",
      "team.shortName"
    ]);
    const team = highlightAstonVilla(asString(teamRaw));
    if (!team) continue;
    const pos = asNumber(firstValue(rec, ["position", "rank", "pos", "place"])) ?? normalized.length + 1;
    const played = asNumber(firstValue(rec, [
      "played",
      "playedGames",
      "matches",
      "p",
      "mp",
      "stats.gamesPlayed"
    ])) ?? 0;
    const won = asNumber(firstValue(rec, [
      "won",
      "wins",
      "w",
      "stats.wins"
    ])) ?? 0;
    const draw = asNumber(firstValue(rec, [
      "drawn",
      "draw",
      "draws",
      "d",
      "ties",
      "stats.ties",
      "stats.draws"
    ])) ?? 0;
    const lost = asNumber(firstValue(rec, [
      "lost",
      "losses",
      "l",
      "stats.losses",
      "stats.lost"
    ])) ?? 0;
    const gd = asNumber(firstValue(rec, [
      "goalDifference",
      "gd",
      "goalsDiff",
      "stats.goalDifference"
    ])) ?? 0;
    const points = asNumber(firstValue(rec, [
      "points",
      "pts",
      "stats.points"
    ])) ?? 0;
    const rankFromStats = asNumber(firstValue(rec, ["stats.rank"]));
    const finalPos = rankFromStats ?? pos;
    normalized.push({ pos: finalPos, team, played, won, draw, lost, gd, points });
  }
  normalized.sort((a, b) => a.pos - b.pos);
  return normalized.map((r) => [
    String(r.pos),
    r.team,
    String(r.played),
    String(r.won),
    String(r.draw),
    String(r.lost),
    String(r.gd),
    String(r.points)
  ]);
}
async function printPremierLeagueTable() {
  const config = readPhoneCliConfig();
  const ballConfig = config.ball || {};
  const rapidApiKey = String(
    ballConfig.rapidApiKey || ballConfig.rapidapiKey || ballConfig.plRapidApiKey || process.env.RAPIDAPI_KEY || ""
  ).trim();
  if (!rapidApiKey) {
    throw new Error(
      `Missing RapidAPI key. Set ball.rapidApiKey in ${getConfigPath()} or RAPIDAPI_KEY env var.`
    );
  }
  const response = await fetch(PL_STANDINGS_URL, {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": PL_RAPID_HOST,
      "x-rapidapi-key": rapidApiKey
    }
  });
  if (!response.ok) {
    throw new Error(`Premier League table request failed (${response.status})`);
  }
  const payload = await response.json();
  const rows = normalizePlRows(payload);
  if (rows.length === 0) {
    throw new Error("Premier League table response returned no rows.");
  }
  const heading = `Premier League Table (at ${formatPrintedAtTimestamp()})`;
  console.log(heading);
  for (const line of makeAsciiTable(["#", "Team", "P", "W", "D", "L", "GD", "Pts"], rows)) {
    console.log(line);
  }
}
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === "--help" || args[0] === "-h") {
    return { help: true };
  }
  if (args.length === 0) {
    return { defaultThreeDays: true };
  }
  if (args.length > 1) {
    throw new Error("Pass either a date (YYYY-MM-DD) or a single team value.");
  }
  const input = args[0];
  if (String(input).trim().toLowerCase() === "pl") {
    return { keyword: "pl" };
  }
  const dayParsers = [parseRelativeDayInput, parseYmd, parseDayMonthInput];
  for (const parser of dayParsers) {
    const parsed = parser(input);
    if (parsed) return { day: toYmd(parsed) };
  }
  const normalizedTeam = String(input || "").toLowerCase();
  const teamQueryBase = normalizedTeam;
  const teamQuery = TEAM_QUERY_ALIASES[teamQueryBase] || teamQueryBase;
  return { teamQuery, teamInput: input, teamUrn: teamUrnFromQuery(teamQuery) };
}
async function fixturesForDay(dayYmd, relativeHeading) {
  const today = toYmd(/* @__PURE__ */ new Date());
  const url = urlForDaysGames(today, dayYmd, dayYmd);
  const events = (await fetchMatchData(url, dayYmd)).filter(competitionAllowed);
  const heading = relativeHeading !== void 0 ? `${ANSI_ORANGE}=== Fixtures for ${relativeHeading} (${formatYmdLondonShort(dayYmd)}) ===${ANSI_RESET}` : `Fixtures for ${dayYmd} (at ${formatPrintedAtTimestamp()})`;
  if (relativeHeading !== void 0) {
    console.log("");
    console.log("");
  }
  printGroupedFixtures(events, heading);
}
async function futureFixturesForTeam(teamQuery, teamInput, teamUrn) {
  const now = /* @__PURE__ */ new Date();
  const seasonStart = startOfMostRecentAugust(now);
  const start = toYmd(seasonStart);
  const end = toYmd(new Date(now.getTime() + 59 * DAY_MS));
  const url = urlForTeamGames(start, end, start, teamUrn);
  const events = (await fetchMatchData(url, start)).filter((event) => {
    const dt = new Date(event.startTime || event.startDateTime);
    return dt.getTime() >= seasonStart.getTime();
  });
  printFlatFixtures(events, `Future fixtures for ${teamInput || teamQuery} (at ${formatPrintedAtTimestamp()})`, {
    includeDate: true,
    showCompetitionTag: true,
    teamUrn,
    emptyMessage: `No fixtures since ${formatYmdLondonShort(start)} or in the next 30 days.`
  });
}
async function main() {
  try {
    const parsed = parseArgs(process.argv);
    if ("help" in parsed && parsed.help) {
      usage();
      return;
    }
    if ("defaultThreeDays" in parsed && parsed.defaultThreeDays) {
      for (const row of defaultThreeDayRows()) {
        await fixturesForDay(row.ymd, row.relative);
      }
      return;
    }
    if ("day" in parsed) {
      await fixturesForDay(parsed.day);
      return;
    }
    if ("keyword" in parsed && parsed.keyword === "pl") {
      await printPremierLeagueTable();
      return;
    }
    if ("teamQuery" in parsed) {
      await futureFixturesForTeam(parsed.teamQuery, parsed.teamInput, parsed.teamUrn);
      return;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    console.error("");
    usage();
    process.exit(1);
  }
}
void main();
