import { findSnippet } from './snippetUtils';

describe('findSnippet', () => {
    it('should return the replacement for a matching snippet without regex', () => {
        const selectedText = 'hello';
        const snippets = ['hello : world'];
        const isRegex = false;
        const result = findSnippet(selectedText, snippets, isRegex);
        expect(result).toBe('world');
    });

    it('should return the replacement for a matching snippet with regex', () => {
        const selectedText = 'hello123';
        const snippets = ['hello\\d+ : world'];
        const isRegex = true;
        const result = findSnippet(selectedText, snippets, isRegex);
        expect(result).toBe('world');
    });

    it('should return an empty string if no snippet matches without regex', () => {
        const selectedText = 'hello';
        const snippets = ['hi : world'];
        const isRegex = false;
        const result = findSnippet(selectedText, snippets, isRegex);
        expect(result).toBe('');
    });

    it('should return an empty string if no snippet matches with regex', () => {
        const selectedText = 'hello';
        const snippets = ['hi\\d+ : world'];
        const isRegex = true;
        const result = findSnippet(selectedText, snippets, isRegex);
        expect(result).toBe('');
    });

    it('should handle multiple snippets and return the first matching one without regex', () => {
        const selectedText = 'hello';
        const snippets = ['hi : world', 'hello : universe'];
        const isRegex = false;
        const result = findSnippet(selectedText, snippets, isRegex);
        expect(result).toBe('universe');
    });

    it('should handle multiple snippets and return the first matching one with regex', () => {
        const selectedText = 'hello123';
        const snippets = ['hi\\d+ : world', 'hello\\d+ : universe'];
        const isRegex = true;
        const result = findSnippet(selectedText, snippets, isRegex);
        expect(result).toBe('universe');
    });
});
