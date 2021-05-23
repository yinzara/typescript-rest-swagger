import _ from 'lodash';
import ts from 'typescript';
import { getDecoratorName, getDecoratorArguments } from '../utils/decoratorUtils.js';
import { getFirstMatchingJSDocTagName } from '../utils/jsDocUtils.js';
import { MetadataGenerator } from './metadataGenerator.js';
let syntaxKindMap;
const localReferenceTypeCache = {};
const inProgressTypes = {};
function initSyntaxKindMap() {
    if (!syntaxKindMap) {
        syntaxKindMap = {};
        syntaxKindMap[ts.SyntaxKind.NumberKeyword] = 'number';
        syntaxKindMap[ts.SyntaxKind.StringKeyword] = 'string';
        syntaxKindMap[ts.SyntaxKind.BooleanKeyword] = 'boolean';
        syntaxKindMap[ts.SyntaxKind.VoidKeyword] = 'void';
    }
}
export function resolveType(typeNode, genericTypeMap) {
    if (!typeNode) {
        return { typeName: 'void' };
    }
    initSyntaxKindMap();
    const primitiveType = getPrimitiveType(typeNode);
    if (primitiveType) {
        return primitiveType;
    }
    if (typeNode.kind === ts.SyntaxKind.ArrayType) {
        const arrayType = typeNode;
        return {
            elementType: resolveType(arrayType.elementType, genericTypeMap),
            typeName: 'array'
        };
    }
    if ((typeNode.kind === ts.SyntaxKind.AnyKeyword) || (typeNode.kind === ts.SyntaxKind.ObjectKeyword)) {
        return { typeName: 'object' };
    }
    if (typeNode.kind === ts.SyntaxKind.TypeLiteral) {
        return getInlineObjectType(typeNode);
    }
    if (typeNode.kind === ts.SyntaxKind.UnionType) {
        return getUnionType(typeNode, genericTypeMap);
    }
    if (typeNode.kind === ts.SyntaxKind.IntersectionType) {
        return getIntersectionType(typeNode, genericTypeMap);
    }
    if (typeNode.kind === ts.SyntaxKind.ParenthesizedType) {
        return getParenthizedType(typeNode.type, genericTypeMap);
    }
    if (typeNode.kind === ts.SyntaxKind.LiteralType && typeNode.literal && typeNode.literal.text) {
        return { typeName: 'enum', enumMembers: [typeNode.literal.text] };
    }
    if (typeNode.kind !== ts.SyntaxKind.TypeReference) {
        throw new Error(`Unknown type: ${ts.SyntaxKind[typeNode.kind]}`);
    }
    let typeReference = typeNode;
    let isPartial = false;
    let typeName = resolveSimpleTypeName(typeReference.typeName);
    if (typeName === 'Date') {
        return getDateType(typeNode);
    }
    else if (typeName === 'Buffer') {
        return { typeName: 'buffer' };
    }
    else if (typeName === 'DownloadBinaryData') {
        return { typeName: 'buffer' };
    }
    else if (typeName === 'DownloadResource') {
        return { typeName: 'buffer' };
    }
    else if (typeName === 'string') {
        return { typeName: 'string' };
    }
    else if (typeName === 'number') {
        return { typeName: 'number' };
    }
    else if (typeName === 'Partial') {
        isPartial = true;
        const subtype = typeReference.typeArguments[0];
        const resolved = resolveType(subtype, genericTypeMap);
        if (subtype.kind === ts.SyntaxKind.TypeReference) {
            typeReference = subtype;
            typeName = resolveSimpleTypeName(typeReference.typeName);
        }
        else {
            return resolved;
        }
    }
    if (typeName === 'Promise') {
        typeReference = typeReference.typeArguments[0];
        return resolveType(typeReference, genericTypeMap);
    }
    if (typeName === 'Array') {
        typeReference = typeReference.typeArguments[0];
        return {
            elementType: resolveType(typeReference, genericTypeMap),
            typeName: 'array'
        };
    }
    const enumType = getEnumerateType(typeNode);
    if (enumType) {
        return enumType;
    }
    const literalType = getLiteralType(typeNode, genericTypeMap);
    if (literalType) {
        return literalType;
    }
    let referenceType;
    if (typeReference.typeArguments && typeReference.typeArguments.length === 1) {
        const typeT = typeReference.typeArguments;
        referenceType = getReferenceType(typeReference.typeName, genericTypeMap, typeT);
        typeName = resolveSimpleTypeName(typeReference.typeName);
        if (['NewResource', 'RequestAccepted', 'MovedPermanently', 'MovedTemporarily'].indexOf(typeName) >= 0) {
            referenceType.typeName = typeName;
            referenceType.typeArgument = resolveType(typeT[0], genericTypeMap);
        }
        else {
            MetadataGenerator.current.addReferenceType(referenceType);
        }
    }
    else {
        referenceType = getReferenceType(typeReference.typeName, genericTypeMap);
        MetadataGenerator.current.addReferenceType(referenceType);
    }
    if (isPartial && referenceType.properties) {
        referenceType.properties.forEach(p => p.required = false);
    }
    return referenceType;
}
function getPrimitiveType(typeNode) {
    const primitiveType = syntaxKindMap[typeNode.kind];
    if (!primitiveType) {
        return undefined;
    }
    if (primitiveType === 'number') {
        const parentNode = typeNode.parent;
        if (!parentNode) {
            return { typeName: 'double' };
        }
        const validDecorators = ['IsInt', 'IsLong', 'IsFloat', 'IsDouble'];
        // Can't use decorators on interface/type properties, so support getting the type from jsdoc too.
        const jsdocTagName = getFirstMatchingJSDocTagName(parentNode, tag => {
            return validDecorators.some(t => t === tag.tagName.text);
        });
        const decoratorName = getDecoratorName(parentNode, identifier => {
            return validDecorators.some(m => m === identifier.text);
        });
        switch (decoratorName || jsdocTagName) {
            case 'IsInt':
                return { typeName: 'integer' };
            case 'IsLong':
                return { typeName: 'long' };
            case 'IsFloat':
                return { typeName: 'float' };
            case 'IsDouble':
                return { typeName: 'double' };
            default:
                return { typeName: 'double' };
        }
    }
    else if (primitiveType === 'string' && typeNode.parent) {
        const enumMembers = getDecoratorArguments(typeNode.parent, t => t.text === 'Enum');
        if (enumMembers) {
            return { typeName: primitiveType, enumMembers: enumMembers };
        }
    }
    return { typeName: primitiveType };
}
function getDateType(typeNode) {
    const parentNode = typeNode.parent;
    if (!parentNode) {
        return { typeName: 'datetime' };
    }
    const decoratorName = getDecoratorName(parentNode, identifier => {
        return ['IsDate', 'IsDateTime'].some(m => m === identifier.text);
    });
    switch (decoratorName) {
        case 'IsDate':
            return { typeName: 'date' };
        case 'IsDateTime':
            return { typeName: 'datetime' };
        default:
            return { typeName: 'datetime' };
    }
}
function getEnumerateType(typeNode) {
    const enumName = typeNode.typeName.text;
    const enumTypes = MetadataGenerator.current.nodes
        .filter(node => node.kind === ts.SyntaxKind.EnumDeclaration)
        .filter(node => node.name.text === enumName);
    if (!enumTypes.length) {
        return undefined;
    }
    if (enumTypes.length > 1) {
        throw new Error(`Multiple matching enum found for enum ${enumName}; please make enum names unique.`);
    }
    const enumDeclaration = enumTypes[0];
    function getEnumValue(member) {
        const initializer = member.initializer;
        if (initializer) {
            if (initializer.expression) {
                return parseEnumValueByKind(initializer.expression.text, initializer.kind);
            }
            return parseEnumValueByKind(initializer.text, initializer.kind);
        }
        return;
    }
    return {
        enumMembers: enumDeclaration.members.map((member, index) => {
            return getEnumValue(member) || index;
        }),
        typeName: 'enum',
    };
}
function parseEnumValueByKind(value, kind) {
    return kind === ts.SyntaxKind.NumericLiteral ? parseFloat(value) : value;
}
function getUnionType(typeNode, genericTypeMap) {
    const union = typeNode;
    let baseType = null;
    let isObject = false;
    union.types.forEach(type => {
        if (baseType === null) {
            baseType = type;
        }
        if (type.kind === ts.SyntaxKind.TypeReference || baseType.kind !== type.kind) {
            isObject = true;
        }
    });
    if (isObject) {
        return getParenthizedType(typeNode, genericTypeMap);
    }
    return {
        enumMembers: union.types.map((type, index) => {
            return type.getText() ? removeQuotes(type.getText()) : index;
        }),
        typeName: 'enum',
    };
}
function getIntersectionType(typeNode, genericTypeMap) {
    if (typeNode.kind === ts.SyntaxKind.IntersectionType) {
        const intersection = typeNode;
        return {
            typeName: 'allOf',
            types: intersection.types
                .map(t => resolveType(t, genericTypeMap)),
        };
    }
    else {
        return undefined;
    }
}
function getParenthizedType(typeNode, genericTypeMap) {
    if (typeNode.kind === ts.SyntaxKind.UnionType) {
        const union = typeNode;
        return {
            typeName: 'oneOf',
            types: union.types
                .map(t => resolveType(t, genericTypeMap)),
        };
    }
    else {
        return getIntersectionType(typeNode, genericTypeMap);
    }
}
function removeQuotes(str) {
    return str.replace(/^["']|["']$/g, '');
}
function getLiteralType(typeNode, genericTypeMap) {
    const literalName = typeNode.typeName.text;
    const literalTypes = MetadataGenerator.current.nodes
        .filter(node => node.kind === ts.SyntaxKind.TypeAliasDeclaration)
        .filter(node => {
        const innerType = node.type;
        return innerType.kind === ts.SyntaxKind.UnionType && innerType.types;
    })
        .filter(node => node.name.text === literalName);
    if (!literalTypes.length) {
        return undefined;
    }
    if (literalTypes.length > 1) {
        throw new Error(`Multiple matching types found for enum ${literalName}; please make type names unique.`);
    }
    const unionType = literalTypes[0].type;
    const unionTypes = unionType.types;
    const firstType = unionTypes[0];
    if (firstType.literal && firstType.literal.kind === 10) { // string literal union (probably an enum)
        return {
            enumMembers: unionTypes.map((unionNode) => unionNode.literal && unionNode.literal.text ||
                unionNode.typeName && unionNode.typeName.escapedText),
            typeName: 'enum',
        };
    }
    return getParenthizedType(unionType, genericTypeMap);
}
function getInlineObjectType(typeNode) {
    const type = {
        properties: getModelTypeProperties(typeNode),
        typeName: ''
    };
    return type;
}
function getReferenceType(type, genericTypeMap, genericTypes) {
    let typeName = resolveFqTypeName(type);
    if (genericTypeMap && genericTypeMap.has(typeName)) {
        const refType = genericTypeMap.get(typeName);
        type = refType.typeName;
        typeName = resolveFqTypeName(type);
    }
    const typeNameWithGenerics = getTypeName(typeName, genericTypes);
    try {
        const existingType = localReferenceTypeCache[typeNameWithGenerics];
        if (existingType) {
            return existingType;
        }
        if (inProgressTypes[typeNameWithGenerics]) {
            return createCircularDependencyResolver(typeNameWithGenerics);
        }
        inProgressTypes[typeNameWithGenerics] = true;
        const modelTypeDeclaration = getModelTypeDeclaration(type);
        const properties = getModelTypeProperties(modelTypeDeclaration, genericTypes);
        const additionalProperties = getModelTypeAdditionalProperties(modelTypeDeclaration);
        let referenceType = {
            description: getModelDescription(modelTypeDeclaration),
            properties: properties,
            typeName: typeNameWithGenerics,
        };
        if (modelTypeDeclaration.kind === ts.SyntaxKind.TypeAliasDeclaration) {
            const aliasedType = modelTypeDeclaration.type;
            const resolvedType = resolveType(aliasedType);
            if (resolvedType) {
                referenceType.typeAlias = resolvedType;
            }
        }
        if (additionalProperties && additionalProperties.length) {
            referenceType.additionalProperties = additionalProperties;
        }
        if (modelTypeDeclaration.kind !== ts.SyntaxKind.TypeAliasDeclaration) {
            const typeAlias = getInheritanceAlias(modelTypeDeclaration, genericTypes);
            if (typeAlias) {
                referenceType = {
                    typeName: referenceType.typeName,
                    properties: [],
                    description: referenceType.description,
                    typeAlias: {
                        typeName: typeAlias.typeName,
                        types: Object.keys(properties).length > 0 ? [
                            ...typeAlias.types,
                            {
                                typeName: referenceType.typeName,
                                properties: properties
                            }
                        ] : typeAlias.types
                    }
                };
            }
        }
        localReferenceTypeCache[typeNameWithGenerics] = referenceType;
        return referenceType;
    }
    catch (err) {
        console.error(`There was a problem resolving type of '${getTypeName(typeName, genericTypes)}' in file '${getSourceFilename(type)}'.`);
        throw err;
    }
}
function resolveFqTypeName(type) {
    if (type.kind === ts.SyntaxKind.Identifier) {
        const prefixes = [];
        let parent = type;
        do {
            parent = findParentOfKind(parent, ts.SyntaxKind.ModuleDeclaration);
            if (parent) {
                prefixes.unshift(parent.name.text);
            }
        } while (parent);
        if (prefixes.length > 0) {
            return `${prefixes.join('.')}.${type.text}`;
        }
        else {
            return type.text;
        }
    }
    else if (type.kind === ts.SyntaxKind.PropertyAccessExpression) {
        return `${type.expression.getText()}.${type.name.text}`;
    }
    const qualifiedType = type;
    return resolveFqTypeName(qualifiedType.left) + '.' + qualifiedType.right.text;
}
function findParentOfKind(type, kind) {
    if (type.parent === undefined) {
        return undefined;
    }
    else if (type.parent.kind === kind) {
        return type.parent;
    }
    else {
        return findParentOfKind(type.parent, kind);
    }
}
function resolveSimpleTypeName(type) {
    if (type.kind === ts.SyntaxKind.Identifier) {
        return type.text;
    }
    const qualifiedType = type;
    return qualifiedType.right.text;
}
function getTypeName(typeName, genericTypes) {
    if (!genericTypes || !genericTypes.length) {
        return typeName;
    }
    return typeName + genericTypes.map(t => getAnyTypeName(t)).join('');
}
function getSourceFilename(typeNode) {
    if (typeNode.kind === ts.SyntaxKind.SourceFile) {
        return typeNode.fileName;
    }
    else if (typeNode.parent) {
        return getSourceFilename(typeNode.parent);
    }
    else {
        return "Unknown";
    }
}
function getAnyTypeName(typeNode) {
    const primitiveType = syntaxKindMap[typeNode.kind];
    if (primitiveType) {
        return primitiveType;
    }
    if (typeNode.kind === ts.SyntaxKind.ArrayType) {
        const arrayType = typeNode;
        return getAnyTypeName(arrayType.elementType) + 'Array';
    }
    if (typeNode.kind === ts.SyntaxKind.UnionType ||
        typeNode.kind === ts.SyntaxKind.AnyKeyword) {
        return 'object';
    }
    if (typeNode.kind !== ts.SyntaxKind.TypeReference) {
        throw new Error(`Unknown type: ${ts.SyntaxKind[typeNode.kind]}`);
    }
    const typeReference = typeNode;
    try {
        const typeName = typeReference.typeName.text;
        if (typeName === 'Array') {
            return getAnyTypeName(typeReference.typeArguments[0]) + 'Array';
        }
        return typeName;
    }
    catch (e) {
        // idk what would hit this? probably needs more testing
        console.error(e);
        return typeNode.toString();
    }
}
function createCircularDependencyResolver(typeName) {
    const referenceType = {
        description: '',
        circular: true,
        properties: new Array(),
        typeName: typeName,
    };
    MetadataGenerator.current.onFinish(referenceTypes => {
        const realReferenceType = referenceTypes[typeName];
        if (!realReferenceType) {
            return;
        }
        referenceType.description = realReferenceType.description;
        referenceType.properties = realReferenceType.properties;
        referenceType.typeName = realReferenceType.typeName;
    });
    return referenceType;
}
function nodeIsUsable(node) {
    switch (node.kind) {
        case ts.SyntaxKind.InterfaceDeclaration:
        case ts.SyntaxKind.ClassDeclaration:
        case ts.SyntaxKind.TypeAliasDeclaration:
            return true;
        default: return false;
    }
}
function resolveLeftmostIdentifier(type) {
    while (type.kind !== ts.SyntaxKind.Identifier) {
        if (type.kind === ts.SyntaxKind.PropertyAccessExpression) {
            type = type.expression;
        }
        else {
            type = type.left;
        }
    }
    return type;
}
function resolveModelTypeScope(leftmost, statements) {
    // while (leftmost.parent && leftmost.parent.kind === ts.SyntaxKind.QualifiedName) {
    //     const leftmostName = leftmost.kind === ts.SyntaxKind.Identifier
    //         ? (leftmost as ts.Identifier).text
    //         : (leftmost as ts.QualifiedName).right.text;
    //     const moduleDeclarations = statements
    //         .filter(node => {
    //             if (node.kind === ts.SyntaxKind.ModuleDeclaration) {
    //                 const moduleDeclaration = node as ts.ModuleDeclaration;
    //                 return (moduleDeclaration.name as ts.Identifier).text.toLowerCase() === leftmostName.toLowerCase();
    //             }
    //             return false;
    //         }) as Array<ts.ModuleDeclaration>;
    //     if (!moduleDeclarations.length) { throw new Error(`No matching module declarations found for ${leftmostName}`); }
    //     if (moduleDeclarations.length > 1) { throw new Error(`Multiple matching module declarations found for ${leftmostName}; please make module declarations unique`); }
    //     const moduleBlock = moduleDeclarations[0].body as ts.ModuleBlock;
    //     if (moduleBlock === null || moduleBlock.kind !== ts.SyntaxKind.ModuleBlock) { throw new Error(`Module declaration found for ${leftmostName} has no body`); }
    //     statements = moduleBlock.statements;
    //     leftmost = leftmost.parent as ts.EntityName;
    // }
    const moduleParent = findParentOfKind(leftmost, ts.SyntaxKind.ModuleDeclaration);
    if (moduleParent && 'statements' in moduleParent.body) {
        return moduleParent.body.statements;
    }
    if (leftmost.parent && (leftmost.parent.kind === ts.SyntaxKind.PropertyAccessExpression || leftmost.parent.kind === ts.SyntaxKind.QualifiedName)) {
        statements = statements
            .map(n => n)
            .filter(n => n.kind === ts.SyntaxKind.ModuleDeclaration && n.name.text === (leftmost.text || leftmost.escapedText) && 'statements' in n.body)
            .map(n => 'statements' in n.body && n.body.statements)
            .reduce((prev, next) => next || prev, statements);
    }
    return statements;
}
function getModelTypeDeclaration(type) {
    const leftmostIdentifier = resolveLeftmostIdentifier(type);
    const statements = resolveModelTypeScope(leftmostIdentifier, MetadataGenerator.current.nodes);
    const typeName = type.kind === ts.SyntaxKind.Identifier ? type.text :
        type.kind === ts.SyntaxKind.PropertyAccessExpression ? type.name.text
            : type.right.text;
    const modelTypes = statements
        .filter(node => {
        if (!nodeIsUsable(node)) {
            return false;
        }
        const modelTypeDeclaration = node;
        return modelTypeDeclaration.name.text === typeName;
    });
    if (!modelTypes.length) {
        throw new Error(`No matching model found for referenced type ${typeName}`);
    }
    // if (modelTypes.length > 1) {
    //     const conflicts = modelTypes.map(modelType => modelType.getSourceFile().fileName).join('"; "');
    //     throw new Error(`Multiple matching models found for referenced type ${typeName}; please make model names unique. Conflicts found: "${conflicts}"`);
    // }
    return modelTypes[0];
}
function getModelTypeProperties(node, genericTypes) {
    if (node.kind === ts.SyntaxKind.TypeLiteral || node.kind === ts.SyntaxKind.InterfaceDeclaration) {
        const interfaceDeclaration = node;
        return interfaceDeclaration.members
            .filter(member => {
            if (member.type && member.type.kind === ts.SyntaxKind.FunctionType) {
                return false;
            }
            return member.kind === ts.SyntaxKind.PropertySignature;
        })
            .filter((member) => {
            const hidden = getFirstMatchingJSDocTagName(member, tag => {
                return tag.tagName.text === 'Hidden';
            });
            return !hidden;
        })
            .map((member) => {
            const propertyDeclaration = member;
            const identifier = propertyDeclaration.name;
            if (!propertyDeclaration.type) {
                throw new Error('No valid type found for property declaration.');
            }
            // Declare a variable that can be overridden if needed
            let aType = propertyDeclaration.type;
            // aType.kind will always be a TypeReference when the property of Interface<T> is of type T
            if (aType.kind === ts.SyntaxKind.TypeReference && genericTypes && genericTypes.length && node.typeParameters) {
                // The type definitions are conviently located on the object which allow us to map -> to the genericTypes
                const typeParams = _.map(node.typeParameters, (typeParam) => {
                    return typeParam.name.text;
                });
                // I am not sure in what cases
                const typeIdentifier = aType.typeName;
                let typeIdentifierName;
                // typeIdentifier can either be a Identifier or a QualifiedName
                if (typeIdentifier.text) {
                    typeIdentifierName = typeIdentifier.text;
                }
                else {
                    typeIdentifierName = typeIdentifier.right.text;
                }
                // I could not produce a situation where this did not find it so its possible this check is irrelevant
                const indexOfType = _.indexOf(typeParams, typeIdentifierName);
                if (indexOfType >= 0) {
                    aType = genericTypes[indexOfType];
                }
            }
            return {
                description: getNodeDescription(propertyDeclaration),
                name: identifier.text,
                required: !propertyDeclaration.questionToken,
                type: resolveType(aType)
            };
        });
    }
    if (node.kind === ts.SyntaxKind.ParenthesizedType || node.kind === ts.SyntaxKind.TypeAliasDeclaration) {
        return [];
    }
    const classDeclaration = node;
    let properties = (classDeclaration.members && classDeclaration.members.filter((member) => {
        if (member.kind !== ts.SyntaxKind.PropertyDeclaration) {
            return false;
        }
        const propertySignature = member;
        return propertySignature && hasPublicMemberModifier(propertySignature);
    }) || []);
    const classConstructor = classDeclaration.members && classDeclaration.members.find((member) => member.kind === ts.SyntaxKind.Constructor);
    if (classConstructor && classConstructor.parameters) {
        properties = properties.concat(classConstructor.parameters.filter(parameter => hasPublicConstructorModifier(parameter)));
    }
    return properties
        .map(declaration => {
        const identifier = declaration.name;
        if (!declaration.type) {
            throw new Error('No valid type found for property declaration.');
        }
        return {
            description: getNodeDescription(declaration),
            name: identifier.text,
            required: !declaration.questionToken,
            type: resolveType(resolveTypeParameter(declaration.type, classDeclaration, genericTypes))
        };
    });
}
function resolveTypeParameter(type, classDeclaration, genericTypes) {
    if (genericTypes && classDeclaration.typeParameters && classDeclaration.typeParameters.length) {
        for (let i = 0; i < classDeclaration.typeParameters.length; i++) {
            if (type.typeName && classDeclaration.typeParameters[i].name.text === type.typeName.text) {
                return genericTypes[i];
            }
        }
    }
    return type;
}
function getModelTypeAdditionalProperties(node) {
    if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
        const interfaceDeclaration = node;
        return interfaceDeclaration.members
            .filter(member => member.kind === ts.SyntaxKind.IndexSignature)
            .map((member) => {
            const indexSignatureDeclaration = member;
            const indexType = resolveType(indexSignatureDeclaration.parameters[0].type);
            if (indexType.typeName !== 'string') {
                throw new Error(`Only string indexers are supported. Found ${indexType.typeName}.`);
            }
            return {
                description: '',
                name: '',
                required: true,
                type: resolveType(indexSignatureDeclaration.type)
            };
        });
    }
    return undefined;
}
function hasPublicMemberModifier(node) {
    return !node.modifiers || node.modifiers.every(modifier => {
        return modifier.kind !== ts.SyntaxKind.ProtectedKeyword && modifier.kind !== ts.SyntaxKind.PrivateKeyword;
    });
}
function hasPublicConstructorModifier(node) {
    return node.modifiers && node.modifiers.some(modifier => {
        return modifier.kind === ts.SyntaxKind.PublicKeyword;
    });
}
function getInheritanceAlias(modelTypeDeclaration, genericTypes) {
    if (modelTypeDeclaration.kind === ts.SyntaxKind.TypeAliasDeclaration) {
        return undefined;
    }
    const heritageClauses = modelTypeDeclaration.heritageClauses;
    if (!heritageClauses) {
        return undefined;
    }
    const types = [];
    heritageClauses.forEach(clause => {
        if (!clause.types) {
            return;
        }
        clause.types.forEach((t) => {
            let typeName = t.expression.getText();
            const prefixes = [];
            let parent = t;
            do {
                parent = findParentOfKind(parent, ts.SyntaxKind.ModuleDeclaration);
                if (parent) {
                    prefixes.unshift(parent.name.text);
                }
            } while (parent);
            if (prefixes.length > 0) {
                typeName = `${prefixes.join('.')}.${typeName}`;
            }
            let type = MetadataGenerator.current.getClassDeclaration(typeName);
            if (!type) {
                type = MetadataGenerator.current.getInterfaceDeclaration(typeName);
            }
            const baseEntityName = t.expression;
            const parentGenerictypes = resolveTypeArguments(modelTypeDeclaration, genericTypes);
            const genericTypeMap = resolveTypeArguments(type, t.typeArguments, parentGenerictypes);
            const subClassGenericTypes = getSubClassGenericTypes(genericTypeMap, t.typeArguments);
            const referenceType = getReferenceType(baseEntityName, genericTypeMap, subClassGenericTypes);
            MetadataGenerator.current.addReferenceType(referenceType);
            types.push(referenceType);
        });
    });
    return {
        typeName: 'allOf',
        types: types
    };
}
function getModelDescription(modelTypeDeclaration) {
    return getNodeDescription(modelTypeDeclaration);
}
function getNodeDescription(node) {
    const symbol = MetadataGenerator.current.typeChecker.getSymbolAtLocation(node.name);
    if (symbol) {
        /**
         * TODO: Workaround for what seems like a bug in the compiler
         * Warrants more investigation and possibly a PR against typescript
         */
        if (node.kind === ts.SyntaxKind.Parameter) {
            // TypeScript won't parse jsdoc if the flag is 4, i.e. 'Property'
            symbol.flags = 0;
        }
        const comments = symbol.getDocumentationComment(MetadataGenerator.current.typeChecker);
        if (comments.length) {
            return ts.displayPartsToString(comments);
        }
    }
    return '';
}
function getSubClassGenericTypes(genericTypeMap, typeArguments) {
    if (genericTypeMap && typeArguments) {
        const result = [];
        typeArguments.forEach((t) => {
            const typeName = getAnyTypeName(t);
            if (genericTypeMap.has(typeName)) {
                result.push(genericTypeMap.get(typeName));
            }
            else {
                result.push(t);
            }
        });
        return result;
    }
    return null;
}
export function getSuperClass(node, typeArguments) {
    const clauses = node.heritageClauses;
    if (clauses) {
        const filteredClauses = clauses.filter(clause => clause.token === ts.SyntaxKind.ExtendsKeyword);
        if (filteredClauses.length > 0) {
            const clause = filteredClauses[0];
            if (clause.types && clause.types.length) {
                const type = MetadataGenerator.current.getClassDeclaration(clause.types[0].expression.getText());
                return {
                    type: type,
                    typeArguments: resolveTypeArguments(type, clause.types[0].typeArguments, typeArguments)
                };
            }
        }
    }
    return undefined;
}
function buildGenericTypeMap(node, typeArguments) {
    const result = new Map();
    if (node.typeParameters && typeArguments) {
        node.typeParameters.forEach((typeParam, index) => {
            const paramName = typeParam.name.text;
            result.set(paramName, typeArguments[index]);
        });
    }
    return result;
}
function resolveTypeArguments(node, typeArguments, parentTypeArguments) {
    const result = buildGenericTypeMap(node, typeArguments);
    if (parentTypeArguments) {
        result.forEach((value, key) => {
            const typeName = getAnyTypeName(value);
            if (parentTypeArguments.has(typeName)) {
                result.set(key, parentTypeArguments.get(typeName));
            }
        });
    }
    return result;
}
/**
 * Used to identify union types of a primitive and array of the same primitive, e.g. `string | string[]`
 */
export function getCommonPrimitiveAndArrayUnionType(typeNode) {
    if (typeNode && typeNode.kind === ts.SyntaxKind.UnionType) {
        const union = typeNode;
        const types = union.types.map(t => resolveType(t));
        const arrType = types.find(t => t.typeName === 'array');
        const primitiveType = types.find(t => t.typeName !== 'array');
        if (types.length === 2 && arrType && arrType.elementType && primitiveType && arrType.elementType.typeName === primitiveType.typeName) {
            return arrType;
        }
    }
    return null;
}
export function getLiteralValue(expression) {
    if (expression.kind === ts.SyntaxKind.StringLiteral) {
        return expression.text;
    }
    if (expression.kind === ts.SyntaxKind.NumericLiteral) {
        return parseFloat(expression.text);
    }
    if (expression.kind === ts.SyntaxKind.TrueKeyword) {
        return true;
    }
    if (expression.kind === ts.SyntaxKind.FalseKeyword) {
        return false;
    }
    if (expression.kind === ts.SyntaxKind.ArrayLiteralExpression) {
        return expression.elements.map(e => getLiteralValue(e));
    }
    return;
}
//# sourceMappingURL=resolveType.js.map