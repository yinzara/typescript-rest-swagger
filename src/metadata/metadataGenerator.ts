import debug from 'debug';
import glob from 'glob';
import _ from 'lodash';
import mm from 'minimatch';
import ts from 'typescript';
import { isDecorator } from '../utils/decoratorUtils';
import { ControllerGenerator } from './controllerGenerator';

export class MetadataGenerator {
    public static current: MetadataGenerator;
    public readonly nodes = new Array<ts.Node>();
    public readonly typeChecker: ts.TypeChecker;
    private readonly program: ts.Program;
    private referenceTypes: { [typeName: string]: ReferenceType } = {};
    private circularDependencyResolvers = new Array<(referenceTypes: { [typeName: string]: ReferenceType }) => void>();
    private debugger = debug('typescript-rest-swagger:metadata');

    constructor(entryFile: string | Array<string>, compilerOptions: ts.CompilerOptions, private readonly  ignorePaths?: Array<string>) {
        const sourceFiles = this.getSourceFiles(entryFile);
        this.debugger('Starting Metadata Generator');
        this.debugger('Source files: %j ', sourceFiles);
        this.debugger('Compiler Options: %j ', compilerOptions);
        this.program = ts.createProgram(sourceFiles, compilerOptions);
        this.typeChecker = this.program.getTypeChecker();
        MetadataGenerator.current = this;
    }

    public generate(): Metadata {
        this.program.getSourceFiles().forEach(sf => {
            if (this.ignorePaths && this.ignorePaths.length) {
                for (const path of this.ignorePaths) {
                    if(!sf.fileName.includes('node_modules/typescript-rest/') && mm(sf.fileName, path)) {
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

    public TypeChecker() {
        return this.typeChecker;
    }

    public addReferenceType(referenceType: ReferenceType) {
        if (!('circular' in referenceType)) { // don't add circular references
            this.referenceTypes[referenceType.typeName] = referenceType;
        }
    }

    public getReferenceType(typeName: string) {
        return this.referenceTypes[typeName];
    }

    public onFinish(callback: (referenceTypes: { [typeName: string]: ReferenceType }) => void) {
        this.circularDependencyResolvers.push(callback);
    }

    public getClassDeclaration(className: string, nodes: ReadonlyArray<ts.Node>  = this.nodes): ts.ClassDeclaration | undefined {
        const moduleIndex = className.indexOf('.');
        let found: Array<ts.ClassDeclaration>;
        if (moduleIndex > 0) {
            const moduleName = className.substring(0, moduleIndex);
            found = nodes
                .map(node => node as ts.ModuleDeclaration)
                .filter(node =>  node.kind === ts.SyntaxKind.ModuleDeclaration && node.name && node.name.text === moduleName)
                .map(node => 'statements' in node.body && this.getClassDeclaration(className.substring(moduleIndex + 1), node.body.statements))
                .filter(node => node);
        } else {
            found = nodes
                .map(node => node as ts.ClassDeclaration)
                .filter(node => node.kind === ts.SyntaxKind.ClassDeclaration && node.name && node.name.text === className);
        }
        if (found && found.length) {
            return found[0];
        }
        return undefined;
    }

    public getInterfaceDeclaration(className: string, nodes: ReadonlyArray<ts.Node> = this.nodes): ts.InterfaceDeclaration | undefined {
        const moduleIndex = className.indexOf('.');
        let found: Array<ts.InterfaceDeclaration>;
        if (moduleIndex > 0) {
            const moduleName = className.substring(0, moduleIndex);
            found = nodes
                .map(node => node as ts.ModuleDeclaration)
                .filter(node =>  node.kind === ts.SyntaxKind.ModuleDeclaration && node.name && node.name.text === moduleName)
                .map(node => 'statements' in node.body && this.getInterfaceDeclaration(className.substring(moduleIndex + 1), node.body.statements))
                .filter(node => node);
        } else {
            found = nodes
                .map(node => node as ts.InterfaceDeclaration)
                .filter(node => node.kind === ts.SyntaxKind.InterfaceDeclaration && node.name && node.name.text === className);
        }
        if (found && found.length) {
            return found[0];
        }
        return undefined;
    }

    private getSourceFiles(sourceFiles: string | Array<string>) {
        this.debugger('Getting source files from expressions');
        this.debugger('Source file patterns: %j ', sourceFiles);
        const sourceFilesExpressions = _.castArray(sourceFiles);
        const result: Set<string> = new Set<string>();
        const options = { cwd: process.cwd() };
        sourceFilesExpressions.forEach(pattern => {
            this.debugger('Searching pattern: %s with options: %j', pattern, options);
            const matches = glob.sync(pattern, options);
            matches.forEach(file => result.add(file));
        });

        return Array.from(result);
    }

    private buildControllers() {
        return this.nodes
            .filter(node => node.kind === ts.SyntaxKind.ClassDeclaration)
            .filter(node => !isDecorator(node, decorator => 'Hidden' === decorator.text))
            .map((classDeclaration: ts.ClassDeclaration) => new ControllerGenerator(classDeclaration))
            .filter(generator => generator.isValid())
            .map(generator => generator.generate());
    }
}

export interface Metadata {
    controllers: Array<Controller>;
    referenceTypes: { [typeName: string]: ReferenceType };
}

export interface Controller {
    location: string;
    methods: Array<Method>;
    name: string;
    path: string;
    consumes: Array<string>;
    produces: Array<string>;
    responses: Array<ResponseType>;
    tags: Array<string>;
    security?: Array<Security>;
}

export interface Method {
    deprecated?: boolean;
    description: string;
    method: string;
    name: string;
    parameters: Array<Parameter>;
    path: string;
    type: Type;
    tags: Array<string>;
    responses: Array<ResponseType>;
    security?: Array<Security>;
    summary?: string;
    consumes: Array<string>;
    produces: Array<string>;
}

export interface Parameter {
    parameterName: string;
    description: string;
    in: string;
    name: string;
    required: boolean;
    type: Type;
    collectionFormat?: boolean;
    allowEmptyValue?: boolean;
    default?: any;
    maxItems?: number;
    minItems?: number;
}

export interface Security {
    name: string;
    scopes?: Array<string>;
}

export interface Type {
    typeName: string;
    typeArgument?: Type;
    types?: Array<Type>;
}

export interface EnumerateType extends Type {
    enumMembers: Array<string>;
}

export interface ReferenceType extends Type {
    description: string;
    properties: Array<Property>;
    additionalProperties?: Array<Property>;
    typeAlias?: Type;
    types?: Array<Type>;
}

export interface ObjectType extends Type {
    properties: Array<Property>;
}

export interface ArrayType extends Type {
    elementType: Type;
}

export interface ResponseType {
    description: string;
    status: string;
    schema?: Type;
    examples?: any;
}

export interface Property {
    description: string;
    name: string;
    type: Type;
    required: boolean;
}

export interface ResponseData {
    status: string;
    type: Type;
}
