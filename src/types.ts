
export type TracePosition = {
    index: number
    row: number
    column: number
    length: number
}

export type LexMatchContext<T = any> = {
    input: string
    nextIndex: number
    queue: LexMatchItem[]
    userContext: T
}

export type LexItem<T = any> = {
    name: string
    regex: string | RegExp
    caseInsensitive?: boolean
    action?(ctx: LexMatchContext<T>, item: LexItem<T>, match: LexMatchItem): void
}

export type LexDefinitions<T = any> = LexItem<T>[]

export type LexMatchItem = {
    name: string
    content: string
    position: TracePosition
}

export type LexMatchResult = LexMatchItem[]

/* ---------------------------------------- */

export type YaccTreeNode = {
    type: "expression"
    expression: string
    inferIndex: number
    children: YaccTreeNode[]
} | {
    type: "term"
    lexItem: LexMatchItem
}

export type YaccMatchContext<T = any> = {
    input: LexMatchItem[]
    currentState: string
    moveStack: string[]
    inputStack: YaccTreeNode[]
    nextIndex: number
    userContext: T
    onShift?: (ctx: YaccMatchContext<T>) => void
    onBadInput?: (ctx: YaccMatchContext<T>) => void | boolean // true to handle
}

export type Expression<T = any> = {
    name: string
    infers: {
        expression: string[]
        action?(ctx: YaccMatchContext<T>, exp: Expression<T>, node: YaccTreeNode): void
    }[]
}

export type YaccDefinitions<T = any> = Expression<T>[]

/* ---------------------------------------- */

export type LR1Action =
    | { type: "shift"; state: string }
    | { type: "reduce"; expression: string; inferInex: number }
    | { type: "accept" }

export type LR1Table = { [state: string]: { [token: string]: LR1Action | undefined } }
