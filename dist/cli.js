#!/usr/bin/env node
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var argparse_1 = require("argparse");
var debug = require("debug");
var fs = require("fs-extra-promise");
var _ = require("lodash");
var path_1 = require("path");
var ts = require("typescript");
var YAML = require("js-yaml");
var path = require("path");
var config_1 = require("./config");
var metadataGenerator_1 = require("./metadata/metadataGenerator");
var generator_1 = require("./swagger/generator");
var debugLog = debug('typescript-rest-swagger');
var packageJson = require("../package.json");
var workingDir = process.cwd();
var versionDefault = getPackageJsonValue('version');
var nameDefault = getPackageJsonValue('name');
var descriptionDefault = getPackageJsonValue('description');
var licenseDefault = getPackageJsonValue('license');
var parser = new argparse_1.ArgumentParser({
    addHelp: true,
    description: 'Typescript-REST Swagger tool',
    version: packageJson.version
});
parser.addArgument(['-c', '--config'], {
    help: 'The swagger config file (swagger.json or swagger.yml or swaggerCongig.js).'
});
parser.addArgument(['-t', '--tsconfig'], {
    action: 'storeTrue',
    defaultValue: false,
    help: 'Load tsconfig.json file',
});
parser.addArgument(['-p', '--tsconfig_path'], {
    help: 'The tsconfig file (tsconfig.json) path. Default to {cwd}/tsconfig.json.',
});
function getPackageJsonValue(key) {
    try {
        var projectPackageJson = require(workingDir + "/package.json");
        return projectPackageJson[key] || '';
    }
    catch (err) {
        return '';
    }
}
function getConfig(configPath) {
    if (configPath === void 0) { configPath = 'swagger.json'; }
    return __awaiter(this, void 0, void 0, function () {
        var configFile;
        return __generator(this, function (_a) {
            configFile = workingDir + "/" + configPath;
            if (_.endsWith(configFile, '.yml') || _.endsWith(configFile, '.yaml')) {
                return [2 /*return*/, YAML.load(configFile)];
            }
            else if (_.endsWith(configFile, '.js') || _.endsWith(configFile, '.mjs') || _.endsWith(configFile, '.cjs')) {
                return [2 /*return*/, Promise.resolve().then(function () { return require(path.join(configFile)); })];
            }
            else {
                return [2 /*return*/, fs.readJSON(configFile)];
            }
            return [2 /*return*/];
        });
    });
}
function validateSwaggerConfig(conf) {
    if (!conf.outputDirectory) {
        throw new Error('Missing outputDirectory: onfiguration most contain output directory');
    }
    if (!conf.entryFile) {
        throw new Error('Missing entryFile: Configuration must contain an entry point file.');
    }
    conf.version = conf.version || versionDefault;
    conf.name = conf.name || nameDefault;
    conf.description = conf.description || descriptionDefault;
    conf.license = conf.license || licenseDefault;
    conf.yaml = conf.yaml === false ? false : true;
    conf.outputFormat = conf.outputFormat ? config_1.Specification[conf.outputFormat] : config_1.Specification.Swagger_2;
    return conf;
}
function getCompilerOptions(loadTsconfig, tsconfigPath) {
    if (!loadTsconfig && tsconfigPath) {
        loadTsconfig = true;
    }
    if (!loadTsconfig) {
        return {};
    }
    var cwd = process.cwd();
    var defaultTsconfigPath = path_1.join(cwd, 'tsconfig.json');
    tsconfigPath = tsconfigPath
        ? getAbsolutePath(tsconfigPath, cwd)
        : defaultTsconfigPath;
    try {
        var tsConfig = require(tsconfigPath);
        if (!tsConfig) {
            throw new Error('Invalid tsconfig');
        }
        return tsConfig.compilerOptions
            ? ts.convertCompilerOptionsFromJson(tsConfig.compilerOptions, cwd).options
            : {};
    }
    catch (err) {
        if (err.code === 'MODULE_NOT_FOUND') {
            throw Error("No tsconfig file found at '" + tsconfigPath + "'");
        }
        else if (err.name === 'SyntaxError') {
            throw Error("Invalid JSON syntax in tsconfig at '" + tsconfigPath + "': " + err.message);
        }
        else {
            throw Error("Unhandled error encountered loading tsconfig '" + tsconfigPath + "': " + err.message);
        }
    }
}
function getAbsolutePath(pth, basePath) {
    if (path_1.isAbsolute(pth)) {
        return pth;
    }
    else {
        return path_1.join(basePath, pth);
    }
}
// actually run SpecGenerator
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var parameters, compilerOptions, config, swaggerConfig, metadata;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                parameters = parser.parseArgs();
                compilerOptions = getCompilerOptions(parameters.tsconfig, parameters.tsconfig_path);
                debugLog('Starting Swagger generation tool');
                debugLog('Compiler Options: %j', compilerOptions);
                return [4 /*yield*/, getConfig(parameters.config)];
            case 1:
                config = _a.sent();
                swaggerConfig = validateSwaggerConfig(config.swagger);
                debugLog('Swagger Config: %j', swaggerConfig);
                debugLog('Processing Services Metadata');
                metadata = new metadataGenerator_1.MetadataGenerator(swaggerConfig.entryFile, compilerOptions, swaggerConfig.ignore).generate();
                debugLog('Generated Metadata: %j', metadata);
                return [2 /*return*/, new generator_1.SpecGenerator(metadata, swaggerConfig).generate()];
        }
    });
}); })().then(function () {
    console.info('Generation completed.');
}).catch(function (err) {
    console.error('Error generating swagger', err);
});
//# sourceMappingURL=cli.js.map