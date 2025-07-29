import { findSnippet } from './snippetUtils';
import { isWord } from './utils';

interface SnippetWithHotkey {
    pattern: string
    replacement: string
    hotkey?: string
    id?: string
}

describe('findSnippet', () => {
    it('should return the replacement for a matching snippet without regex', () => {
        const selectedText = 'hello';
        const snippets: SnippetWithHotkey[] = [{ pattern: 'hello', replacement: 'world', id: '1' }];
        const isRegex = false;
        const result = findSnippet(selectedText, snippets, isRegex);
        expect(result).toBe('world');
    });

    it('should return the replacement for a matching snippet with regex', () => {
        const selectedText = 'hello123';
        const snippets: SnippetWithHotkey[] = [{ pattern: 'hello\\d+', replacement: 'world', id: '1' }];
        const isRegex = true;
        const result = findSnippet(selectedText, snippets, isRegex);
        expect(result).toBe('world');
    });

    it('should return an empty string if no snippet matches without regex', () => {
        const selectedText = 'hello';
        const snippets: SnippetWithHotkey[] = [{ pattern: 'hi', replacement: 'world', id: '1' }];
        const isRegex = false;
        const result = findSnippet(selectedText, snippets, isRegex);
        expect(result).toBe('');
    });

    it('should return an empty string if no snippet matches with regex', () => {
        const selectedText = 'hello';
        const snippets: SnippetWithHotkey[] = [{ pattern: 'hi\\d+', replacement: 'world', id: '1' }];
        const isRegex = true;
        const result = findSnippet(selectedText, snippets, isRegex);
        expect(result).toBe('');
    });

    it('should handle multiple snippets and return the first matching one without regex', () => {
        const selectedText = 'hello';
        const snippets: SnippetWithHotkey[] = [
            { pattern: 'hi', replacement: 'world', id: '1' },
            { pattern: 'hello', replacement: 'universe', id: '2' }
        ];
        const isRegex = false;
        const result = findSnippet(selectedText, snippets, isRegex);
        expect(result).toBe('universe');
    });

    it('should handle multiple snippets and return the first matching one with regex', () => {
        const selectedText = 'hello123';
        const snippets: SnippetWithHotkey[] = [
            { pattern: 'hi\\d+', replacement: 'world', id: '1' },
            { pattern: 'hello\\d+', replacement: 'universe', id: '2' }
        ];
        const isRegex = true;
        const result = findSnippet(selectedText, snippets, isRegex);
        expect(result).toBe('universe');
    });

    it('should evaluate dynamic expressions in snippet replacements', () => {
        const selectedText = 'today';
        const snippets: SnippetWithHotkey[] = [{ pattern: 'today', replacement: 'Today is {{date}}', id: '1' }];
        const isRegex = false;
        const mockApp = {} as any;
        const mockFile = { basename: 'Test' } as any;
        const result = findSnippet(selectedText, snippets, isRegex, mockApp, mockFile);
        expect(result).toContain('Today is ');
    });

    it('should evaluate multiple dynamic expressions in snippet replacements', () => {
        const selectedText = 'now';
        const snippets: SnippetWithHotkey[] = [{ pattern: 'now', replacement: '{{date}} at {{time}}', id: '1' }];
        const isRegex = false;
        const mockApp = {} as any;
        const mockFile = { basename: 'Test' } as any;
        const result = findSnippet(selectedText, snippets, isRegex, mockApp, mockFile);
        expect(result).toContain(' at ');
    });

    it('should leave unknown dynamic expressions unchanged', () => {
        const selectedText = 'test';
        const snippets: SnippetWithHotkey[] = [{ pattern: 'test', replacement: 'Result with {{unknown}} variable', id: '1' }];
        const isRegex = false;
        const mockApp = {} as any;
        const mockFile = { basename: 'Test' } as any;
        const result = findSnippet(selectedText, snippets, isRegex, mockApp, mockFile);
        expect(result).toBe('Result with {{unknown}} variable');
    });

    it('should work without app instance for backward compatibility', () => {
        const selectedText = 'hello';
        const snippets: SnippetWithHotkey[] = [{ pattern: 'hello', replacement: 'world', id: '1' }];
        const isRegex = false;
        const result = findSnippet(selectedText, snippets, isRegex);
        expect(result).toBe('world');
    });

    it('should handle snippets with hotkeys (hotkey field should not affect matching)', () => {
        const selectedText = 'test';
        const snippets: SnippetWithHotkey[] = [{ 
            pattern: 'test', 
            replacement: 'success', 
            hotkey: 'Alt+T',
            id: '1' 
        }];
        const isRegex = false;
        const result = findSnippet(selectedText, snippets, isRegex);
        expect(result).toBe('success');
    });
});

describe('isWord', () => {
    const wordDelimiters = "$()[]{}<>,.!?;:'\"\\/";

    it('should return true for a character that is not a whitespace or a delimiter', () => {
        expect(isWord('a', wordDelimiters)).toBe(true);
    });

    it('should return false for a whitespace character', () => {
        expect(isWord(' ', wordDelimiters)).toBe(false);
    });

    it('should return false for a delimiter character', () => {
        expect(isWord('$', wordDelimiters)).toBe(false);
    });

    it('should return true for a character that is not in the delimiters', () => {
        expect(isWord('b', wordDelimiters)).toBe(true);
    });
});
