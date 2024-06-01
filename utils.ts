export function isWord(c: any, wordDelimiters: string): boolean {
    //if character is not a whitespace or a delimiter
    var notWord = " \t\n\r\v" + wordDelimiters;
    if (notWord.indexOf(c) <= -1) {
        return true;
    }
    return false;
}
export function SnippetsWordAt(cm: CodeMirror.Editor, pos: CodeMirror.Position, wordDelimiters: string): any {
    var start = pos.ch,
        end = start,
        line = cm.getLine(pos.line);
    while (start && isWord(line.charAt(start - 1), wordDelimiters)) --start;
    while (end < line.length && isWord(line.charAt(end), wordDelimiters)) ++end;
    var fr = { line: pos.line, ch: start };
    var t = { line: pos.line, ch: end };
    return { from: fr, to: t, word: line.slice(start, end) };
}
