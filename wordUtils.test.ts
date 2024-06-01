import { getWordBoundaries } from './wordUtils';

describe('getWordBoundaries', () => {
    let editorMock: any;

    beforeEach(() => {
        editorMock = {
            getCursor: jest.fn().mockReturnValue({ line: 0, ch: 5 }),
            getLine: jest.fn().mockReturnValue("hello world"),
        };
    });

    it('should return the correct word boundaries', () => {
        const wordDelimiters = "$()[]{}<>,.!?;:'\"\\/";
        const result = getWordBoundaries(editorMock, wordDelimiters);
        expect(result).toEqual({
            start: { line: 0, ch: 0 },
            end: { line: 0, ch: 5 },
        });
    });
});
