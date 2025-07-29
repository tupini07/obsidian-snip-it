import { App, Plugin, PluginSettingTab, Setting } from "obsidian"
import { calculateCursorEndPos } from "./cursorUtils"
import { findSnippet } from "./snippetUtils"
import { getWordBoundaries } from "./wordUtils"
import { evaluateDynamicExpressions } from "./dynamicUtils"
import moment from "moment"

export default class TextSnippets extends Plugin {
	settings: TextSnippetsSettings
	private cmEditors: CodeMirror.Editor[]
	private registeredCommands: Set<string> = new Set()

	onInit() {}

	async onload() {
		console.log("Loading snippets plugin")
		
		// Setup moment.js for dynamic expressions
		window.moment = moment;
		console.log("DEBUG: Set up window.moment in plugin load");
		
		await this.loadSettings()

		this.addSettingTab(new TextSnippetsSettingsTab(this.app, this))

		//expected warning
		// var isLegacy = this.app.vault.config.legacyeditor
		// if (!isLegacy != this.settings.isWYSIWYG) {
		// 	this.settings.isWYSIWYG = !isLegacy
		// 	await this.saveSettings()
		// }

		this.addCommand({
			id: "text-snippets",
			name: "Run snippet replacement",
			callback: () => this.SnippetOnTrigger(),
			hotkeys: [
				{
					modifiers: ["Mod"],
					key: "tab",
				},
			],
		})

		// Register hotkey commands for individual snippets
		this.registerHotkeyCommands()

		this.cmEditors = []
		this.registerCodeMirror((cm) => {
			this.cmEditors.push(cm)
			// the callback has to be called through another function in order for 'this' to work
			cm.on("keydown", (cm, event) => this.handleKeyDown(cm, event))
		})
	}

	async onunload() {
		console.log("Unloading text snippet plugin")

		this.cmEditors = []
		this.registerCodeMirror((cm) => {
			this.cmEditors.push(cm)
			// the callback has to be called through another function in order for 'this' to work
			cm.off("keydown", (cm, event) => this.handleKeyDown(cm, event))
		})
	}

	registerHotkeyCommands() {
		// Clear existing hotkey commands
		this.unregisterHotkeyCommands()
		
		// Register commands for snippets with hotkeys
		this.settings.snippetsWithHotkeys.forEach((snippet) => {
			if (snippet.hotkey && snippet.id) {
				const commandId = `snippet-${snippet.id}`
				this.addCommand({
					id: commandId,
					name: `Insert snippet: ${snippet.pattern}`,
					callback: () => this.insertSpecificSnippet(snippet),
					hotkeys: [this.parseHotkey(snippet.hotkey)]
				})
				this.registeredCommands.add(commandId)
			}
		})
	}

	unregisterHotkeyCommands() {
		// Note: Obsidian doesn't provide a direct way to unregister commands
		// Commands are automatically cleaned up when the plugin is disabled/unloaded
		this.registeredCommands.clear()
	}

	parseHotkey(hotkeyString: string): { modifiers: ("Mod" | "Ctrl" | "Meta" | "Shift" | "Alt")[], key: string } {
		const parts = hotkeyString.toLowerCase().split('+')
		const key = parts.pop() || ''
		const modifiers: ("Mod" | "Ctrl" | "Meta" | "Shift" | "Alt")[] = []
		
		parts.forEach(part => {
			const trimmed = part.trim()
			switch (trimmed) {
				case 'ctrl':
				case 'cmd':
					modifiers.push('Mod')
					break
				case 'alt':
					modifiers.push('Alt')
					break
				case 'shift':
					modifiers.push('Shift')
					break
			}
		})
		
		return { modifiers, key: key.trim() }
	}

	insertSpecificSnippet(snippet: SnippetWithHotkey) {
		let activeLeaf: any = this.app.workspace.activeLeaf
		if (!activeLeaf || !activeLeaf.view.sourceMode) return
		
		let editor = activeLeaf.view.sourceMode.cmEditor
		const cursor = editor.getCursor()
		
		// Get the active file for dynamic variable resolution
		const activeFile = this.app.workspace.getActiveFile()
		
		// Process the snippet replacement text for dynamic expressions
		let newStr = snippet.replacement
		if (newStr) {
			newStr = evaluateDynamicExpressions(newStr, this.app, activeFile)
		}
		
		// Handle special symbols
		const stopSymbol = this.settings.stopSymbol
		const pasteSymbol = this.settings.pasteSymbol
		let stopFound = false
		
		// Calculate cursor end position
		var endPosition = { nlinesCount: 0, position: 0 }
		newStr = calculateCursorEndPos(newStr, cursor, endPosition, this.settings)
		
		if (newStr.indexOf(stopSymbol) != -1) stopFound = true
		
		// Insert the snippet
		editor.replaceSelection(newStr)
		
		if (stopFound) {
			editor.setCursor({
				line: cursor.line,
				ch: cursor.ch,
			})
			this.nextStop()
		} else {
			editor.setCursor({
				line: cursor.line + endPosition.nlinesCount,
				ch: cursor.ch + endPosition.position,
			})
		}
		
		// Handle clipboard paste symbol
		if (newStr.indexOf(pasteSymbol) != -1) {
			navigator.clipboard.readText().then((clipText) => {
				const search = this.settings.isWYSIWYG ? 
					editor.searchCursor(pasteSymbol, cursor) :
					editor.getSearchCursor(pasteSymbol, cursor)
				if (search.findNext()) {
					search.replace(clipText)
				}
			})
		}
		
		editor.focus()
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
		
		// Initialize snippetsWithHotkeys if it doesn't exist (backward compatibility)
		if (!this.settings.snippetsWithHotkeys) {
			this.settings.snippetsWithHotkeys = []
		}
		
		// Ensure each snippet has a unique ID
		this.settings.snippetsWithHotkeys.forEach((snippet, index) => {
			if (!snippet.id) {
				snippet.id = `snippet-${Date.now()}-${index}`
			}
		})
	}

	async saveSettings() {
		await this.saveData(this.settings)
		// Re-register hotkey commands when settings change
		this.registerHotkeyCommands()
	}

	getSelectedText(editor: CodeMirror.Editor) {
		if (editor.somethingSelected()) {
			return editor.getSelection()
		} else {
			var wordBoundaries = getWordBoundaries(editor, this.settings.wordDelimiters)
			editor.getDoc().setSelection(wordBoundaries.start, wordBoundaries.end)
			return editor.getSelection()
		}
	}

	insertSnippet(
		key: string = "",
		snippetStartpos: CodeMirror.Position = { ch: -1, line: -1 }
	): boolean {
		let activeLeaf: any = this.app.workspace.activeLeaf
		let editor = activeLeaf.view.sourceMode.cmEditor
		// let editor = activeLeaf.view.editor;
		var cursorOrig = editor.getCursor()
		var wasSelection = editor.somethingSelected()
		var cursor = editor.getCursor("from")
		var wordBoundaries
		if (wasSelection) {
			wordBoundaries = { start: cursor, end: editor.getCursor("to") }
		} else {
			wordBoundaries = getWordBoundaries(editor, this.settings.wordDelimiters)
		}
		var stopSymbol = this.settings.stopSymbol
		var pasteSymbol = this.settings.pasteSymbol
		var stopFound = false
		var newStr = ""
		const selectedText = this.getSelectedText(editor)
		const snippetsWithHotkeys = this.settings.snippetsWithHotkeys
		const isRegex = this.settings.isRegex
		
		// Get the active file for dynamic variable resolution
		const activeFile = this.app.workspace.getActiveFile()
		
		newStr = findSnippet(selectedText, snippetsWithHotkeys, isRegex, this.app, activeFile)
		cursor = editor.getCursor("from")

		//proceed Tab and Spacebar
		var endCursor = editor.getCursor("to")
		if (
			newStr == "" ||
			(key == "Space" &&
				(cursorOrig.ch != endCursor.ch || cursorOrig.line != endCursor.line))
		) {
			if (wasSelection == false) {
				editor.getDoc().setSelection(cursorOrig, cursorOrig)
			}
			if (key == "Space") return false
			if (newStr == "") {
				editor.setCursor(cursorOrig)
				return this.nextStop()
			}
		}

		//find end position
		var endPosition = { nlinesCount: 0, position: 0 }
		newStr = calculateCursorEndPos(newStr, cursor, endPosition, this.settings)
		if (newStr.indexOf(stopSymbol) != -1) stopFound = true
		if (newStr.indexOf(pasteSymbol) != -1) snippetStartpos = cursor

		editor.replaceSelection(newStr)

		if (stopFound) {
			editor.setCursor({
				line: cursor.line,
				ch: cursor.ch,
			})

			return this.nextStop()
		} else {
			editor.setCursor({
				line: cursor.line + endPosition.nlinesCount,
				ch: cursor.ch + endPosition.position,
			})
		}

		editor.focus()
		return true
	}

	adjustCursor(
		editor: CodeMirror.Editor,
		cursor: CodeMirror.Position,
		newStr: string,
		oldStr: string
	) {
		var cursorOffset = newStr.length - oldStr.length
		this.adjustCursorOffset(editor, cursor, cursorOffset)
	}

	adjustCursorOffset(
		editor: CodeMirror.Editor,
		cursor: CodeMirror.Position,
		cursorOffset: any
	) {
		editor.setCursor({
			line: cursor.line,
			ch: cursor.ch + cursorOffset,
		})
	}

	handleKeyDown(cm: CodeMirror.Editor, event: KeyboardEvent): void {
		if (
			(event.key == "Tab" && this.settings.useTab) ||
			(event.code == "Space" && this.settings.useSpace)
		) {
			this.SnippetOnTrigger(event.code, true)
		}
	}

	SnippetOnTrigger(key: string = "", preventDef: boolean = false): boolean {
		let activeLeaf: any = this.app.workspace.activeLeaf
		let cm = activeLeaf.view.sourceMode.cmEditor
		var cursorSt = cm.getCursor()
		if (this.insertSnippet(key, cursorSt)) {
			if (preventDef) {
				event.preventDefault()
				if (this.settings.isWYSIWYG && key == "Tab") {
					// delete '\t' in Live preview
					var search = cm.searchCursor("\t", cursorSt)
					if (search.findPrevious()) {
						search.replace("")
					}
				}
			}

			if (cursorSt.ch >= 0 && cursorSt.line >= 0) {
				//paste text from clipboard
				var cursorOrig = cm.getCursor()
				navigator.clipboard.readText().then((clipText) => {
					if (this.settings.isWYSIWYG == false) {
						var search = cm.getSearchCursor(this.settings.pasteSymbol, cursorSt)
					} else {
						var search = cm.searchCursor(this.settings.pasteSymbol, cursorSt)
					}
					if (search.findNext()) {
						search.replace(clipText)
					}
				})
			}
			return true
		}
		return this.nextStop()
	}

	nextStop(): boolean {
		let activeLeaf: any = this.app.workspace.activeLeaf
		let cm = activeLeaf.view.sourceMode.cmEditor

		if (this.settings.isWYSIWYG == false) {
			var search = cm.getSearchCursor(this.settings.stopSymbol, cm.getCursor())
		} else {
			var search = cm.searchCursor(this.settings.stopSymbol, cm.getCursor())
		}

		if (search.findNext()) {
			search.replace("")

			if (this.settings.isWYSIWYG == false) {
				cm.setCursor(search.from())
			} else {
				cm.setCursor(search.current().from)
			}
			return true
		} else if (this.settings.useTab) {
			return false
		}
		return false
	}
	isRegex: boolean
}

interface SnippetWithHotkey {
	pattern: string
	replacement: string
	hotkey?: string
	id?: string
}

interface TextSnippetsSettings {
	snippetsWithHotkeys: SnippetWithHotkey[]
	endSymbol: string
	newlineSymbol: string
	stopSymbol: string
	pasteSymbol: string
	useTab: boolean
	useSpace: boolean
	wordDelimiters: string
	isWYSIWYG: boolean
	isRegex: boolean
}

const DEFAULT_SETTINGS: TextSnippetsSettings = {
	snippetsWithHotkeys: [],
	endSymbol: "$end$",
	newlineSymbol: "$nl$",
	stopSymbol: "$tb$",
	pasteSymbol: "$pst$",
	useTab: true,
	useSpace: false,
	wordDelimiters: "$()[]{}<>,.!?;:'\"\\/",
	isWYSIWYG: false,
	isRegex: false,
}

class TextSnippetsSettingsTab extends PluginSettingTab {
	plugin: TextSnippets

	constructor(app: App, plugin: TextSnippets) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		let { containerEl } = this

		containerEl.empty()
		containerEl.createEl("h2", { text: "Text Snippets - Settings" })

		// Add usage information section
		const infoContainer = containerEl.createDiv("info-container")
		infoContainer.style.backgroundColor = "var(--background-secondary)"
		infoContainer.style.border = "1px solid var(--background-modifier-border)"
		infoContainer.style.borderRadius = "8px"
		infoContainer.style.padding = "15px"
		infoContainer.style.marginBottom = "20px"

		infoContainer.createEl("h3", { text: "📖 How to Use Text Snippets" })
		
		const usageList = infoContainer.createEl("ul")
		usageList.style.marginLeft = "20px"
		usageList.style.lineHeight = "1.6"
		
		const usageItems = [
			"<strong>Create snippets:</strong> Use the 'Add New Snippet' button below",
			"<strong>Pattern:</strong> Text to match when typing (e.g., 'sig', 'addr', 'todo')",
			"<strong>Replacement:</strong> Text to insert (supports all special symbols like $end$, $nl$, $pst$)",
			"<strong>Hotkey (Optional):</strong> Press this key combination anywhere to insert the snippet directly",
			"<strong>Two ways to trigger:</strong> Type the pattern + Tab/Space OR press the hotkey"
		]
		
		usageItems.forEach(item => {
			const li = usageList.createEl("li")
			li.innerHTML = item
		})

		const examplesContainer = infoContainer.createDiv()
		examplesContainer.createEl("h4", { text: "💡 Hotkey Examples:" })
		
		const examplesList = examplesContainer.createEl("ul")
		examplesList.style.marginLeft = "20px"
		examplesList.style.fontFamily = "monospace"
		examplesList.style.fontSize = "0.9em"
		
		const examples = [
			"<code>Alt+T</code> - Insert signature",
			"<code>Ctrl+Shift+D</code> - Insert current date",
			"<code>Alt+A</code> - Insert address",
			"<code>Shift+F1</code> - Insert help template"
		]
		
		examples.forEach(example => {
			const li = examplesList.createEl("li")
			li.innerHTML = example
			li.style.marginBottom = "5px"
		})

		const tipContainer = infoContainer.createDiv()
		tipContainer.style.marginTop = "15px"
		tipContainer.style.padding = "10px"
		tipContainer.style.backgroundColor = "var(--background-primary)"
		tipContainer.style.borderRadius = "5px"
		tipContainer.innerHTML = "💡 <strong>Tip:</strong> Snippets can be triggered in two ways: Type the pattern and press Tab/Space, or assign a hotkey for instant access from anywhere!"

		// Add special symbols section
		const symbolsContainer = infoContainer.createDiv()
		symbolsContainer.style.marginTop = "15px"
		symbolsContainer.createEl("h4", { text: "🔧 Special Symbols & Variables:" })
		
		const symbolsList = symbolsContainer.createEl("ul")
		symbolsList.style.marginLeft = "20px"
		symbolsList.style.fontFamily = "monospace"
		symbolsList.style.fontSize = "0.9em"
		symbolsList.style.lineHeight = "1.5"
		
		const symbols = [
			"<code>$end$</code> - Places cursor at this position after insertion",
			"<code>$nl$</code> - Inserts a new line",
			"<code>$tb$</code> - Tab stop (jump here with next trigger)",
			"<code>$pst$</code> - Pastes clipboard content",
			"<code>{{date}}</code> - Current date (YYYY-MM-DD)",
			"<code>{{time}}</code> - Current time (HH:mm)",
			"<code>{{title}}</code> - Current note title"
		]
		
		symbols.forEach(symbol => {
			const li = symbolsList.createEl("li")
			li.innerHTML = symbol
			li.style.marginBottom = "3px"
		})

		new Setting(containerEl)
			.setName("Text Snippets")
			.setDesc("Configure text snippets with optional hotkeys. Each snippet can be triggered either by typing its pattern or pressing its hotkey.")
			.setHeading()

		// Add button to create new snippet
		new Setting(containerEl)
			.addButton((button) => {
				button
					.setButtonText("Add New Snippet")
					.onClick(() => {
						const newSnippet: SnippetWithHotkey = {
							id: Date.now().toString(),
							pattern: "",
							replacement: "",
							hotkey: ""
						}
						this.plugin.settings.snippetsWithHotkeys.push(newSnippet)
						this.plugin.saveSettings().then(() => {
							this.display() // Refresh the settings display
						})
					})
			})
			.addButton((button) => {
				button
					.setButtonText("Add Example Snippet")
					.onClick(() => {
						const exampleSnippet: SnippetWithHotkey = {
							id: Date.now().toString(),
							pattern: "sig",
							replacement: "Best regards,$nl$$nl${{title}}$end$",
							hotkey: "Alt+S"
						}
						this.plugin.settings.snippetsWithHotkeys.push(exampleSnippet)
						this.plugin.saveSettings().then(() => {
							this.display() // Refresh the settings display
						})
					})
			})

		// Display existing snippets with hotkeys
		this.plugin.settings.snippetsWithHotkeys.forEach((snippet, index) => {
			const snippetContainer = containerEl.createDiv("snippet-container")
			snippetContainer.style.border = "1px solid var(--background-modifier-border)"
			snippetContainer.style.borderRadius = "5px"
			snippetContainer.style.padding = "10px"
			snippetContainer.style.marginBottom = "10px"

			// Add a visual indicator for snippets with hotkeys
			if (snippet.hotkey) {
				snippetContainer.style.borderLeft = "4px solid var(--interactive-accent)"
			}

			const headerDiv = snippetContainer.createDiv()
			headerDiv.style.display = "flex"
			headerDiv.style.justifyContent = "space-between"
			headerDiv.style.alignItems = "center"
			headerDiv.style.marginBottom = "10px"

			const titleSpan = headerDiv.createSpan()
			titleSpan.textContent = `Snippet ${index + 1}`
			titleSpan.style.fontWeight = "bold"

			if (snippet.hotkey) {
				const hotkeyBadge = headerDiv.createSpan()
				hotkeyBadge.textContent = `⌨️ ${snippet.hotkey}`
				hotkeyBadge.style.fontSize = "0.8em"
				hotkeyBadge.style.padding = "2px 6px"
				hotkeyBadge.style.backgroundColor = "var(--interactive-accent)"
				hotkeyBadge.style.color = "var(--text-on-accent)"
				hotkeyBadge.style.borderRadius = "3px"
			}

			new Setting(snippetContainer)
				.addButton((button) => {
					button
						.setButtonText("Delete")
						.setWarning()
						.onClick(() => {
							this.plugin.settings.snippetsWithHotkeys.splice(index, 1)
							this.plugin.saveSettings().then(() => {
								this.plugin.registerHotkeyCommands()
								this.display()
							})
						})
				})

			new Setting(snippetContainer)
				.setName("Pattern")
				.setDesc("The text to match when typing (e.g., 'sig' for signature, 'addr' for address, 'today' for current date)")
				.addText((text) => {
					text
						.setPlaceholder("e.g., sig, addr, todo...")
						.setValue(snippet.pattern)
						.onChange(async (value) => {
							snippet.pattern = value
							await this.plugin.saveSettings()
						})
				})

			new Setting(snippetContainer)
				.setName("Replacement")
				.setDesc("The text to insert. Use $end$ for cursor position, $nl$ for new lines, $pst$ for clipboard content.")
				.addTextArea((text) => {
					text
						.setPlaceholder("e.g., Best regards,$nl$John Doe$end$")
						.setValue(snippet.replacement)
						.onChange(async (value) => {
							snippet.replacement = value
							await this.plugin.saveSettings()
						})
					text.inputEl.rows = 3
				})

			new Setting(snippetContainer)
				.setName("Hotkey")
				.setDesc("Optional hotkey to insert this snippet from anywhere. Click 'Capture' to record a key combination, or type manually.")
				.addText((text) => {
					const textInput = text
						.setPlaceholder("e.g., Alt+T, Ctrl+Shift+D")
						.setValue(snippet.hotkey || "")
						.onChange(async (value) => {
							snippet.hotkey = value.trim() || undefined
							await this.plugin.saveSettings()
							this.plugin.registerHotkeyCommands()
							this.updateHotkeyValidation(snippetContainer, snippet, text.inputEl)
						})
					
					// Update validation when the setting is first created
					setTimeout(() => this.updateHotkeyValidation(snippetContainer, snippet, text.inputEl), 0)
					
					return textInput
				})
				.addButton((button) => {
					button
						.setButtonText("Capture")
						.setTooltip("Click and press the key combination you want to use")
						.onClick(() => {
							this.captureHotkey(snippet, snippetContainer)
						})
				})
				.addButton((button) => {
					button
						.setButtonText("Clear")
						.setTooltip("Remove the hotkey")
						.onClick(async () => {
							snippet.hotkey = undefined
							await this.plugin.saveSettings()
							this.plugin.registerHotkeyCommands()
							this.display() // Refresh the display
						})
				})
		})

		// Add summary section for active hotkeys
		if (this.plugin.settings.snippetsWithHotkeys.some(s => s.hotkey)) {
			const summaryContainer = containerEl.createDiv("hotkey-summary")
			summaryContainer.style.backgroundColor = "var(--background-secondary)"
			summaryContainer.style.border = "1px solid var(--background-modifier-border)"
			summaryContainer.style.borderRadius = "8px"
			summaryContainer.style.padding = "15px"
			summaryContainer.style.marginTop = "20px"
			summaryContainer.style.marginBottom = "20px"

			summaryContainer.createEl("h3", { text: "⌨️ Active Hotkeys" })
			
			const activeHotkeys = this.plugin.settings.snippetsWithHotkeys.filter(s => s.hotkey && s.pattern)
			
			if (activeHotkeys.length > 0) {
				const hotkeyList = summaryContainer.createEl("ul")
				hotkeyList.style.marginLeft = "20px"
				hotkeyList.style.lineHeight = "1.6"
				
				activeHotkeys.forEach(snippet => {
					const li = hotkeyList.createEl("li")
					li.innerHTML = `<code>${snippet.hotkey}</code> → <strong>${snippet.pattern}</strong> (${snippet.replacement.substring(0, 30)}${snippet.replacement.length > 30 ? '...' : ''})`
					li.style.marginBottom = "5px"
				})
			} else {
				summaryContainer.createEl("p", { text: "No active hotkeys configured yet. Add hotkeys to snippets above to see them here." })
			}
		}

		new Setting(containerEl)
			.setName("Use Regex for Snippets")
			.setDesc("Enable this to use regex patterns for snippet matching.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.isRegex).onChange(async (value) => {
					this.plugin.settings.isRegex = value
					await this.plugin.saveSettings()
				})
			)
		new Setting(containerEl)
			.setName("Cursor end position mark")
			.setDesc(
				"Places the cursor to the mark position after inserting a snippet (default: $end$).\nMark does not appear anywhere within the snippet. Do not use together with Stop Symbol."
			)
			.setClass("text-snippets-cursor")
			.addTextArea((text) =>
				text
					.setPlaceholder("$end$")
					.setValue(this.plugin.settings.endSymbol)
					.onChange(async (value) => {
						if (value == "") {
							value = "$end$"
						}
						this.plugin.settings.endSymbol = value
						await this.plugin.saveSettings()
					})
			)
		new Setting(containerEl)
			.setName("Newline mark")
			.setDesc(
				"Ignores newline after mark, replace it with a newline character after expanding (default: $nl$).\nNecessary to write before every line break in multiline snippets."
			)
			.setClass("text-snippets-newline")
			.addTextArea((text) =>
				text
					.setPlaceholder("$nl$")
					.setValue(this.plugin.settings.newlineSymbol)
					.onChange(async (value) => {
						if (value == "") {
							value = "$nl$"
						}
						this.plugin.settings.newlineSymbol = value
						await this.plugin.saveSettings()
					})
			)
		new Setting(containerEl)
			.setName("Stop Symbol")
			.setDesc("Symbol to jump to when command is called.")
			.setClass("text-snippets-tabstops")
			.addTextArea((text) =>
				text
					.setPlaceholder("")
					.setValue(this.plugin.settings.stopSymbol)
					.onChange(async (value) => {
						if (value == "") {
							value = "$tb$"
						}
						this.plugin.settings.stopSymbol = value
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName("Clipboard paste Symbol")
			.setDesc("Symbol to be replaced with clipboard content.")
			.setClass("text-snippets-tabstops")
			.addTextArea((text) =>
				text
					.setPlaceholder("")
					.setValue(this.plugin.settings.pasteSymbol)
					.onChange(async (value) => {
						if (value == "") {
							value = "$pst$"
						}
						this.plugin.settings.pasteSymbol = value
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName("Expand on Tab")
			.setDesc("Use the Tab key as the trigger.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.useTab).onChange(async (value) => {
					this.plugin.settings.useTab = !this.plugin.settings.useTab
					await this.plugin.saveSettings()
				})
			)
		new Setting(containerEl)
			.setName("Expand on Space")
			.setDesc("Use the Space bar button as the trigger.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.useSpace).onChange(async (value) => {
					this.plugin.settings.useSpace = !this.plugin.settings.useSpace
					await this.plugin.saveSettings()
				})
			)
		new Setting(containerEl)
			.setName("Live Preview Mode")
			.setDesc(
				"Toggle manually if not correct. You should restart plugin after changing this option."
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.isWYSIWYG).onChange(async (value) => {
					this.plugin.settings.isWYSIWYG = !this.plugin.settings.isWYSIWYG
					await this.plugin.saveSettings()
				})
			)

		new Setting(containerEl)
			.setName("Word delimiters")
			.setDesc("Сharacters for specifying the boundary between separate words.")
			.setClass("text-snippets-delimiter")
			.addTextArea((text) =>
				text
					.setPlaceholder("")
					.setValue(this.plugin.settings.wordDelimiters)
					.onChange(async (value) => {
						this.plugin.settings.wordDelimiters = value
						await this.plugin.saveSettings()
					})
			)
	}

	/**
	 * Captures a hotkey combination by listening for keydown events
	 */
	captureHotkey(snippet: SnippetWithHotkey, snippetContainer: HTMLElement) {
		// Find the text input in the container to make it readonly during capture
		const textInput = snippetContainer.querySelector('input[type="text"]') as HTMLInputElement
		const originalValue = textInput?.value || ''
		const originalReadonly = textInput?.readOnly || false
		
		// Make the input readonly during capture
		if (textInput) {
			textInput.readOnly = true
			textInput.style.opacity = '0.6'
			textInput.value = 'Press a key combination...'
		}
		
		// Create modal overlay
		const overlay = document.createElement('div')
		overlay.style.position = 'fixed'
		overlay.style.top = '0'
		overlay.style.left = '0'
		overlay.style.width = '100%'
		overlay.style.height = '100%'
		overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
		overlay.style.zIndex = '9999'
		overlay.style.display = 'flex'
		overlay.style.alignItems = 'center'
		overlay.style.justifyContent = 'center'
		
		// Create modal content
		const modal = document.createElement('div')
		modal.style.backgroundColor = 'var(--background-primary)'
		modal.style.border = '1px solid var(--background-modifier-border)'
		modal.style.borderRadius = '8px'
		modal.style.padding = '20px'
		modal.style.maxWidth = '400px'
		modal.style.textAlign = 'center'
		modal.style.animation = 'fadeIn 0.2s ease-out'
		
		const title = modal.createEl('h3', { text: 'Press the key combination' })
		title.style.marginTop = '0'
		
		const instruction = modal.createEl('p', { 
			text: 'Press the keys you want to use for this hotkey. Press Escape to cancel.' 
		})
		instruction.style.color = 'var(--text-muted)'
		
		const preview = modal.createEl('div')
		preview.style.fontSize = '18px'
		preview.style.fontWeight = 'bold'
		preview.style.marginTop = '15px'
		preview.style.minHeight = '25px'
		preview.style.padding = '10px'
		preview.style.backgroundColor = 'var(--background-secondary)'
		preview.style.borderRadius = '5px'
		preview.textContent = 'Waiting for input...'
		
		const conflictDiv = modal.createEl('div')
		conflictDiv.style.marginTop = '10px'
		conflictDiv.style.minHeight = '20px'
		
		overlay.appendChild(modal)
		document.body.appendChild(overlay)
		
		// Focus the modal to capture events
		modal.tabIndex = -1
		modal.focus()
		
		const cleanup = () => {
			document.removeEventListener('keydown', keydownHandler, true)
			document.body.removeChild(overlay)
			
			// Restore the input field
			if (textInput) {
				textInput.readOnly = originalReadonly
				textInput.style.opacity = '1'
				if (!snippet.hotkey) {
					textInput.value = originalValue
				}
			}
		}
		
		const keydownHandler = (event: KeyboardEvent) => {
			event.preventDefault()
			event.stopPropagation()
			
			// Handle escape to cancel
			if (event.key === 'Escape') {
				cleanup()
				return
			}
			
			// Build hotkey string
			const modifiers: string[] = []
			if (event.ctrlKey || event.metaKey) modifiers.push(event.ctrlKey ? 'Ctrl' : 'Cmd')
			if (event.altKey) modifiers.push('Alt')
			if (event.shiftKey) modifiers.push('Shift')
			
			// Don't treat modifier keys alone as valid hotkeys
			if (['Control', 'Alt', 'Shift', 'Meta', 'Cmd'].includes(event.key)) {
				preview.textContent = modifiers.join('+') + (modifiers.length > 0 ? '+' : '') + '...'
				return
			}
			
			// Build the full hotkey string
			const key = event.key === ' ' ? 'Space' : event.key
			const hotkeyString = modifiers.length > 0 ? modifiers.join('+') + '+' + key : key
			
			preview.textContent = hotkeyString
			
			// Update the input field immediately
			if (textInput) {
				textInput.value = hotkeyString
			}
			
			// Check for conflicts
			const conflicts = this.checkHotkeyConflicts(hotkeyString, snippet.id)
			if (conflicts.length > 0) {
				conflictDiv.innerHTML = `<span style="color: var(--text-error)">⚠️ Conflicts with: ${conflicts.slice(0, 3).join(', ')}${conflicts.length > 3 ? '...' : ''}</span>`
			} else {
				conflictDiv.innerHTML = `<span style="color: var(--text-success)">✅ No conflicts found</span>`
			}
			
			// Auto-close after a short delay
			setTimeout(() => {
				snippet.hotkey = hotkeyString
				this.plugin.saveSettings().then(() => {
					this.plugin.registerHotkeyCommands()
					this.display() // Refresh the display
				})
				cleanup()
			}, conflicts.length > 0 ? 2500 : 1000) // Longer delay if there are conflicts
		}
		
		// Close modal when clicking outside
		overlay.addEventListener('click', (event) => {
			if (event.target === overlay) {
				cleanup()
			}
		})
		
		// Add global keydown listener with capture to intercept all keys
		document.addEventListener('keydown', keydownHandler, true)
	}

	/**
	 * Checks if a hotkey conflicts with existing commands
	 */
	checkHotkeyConflicts(hotkeyString: string, excludeSnippetId?: string): string[] {
		const conflicts: string[] = []
		
		try {
			// Parse the hotkey to Obsidian's format
			const parsedHotkey = this.plugin.parseHotkey(hotkeyString)
			
			// Access Obsidian's internal hotkey system
			const app = this.app as any
			
			// Method 1: Check through hotkeyManager if available
			if (app.hotkeyManager && app.hotkeyManager.customKeys) {
				for (const [hotkeyStr, commandIds] of Object.entries(app.hotkeyManager.customKeys)) {
					if (Array.isArray(commandIds)) {
						for (const commandId of commandIds) {
							// Skip our own snippet commands
							if (excludeSnippetId && commandId === `text-snippets-obsidian:snippet-${excludeSnippetId}`) {
								continue
							}
							
							// Parse the stored hotkey and compare
							try {
								const storedHotkey = this.parseStoredHotkey(hotkeyStr)
								if (storedHotkey && this.hotkeysMatch(parsedHotkey, storedHotkey)) {
									const command = app.commands?.commands?.[commandId]
									const commandName = command?.name || commandId
									conflicts.push(commandName)
								}
							} catch (e) {
								// Ignore parse errors
							}
						}
					}
				}
			}
			
			// Method 2: Check through default hotkeys if available
			if (app.hotkeyManager && app.hotkeyManager.defaultKeys) {
				for (const [commandId, hotkeys] of Object.entries(app.hotkeyManager.defaultKeys)) {
					// Skip our own snippet commands
					if (excludeSnippetId && commandId === `text-snippets-obsidian:snippet-${excludeSnippetId}`) {
						continue
					}
					
					if (Array.isArray(hotkeys)) {
						for (const hotkey of hotkeys) {
							if (this.hotkeysMatch(parsedHotkey, hotkey)) {
								const command = app.commands?.commands?.[commandId]
								const commandName = command?.name || commandId
								conflicts.push(`${commandName} (default)`)
							}
						}
					}
				}
			}
			
			// Method 3: Manual check for common Obsidian hotkeys that might not be in the system
			const commonHotkeys = this.getCommonObsidianHotkeys()
			const hotkeyKey = this.normalizeHotkeyForComparison(parsedHotkey)
			
			if (commonHotkeys[hotkeyKey]) {
				conflicts.push(commonHotkeys[hotkeyKey])
			}
			
			// Also check against other snippets in our plugin
			this.plugin.settings.snippetsWithHotkeys.forEach((otherSnippet) => {
				if (otherSnippet.id !== excludeSnippetId && otherSnippet.hotkey) {
					try {
						const otherParsedHotkey = this.plugin.parseHotkey(otherSnippet.hotkey)
						if (this.hotkeysMatch(parsedHotkey, otherParsedHotkey)) {
							conflicts.push(`Snippet: ${otherSnippet.pattern}`)
						}
					} catch (e) {
						// Ignore parsing errors for other snippets
					}
				}
			})
		} catch (error) {
			console.error('Error checking hotkey conflicts:', error)
		}
		
		// Remove duplicates
		return [...new Set(conflicts)]
	}
	
	/**
	 * Parse a hotkey string from Obsidian's internal format
	 */
	parseStoredHotkey(hotkeyStr: string): any {
		try {
			// Obsidian stores hotkeys in format like "Ctrl+KeyT" or "Mod+KeyT"
			const parts = hotkeyStr.split('+')
			const modifiers: string[] = []
			let key = ''
			
			for (const part of parts) {
				if (part === 'Ctrl' || part === 'Cmd' || part === 'Mod') {
					modifiers.push('Mod')
				} else if (part === 'Alt') {
					modifiers.push('Alt')
				} else if (part === 'Shift') {
					modifiers.push('Shift')
				} else if (part.startsWith('Key')) {
					// Convert KeyT to t
					key = part.substring(3).toLowerCase()
				} else if (part.startsWith('Digit')) {
					// Convert Digit1 to 1
					key = part.substring(5)
				} else {
					// Other keys like Space, Enter, etc.
					key = part.toLowerCase()
				}
			}
			
			return { modifiers, key }
		} catch (e) {
			return null
		}
	}
	
	/**
	 * Get common Obsidian hotkeys that might not be detected otherwise
	 */
	getCommonObsidianHotkeys(): Record<string, string> {
		return {
			'mod+t': 'New tab',
			'ctrl+t': 'New tab',
			'cmd+t': 'New tab',
			'mod+w': 'Close current tab',
			'ctrl+w': 'Close current tab',
			'cmd+w': 'Close current tab',
			'mod+n': 'New note',
			'ctrl+n': 'New note',
			'cmd+n': 'New note',
			'mod+o': 'Quick switcher',
			'ctrl+o': 'Quick switcher',
			'cmd+o': 'Quick switcher',
			'mod+p': 'Command palette',
			'ctrl+p': 'Command palette',
			'cmd+p': 'Command palette',
			'mod+shift+p': 'Command palette',
			'ctrl+shift+p': 'Command palette',
			'cmd+shift+p': 'Command palette',
			'mod+s': 'Save',
			'ctrl+s': 'Save',
			'cmd+s': 'Save',
			'mod+f': 'Search current file',
			'ctrl+f': 'Search current file',
			'cmd+f': 'Search current file',
			'mod+h': 'Search and replace',
			'ctrl+h': 'Search and replace',
			'cmd+h': 'Search and replace',
			'mod+shift+f': 'Search in all files',
			'ctrl+shift+f': 'Search in all files',
			'cmd+shift+f': 'Search in all files',
			'mod+e': 'Toggle edit/preview mode',
			'ctrl+e': 'Toggle edit/preview mode',
			'cmd+e': 'Toggle edit/preview mode',
			'mod+,': 'Open settings',
			'ctrl+,': 'Open settings',
			'cmd+,': 'Open settings',
			'f11': 'Toggle fullscreen',
			'mod+\\': 'Toggle left sidebar',
			'ctrl+\\': 'Toggle left sidebar',
			'cmd+\\': 'Toggle left sidebar',
			'mod+alt+\\': 'Toggle right sidebar',
			'ctrl+alt+\\': 'Toggle right sidebar',
			'cmd+alt+\\': 'Toggle right sidebar'
		}
	}
	
	/**
	 * Normalize a hotkey for comparison with common hotkeys
	 */
	normalizeHotkeyForComparison(hotkey: any): string {
		if (!hotkey) return ''
		
		const modifiers = hotkey.modifiers || []
		const key = hotkey.key || ''
		
		// Sort modifiers and join with key
		const sortedModifiers = modifiers.slice().sort().join('+').toLowerCase()
		const normalizedKey = key.toLowerCase()
		
		return sortedModifiers ? `${sortedModifiers}+${normalizedKey}` : normalizedKey
	}

	/**
	 * Compares two hotkey objects to see if they match
	 */
	hotkeysMatch(hotkey1: any, hotkey2: any): boolean {
		if (!hotkey1 || !hotkey2) return false
		
		// Normalize modifiers (convert arrays to sorted strings)
		const normalizeModifiers = (modifiers: any) => {
			if (!modifiers) return ''
			if (Array.isArray(modifiers)) {
				return modifiers.slice().sort().join('+')
			}
			return String(modifiers)
		}
		
		const normalizeKey = (key: any) => {
			if (!key) return ''
			return String(key).toLowerCase()
		}
		
		return normalizeModifiers(hotkey1.modifiers) === normalizeModifiers(hotkey2.modifiers) &&
			   normalizeKey(hotkey1.key) === normalizeKey(hotkey2.key)
	}

	/**
	 * Updates the visual validation for a hotkey input
	 */
	updateHotkeyValidation(container: HTMLElement, snippet: SnippetWithHotkey, inputEl: HTMLInputElement) {
		// Remove existing validation messages
		const existingValidation = container.querySelector('.hotkey-validation')
		if (existingValidation) {
			existingValidation.remove()
		}
		
		if (!snippet.hotkey) return
		
		// Check for conflicts
		const conflicts = this.checkHotkeyConflicts(snippet.hotkey, snippet.id)
		
		if (conflicts.length > 0) {
			const validationDiv = container.createDiv('hotkey-validation')
			validationDiv.style.color = 'var(--text-error)'
			validationDiv.style.fontSize = '0.8em'
			validationDiv.style.marginTop = '5px'
			validationDiv.innerHTML = `⚠️ Conflicts with: ${conflicts.join(', ')}`
			
			// Add red border to input
			inputEl.style.borderColor = 'var(--text-error)'
		} else {
			// Add green border to input for valid hotkey
			inputEl.style.borderColor = 'var(--text-success)'
			
			const validationDiv = container.createDiv('hotkey-validation')
			validationDiv.style.color = 'var(--text-success)'
			validationDiv.style.fontSize = '0.8em'
			validationDiv.style.marginTop = '5px'
			validationDiv.innerHTML = '✅ Hotkey is available'
		}
	}
}
