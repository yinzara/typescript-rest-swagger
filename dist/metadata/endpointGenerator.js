'use strict';
import debug from 'debug';
import _ from 'lodash';
import ts from 'typescript';
import { getDecorators } from '../utils/decoratorUtils.js';
import { resolveType } from './resolveType.js';
export class EndpointGenerator {
    constructor(node, name) {
        this.node = node;
        this.debugger = debug(`typescript-rest-swagger:metadata:${name}`);
    }
    getDecoratorValues(decoratorName, acceptMultiple = false) {
        const decorators = getDecorators(this.node, decorator => decorator.text === decoratorName);
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
            scopes: security[0] ? _.castArray(this.handleRolesArray(security[0])) : []
        }));
    }
    handleRolesArray(argument) {
        if (ts.isArrayLiteralExpression(argument)) {
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
            case ts.SyntaxKind.ArrayLiteralExpression:
                return initializer.elements.map((e) => this.getInitializerValue(e));
            case ts.SyntaxKind.StringLiteral:
                return initializer.text;
            case ts.SyntaxKind.TrueKeyword:
                return true;
            case ts.SyntaxKind.FalseKeyword:
                return false;
            case ts.SyntaxKind.NumberKeyword:
            case ts.SyntaxKind.FirstLiteralToken:
                return parseInt(initializer.text, 10);
            case ts.SyntaxKind.ObjectLiteralExpression:
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
        const decorators = getDecorators(this.node, decorator => decorator.text === 'Response');
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
                    ? resolveType(decorator.typeArguments[0], genericTypeMap)
                    : undefined,
                status: status
            };
            this.debugger('Generated Responses for %s: %j', this.getCurrentLocation(), responses);
            return responses;
        });
    }
}
//# sourceMappingURL=endpointGenerator.js.map