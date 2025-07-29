import { App, TFile } from "obsidian"

/**
 * Utility functions for evaluating dynamic expressions in snippets
 * Compatible with Obsidian's built-in template variables
 */

/**
 * Available dynamic variables - compatible with Obsidian's template system
 */
export function createDynamicVariables(app: App, activeFile?: TFile): Record<string, () => string> {
    return {
        // Obsidian built-in template variables (default formats)
        'date': () => window.moment().format('YYYY-MM-DD'),
        'time': () => window.moment().format('HH:mm'),
        'title': () => activeFile?.basename || '',
    }
}

/**
 * Get variables that support moment.js formatting (excludes special cases like title)
 */
function getMomentFormattableVariables(): string[] {
    // Get all variables except those that don't use moment formatting
    const allVariables = Object.keys(createDynamicVariables({} as App));
    const nonMomentVariables = ['title'];
    return allVariables.filter(variable => nonMomentVariables.indexOf(variable) === -1);
}

/**
 * Evaluates dynamic expressions in the format {{expression}} within a string
 * @param text The text containing dynamic expressions
 * @param app The Obsidian app instance
 * @param activeFile The currently active file (for title resolution)
 * @returns The text with dynamic expressions evaluated
 */
export function evaluateDynamicExpressions(text: string, app?: App, activeFile?: TFile): string {
    // Match {{expression}} patterns
    const dynamicPattern = /\{\{([^}]+)\}\}/g;

    // Debug: Check if window.moment is available
    console.log('DEBUG: window.moment available?', typeof window.moment);
    console.log('DEBUG: text to process:', text);

    // Get dynamic variables (use empty object if app not provided for testing)
    const dynamicVariables = app ? createDynamicVariables(app, activeFile) : {};

    return text.replace(dynamicPattern, (match, expression) => {
        const trimmedExpression = expression.trim();
        console.log('DEBUG: processing expression:', trimmedExpression);

        // Check if it's a built-in variable
        if (dynamicVariables[trimmedExpression]) {
            console.log('DEBUG: found built-in variable:', trimmedExpression);
            return dynamicVariables[trimmedExpression]();
        }

        // Check for custom format expressions (e.g., {{date:YYYY-MM-DD}}, {{time:HH:mm:ss}})
        if (trimmedExpression.includes(':')) {
            const colonIndex = trimmedExpression.indexOf(':');
            const variable = trimmedExpression.substring(0, colonIndex).trim();
            const format = trimmedExpression.substring(colonIndex + 1).trim();
            console.log('DEBUG: custom format - variable:', variable, 'format:', format);

            // Handle special timestamp formats
            if (variable === 'timestamp') {
                console.log('DEBUG: processing timestamp');
                if (format === 'unix') {
                    return Math.floor(window.moment().valueOf() / 1000).toString();
                } else if (format === 'iso') {
                    return window.moment().toISOString();
                } else {
                    // Custom timestamp format
                    return window.moment().format(format);
                }
            }

            // Support custom formats for any moment-formattable variable
            const momentFormattableVariables = getMomentFormattableVariables();
            console.log('DEBUG: momentFormattableVariables:', momentFormattableVariables);
            if (momentFormattableVariables.indexOf(variable) !== -1) {
                console.log('DEBUG: formatting with moment:', variable, format);
                try {
                    const result = window.moment().format(format);
                    console.log('DEBUG: moment result:', result);
                    return result;
                } catch (error) {
                    console.error('DEBUG: moment error:', error);
                    return match; // Return original if error
                }
            }
        }

        // If expression is not recognized, return the original match
        console.log('DEBUG: expression not recognized, returning original:', match);
        return match;
    });
}

/**
 * Checks if a string contains dynamic expressions
 * @param text The text to check
 * @returns True if the text contains dynamic expressions
 */
export function hasDynamicExpressions(text: string): boolean {
    return /\{\{[^}]+\}\}/.test(text);
}
