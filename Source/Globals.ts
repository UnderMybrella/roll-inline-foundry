import assert from "assert"
import Color from "color";
import Globals from "./Globals";
import Logger from "./Utils/Logger";

export default {
	ModuleName: "roll-inline",
	IsModule: true, // If you are developing a system rather than a module, change this to false
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

declare global {
	interface JQuery {
		immediateText(): string;
	}
}

$.fn.immediateText = function() {
	return this.contents().not(this.children()).text();
};