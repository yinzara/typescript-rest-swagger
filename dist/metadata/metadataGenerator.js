import debug from 'debug';
import glob from 'glob';
import _ from 'lodash';
import mm from 'minimatch';
import ts from 'typescript';
import { isDecorator } from '../utils/decoratorUtils.js';
import { ControllerGenerator } from './controllerGenerator.js';
export class MetadataGenerator {
    constructor(entryFile, compilerOptions, ignorePaths) {
        this.ignorePaths = ignorePaths;
        this.nodes = new Array();
        this.referenceTypes = {};
        this.circularDependencyResolvers = new Array();
        this.debugger = debug('typescript-rest-swagger:metadata');
        const sourceFiles = this.getSourceFiles(entryFile);
        this.debugger('Starting Metadata Generator');
        this.debugger('Source files: %j ', sourceFiles);
        this.debugger('Compiler Options: %j ', compilerOptions);
        this.program = ts.createProgram(sourceFiles, compilerOptions);
        this.typeChecker = this.program.getTypeChecker();
        MetadataGenerator.current = this;
    }
    generate() {
        this.program.getSourceFiles().forEach(sf => {
            if (this.ignorePaths && this.ignorePaths.length) {
                for (const path of this.ignorePaths) {
                    if (!sf.fileName.includes('node_modules/typescript-rest/') && mm(sf.fileName, path)) {
                        return;
                    }
                }
            }
            ts.forEachChild(sf, node => {
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
                .filter(node => node.kind === ts.SyntaxKind.ModuleDeclaration && node.name && node.name.text === moduleName)
                .map(node => 'statements' in node.body && this.getClassDeclaration(className.substring(moduleIndex + 1), node.body.statements))
                .filter(node => node);
        }
        else {
            found = nodes
                .map(node => node)
                .filter(node => node.kind === ts.SyntaxKind.ClassDeclaration && node.name && node.name.text === className);
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
                .filter(node => node.kind === ts.SyntaxKind.ModuleDeclaration && node.name && node.name.text === moduleName)
                .map(node => 'statements' in node.body && this.getInterfaceDeclaration(className.substring(moduleIndex + 1), node.body.statements))
                .filter(node => node);
        }
        else {
            found = nodes
                .map(node => node)
                .filter(node => node.kind === ts.SyntaxKind.InterfaceDeclaration && node.name && node.name.text === className);
        }
        if (found && found.length) {
            return found[0];
        }
        return undefined;
    }
    getSourceFiles(sourceFiles) {
        this.debugger('Getting source files from expressions');
        this.debugger('Source file patterns: %j ', sourceFiles);
        const sourceFilesExpressions = _.castArray(sourceFiles);
        const result = new Set();
        const options = { cwd: process.cwd() };
        sourceFilesExpressions.forEach(pattern => {
            this.debugger('Searching pattern: %s with options: %j', pattern, options);
            const matches = glob.sync(pattern, options);
            matches.forEach(file => result.add(file));
        });
        return Array.from(result);
    }
    buildControllers() {
        return this.nodes
            .filter(node => node.kind === ts.SyntaxKind.ClassDeclaration)
            .filter(node => !isDecorator(node, decorator => 'Hidden' === decorator.text))
            .map((classDeclaration) => new ControllerGenerator(classDeclaration))
            .filter(generator => generator.isValid())
            .map(generator => generator.generate());
    }
}
//# sourceMappingURL=metadataGenerator.js.map