'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnumValues = exports.Enum = exports.IsDateTime = exports.IsDate = exports.IsDouble = exports.IsFloat = exports.IsLong = exports.IsInt = exports.Hidden = exports.Produces = exports.Consumes = exports.Tags = exports.Example = exports.Response = void 0;
/**
 * A decorator to document the responses that a given service method can return. It is used to generate
 * documentation for the REST service.
 * ```typescript
 * interface MyError {
 *    message: string
 * }
 * @ Path('people')
 * class PeopleService {
 *   @ Response<string>(200, 'Retrieve a list of people.')
 *   @ Response<MyError>(401, 'The user is unauthorized.', {message: 'The user is not authorized to access this operation.'})
 *   @ GET
 *   getPeople(@ Param('name') name: string) {
 *      // ...
 *   }
 * }
 * ```
 * A Default response is created in swagger documentation from the method return analisys. So any response declared
 * through this decorator is an additional response created.
 * @param name The response status code or name
 * @param description A description for this response
 * @param example An optional example of response to be added to method documentation.
 */
function Response(name, description, example) {
    return () => { return; };
}
exports.Response = Response;
/**
 * Used to provide an example of method return to be added into the method response section of the
 * generated documentation for this method.
 * ```typescript
 * @ Path('people')
 * class PeopleService {
 *   @ Example<Array<Person>>([{
 *     name: 'Joe'
 *   }])
 *   @ GET
 *   getPeople(@ Param('name') name: string): Person[] {
 *      // ...
 *   }
 * }
 * ```
 * @param example The example returned object
 */
function Example(example) {
    return () => { return; };
}
exports.Example = Example;
/**
 * Add tags for a given method on generated swagger documentation.
 * ```typescript
 * @ Path('people')
 * class PeopleService {
 *   @ Tags('adiministrative', 'department1')
 *   @ GET
 *   getPeople(@ Param('name') name: string) {
 *      // ...
 *   }
 * }
 * ```
 * @param values a list of tags
 */
function Tags(...values) {
    return () => { return; };
}
exports.Tags = Tags;
/**
 * Document the method or class comsumes property in generated swagger docs
 */
function Consumes(...values) {
    return () => { return; };
}
exports.Consumes = Consumes;
/**
 * Document the method or class produces property in generated swagger docs
 */
function Produces(...values) {
    return () => { return; };
}
exports.Produces = Produces;
/**
 * Document the method or class produces property in generated swagger docs
 */
function Hidden() {
    return () => { return; };
}
exports.Hidden = Hidden;
/**
 * Document the type of a property or parameter as `integer ($int32)` in generated swagger docs
 */
function IsInt(target, propertyKey, parameterIndex) {
    return;
}
exports.IsInt = IsInt;
/**
 * Document the type of a property or parameter as `integer ($int64)` in generated swagger docs
 */
function IsLong(target, propertyKey, parameterIndex) {
    return;
}
exports.IsLong = IsLong;
/**
 * Document the type of a property or parameter as `number ($float)` in generated swagger docs
 */
function IsFloat(target, propertyKey, parameterIndex) {
    return;
}
exports.IsFloat = IsFloat;
/**
 * Document the type of a property or parameter as `number ($double)` in generated swagger docs.
 * This is the default for `number` types without a specifying decorator.
 */
function IsDouble(target, propertyKey, parameterIndex) {
    return;
}
exports.IsDouble = IsDouble;
/**
 * Document the type of a property or parameter as a `string ($date)` format in generated swagger docs
 */
function IsDate(target, propertyKey, parameterIndex) {
    return;
}
exports.IsDate = IsDate;
/**
 * Document the type of a property or parameter as a `string ($date-time)` format in generated swagger docs.
 *
 * This is the default behavior for 'Date' types without specifying a decorator.
 */
function IsDateTime(target, propertyKey, parameterIndex) {
    return;
}
exports.IsDateTime = IsDateTime;
const EnumSymbol = Symbol.for("typescript-rest-swagger-enum");
/**
 * Decorator to provide enum values for a string field dynamically
 * Can only be used as a decorator and not as a JSDoc comment
 *
 * @Enum('A_VALUE', 'ANOTHER')
 * OR
 * const { getEnumValues } = require("./another-module")
 * @Enum(...getEnumValues())
 */
function Enum(...values) {
    return (target) => {
        Reflect.set(target, EnumSymbol, values);
    };
}
exports.Enum = Enum;
function getEnumValues(target) {
    return Reflect.get(target, EnumSymbol);
}
exports.getEnumValues = getEnumValues;
//# sourceMappingURL=decorators.js.map