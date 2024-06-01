export function isWord(c: any, wordDelimiters: string): boolean {
    //if character is not a whitespace or a delimiter
    var notWord = " \t\n\r\v" + wordDelimiters;
    if (notWord.indexOf(c) <= -1) {
        return true;
    }
    return false;
}
