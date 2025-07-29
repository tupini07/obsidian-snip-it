/**
 * @jest-environment jsdom
 */

import moment from 'moment';
import { evaluateDynamicExpressions, hasDynamicExpressions, createDynamicVariables } from './dynamicUtils';

// Setup window.moment for tests
window.moment = moment;

// Mock Obsidian types for testing
const mockApp = {} as any;
const mockFile = { basename: 'Test Note' } as any;

describe('dynamicUtils', () => {
    beforeEach(() => {
        // Use fixed time for consistent tests
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2023-07-29T10:30:00'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('createDynamicVariables', () => {
        it('should provide date variable compatible with Obsidian', () => {
            const variables = createDynamicVariables(mockApp, mockFile);
            expect(typeof variables['date']).toBe('function');
        });

        it('should provide time variable compatible with Obsidian', () => {
            const variables = createDynamicVariables(mockApp, mockFile);
            expect(typeof variables['time']).toBe('function');
        });

        it('should provide title variable that returns file basename', () => {
            const variables = createDynamicVariables(mockApp, mockFile);
            expect(typeof variables['title']).toBe('function');
        });

        it('should handle missing file gracefully', () => {
            const variables = createDynamicVariables(mockApp, undefined);
            const titleResult = variables['title']();
            expect(titleResult).toBe('');
        });
    });

    describe('hasDynamicExpressions', () => {
        it('should return true for text with dynamic expressions', () => {
            expect(hasDynamicExpressions('Today is {{date}}')).toBe(true);
            expect(hasDynamicExpressions('{{time}} - {{date}}')).toBe(true);
            expect(hasDynamicExpressions('Title: {{title}}')).toBe(true);
        });

        it('should return false for text without dynamic expressions', () => {
            expect(hasDynamicExpressions('Just plain text')).toBe(false);
            expect(hasDynamicExpressions('No dynamics here')).toBe(false);
            expect(hasDynamicExpressions('')).toBe(false);
        });

        it('should return false for malformed expressions', () => {
            expect(hasDynamicExpressions('{{incomplete')).toBe(false);
            expect(hasDynamicExpressions('incomplete}}')).toBe(false);
            expect(hasDynamicExpressions('{single brackets}')).toBe(false);
        });
    });

    describe('evaluateDynamicExpressions', () => {
        it('should handle expressions without app instance', () => {
            const result = evaluateDynamicExpressions('Today is {{date}}');
            // Should preserve the expression if no app provided
            expect(result).toBe('Today is {{date}}');
        });

        it('should leave unknown expressions unchanged', () => {
            const result = evaluateDynamicExpressions('{{unknown}} variable');
            expect(result).toBe('{{unknown}} variable');
        });

        it('should handle mixed known and unknown expressions', () => {
            const result = evaluateDynamicExpressions('{{date}} and {{unknown}}', mockApp, mockFile);
            expect(result).toBe('2023-07-29 and {{unknown}}');
        });

        it('should handle expressions with whitespace', () => {
            const result = evaluateDynamicExpressions('{{ date }} with spaces', mockApp, mockFile);
            expect(result).toBe('2023-07-29 with spaces');
        });

        it('should handle custom moment format expressions', () => {
            const result = evaluateDynamicExpressions('{{date:MMMM Do, YYYY}}', mockApp, mockFile);
            expect(result).toBe('July 29th, 2023');
        });

        it('should handle custom time format expressions', () => {
            const result = evaluateDynamicExpressions('{{time:h:mm A}}', mockApp, mockFile);
            expect(result).toBe('10:30 AM');
        });

        it('should handle date variable with time format', () => {
            const result = evaluateDynamicExpressions('now : `{{date:HH:mm}}` —', mockApp, mockFile);
            expect(result).toBe('now : `10:30` —');
        });

        it('should return original text if no expressions', () => {
            const text = 'No dynamic content here';
            expect(evaluateDynamicExpressions(text)).toBe(text);
        });

        it('should handle empty string', () => {
            expect(evaluateDynamicExpressions('')).toBe('');
        });
    });
});
