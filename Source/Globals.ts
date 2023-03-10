import assert from "assert"
import Globals from "./Globals";
import {DevModeApi} from "./Utils/DevModeTypes";

export default {
	ModuleName: "roll-inline",
	IsModule: true, // If you are developing a system rather than a module, change this to false

	DomConstants: {
		href: {
			openHiddenCondition: "#open-condition",

			close: "#close-hidden"
		},
		classes: {
			divHiddenNode: "hidden-condition",
			anchorSetFlag: "set-flag"
		},
		data: {
			hiddenConditionCheck: "check",
			hiddenConditionCheckType: "check_type",
			hiddenConditionCompare: "compare",
			hiddenConditionDC: "dc",

			hiddenNodeType: "type",

			anchorSetFlag: "flag",
			anchorSetFlagValue: "flag_value"
		}
	}
}

// Pop some fairly universal types that we might use

export type Pair<T> = [string, T];
export const Assert = (value: unknown): void => assert(value);

export function fromGame<T>(func: (game: Game) => T): T | undefined {
	const ourGame = game;

	// noinspection SuspiciousTypeOfGuard
	return ourGame instanceof Game ? func(ourGame) : undefined;
}

export function moduleApi<T, R>(packageName: string, func: (api: T) => R): R | undefined {
	const module = fromGame((g) => g.modules.get(packageName));
	if (!module) return undefined;

	return func((module as any).api as T);
}

export function ifDebugging<T>(func: () => T, ifNot?: () => T | undefined): T | undefined {
	try {
		const isDebugging = moduleApi("_dev-mode", (devMode: DevModeApi) => devMode.getPackageDebugValue(Globals.ModuleName, "boolean"));

		if (isDebugging) {
			return func();
		} else if (ifNot) {
			return ifNot();
		} else {
			return undefined;
		}
	} catch (e) {
		console.error(e);
		return undefined;
	}
}