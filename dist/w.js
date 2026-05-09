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
    var stripAnsi2 = require_strip_ansi();
    var isFullwidthCodePoint = require_is_fullwidth_code_point();
    var emojiRegex = require_emoji_regex();
    var stringWidth2 = (string) => {
      if (typeof string !== "string" || string.length === 0) {
        return 0;
      }
      string = stripAnsi2(string);
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

// w.ts
var w_exports = {};
module.exports = __toCommonJS(w_exports);
var import_strip_ansi = __toESM(require_strip_ansi());
var import_string_width = __toESM(require_string_width());

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

// lib/temperatureColours.ts
var ANSI_RESET = "\x1B[0m";
var ANSI_BLUE = "\x1B[34m";
var ANSI_GREEN = "\x1B[32m";
var ANSI_YELLOW = "\x1B[33m";
var ANSI_ORANGE = "\x1B[38;5;208m";
var ANSI_RED = "\x1B[31m";
function shouldUseColor() {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}
function colorize(value, color) {
  if (!shouldUseColor()) return value;
  return `${color}${value}${ANSI_RESET}`;
}
function colourTemperatureText(text, value, _scale = "max") {
  if (value < 5) return colorize(text, ANSI_BLUE);
  if (value <= 10) return colorize(text, ANSI_GREEN);
  if (value <= 16) return colorize(text, ANSI_YELLOW);
  if (value <= 23) return colorize(text, ANSI_ORANGE);
  return colorize(text, ANSI_RED);
}
function formatTemperatureText(value, options) {
  if (value == null) return options?.unknownText ?? "?";
  const fractionDigits = options?.fractionDigits ?? 0;
  const text = `${value.toFixed(fractionDigits)}C`;
  return colourTemperatureText(text, value, options?.scale ?? "max");
}

// w.ts
var WEATHER_BASE_URL = "https://weather-broker-cdn.api.bbci.co.uk/en/forecast/aggregated";
var MOON_API_URL = "https://moon-phases-api-apiverve.p.rapidapi.com/v1/";
var MOON_API_HOST = "moon-phases-api-apiverve.p.rapidapi.com";
var DEFAULT_POSTCODE = "cm2";
var ANSI_RESET2 = "\x1B[0m";
var ANSI_GREEN2 = "\x1B[32m";
var ANSI_YELLOW2 = "\x1B[33m";
var ANSI_ORANGE2 = "\x1B[38;5;208m";
var ANSI_RED2 = "\x1B[31m";
var HEAVY_RAIN_WORDING = /\b(heavy rain|heavy showers?|heavy downpour|torrential)\b/;
var LIGHT_RAIN_WORDING = /\b(light rain showers?|light showers?|light rain|drizzle)\b/;
var EXTENDED_PICTOGRAPHIC = new RegExp("\\p{Extended_Pictographic}", "u");
function visibleLength(value) {
  return (0, import_string_width.default)((0, import_strip_ansi.default)(value));
}
function emojiTerminalDisplayWidth(value) {
  const plain = (0, import_strip_ansi.default)(value);
  if (!plain) return 0;
  try {
    const segmenter = new Intl.Segmenter(void 0, { granularity: "grapheme" });
    let total = 0;
    for (const { segment } of segmenter.segment(plain)) {
      const sw = (0, import_string_width.default)(segment);
      if (EXTENDED_PICTOGRAPHIC.test(segment)) {
        let w = Math.max(sw, 2);
        total += w - 1;
      } else if (new RegExp("\\p{Regional_Indicator}", "u").test(segment)) {
        total += Math.max(sw, 2);
      } else {
        total += sw;
      }
    }
    return total;
  } catch {
    return visibleLength(value);
  }
}
function usage() {
  console.log("Usage:");
  console.log("  w");
  console.log("  w <postcode>");
  console.log("");
  console.log("Examples:");
  console.log("  w");
  console.log("  w ws9");
  console.log("  w sw1a");
  console.log("");
}
function sanitizePostcode(input) {
  return String(input || "").trim().toLowerCase().replace(/\s+/g, "");
}
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === "--help" || args[0] === "-h") {
    return { help: true };
  }
  if (args.length === 0) {
    return { postcode: DEFAULT_POSTCODE };
  }
  if (args.length > 1) {
    throw new Error("Pass at most one postcode.");
  }
  const postcode = sanitizePostcode(args[0]);
  if (!postcode) {
    return { postcode: DEFAULT_POSTCODE };
  }
  return { postcode };
}
async function fetchWeather(postcode) {
  const url = `${WEATHER_BASE_URL}/${encodeURIComponent(postcode)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "*/*",
      "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Priority: "u=1, i",
      Referer: "https://www.bbc.co.uk/"
    }
  });
  if (!response.ok) {
    throw new Error(`Weather API request failed (${response.status})`);
  }
  return await response.json();
}
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function resolveMoonRapidApiKey() {
  const config = readPhoneCliConfig();
  const ballConfig = asRecord(config.ball);
  return String(ballConfig?.rapidApiKey || "").trim();
}
function toMoonDate(localDate) {
  if (!localDate) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}
async function fetchMoonPhase(localDate) {
  const apiKey = resolveMoonRapidApiKey();
  if (!apiKey) {
    return "moon api key not set";
  }
  const moonDate = toMoonDate(localDate);
  if (!moonDate) {
    return "-";
  }
  const response = await fetch(`${MOON_API_URL}?date=${encodeURIComponent(moonDate)}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-rapidapi-host": MOON_API_HOST,
      "x-rapidapi-key": apiKey
    }
  });
  if (!response.ok) {
    return "no api calls for moon data left";
  }
  const payload = await response.json();
  const phase = payload.data?.phase ? String(payload.data.phase).trim() : "";
  const emoji = payload.data?.phaseEmoji ? String(payload.data.phaseEmoji).trim() : "";
  if (!phase && !emoji) {
    return "-";
  }
  return `${emoji} ${phase}`.trim();
}
function formatWeatherDisplay(weatherTypeText, enhancedWeatherDescription) {
  const description = (weatherTypeText || enhancedWeatherDescription || "Unknown").trim() || "Unknown";
  const lower = description.toLowerCase();
  if (/\b(snow|sleet|hail|blizzard|ice pellets|freezing rain|wintry|wintry showers)\b/.test(lower)) {
    return { icon: "\u2744\uFE0F", description };
  }
  if (HEAVY_RAIN_WORDING.test(lower)) {
    return { icon: "\u26C8\uFE0F\u26C8\uFE0F", description };
  }
  if (LIGHT_RAIN_WORDING.test(lower)) {
    return { icon: "\u26C8\uFE0F", description };
  }
  if (/\b(light cloud|thin cloud|partly cloudy|partly sunny|sunny intervals|medium cloud|bright intervals)\b/.test(
    lower
  )) {
    return { icon: "\u26C5\uFE0F", description };
  }
  if (/\bsunny\b/.test(lower) && !/\bnot\s+sunny\b/.test(lower)) {
    return { icon: "\u2600\uFE0F", description };
  }
  if (/\b(overcast|heavy cloud|thick cloud|grey cloud|gray cloud|cloudy)\b/.test(lower)) {
    return { icon: "\u2601\uFE0F", description };
  }
  if (/\bclear\s+sky\b/.test(lower)) {
    return { icon: "\u263E", description };
  }
  return { icon: "", description };
}
function formatDayCells(report) {
  const date = formatDisplayDate(report.localDate);
  const wx = formatWeatherDisplay(report.weatherTypeText, report.enhancedWeatherDescription);
  const hi = formatMaxTemp(report.maxTempC);
  const lo = formatMinTemp(report.minTempC);
  const rain = formatRain(report.precipitationProbabilityInPercent);
  const windSpeed = formatWindSpeed(report.windSpeedMph);
  const windDir = report.windDirectionAbbreviation || "?";
  return [date, wx.icon, wx.description, lo, hi, rain, `${windSpeed} ${windDir}`];
}
function formatDisplayDate(localDate) {
  if (!localDate) return "unknown-date";
  const d = /* @__PURE__ */ new Date(`${localDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return localDate;
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const day = d.toLocaleDateString("en-GB", { day: "2-digit" });
  const month = d.toLocaleDateString("en-GB", { month: "2-digit" });
  return `${weekday} ${day}/${month}`;
}
function formatHourlyTemp(value) {
  if (value == null) return "?";
  return formatMaxTemp(value);
}
function formatHourlyCells(report) {
  const time = report.timeslot || "??:??";
  const wx = formatWeatherDisplay(report.weatherTypeText, report.enhancedWeatherDescription);
  const temp = formatHourlyTemp(report.temperatureC);
  const rain = formatRain(report.precipitationProbabilityInPercent);
  const windSpeed = formatWindSpeed(report.windSpeedMph);
  const windDir = report.windDirectionAbbreviation || "?";
  return [time, wx.icon, wx.description, temp, rain, `${windSpeed} ${windDir}`];
}
function parseClockMinutes(value) {
  if (!value) return null;
  const m = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hh = Number.parseInt(m[1], 10);
  const mm = Number.parseInt(m[2], 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}
function formatDayLength(sunrise, sunset) {
  const start = parseClockMinutes(sunrise);
  const end = parseClockMinutes(sunset);
  if (start == null || end == null || end < start) {
    return "-";
  }
  const total = end - start;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}
function formatPollen(report) {
  if (!report) return "-";
  const index = report.pollenIndex;
  const text = report.pollenIndexText ? String(report.pollenIndexText).trim() : "";
  if (index == null && !text) return "-";
  if (index == null) return text;
  if (!text) return String(index);
  return `${index} (${text})`;
}
function shouldUseColor2() {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}
function colorize2(value, color) {
  if (!shouldUseColor2()) return value;
  return `${color}${value}${ANSI_RESET2}`;
}
function formatMaxTemp(value) {
  return formatTemperatureText(value, { scale: "max" });
}
function formatMinTemp(value) {
  return formatTemperatureText(value, { scale: "min" });
}
function formatRain(value) {
  if (value == null) return "?%";
  const text = `${value}%`;
  const colored = value > 80 ? colorize2(text, ANSI_RED2) : value >= 50 ? colorize2(text, ANSI_ORANGE2) : value >= 25 ? colorize2(text, ANSI_YELLOW2) : colorize2(text, ANSI_GREEN2);
  return colored;
}
function formatWindSpeed(value) {
  if (value == null) return "?mph";
  const text = `${value}mph`;
  if (value > 40) return colorize2(text, ANSI_RED2);
  if (value >= 20) return colorize2(text, ANSI_ORANGE2);
  if (value >= 10) return colorize2(text, ANSI_YELLOW2);
  return colorize2(text, ANSI_GREEN2);
}
function cellWidthForTable(colIdx, value, colWidthFns) {
  const fn = colWidthFns?.[colIdx];
  if (fn) return fn(value);
  return visibleLength(value);
}
function makeAsciiTable(headers, rows, forcedWidths, colWidthFns) {
  const padCell = (value, colIdx, width) => {
    const vw = cellWidthForTable(colIdx, value, colWidthFns);
    const padCount = width - vw;
    return padCount > 0 ? `${value}${" ".repeat(padCount)}` : value;
  };
  const widths = headers.map((header, colIdx) => {
    let max = Math.max(cellWidthForTable(colIdx, header, colWidthFns), forcedWidths?.[colIdx] || 0);
    for (const row of rows) {
      const cell = row[colIdx] || "";
      const len = cellWidthForTable(colIdx, cell, colWidthFns);
      if (len > max) max = len;
    }
    return max;
  });
  const border = `+${widths.map((w) => "-".repeat(w + 2)).join("+")}+`;
  const renderRow = (cells) => `| ${cells.map((cell, i) => padCell(cell || "", i, widths[i])).join(" | ")} |`;
  const lines = [border, renderRow(headers), border];
  for (const row of rows) {
    lines.push(renderRow(row));
  }
  lines.push(border);
  return lines;
}
async function printForecast(data, requestedPostcode) {
  const location = data.location?.name || data.location?.id || requestedPostcode.toUpperCase();
  const lastUpdated = data.lastUpdated || "unknown";
  const reports = (data.forecasts || []).map((f) => f.summary?.report).filter((r) => Boolean(r));
  console.log(`Weather for ${location}`);
  console.log(`Last updated: ${lastUpdated}`);
  console.log("");
  if (reports.length === 0) {
    console.log("No daily forecast data available.");
    return;
  }
  const forecastColWidthFns = { 1: emojiTerminalDisplayWidth };
  const todayExtrasColWidthFns = { 4: emojiTerminalDisplayWidth };
  const dayHeaders = ["Date", "Ic", "Weather", "Min", "Max", "Rain", "Wind"];
  const dayRows = reports.map((report) => formatDayCells(report));
  const hourlyReports = (data.forecasts || []).flatMap((f) => f.detailed?.reports || []).filter((r) => Boolean(r && r.localDate && r.timeslot));
  const todayDate = reports[0]?.localDate || "";
  const tomorrowDate = reports[1]?.localDate || "";
  const rowsForDate = (date) => {
    if (!date) return [];
    return hourlyReports.filter((r) => r.localDate === date).sort((a, b) => (a.timeslot || "").localeCompare(b.timeslot || "")).map((report) => formatHourlyCells(report));
  };
  const todayHourlyRows = rowsForDate(todayDate);
  const tomorrowHourlyRows = rowsForDate(tomorrowDate);
  const allHourlyRows = [...tomorrowHourlyRows, ...todayHourlyRows];
  const minTempColWidth = Math.max(
    visibleLength("Min"),
    ...dayRows.map((r) => visibleLength(r[3] || ""))
  );
  const maxTempColWidth = Math.max(
    visibleLength("Max"),
    ...dayRows.map((r) => visibleLength(r[4] || ""))
  );
  const tempWidth = Math.max(
    visibleLength("Temp"),
    minTempColWidth,
    maxTempColWidth,
    ...allHourlyRows.map((r) => visibleLength(r[3] || ""))
  );
  const sharedWidths = {
    dateOrTime: Math.max(
      visibleLength("Date"),
      visibleLength("Time"),
      ...dayRows.map((r) => visibleLength(r[0] || "")),
      ...allHourlyRows.map((r) => visibleLength(r[0] || ""))
    ),
    icon: Math.max(
      emojiTerminalDisplayWidth("Ic"),
      ...dayRows.map((r) => emojiTerminalDisplayWidth(r[1] || "")),
      ...allHourlyRows.map((r) => emojiTerminalDisplayWidth(r[1] || ""))
    ),
    weather: Math.max(
      visibleLength("Weather"),
      ...dayRows.map((r) => visibleLength(r[2] || "")),
      ...allHourlyRows.map((r) => visibleLength(r[2] || ""))
    ),
    rain: Math.max(
      visibleLength("Rain"),
      ...dayRows.map((r) => visibleLength(r[5] || "")),
      ...allHourlyRows.map((r) => visibleLength(r[4] || ""))
    ),
    wind: Math.max(
      visibleLength("Wind"),
      ...dayRows.map((r) => visibleLength(r[6] || "")),
      ...allHourlyRows.map((r) => visibleLength(r[5] || ""))
    )
  };
  const hourlyHeaders = ["Time", "Ic", "Weather", "Temp", "Rain", "Wind"];
  const hourlyWidths = [
    sharedWidths.dateOrTime,
    sharedWidths.icon,
    sharedWidths.weather,
    tempWidth,
    sharedWidths.rain,
    sharedWidths.wind
  ];
  const printHourlySection = (date, rows) => {
    if (!date || rows.length === 0) return;
    console.log(`Hourly forecast for ${formatDisplayDate(date)}`);
    const lines = makeAsciiTable(hourlyHeaders, rows, hourlyWidths, forecastColWidthFns);
    for (const line of lines) {
      console.log(line);
    }
    console.log("");
  };
  printHourlySection(tomorrowDate, tomorrowHourlyRows);
  printHourlySection(todayDate, todayHourlyRows);
  if (todayDate) {
    const moon = await fetchMoonPhase(todayDate);
    const todayReport = reports.find((r) => r.localDate === todayDate) || reports[0];
    const extrasRows = [[
      formatPollen(todayReport),
      todayReport?.sunrise || "-",
      todayReport?.sunset || "-",
      formatDayLength(todayReport?.sunrise, todayReport?.sunset),
      moon
    ]];
    console.log(`Today extras (${formatDisplayDate(todayDate)})`);
    const extraLines = makeAsciiTable(
      ["Pollen", "Sunrise", "Sunset", "Day length", "Moon"],
      extrasRows,
      void 0,
      todayExtrasColWidthFns
    );
    for (const line of extraLines) {
      console.log(line);
    }
    console.log("");
  }
  console.log("Daily forecast");
  const dayWidths = [
    sharedWidths.dateOrTime,
    sharedWidths.icon,
    sharedWidths.weather,
    tempWidth,
    tempWidth,
    sharedWidths.rain,
    sharedWidths.wind
  ];
  const dayTableLines = makeAsciiTable(dayHeaders, dayRows, dayWidths, forecastColWidthFns);
  for (const line of dayTableLines) {
    console.log(line);
  }
}
async function main() {
  try {
    const parsed = parseArgs(process.argv);
    if (parsed.help) {
      usage();
      return;
    }
    const postcode = parsed.postcode || DEFAULT_POSTCODE;
    const data = await fetchWeather(postcode);
    await printForecast(data, postcode);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    console.error("");
    usage();
    process.exit(1);
  }
}
void main();
