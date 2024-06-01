import { calculateCursorEndPos } from "./cursorUtils"

describe("calculateCursorEndPos", () => {
    it("should calculate the correct end position", () => {
        const nStr = "Hello$nl$World$end$"
        const cursor = { line: 0, ch: 5 }
        const endPosition = { nlinesCount: 0, position: 0 }
        const settings = {
            newlineSymbol: "$nl$",
            endSymbol: "$end$",
            stopSymbol: "$tb$"
        }

        const result = calculateCursorEndPos(nStr, cursor, endPosition, settings)

        expect(result).toBe("Hello\nWorld")
        expect(endPosition).toEqual({ nlinesCount: 1, position: 5 })
    })
})
