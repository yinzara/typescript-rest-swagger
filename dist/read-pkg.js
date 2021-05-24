"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readPackageSync = exports.readPackageAsync = void 0;
const fs_1 = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const parse_json_1 = __importDefault(require("parse-json"));
const normalize_package_data_1 = __importDefault(require("normalize-package-data"));
async function readPackageAsync({ cwd = process.cwd(), normalize = true } = {}) {
    const filePath = path_1.default.resolve(cwd, 'package.json');
    const json = parse_json_1.default(await fs_1.promises.readFile(filePath, 'utf8'));
    if (normalize) {
        normalize_package_data_1.default(json);
    }
    return json;
}
exports.readPackageAsync = readPackageAsync;
function readPackageSync({ cwd = process.cwd(), normalize = true } = {}) {
    const filePath = path_1.default.resolve(cwd, 'package.json');
    const json = parse_json_1.default(fs_1.default.readFileSync(filePath, 'utf8'));
    if (normalize) {
        normalize_package_data_1.default(json);
    }
    return json;
}
exports.readPackageSync = readPackageSync;
//# sourceMappingURL=read-pkg.js.map