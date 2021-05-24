#!/usr/bin/env node
'use strict';
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
const argparse_1 = require("argparse");
const debug_1 = __importDefault(require("debug"));
const fs_extra_promise_1 = __importDefault(require("fs-extra-promise"));
const lodash_1 = __importDefault(require("lodash"));
const path_1 = require("path");
const typescript_1 = __importDefault(require("typescript"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const path_2 = __importDefault(require("path"));
const config_js_1 = require("./config.js");
const metadataGenerator_js_1 = require("./metadata/metadataGenerator.js");
const generator_js_1 = require("./swagger/generator.js");
const read_pkg_js_1 = require("./read-pkg.js");
const debugLog = debug_1.default('typescript-rest-swagger');
const workingDir = process.cwd();
function getPackageJsonValue(key) {
    try {
        const projectPackageJson = read_pkg_js_1.readPackageSync();
        return projectPackageJson[key] || '';
    }
    catch (err) {
        return '';
    }
}
const versionDefault = getPackageJsonValue('version');
const nameDefault = getPackageJsonValue('name');
const descriptionDefault = getPackageJsonValue('description');
const licenseDefault = getPackageJsonValue('license');
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
    conf.outputFormat = conf.outputFormat ? config_js_1.Specification[conf.outputFormat] : config_js_1.Specification.Swagger_2;
    return conf;
}
async function getConfig(configPath = 'swagger.json') {
    const configFile = `${workingDir}/${configPath}`;
    if (lodash_1.default.endsWith(configFile, '.yml') || lodash_1.default.endsWith(configFile, '.yaml')) {
        return js_yaml_1.default.load(configFile);
    }
    else if (lodash_1.default.endsWith(configFile, '.js') || lodash_1.default.endsWith(configFile, '.mjs') || lodash_1.default.endsWith(configFile, '.cjs')) {
        return Promise.resolve().then(() => __importStar(require(path_2.default.join(configFile))));
    }
    else {
        return fs_extra_promise_1.default.readJSON(configFile);
    }
}
async function getCompilerOptions(loadTsconfig, tsconfigPath) {
    if (!loadTsconfig && tsconfigPath) {
        loadTsconfig = true;
    }
    if (!loadTsconfig) {
        return {};
    }
    const cwd = process.cwd();
    const defaultTsconfigPath = path_1.join(cwd, 'tsconfig.json');
    tsconfigPath = tsconfigPath
        ? getAbsolutePath(tsconfigPath, cwd)
        : defaultTsconfigPath;
    try {
        const tsConfig = require(tsconfigPath);
        if (!tsConfig) {
            throw new Error('Invalid tsconfig');
        }
        return tsConfig.compilerOptions
            ? typescript_1.default.convertCompilerOptionsFromJson(tsConfig.compilerOptions, cwd).options
            : {};
    }
    catch (err) {
        if (err.code === 'MODULE_NOT_FOUND') {
            throw Error(`No tsconfig file found at '${tsconfigPath}'`);
        }
        else if (err.name === 'SyntaxError') {
            throw Error(`Invalid JSON syntax in tsconfig at '${tsconfigPath}': ${err.message}`);
        }
        else {
            throw Error(`Unhandled error encountered loading tsconfig '${tsconfigPath}': ${err.message}`);
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
(async () => {
    const packageJson = await read_pkg_js_1.readPackageAsync({ cwd: path_2.default.resolve(__dirname, "..") });
    const parser = new argparse_1.ArgumentParser({
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
    const parameters = parser.parseArgs();
    const compilerOptions = await getCompilerOptions(parameters.tsconfig, parameters.tsconfig_path);
    debugLog('Starting Swagger generation tool');
    debugLog('Compiler Options: %j', compilerOptions);
    const config = await getConfig(parameters.config);
    const swaggerConfig = validateSwaggerConfig(config.swagger);
    debugLog('Swagger Config: %j', swaggerConfig);
    debugLog('Processing Services Metadata');
    const metadata = new metadataGenerator_js_1.MetadataGenerator(swaggerConfig.entryFile, compilerOptions, swaggerConfig.ignore).generate();
    debugLog('Generated Metadata: %j', metadata);
    return new generator_js_1.SpecGenerator(metadata, swaggerConfig).generate();
})().then(() => {
    console.info('Generation completed.');
}).catch((err) => {
    console.error('Error generating swagger', err);
});
//# sourceMappingURL=cli.js.map