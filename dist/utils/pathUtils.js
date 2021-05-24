'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePath = void 0;
function normalizePath(path) {
    if (!path) {
        return path;
    }
    let parts = path.split('/');
    parts = parts.map(part => part.startsWith(':') ? `{${part.slice(1)}}` : part);
    return parts.join('/');
}
exports.normalizePath = normalizePath;
//# sourceMappingURL=pathUtils.js.map