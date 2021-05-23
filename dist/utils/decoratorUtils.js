import ts from 'typescript';
export function getDecorators(node, isMatching) {
    const decorators = node.decorators;
    if (!decorators || !decorators.length) {
        return [];
    }
    return decorators
        .map(d => {
        const result = {
            arguments: [],
            typeArguments: []
        };
        let x = d.expression;
        if (ts.isCallExpression(x)) {
            if (x.arguments) {
                result.arguments = x.arguments.map((argument) => {
                    if (ts.isStringLiteral(argument)) {
                        return argument.text;
                    }
                    else if (ts.isNumericLiteral(argument)) {
                        return argument.text;
                    }
                    else {
                        return argument;
                    }
                });
            }
            if (x.typeArguments) {
                result.typeArguments = x.typeArguments;
            }
            x = x.expression;
        }
        result.text = x.text || x.name.text;
        return result;
    })
        .filter(isMatching);
}
function getDecorator(node, isMatching) {
    const decorators = getDecorators(node, isMatching);
    if (!decorators || !decorators.length) {
        return undefined;
    }
    return decorators[0];
}
export function getDecoratorName(node, isMatching) {
    const decorator = getDecorator(node, isMatching);
    return decorator ? decorator.text : undefined;
}
export function getDecoratorTextValue(node, isMatching) {
    const decorator = getDecorator(node, isMatching);
    return decorator && typeof decorator.arguments[0] === 'string' ? decorator.arguments[0] : undefined;
}
export function getDecoratorOptions(node, isMatching) {
    const decorator = getDecorator(node, isMatching);
    return decorator && typeof decorator.arguments[1] === 'object' ? decorator.arguments[1] : undefined;
}
export function getDecoratorArguments(node, isMatching) {
    const decorator = getDecorator(node, isMatching);
    return decorator && decorator.arguments.length > 0 ? decorator.arguments : undefined;
}
export function isDecorator(node, isMatching) {
    const decorators = getDecorators(node, isMatching);
    if (!decorators || !decorators.length) {
        return false;
    }
    return true;
}
//# sourceMappingURL=decoratorUtils.js.map