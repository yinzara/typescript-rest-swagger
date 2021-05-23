export function getJSDocDescription(node) {
    const jsDocs = node.jsDoc;
    if (!jsDocs || !jsDocs.length) {
        return '';
    }
    return jsDocs[0].comment || '';
}
export function getJSDocTag(node, tagName) {
    const tags = getJSDocTags(node, tagName);
    if (!tags || !tags.length) {
        return undefined;
    }
    return tags[0].comment;
}
export function isExistJSDocTag(node, tagName) {
    const tags = getJSDocTags(node, tagName);
    if (!tags || !tags.length) {
        return false;
    }
    return true;
}
function getJSDocTags(node, tagName) {
    return getMatchingJSDocTags(node, t => t.tagName.text === tagName);
}
export function getFirstMatchingJSDocTagName(node, isMatching) {
    const tags = getMatchingJSDocTags(node, isMatching);
    if (!tags || !tags.length) {
        return undefined;
    }
    return tags[0].tagName.text;
}
function getMatchingJSDocTags(node, isMatching) {
    const jsDocs = node.jsDoc;
    if (!jsDocs || !jsDocs.length) {
        return undefined;
    }
    const jsDoc = jsDocs[0];
    if (!jsDoc.tags) {
        return undefined;
    }
    return jsDoc.tags.filter(isMatching);
}
//# sourceMappingURL=jsDocUtils.js.map