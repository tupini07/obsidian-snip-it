export function findSnippet(selectedText: string, snippets: string[], isRegex: boolean): string {
	let newStr = "";
	for (const snippet of snippets) {
		const [pattern, replacement] = snippet.split(" : ");
		if (isRegex) {
			const regex = new RegExp(pattern);
			if (regex.test(selectedText)) {
				newStr = selectedText.replace(regex, replacement);
				break;
			}
		} else {
			if (selectedText === pattern) {
				newStr = replacement;
				break;
			}
		}
	}
	return newStr;
}
