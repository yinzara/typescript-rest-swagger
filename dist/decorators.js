'use strict';
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
export function Response(name, description, example) {
    return () => { return; };
}
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
export function Example(example) {
    return () => { return; };
}
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
export function Tags(...values) {
    return () => { return; };
}
/**
 * Document the method or class comsumes property in generated swagger docs
 */
export function Consumes(...values) {
    return () => { return; };
}
/**
 * Document the method or class produces property in generated swagger docs
 */
export function Produces(...values) {
    return () => { return; };
}
/**
 * Document the method or class produces property in generated swagger docs
 */
export function Hidden() {
    return () => { return; };
}
/**
 * Document the type of a property or parameter as `integer ($int32)` in generated swagger docs
 */
export function IsInt(target, propertyKey, parameterIndex) {
    return;
}
/**
 * Document the type of a property or parameter as `integer ($int64)` in generated swagger docs
 */
export function IsLong(target, propertyKey, parameterIndex) {
    return;
}
/**
 * Document the type of a property or parameter as `number ($float)` in generated swagger docs
 */
export function IsFloat(target, propertyKey, parameterIndex) {
    return;
}
/**
 * Document the type of a property or parameter as `number ($double)` in generated swagger docs.
 * This is the default for `number` types without a specifying decorator.
 */
export function IsDouble(target, propertyKey, parameterIndex) {
    return;
}
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
export function Enum(...values) {
    return (target) => {
        Reflect.set(target, EnumSymbol, values);
    };
}
export function getEnumValues(target) {
    return Reflect.get(target, EnumSymbol);
}
//# sourceMappingURL=decorators.js.map