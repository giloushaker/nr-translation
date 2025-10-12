import { addObj, forEachPairRecursive, isObject } from "../shared/battlescribe/bs_helpers";
import { getDataObject } from "../shared/battlescribe/bs_main";
import { GameSystemFiles } from "../shared/battlescribe/local_game_system";


export type TranslationStringType =
    | "unit"        // Unit entry (isUnit() === true)
    | "option"      // Other entries (not units)
    | "profileName" // Name of a profile
    | "profile"     // Profile field/stat
    | "ruleName"    // Name of a rule
    | "rule"        // Rule content
    | "category"    // Category name
    | "faction"     // Faction name
    | "other";      // Other strings

export interface ITranslatable {
    source?: {
        catalogue?: string,
        nodes?: Array<{ name: string, type: string }>,
    },
    text: string,
    type?: TranslationStringType,
}

function detectStringType(key: string, obj: any, path?: string[]): TranslationStringType {
    if (!path || path.length === 0) return "other";

    // Get the immediate parent context (last item in path before current)
    const parentContext = path[path.length - 1];

    // Check if we're directly in a categoryEntry (not just somewhere in the path)
    if (parentContext === "categoryEntries" && key === "name") {
        console.log("📁 Found category:", obj.name || obj[key]);
        return "category";
    }

    // Check if it's in a force/faction context
    if (parentContext === "forceEntries" && key === "name") {
        console.log("🏴 Found faction:", obj.name || obj[key]);
        return "faction";
    }

    // Check if we're in a selection entry context (including sharedSelectionEntries)
    if ((parentContext === "selectionEntries" || parentContext === "entryLinks" || parentContext === "sharedSelectionEntries") && key === "name") {
        // Check if this entry has type "model" or "unit" - these are root units
        if (obj.type === "model" || obj.type === "unit") {
            console.log("🎯 Found unit (type=model/unit):", obj.name || obj[key], "type:", obj.type, "parent:", parentContext);
            return "unit";
        }

        // For entryLinks, check the target's type if available
        if (parentContext === "entryLinks" && obj.target) {
            const targetType = obj.target.type;
            if (targetType === "model" || targetType === "unit") {
                console.log("🎯 Found unit (link target type=model/unit):", obj.name || obj[key], "target type:", targetType);
                return "unit";
            }
        }

        // If not a unit type, count nesting level for selectionEntries
        const inSharedContext = path.some(p => p === "sharedSelectionEntries");
        if (inSharedContext) {
            console.log("🔗 Found option in shared context:", obj.name || obj[key], "type:", obj.type);
            return "option";
        }

        // Count how many times we see selectionEntries/entryLinks in the path
        // Units are at the root level (first occurrence), options are nested deeper
        const entryOccurrences = path.filter(p =>
            p === "selectionEntries" ||
            p === "entryLinks"
        ).length;

        // If this is the first/root level selectionEntry, it could be a unit or option
        if (entryOccurrences === 1) {
            console.log("⚙️ Found root level entry (not model/unit type):", obj.name || obj[key], "type:", obj.type, "parent:", parentContext);
            return "option"; // Root level but not type model/unit = option
        } else {
            // Nested entries are options
            console.log("⚙️ Found option (nested):", obj.name || obj[key], "nesting level:", entryOccurrences);
            return "option";
        }
    }

    // Check if it's in a profile context
    if (parentContext === "profiles" || path.some(p => p === "profiles")) {
        if (key === "name") return "profileName";
        if (key === "typeName") return "profileName";
        return "profile";
    }

    // Check if it's in a rule context
    if (parentContext === "rules" || path.some(p => p === "rules")) {
        if (key === "name") return "ruleName";
        if (key === "description") return "rule";
        return "rule";
    }

    return "other";
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

    const result = {} as Record<string, Set<ITranslatable>>
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

            const type = detectStringType(key, obj, path);
            result[data.name]!.add({
                text: value,
                type: type,
            })
        }, (value, key) => {
            if (blacklistedNodes.has(key)) return false;
            return true;
        })
        cur++;
        progressCallback(cur / files.length, data.name)
    }
    return result;
}