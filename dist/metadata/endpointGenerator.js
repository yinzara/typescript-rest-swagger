'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EndpointGenerator = void 0;
const debug_1 = __importDefault(require("debug"));
const lodash_1 = __importDefault(require("lodash"));
const typescript_1 = __importDefault(require("typescript"));
const decoratorUtils_js_1 = require("../utils/decoratorUtils.js");
const resolveType_js_1 = require("./resolveType.js");
class EndpointGenerator {
    constructor(node, name) {
        this.node = node;
        this.debugger = debug_1.default(`typescript-rest-swagger:metadata:${name}`);
    }
    getDecoratorValues(decoratorName, acceptMultiple = false) {
        const decorators = decoratorUtils_js_1.getDecorators(this.node, decorator => decorator.text === decoratorName);
        if (!decorators || !decorators.length) {
            return [];
        }
        if (!acceptMultiple && decorators.length > 1) {
            throw new Error(`Only one ${decoratorName} decorator allowed in ${this.getCurrentLocation()}.`);
        }
        let result;
        if (acceptMultiple) {
            result = decorators.map(d => d.arguments);
        }
        else {
            const d = decorators[0];
            result = d.arguments;
        }
        this.debugger('Arguments of decorator %s: %j', decoratorName, result);
        return result;
    }
    getSecurity() {
        const securities = this.getDecoratorValues('Security', true);
        if (!securities || !securities.length) {
            return undefined;
        }
        return securities.map(security => ({
            name: security[1] ? security[1] : 'default',
            scopes: security[0] ? lodash_1.default.castArray(this.handleRolesArray(security[0])) : []
        }));
    }
    handleRolesArray(argument) {
        if (typescript_1.default.isArrayLiteralExpression(argument)) {
            return argument.elements.map(value => value.getText())
                .map(val => (val && val.startsWith('\'') && val.endsWith('\'')) ? val.slice(1, -1) : val);
        }
        else {
            return argument;
        }
    }
    getExamplesValue(argument) {
        let example = {};
        this.debugger(argument);
        if (argument.properties) {
            argument.properties.forEach((p) => {
                example[p.name.text] = this.getInitializerValue(p.initializer);
            });
        }
        else {
            example = this.getInitializerValue(argument);
        }
        this.debugger('Example extracted for %s: %j', this.getCurrentLocation(), example);
        return example;
    }
    getInitializerValue(initializer) {
        switch (initializer.kind) {
            case typescript_1.default.SyntaxKind.ArrayLiteralExpression:
                return initializer.elements.map((e) => this.getInitializerValue(e));
            case typescript_1.default.SyntaxKind.StringLiteral:
                return initializer.text;
            case typescript_1.default.SyntaxKind.TrueKeyword:
                return true;
            case typescript_1.default.SyntaxKind.FalseKeyword:
                return false;
            case typescript_1.default.SyntaxKind.NumberKeyword:
            case typescript_1.default.SyntaxKind.FirstLiteralToken:
                return parseInt(initializer.text, 10);
            case typescript_1.default.SyntaxKind.ObjectLiteralExpression:
                const nestedObject = {};
                initializer.properties.forEach((p) => {
                    nestedObject[p.name.text] = this.getInitializerValue(p.initializer);
                });
                return nestedObject;
            default:
                return undefined;
        }
    }
    getResponses(genericTypeMap) {
        const decorators = decoratorUtils_js_1.getDecorators(this.node, decorator => decorator.text === 'Response');
        if (!decorators || !decorators.length) {
            return [];
        }
        this.debugger('Generating Responses for %s', this.getCurrentLocation());
        return decorators.map(decorator => {
            let description = '';
            let status = '200';
            let examples;
            if (decorator.arguments.length > 0 && decorator.arguments[0]) {
                status = decorator.arguments[0];
            }
            if (decorator.arguments.length > 1 && decorator.arguments[1]) {
                description = decorator.arguments[1];
            }
            if (decorator.arguments.length > 2 && decorator.arguments[2]) {
                const argument = decorator.arguments[2];
                examples = this.getExamplesValue(argument);
            }
            const responses = {
                description: description,
                examples: examples,
                schema: (decorator.typeArguments && decorator.typeArguments.length > 0)
                    ? resolveType_js_1.resolveType(decorator.typeArguments[0], genericTypeMap)
                    : undefined,
                status: status
            };
            this.debugger('Generated Responses for %s: %j', this.getCurrentLocation(), responses);
            return responses;
        });
    }
}
exports.EndpointGenerator = EndpointGenerator;
//# sourceMappingURL=endpointGenerator.js.map