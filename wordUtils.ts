import { isWord } from "./utils"

export function getWordBoundaries(editor: CodeMirror.Editor, wordDelimiters: string) {
	var cursor = editor.getCursor()
	var line = cursor.line
	var ch = cursor.ch

	var word = SnippetsWordAt(editor, cursor, wordDelimiters)
	var wordStart = word.from.ch
	var wordEnd = word.to.ch

	return {
		start: {
			line: line,
			ch: wordStart,
		},
		end: {
			line: line,
			ch: wordEnd,
		},
	}
}

export function SnippetsWordAt(
	cm: CodeMirror.Editor,
	pos: CodeMirror.Position,
	wordDelimiters: string
): any {
	var start = pos.ch,
		end = start,
		line = cm.getLine(pos.line)
	while (start && isWord(line.charAt(start - 1), wordDelimiters)) --start
	while (end < line.length && isWord(line.charAt(end), wordDelimiters)) ++end
	var fr = { line: pos.line, ch: start }
	var t = { line: pos.line, ch: end }
	return { from: fr, to: t, word: line.slice(start, end) }
}
