import { LexDefinitions, TracePosition, LexMatchItem, LexMatchContext } from "./types"

function lineIndexes(input: string) {
    const lines = [0]
    const lineReg = /\r?\n/g
    while (true) {
        const match = lineReg.exec(input)
        if (!match) break
        lines.push(match.index + match[0].length)
    }
    return function getTracePosition(position: number, length: number): TracePosition {
        let lineNumber = 0
        while (lineNumber < lines.length && lines[lineNumber] <= position) {
            lineNumber++
        }
        return {
            index: position,
            row: lineNumber,
            column: position - lines[lineNumber - 1] + 1,
            length
        }
    }
}

export function createLexer<T>(definitions: LexDefinitions<T>) {
    const regs = definitions.map(x =>
        new RegExp(x.regex, x.caseInsensitive ? 'iy' : 'y'))

    return function lexer(ctx: LexMatchContext<T>) {
        const len = ctx.input.length
        const getTracePosition = lineIndexes(ctx.input)
        ctx.nextIndex = 0
        ctx.queue = []

        while (ctx.nextIndex < len) {
            let matched = false
            for (let i = 0; i < regs.length; i++) {
                const reg = regs[i]
                reg.lastIndex = ctx.nextIndex
                const match = reg.exec(ctx.input)
                if (match) {
                    const def = definitions[i]
                    const content = match[0]
                    if (content.length <= 0) {
                        throw new Error(`The RegExp ${def.regex} is not matching anything`)
                    }
                    const position = getTracePosition(ctx.nextIndex, content.length)
                    const item: LexMatchItem = {
                        name: def.name,
                        content,
                        position,
                    }
                    ctx.nextIndex += content.length
                    ctx.queue.push(item)
                    def.action && def.action(ctx, def, item)
                    matched = true
                    break
                }
            }
            if (!matched) {
                const position = getTracePosition(ctx.nextIndex, 0)
                throw new Error(`No match RegExp at position ${position.row}:${position.column}(${position.index})`)
            }
        }
    }
}
