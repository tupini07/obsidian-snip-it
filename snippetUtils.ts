export function findSnippet(
	selectedText: string,
	snippets: string[],
	isRegex: boolean
): string {
	let newStr = ""
	for (const snippet of snippets) {
		const [pattern, replacement] = snippet.split(" : ")
		if (isRegex) {
			const regex = new RegExp(pattern)
			if (regex.test(selectedText)) {
				newStr = selectedText.replace(regex, replacement)
				break
			}
		} else {
			if (selectedText === pattern) {
				newStr = replacement
				break
			}
		}
	}
	return newStr
}
export function updateSplit(
	newlineSymbol: string,
	snippets_file: string,
	isRegex: boolean
) {
	let nlSymb = newlineSymbol
	nlSymb = nlSymb.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")
	const rg = "(?<!" + nlSymb + ")\\n"
	const regex = new RegExp(rg)
	let splited = snippets_file.split(regex)
	splited = splited.filter((item) => item)

	return splited
}
