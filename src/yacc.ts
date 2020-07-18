import { EndSymbol } from "./lr1table"
import { YaccDefinitions, LR1Table, YaccMatchContext, YaccTreeNode } from "./types"

export function createYacc<T>(definitions: YaccDefinitions<T>, table: LR1Table, start: string) {
    const exps = new Map(definitions.map(
        x => [x.name, x]))
    return function yacc(ctx: YaccMatchContext) {
        ctx.moveStack = [start]
        ctx.inputStack = []
        ctx.nextIndex = 0
        while (ctx.nextIndex <= ctx.input.length) {
            ctx.currentState = ctx.moveStack[ctx.moveStack.length - 1]
            const input = ctx.input[ctx.nextIndex]
            const inputName = input?.name ?? EndSymbol
            const action = table[ctx.currentState] && table[ctx.currentState][inputName]
            if (!action) {
                if (ctx.onBadInput && ctx.onBadInput(ctx) === true) {
                    continue
                }
                throw new Error(`Bad input at index ${ctx.nextIndex}: ${inputName}`)
            }
            if (action.type === "accept") {
                break
            } else if (action.type === "shift") {
                ctx.nextIndex++
                ctx.moveStack.push(action.state)
                ctx.inputStack.push({
                    type: "term",
                    lexItem: input
                })
            } else if (action.type === "reduce") {
                const exp = exps.get(action.expression)!
                const infer = exp.infers[action.inferInex]
                const len = infer.expression.length
                if (ctx.moveStack.length < len || ctx.inputStack.length < len)
                    throw new Error(`Unable to reduce expression ${exp.name} --> ${infer.expression.join(" ")}`)
                ctx.moveStack.splice(ctx.moveStack.length - len, len)
                const children = ctx.inputStack.splice(ctx.inputStack.length - len, len)
                const node: YaccTreeNode = {
                    type: "expression",
                    expression: action.expression,
                    inferIndex: action.inferInex,
                    children
                }
                const current2 = ctx.moveStack[ctx.moveStack.length - 1]
                const next = table[current2][action.expression]
                if (!next || next.type !== "shift") throw new Error("Should not happen: no move after reduce")
                ctx.inputStack.push(node)
                ctx.moveStack.push(next.state)

                infer.action && infer.action(ctx, exp, node)
            } else {
                throw new Error(`Bad action type ${(action as any).type}`)
            }
        }
        if (ctx.inputStack.length !== 1) throw new Error("Ended before all reduced")
        if (ctx.nextIndex < ctx.input.length) throw new Error("Ended before read all input")
        if (ctx.nextIndex > ctx.input.length) {
            if (ctx.onBadInput && ctx.onBadInput(ctx) === true) {
            } else {
                throw new Error("Unexpected end")
            }
        }
    }
}
