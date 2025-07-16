import { addObj, forEachPairRecursive } from "../shared/battlescribe/bs_helpers";
import { getDataObject } from "../shared/battlescribe/bs_main";
import { GameSystemFiles } from "../shared/battlescribe/local_game_system";


export interface ITranslatable {
    source?: {
        catalogue?: string,
        nodes?: Array<{ name: string, type: string }>,
    },
    text: string,
}

export function extractTranslations(system: GameSystemFiles, progressCallback: (progress: number, message: string) => void) {
    const blacklistedKeys = new Set([
        "id",
        "type",
        "field",
        "scope",
        "affects",
        "comment",
        "info",

        "authorName",
        "authorContact",
        "authorUrl",
        "xmlns",

        "shortName",
        "publisher",
        "publicatonDate",
        "publisherUrl",

    ])
    const result = {} as Record<string, Set<string>>
    const files = system.getAllCatalogueFiles()
    let cur = 0;
    for (const file of files) {
        const data = getDataObject(file)
        progressCallback(cur / files.length, data.name)
        forEachPairRecursive(data, (value: string, key, obj) => {
            if (typeof value !== "string") return;
            if (blacklistedKeys.has(key)) return;
            if (key.includes('Id')) return;
            if (value.match(/^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/i)) return;
            if (value.match(/^[^a-zA-Z]+$/)) return;
            if (!(data.name in result)) result[data.name] = new Set()
            result[data.name].add(value)
        })
        cur++;
        progressCallback(cur / files.length, data.name)
    }
    return result;
}