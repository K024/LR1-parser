import { promises as fs } from "fs"
import { LexDefinitions, createLexer, YaccDefinitions, createLR1Table, createYacc, LexMatchContext, YaccMatchContext } from "../index"

const lexDefs: LexDefinitions = [
    { name: "seperator", regex: /[ \t\r\n]+/, action(ctx) { ctx.queue.pop() } },
    { name: "leftb", regex: /\(/ },
    { name: "rightb", regex: /\)/ },
    { name: "and", regex: /\&/ },
    { name: "or", regex: /\|/ },
    { name: "not", regex: /\-/ },
    { name: "id", regex: /\w+/ },
]
console.time("createLexer")
const lexer = createLexer(lexDefs)
console.timeLog("createLexer")

const yaccDefs: YaccDefinitions = [
    {
        name: "E",
        infers: [
            { expression: ["E", "and", "F"] },
            { expression: ["E", "or", "F"] },
            { expression: ["F"] },
        ]
    },
    {
        name: "F",
        infers: [
            { expression: ["leftb", "E", "rightb"] },
            { expression: ["not", "F"] },
            { expression: ["id"] },
        ]
    }
]
console.time("createLR1Table")
const table = createLR1Table(yaccDefs)
console.timeLog("createLR1Table")

fs.writeFile("./table.json", JSON.stringify(table))

console.time("createYacc")
const yacc = createYacc(yaccDefs, table.table, table.start)
console.timeLog("createYacc")

const lexCtx: LexMatchContext = {
    input: `1 (2 | - 200)`,
    nextIndex: 0,
    queue: [],
    userContext: undefined
}
console.time("lexer")
lexer(lexCtx)
console.timeLog("lexer")

const yaccCtx: YaccMatchContext = {
    input: lexCtx.queue,
    currentState: "",
    moveStack: [],
    inputStack: [],
    nextIndex: 0,
    userContext: undefined,
    onBadInput(ctx) {
        if (ctx.nextIndex < ctx.input.length) {
            const { row, column, index } = ctx.input[ctx.nextIndex].position
            ctx.input.splice(ctx.nextIndex, 0, {
                name: "and", content: "<hidden>",
                position: { index, row, column, length: 0 }
            })
            return true
        }
    }
}
console.time("yacc")
yacc(yaccCtx)
console.timeLog("yacc")

fs.writeFile("./output.json", JSON.stringify(yaccCtx.inputStack[0]))
