import { addObj, forEachPairRecursive, isObject } from "../shared/battlescribe/bs_helpers";
import { getDataObject } from "../shared/battlescribe/bs_main";
import { GameSystemFiles } from "../shared/battlescribe/local_game_system";


export interface ITranslatable {
    source?: {
        catalogue?: string,
        nodes?: Array<{ name: string, type: string }>,
    },
    text: string,
}

export function extractStrings(system: GameSystemFiles, progressCallback: (progress: number, message: string) => void) {
    const blacklistedKeys = new Set([
        "id",
        "type",
        "field",
        "scope",
        "affects",
        "comment",
        "info",
        "typeName",

        "authorName",
        "authorContact",
        "authorUrl",
        "xmlns",

        "shortName",
        "publisher",
        "publicatonDate",
        "publisherUrl",

    ])
    const blacklistedNodes = new Set([
        "costs",
        "publications"
    ])
    const REGEX_BSID = /^[0-9a-f]{3,4}-[0-9a-f]{3,4}-[0-9a-f]{3,4}-[0-9a-f]{3,4}$/i
    const REGEX_NO_LETTERS = /^[^a-zA-Z]+$/
    const REGEX_DICE_NOTATION = /^(\d*)D(3|6)(\+\d+)?$/

    const result = {} as Record<string, Set<string>>
    const files = system.getAllCatalogueFiles()
    let cur = 0;
    for (const file of files) {
        const data = getDataObject(file)
        progressCallback(cur / files.length, data.name)
        forEachPairRecursive(data, (value: string, key, obj, path) => {
            if (typeof value !== "string") return;
            if (blacklistedKeys.has(key)) return;
            if (key.includes('Id')) return;
            if (value.match(REGEX_BSID)) return;
            if (value.match(REGEX_NO_LETTERS)) return;
            if (value.match(REGEX_DICE_NOTATION)) return;
            if ("targetId" in obj) return;
            if (key === "name" && path?.at(-1) === "characteristics") return;
            if (!(data.name in result)) result[data.name] = new Set()
            result[data.name]!.add(value)
        }, (value, key) => {
            if (blacklistedNodes.has(key)) return false;
            return true;
        })
        cur++;
        progressCallback(cur / files.length, data.name)
    }
    return result;
}