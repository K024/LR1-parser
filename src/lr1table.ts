import { Expression, LR1Table, YaccDefinitions } from "./types"

export const StartSymbol = "--start--"
export const EndSymbol = "$"

function getFirst<T>(exps: Map<string, Expression<T>>, terms: Set<string>, start: string) {
    const first = new Map<string, Set<string>>()
    for (const term of terms) {
        first.set(term, new Set([term]))
    }
    for (const [name] of exps) {
        first.set(name, new Set())
    }
    function FirstN(infer: string[]) {
        const set = new Set<string>()
        let i = 0
        for (; i < infer.length; i++) {
            let hasE = false
            if (!first.has(infer[i])) throw new Error(`Unknown term/expression ${infer[i]}`)
            for (const f of first.get(infer[i])!) {
                if (f !== "") set.add(f)
                else hasE = true
            }
            if (!hasE) break
        }
        if (i === infer.length) set.add("")
        return set
    }
    while (true) {
        let added = false
        for (const [name, exp] of exps) {
            const firstOfExp = first.get(name)!!
            const before = firstOfExp.size
            for (const infer of exp.infers) {
                for (const term of FirstN(infer.expression)) {
                    firstOfExp.add(term)
                }
            }
            if (firstOfExp.size !== before) added = true
        }
        if (!added) break
    }
    first.set(EndSymbol, new Set([EndSymbol]))
    return FirstN
}

type LR1Item = {
    expression: string
    inferIndex: number
    step: number
    follow: string
}
type LR1Node = {
    name: string
    items: LR1Item[]
    map: { [next: string]: string }
}
function LR1Name(item: LR1Item) {
    return `Item[${item.expression}:${item.inferIndex}:${item.step}:${item.follow}]`
}
function ClosureName(closure: LR1Item[]) {
    return `Closure<${closure.map(LR1Name).sort().join(",")}>`
}

function getLR1ItemsMap<T>(exps: Map<string, Expression<T>>, terms: Set<string>, FirstN: (infer: string[]) => Set<string>, start: string) {
    function getClosure(items: LR1Item[]) {
        const set = new Set<string>()
        for (const item of items) set.add(LR1Name(item))
        const result = items.slice()
        for (let i = 0; i < result.length; i++)
            addNextItems(result[i])
        return result

        function addNextItems(item: LR1Item) {
            const exp = exps.get(item.expression)!
            const infer = exp.infers[item.inferIndex].expression
            if (item.step >= infer.length) return
            const next = infer[item.step]
            if (terms.has(next)) return
            const subexp = exps.get(next)!
            for (const follow of FirstN([...infer.slice(item.step + 1), item.follow])) {
                for (let i = 0; i < subexp.infers.length; i++) {
                    const subitem: LR1Item = {
                        expression: subexp.name,
                        inferIndex: i,
                        step: 0,
                        follow
                    }
                    const subitemname = LR1Name(subitem)
                    if (set.has(subitemname)) break
                    set.add(subitemname)
                    result.push(subitem)
                }
            }
        }
    }
    function gotoClosure(items: LR1Item[], step: string) {
        return getClosure(items
            .filter(i => {
                const infer = exps.get(i.expression)!.infers[i.inferIndex].expression
                return i.step < infer.length && infer[i.step] === step
            })
            .map(i => ({
                expression: i.expression,
                inferIndex: i.inferIndex,
                follow: i.follow,
                step: i.step + 1,
            })))
    }

    exps.set(StartSymbol, { name: StartSymbol, infers: [{ action() { }, expression: [start] }] })
    const nodeMap: { [name: string]: LR1Node } = {}
    const nodes: LR1Node[] = []
    {
        const items = [{ expression: StartSymbol, inferIndex: 0, step: 0, follow: EndSymbol }]
        const closure = getClosure(items)
        const name = ClosureName(closure)
        const node0: LR1Node = { name, items: closure, map: {} }
        nodeMap[name] = node0
        nodes.push(node0)
    }
    const tokens = new Set([...exps.keys(), ...terms.keys()])
    for (let i = 0; i < nodes.length; i++) {
        const from = nodes[i]
        for (const token of tokens) {
            const next = gotoClosure(from.items, token)
            if (next.length <= 0) continue
            const name = ClosureName(next)
            from.map[token] = name
            if (name in nodeMap) continue
            nodeMap[name] = { name, items: next, map: {} }
            nodes.push(nodeMap[name])
        }
    }
    return {
        nodes: nodeMap,
        start: nodes[0].name
    }
}

function getLR1Table<T>(exps: Map<string, Expression<T>>, itemsMap: { nodes: { [name: string]: LR1Node }, start: string }) {
    const nameMapping = new Map<string, string>()
    const table: LR1Table = {}
    let nameIndex = 0
    for (const name in itemsMap.nodes) {
        nameMapping.set(name, '' + nameIndex++)
    }
    for (const name in itemsMap.nodes) {
        const node = itemsMap.nodes[name]
        const row: LR1Table[string] = {}

        for (const step in node.map) {
            row[step] = { type: "shift", state: nameMapping.get(node.map[step])! }
        }

        for (const item of node.items) {
            const exp = exps.get(item.expression)!
            if (exp.infers[item.inferIndex].expression.length === item.step) {
                if (row[item.follow]) throw new Error(`LR(1) collision at ${exp.name} -> ${exp.infers[item.inferIndex].expression.join(" ")} *, ${item.follow}`)
                if (item.expression === StartSymbol) {
                    row[item.follow] = { type: "accept" }
                } else {
                    row[item.follow] = { type: "reduce", expression: item.expression, inferInex: item.inferIndex }
                }
            }
        }

        table[nameMapping.get(name)!] = row
    }
    return { table, start: nameMapping.get(itemsMap.start)! }
}

export function createLR1Table<T>(definitions: YaccDefinitions<T>) {
    const exps = new Map(definitions.map(
        x => [x.name, x]))
    if (exps.size !== definitions.length) {
        throw new Error(`Can not have expressions with same name`)
    }
    const start = definitions[0].name

    const terms = new Set(definitions.flatMap(
        def => def.infers.flatMap(infer =>
            infer.expression.filter(t => !exps.has(t)))))

    const FirstN = getFirst(exps, terms, start)
    const itemsMap = getLR1ItemsMap(exps, terms, FirstN, start)
    const table = getLR1Table(exps, itemsMap)
    return table
}