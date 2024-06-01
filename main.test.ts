import TextSnippets from "./main"
import * as CodeMirror from "codemirror"

describe("TextSnippets", () => {
	let textSnippets: TextSnippets
	let editor: CodeMirror.Editor

	beforeEach(() => {
		textSnippets = new TextSnippets()
		editor = CodeMirror(document.createElement("div"), {
			value: "Hello, world!",
			mode: "javascript",
		})
	})

	afterEach(() => {
		// Assuming you want to remove the editor instance after each test
		editor.getWrapperElement().remove()
	})

	it("should find a snippet when the selected text matches a pattern", () => {
		const cursorOrig = { ch: 0, line: 0 }
		const cursor = { ch: 6, line: 0 }

		const snippets = ["Hello, :greeting! :smiley", "Goodbye, :greeting! :frowning"]

		const snippet = textSnippets.findSnippet(editor, cursorOrig, cursor)
		expect(snippet).toBe("Hello, :greeting! :smiley")
	})

	it("should not find a snippet when the selected text does not match any patterns", () => {
		const cursorOrig = { ch: 0, line: 0 }
		const cursor = { ch: 10, line: 0 }

		// const snippets = ["Hello, :greeting! :smiley", "Goodbye, :greeting! :frowning"]

		const snippet = textSnippets.findSnippet(editor, cursorOrig, cursor)
		expect(snippet).toBe(null)
	})

	it("should find a snippet when the selected text matches a regex pattern", () => {
		const cursorOrig = { ch: 0, line: 0 }
		const cursor = { ch: 6, line: 0 }

		const snippets = [
			"Hello, (?<greeting>\\w+)! :smiley",
			"Goodbye, (?<greeting>\\w+)! :frowning",
		]

		const snippet = textSnippets.findSnippet(
			editor,
			snippets,
			cursorOrig,
			cursor,
			true
		)
		expect(snippet).toBe("Hello, :greeting! :smiley")
	})

	it("should not find a snippet when the selected text does not match any regex patterns", () => {
		const cursorOrig = { ch: 0, line: 0 }
		const cursor = { ch: 10, line: 0 }

		const snippets = [
			"Hello, (?<greeting>\\w+)! :smiley",
			"Goodbye, (?<greeting>\\w+)! :frowning",
		]

		const snippet = textSnippets.findSnippet(
			editor,
			snippets,
			cursorOrig,
			cursor,
			true
		)
		expect(snippet).toBe(null)
	})
})
