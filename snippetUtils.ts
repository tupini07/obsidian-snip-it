import { evaluateDynamicExpressions } from "./dynamicUtils"
import { App, TFile } from "obsidian"

interface SnippetWithHotkey {
	pattern: string
	replacement: string
	hotkey?: string
	id?: string
}

export function findSnippet(
	selectedText: string,
	snippetsWithHotkeys: SnippetWithHotkey[],
	isRegex: boolean,
	app?: App,
	activeFile?: TFile
): string {
	let newStr = ""
	
	// Check snippets with hotkeys
	for (const snippet of snippetsWithHotkeys) {
		if (isRegex) {
			const regex = new RegExp(snippet.pattern)
			if (regex.test(selectedText)) {
				newStr = selectedText.replace(regex, snippet.replacement)
				break
			}
		} else {
			if (selectedText === snippet.pattern) {
				newStr = snippet.replacement
				break
			}
		}
	}
	
	// Evaluate dynamic expressions in the replacement text
	if (newStr && app) {
		newStr = evaluateDynamicExpressions(newStr, app, activeFile)
	}
	
	return newStr
}
