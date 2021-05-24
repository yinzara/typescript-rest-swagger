"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetadataGenerator = void 0;
const debug_1 = __importDefault(require("debug"));
const glob_1 = __importDefault(require("glob"));
const lodash_1 = __importDefault(require("lodash"));
const minimatch_1 = __importDefault(require("minimatch"));
const typescript_1 = __importDefault(require("typescript"));
const decoratorUtils_js_1 = require("../utils/decoratorUtils.js");
const controllerGenerator_js_1 = require("./controllerGenerator.js");
class MetadataGenerator {
    constructor(entryFile, compilerOptions, ignorePaths) {
        this.ignorePaths = ignorePaths;
        this.nodes = new Array();
        this.referenceTypes = {};
        this.circularDependencyResolvers = new Array();
        this.debugger = debug_1.default('typescript-rest-swagger:metadata');
        const sourceFiles = this.getSourceFiles(entryFile);
        this.debugger('Starting Metadata Generator');
        this.debugger('Source files: %j ', sourceFiles);
        this.debugger('Compiler Options: %j ', compilerOptions);
        this.program = typescript_1.default.createProgram(sourceFiles, compilerOptions);
        this.typeChecker = this.program.getTypeChecker();
        MetadataGenerator.current = this;
    }
    generate() {
        this.program.getSourceFiles().forEach(sf => {
            if (this.ignorePaths && this.ignorePaths.length) {
                for (const path of this.ignorePaths) {
                    if (!sf.fileName.includes('node_modules/typescript-rest/') && minimatch_1.default(sf.fileName, path)) {
                        return;
                    }
                }
            }
            typescript_1.default.forEachChild(sf, node => {
                this.nodes.push(node);
            });
        });
        this.debugger('Building Metadata for controllers Generator');
        const controllers = this.buildControllers();
        this.debugger('Handling circular references');
        this.circularDependencyResolvers.forEach(c => c(this.referenceTypes));
        return {
            controllers: controllers,
            referenceTypes: this.referenceTypes
        };
    }
    TypeChecker() {
        return this.typeChecker;
    }
    addReferenceType(referenceType) {
        if (!('circular' in referenceType)) { // don't add circular references
            this.referenceTypes[referenceType.typeName] = referenceType;
        }
    }
    getReferenceType(typeName) {
        return this.referenceTypes[typeName];
    }
    onFinish(callback) {
        this.circularDependencyResolvers.push(callback);
    }
    getClassDeclaration(className, nodes = this.nodes) {
        const moduleIndex = className.indexOf('.');
        let found;
        if (moduleIndex > 0) {
            const moduleName = className.substring(0, moduleIndex);
            found = nodes
                .map(node => node)
                .filter(node => node.kind === typescript_1.default.SyntaxKind.ModuleDeclaration && node.name && node.name.text === moduleName)
                .map(node => 'statements' in node.body && this.getClassDeclaration(className.substring(moduleIndex + 1), node.body.statements))
                .filter(node => node);
        }
        else {
            found = nodes
                .map(node => node)
                .filter(node => node.kind === typescript_1.default.SyntaxKind.ClassDeclaration && node.name && node.name.text === className);
        }
        if (found && found.length) {
            return found[0];
        }
        return undefined;
    }
    getInterfaceDeclaration(className, nodes = this.nodes) {
        const moduleIndex = className.indexOf('.');
        let found;
        if (moduleIndex > 0) {
            const moduleName = className.substring(0, moduleIndex);
            found = nodes
                .map(node => node)
                .filter(node => node.kind === typescript_1.default.SyntaxKind.ModuleDeclaration && node.name && node.name.text === moduleName)
                .map(node => 'statements' in node.body && this.getInterfaceDeclaration(className.substring(moduleIndex + 1), node.body.statements))
                .filter(node => node);
        }
        else {
            found = nodes
                .map(node => node)
                .filter(node => node.kind === typescript_1.default.SyntaxKind.InterfaceDeclaration && node.name && node.name.text === className);
        }
        if (found && found.length) {
            return found[0];
        }
        return undefined;
    }
    getSourceFiles(sourceFiles) {
        this.debugger('Getting source files from expressions');
        this.debugger('Source file patterns: %j ', sourceFiles);
        const sourceFilesExpressions = lodash_1.default.castArray(sourceFiles);
        const result = new Set();
        const options = { cwd: process.cwd() };
        sourceFilesExpressions.forEach(pattern => {
            this.debugger('Searching pattern: %s with options: %j', pattern, options);
            const matches = glob_1.default.sync(pattern, options);
            matches.forEach(file => result.add(file));
        });
        return Array.from(result);
    }
    buildControllers() {
        return this.nodes
            .filter(node => node.kind === typescript_1.default.SyntaxKind.ClassDeclaration)
            .filter(node => !decoratorUtils_js_1.isDecorator(node, decorator => 'Hidden' === decorator.text))
            .map((classDeclaration) => new controllerGenerator_js_1.ControllerGenerator(classDeclaration))
            .filter(generator => generator.isValid())
            .map(generator => generator.generate());
    }
}
exports.MetadataGenerator = MetadataGenerator;
//# sourceMappingURL=metadataGenerator.js.map