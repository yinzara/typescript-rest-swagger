import _ from 'lodash';
import ts from 'typescript';
import { getDecoratorTextValue, isDecorator } from '../utils/decoratorUtils.js';
import { normalizePath } from '../utils/pathUtils.js';
import { EndpointGenerator } from './endpointGenerator.js';
import { MethodGenerator } from './methodGenerator.js';
import { getSuperClass } from './resolveType.js';
export class ControllerGenerator extends EndpointGenerator {
    constructor(node) {
        super(node, 'controllers');
        this.genMethods = new Set();
        this.pathValue = normalizePath(getDecoratorTextValue(node, decorator => decorator.text === 'Path'));
    }
    isValid() {
        return !!this.pathValue || this.pathValue === '';
    }
    generate() {
        if (!this.node.parent) {
            throw new Error('Controller node doesn\'t have a valid parent source file.');
        }
        if (!this.node.name) {
            throw new Error('Controller node doesn\'t have a valid name.');
        }
        const sourceFile = this.node.parent.getSourceFile();
        this.debugger('Generating Metadata for controller %s', this.getCurrentLocation());
        this.debugger('Controller path: %s', this.pathValue);
        const controllerMetadata = {
            consumes: this.getDecoratorValues('Consumes'),
            location: sourceFile.fileName,
            methods: this.buildMethods(),
            name: this.getCurrentLocation(),
            path: this.pathValue || '',
            produces: (this.getDecoratorValues('Produces') ? this.getDecoratorValues('Produces') : this.getDecoratorValues('Accept')),
            responses: this.getResponses(),
            security: this.getSecurity(),
            tags: this.getDecoratorValues('Tags'),
        };
        this.debugger('Generated Metadata for controller %s: %j', this.getCurrentLocation(), controllerMetadata);
        return controllerMetadata;
    }
    getCurrentLocation() {
        return this.node.name.text;
    }
    buildMethods() {
        let result = [];
        let targetClass = {
            type: this.node,
            typeArguments: null
        };
        while (targetClass) {
            result = _.union(result, this.buildMethodsForClass(targetClass.type, targetClass.typeArguments));
            targetClass = getSuperClass(targetClass.type, targetClass.typeArguments);
        }
        return result;
    }
    buildMethodsForClass(node, genericTypeMap) {
        return node.members
            .filter(m => (m.kind === ts.SyntaxKind.MethodDeclaration))
            .filter(m => !isDecorator(m, decorator => 'Hidden' === decorator.text))
            .map((m) => new MethodGenerator(m, this.pathValue || '', genericTypeMap))
            .filter(generator => {
            if (generator.isValid() && !this.genMethods.has(generator.getMethodName())) {
                this.genMethods.add(generator.getMethodName());
                return true;
            }
            return false;
        })
            .map(generator => generator.generate());
    }
}
//# sourceMappingURL=controllerGenerator.js.map