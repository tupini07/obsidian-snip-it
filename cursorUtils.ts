export function calculateCursorEndPos(
    nStr: string,
    cursor: CodeMirror.Position,
    endPosition: any,
    settings: { newlineSymbol: string; endSymbol: string; stopSymbol: string }
): string {
    var nlSymb = settings.newlineSymbol
    var endSymbol = settings.endSymbol
    var stopSymbol = settings.stopSymbol
    var newStr = nStr.split("\n").join("")

    if (newStr.indexOf(stopSymbol) == -1) {
        var rawEnd = newStr.indexOf(endSymbol)
        if (rawEnd == -1) rawEnd = newStr.length

        var lastNl = newStr.substring(0, rawEnd).lastIndexOf(nlSymb)
        if (lastNl != -1) var endPosIndex = rawEnd - lastNl - nlSymb.length - cursor.ch
        else var endPosIndex = rawEnd
    } else {
        var endPosIndex = 0
    }

    nlSymb = nlSymb.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") //no special symbols in nlSymb
    var rg = nlSymb + "\\n" + "|" + nlSymb
    const regex = new RegExp(rg)
    const regexF = new RegExp(rg, "g")
    var nlinesCount = (newStr.substring(0, rawEnd).match(regexF) || []).length

    endPosition.nlinesCount = nlinesCount
    endPosition.position = endPosIndex

    newStr = newStr.split(regex).join("\n")
    newStr = newStr.replace(endSymbol, "")
    return newStr
}
