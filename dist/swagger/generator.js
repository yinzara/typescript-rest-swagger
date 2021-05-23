import debug from 'debug';
import fs from 'fs';
import _ from 'lodash';
import pathUtil from 'path';
import YAML from 'js-yaml';
import mm from "minimatch";
import { Specification } from '../config.js';
import merge from 'merge';
export class SpecGenerator {
    constructor(metadata, config) {
        this.metadata = metadata;
        this.config = config;
        this.debugger = debug('typescript-rest-swagger:spec-generator');
    }
    async generate() {
        this.debugger('Generating swagger files.');
        this.debugger('Swagger Config: %j', this.config);
        this.debugger('Services Metadata: %j', this.metadata);
        let spec = this.getSwaggerSpec();
        if (this.config.outputFormat === Specification.OpenApi_3) {
            spec = await this.convertToOpenApiSpec(spec);
        }
        return new Promise((resolve, reject) => {
            const swaggerDirs = _.castArray(this.config.outputDirectory);
            this.debugger('Saving specs to files: %j', swaggerDirs);
            return Promise.all(swaggerDirs.map(swaggerDir => {
                fs.promises.mkdir(swaggerDir, { recursive: true }).then(() => {
                    fs.writeFile(`${swaggerDir}/swagger.json`, JSON.stringify(spec, null, '\t'), (err) => {
                        if (err) {
                            reject(err);
                        }
                        if (this.config.yaml) {
                            fs.writeFile(`${swaggerDir}/swagger.yaml`, YAML.dump(spec, { flowLevel: -1 }), (errYaml) => {
                                if (errYaml) {
                                    reject(errYaml);
                                }
                                resolve();
                            });
                        }
                        else {
                            resolve();
                        }
                    });
                });
            }));
        });
    }
    getSwaggerSpec() {
        const definitions = this.buildDefinitions();
        let spec = {
            basePath: this.config.basePath,
            definitions: definitions,
            info: {},
            paths: this.buildPaths(definitions),
            swagger: '2.0'
        };
        spec.securityDefinitions = this.config.securityDefinitions
            ? this.config.securityDefinitions
            : {};
        if (this.config.consumes) {
            spec.consumes = this.config.consumes;
        }
        if (this.config.produces) {
            spec.produces = this.config.produces;
        }
        if (this.config.description) {
            spec.info.description = this.config.description;
        }
        if (this.config.license) {
            spec.info.license = { name: this.config.license };
        }
        if (this.config.name) {
            spec.info.title = this.config.name;
        }
        if (this.config.version) {
            spec.info.version = this.config.version;
        }
        if (this.config.host) {
            spec.host = this.config.host;
        }
        if (this.config.spec) {
            spec = merge.recursive(spec, this.config.spec);
        }
        this.debugger('Generated specs: %j', spec);
        return spec;
    }
    async getOpenApiSpec() {
        return await this.convertToOpenApiSpec(this.getSwaggerSpec());
    }
    async convertToOpenApiSpec(spec) {
        this.debugger('Converting specs to openapi 3.0');
        const options = {
            patch: true,
            warnOnly: true
        };
        // @ts-ignore
        const converter = await import('swagger2openapi');
        const openapi = await converter.convertObj(spec, options);
        this.debugger('Converted to openapi 3.0: %j', openapi);
        return openapi.openapi;
    }
    buildDefinitions() {
        const definitions = {};
        const ignoreTypes = this.config.ignoreTypes || [];
        const includeTypes = this.config.includeTypes;
        Object.keys(this.metadata.referenceTypes)
            .filter(typeName => includeTypes === undefined || includeTypes.some(type => mm(typeName, type)))
            .filter(typeName => !ignoreTypes.some(type => mm(typeName, type)))
            .map(typeName => {
            this.debugger('Generating definition for type: %s', typeName);
            const referenceType = this.metadata.referenceTypes[typeName];
            this.debugger('Metadata for referenced Type: %j', referenceType);
            if (referenceType.typeAlias) {
                if (['oneOf', 'anyOf', 'allOf'].includes(referenceType.typeAlias.typeName)) {
                    const types = referenceType.typeAlias.types.map(this.getSwaggerType.bind(this));
                    definitions[referenceType.typeName] = {
                        description: referenceType.description,
                        ...(referenceType.typeAlias.typeName === 'allOf' ? { allOf: types } : {}),
                        ...(referenceType.typeAlias.typeName === 'anyOf' ? { anyOf: types } : {}),
                        ...(referenceType.typeAlias.typeName === 'oneOf' ? { oneOf: types } : {})
                    };
                }
                else {
                    definitions[referenceType.typeName] = {
                        description: referenceType.description,
                        ...this.getSwaggerType(referenceType.typeAlias)
                    };
                }
            }
            else {
                definitions[referenceType.typeName] = {
                    description: referenceType.description,
                    properties: this.buildProperties(referenceType.properties),
                    type: 'object'
                };
            }
            const requiredFields = referenceType.properties.filter(p => p.required).map(p => p.name);
            if (requiredFields && requiredFields.length) {
                definitions[referenceType.typeName].required = requiredFields;
            }
            if (referenceType.additionalProperties) {
                definitions[referenceType.typeName].additionalProperties = this.buildAdditionalProperties(referenceType.additionalProperties);
            }
            this.debugger('Generated Definition for type %s: %j', typeName, definitions[referenceType.typeName]);
        });
        return definitions;
    }
    buildPaths(definitions) {
        const paths = {};
        this.debugger('Generating paths declarations');
        this.metadata.controllers.forEach(controller => {
            this.debugger('Generating paths for controller: %s', controller.name);
            controller.methods.forEach(method => {
                this.debugger('Generating paths for method: %s', method.name);
                const path = pathUtil.posix.join('/', (controller.path ? controller.path : ''), method.path);
                paths[path] = paths[path] || {};
                method.consumes = _.union(controller.consumes, method.consumes);
                method.produces = _.union(controller.produces, method.produces);
                method.tags = _.union(controller.tags, method.tags);
                method.security = method.security || controller.security;
                method.responses = _.union(controller.responses, method.responses);
                const pathObject = paths[path];
                pathObject[method.method] = this.buildPathMethod(controller.name, definitions, method);
                this.debugger('Generated path for method %s: %j', method.name, pathObject[method.method]);
            });
        });
        return paths;
    }
    buildPathMethod(controllerName, definitions, method) {
        const pathMethod = this.buildOperation(controllerName, method);
        pathMethod.description = method.description;
        if (method.summary) {
            pathMethod.summary = method.summary;
        }
        if (method.deprecated) {
            pathMethod.deprecated = method.deprecated;
        }
        if (method.tags.length) {
            pathMethod.tags = method.tags;
        }
        if (method.security) {
            pathMethod.security = method.security.map(s => ({
                [s.name]: s.scopes || []
            }));
        }
        this.handleMethodConsumes(method, pathMethod);
        pathMethod.parameters = method.parameters
            .filter(p => (p.in !== 'param'))
            .map(p => this.buildParameter(p));
        if ((!pathMethod.description || pathMethod.description === '')) {
            pathMethod.description = method.parameters
                .filter(p => (p.in === 'body'))
                .map(p => definitions[p.type.typeName])
                .map(d => d && d.description)
                .find(d => d) || '';
        }
        method.parameters
            .filter(p => (p.in === 'param'))
            .forEach(p => {
            pathMethod.parameters.push(this.buildParameter({
                description: p.description,
                in: 'query',
                name: p.name,
                parameterName: p.parameterName,
                required: false,
                type: p.type
            }));
            pathMethod.parameters.push(this.buildParameter({
                description: p.description,
                in: 'formData',
                name: p.name,
                parameterName: p.parameterName,
                required: false,
                type: p.type
            }));
        });
        if (pathMethod.parameters.filter((p) => p.in === 'body').length > 1) {
            throw new Error('Only one body parameter allowed per controller method.');
        }
        return pathMethod;
    }
    handleMethodConsumes(method, pathMethod) {
        if (method.consumes.length) {
            pathMethod.consumes = method.consumes;
        }
        if ((!pathMethod.consumes || !pathMethod.consumes.length)) {
            if (method.parameters.some(p => (p.in === 'formData' && p.type.typeName === 'file'))) {
                pathMethod.consumes = pathMethod.consumes || [];
                pathMethod.consumes.push('multipart/form-data');
            }
            else if (this.hasFormParams(method)) {
                pathMethod.consumes = pathMethod.consumes || [];
                pathMethod.consumes.push('application/x-www-form-urlencoded');
            }
            else if (this.supportsBodyParameters(method.method)) {
                pathMethod.consumes = pathMethod.consumes || [];
                pathMethod.consumes.push('application/json');
            }
        }
    }
    hasFormParams(method) {
        return method.parameters.find(p => (p.in === 'formData'));
    }
    supportsBodyParameters(method) {
        return ['post', 'put', 'patch'].some(m => m === method);
    }
    buildParameter(parameter) {
        const swaggerParameter = {
            description: parameter.description,
            in: parameter.in,
            name: parameter.name,
            required: parameter.required
        };
        const parameterType = this.getSwaggerType(parameter.type);
        if (parameterType.$ref || parameter.in === 'body') {
            swaggerParameter.schema = parameterType;
            if (swaggerParameter.description === '') {
                swaggerParameter.description = parameterType.description;
                parameterType.description = '';
            }
        }
        else {
            swaggerParameter.type = parameterType.type;
            if (parameterType.items) {
                swaggerParameter.items = parameterType.items;
                if (parameter.collectionFormat || this.config.collectionFormat) {
                    swaggerParameter.collectionFormat = parameter.collectionFormat || this.config.collectionFormat;
                }
            }
        }
        if (parameterType.format) {
            swaggerParameter.format = parameterType.format;
        }
        if (parameter.default !== undefined) {
            swaggerParameter.default = parameter.default;
        }
        if (parameterType.enum) {
            swaggerParameter.enum = parameterType.enum;
        }
        return swaggerParameter;
    }
    buildProperties(properties) {
        const swaggerProperties = {};
        const ignoreProperties = this.config.ignoreProperties || [];
        properties
            .filter(property => !ignoreProperties.some(prop => mm(property.name, prop)))
            .forEach(property => {
            let swaggerType = this.getSwaggerType(property.type);
            if (!swaggerType.$ref) {
                swaggerType.description = property.description;
            }
            else if (property.description) {
                swaggerType = {
                    allOf: [swaggerType],
                    description: property.description
                };
            }
            swaggerProperties[property.name] = swaggerType;
        });
        return swaggerProperties;
    }
    buildAdditionalProperties(properties) {
        const swaggerAdditionalProperties = {};
        const ignoreProperties = this.config.ignoreProperties || [];
        properties
            .filter(property => !ignoreProperties.some(prop => mm(property.name, prop)))
            .forEach(property => {
            const swaggerType = this.getSwaggerType(property.type);
            if (swaggerType.$ref) {
                swaggerAdditionalProperties['$ref'] = swaggerType.$ref;
            }
        });
        return swaggerAdditionalProperties;
    }
    buildOperation(controllerName, method) {
        const operation = {
            operationId: this.getOperationId(controllerName, method.name),
            produces: [],
            responses: {}
        };
        const methodReturnTypes = new Set();
        method.responses.forEach((res) => {
            operation.responses[res.status] = {
                description: res.description
            };
            if (res.schema) {
                const swaggerType = this.getSwaggerType(res.schema);
                if (swaggerType.type !== 'void') {
                    operation.responses[res.status]['schema'] = swaggerType;
                }
                methodReturnTypes.add(this.getMimeType(swaggerType));
            }
            if (res.examples) {
                operation.responses[res.status]['examples'] = { 'application/json': res.examples };
            }
        });
        this.handleMethodProduces(method, operation, methodReturnTypes);
        return operation;
    }
    getMimeType(swaggerType) {
        if (swaggerType.$ref || swaggerType.type === 'array' || swaggerType.type === 'object') {
            return 'application/json';
        }
        else if (swaggerType.type === 'string' && swaggerType.format === 'binary') {
            return 'application/octet-stream';
        }
        else {
            return 'text/html';
        }
    }
    handleMethodProduces(method, operation, methodReturnTypes) {
        if (method.produces.length) {
            operation.produces = method.produces;
        }
        else if (methodReturnTypes && methodReturnTypes.size > 0) {
            operation.produces = Array.from(methodReturnTypes);
        }
    }
    getOperationId(controllerName, methodName) {
        const controllerNameWithoutSuffix = controllerName.replace(new RegExp('Controller$'), '');
        return `${controllerNameWithoutSuffix}${methodName.charAt(0).toUpperCase() + methodName.substr(1)}`;
    }
    getSwaggerType(type) {
        const swaggerType = this.getSwaggerTypeForPrimitiveType(type);
        if (swaggerType) {
            return swaggerType;
        }
        const arrayType = type;
        if (arrayType.elementType) {
            return this.getSwaggerTypeForArrayType(arrayType);
        }
        const enumType = type;
        if (enumType.enumMembers) {
            return this.getSwaggerTypeForEnumType(enumType);
        }
        const refType = type;
        if (refType.properties && refType.description !== undefined) {
            return this.getSwaggerTypeForReferenceType(type);
        }
        if (refType.typeName === 'oneOf' && refType.types) {
            return this.getSwaggerOneOfType(refType);
        }
        const objectType = type;
        return this.getSwaggerTypeForObjectType(objectType);
    }
    getSwaggerTypeForPrimitiveType(type) {
        const typeMap = {
            binary: { type: 'string', format: 'binary' },
            boolean: { type: 'boolean' },
            buffer: { type: 'file' },
            //            buffer: { type: 'string', format: 'base64' },
            byte: { type: 'string', format: 'byte' },
            date: { type: 'string', format: 'date' },
            datetime: { type: 'string', format: 'date-time' },
            double: { type: 'number', format: 'double' },
            file: { type: 'file' },
            float: { type: 'number', format: 'float' },
            integer: { type: 'integer', format: 'int32' },
            long: { type: 'integer', format: 'int64' },
            object: { type: 'object' },
            string: { type: 'string' },
            void: { type: 'void' },
        };
        return typeMap[type.typeName];
    }
    getSwaggerOneOfType(oneOfType) {
        return { oneOf: oneOfType.types.map(t => this.getSwaggerType(t)) };
    }
    getSwaggerTypeForObjectType(objectType) {
        return { type: 'object', properties: this.buildProperties(objectType.properties) };
    }
    getSwaggerTypeForArrayType(arrayType) {
        return { type: 'array', items: this.getSwaggerType(arrayType.elementType) };
    }
    getSwaggerTypeForEnumType(enumType) {
        function getDerivedTypeFromValues(values) {
            return values.reduce((derivedType, item) => {
                const currentType = typeof item;
                derivedType = derivedType && derivedType !== currentType ? 'string' : currentType;
                return derivedType;
            }, null);
        }
        const enumValues = enumType.enumMembers.map(member => member);
        return {
            enum: enumType.enumMembers.map(member => member),
            type: getDerivedTypeFromValues(enumValues),
        };
    }
    getSwaggerTypeForReferenceType(referenceType) {
        return { $ref: `#/definitions/${referenceType.typeName}` };
    }
}
//# sourceMappingURL=generator.js.map