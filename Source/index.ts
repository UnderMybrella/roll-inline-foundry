import Logger from "./Utils/Logger";
import {ConfiguredDocumentClass} from "@league-of-foundry-developers/foundry-vtt-types/src/types/helperTypes";
import {
	ClientDocumentMixin
} from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/client/data/abstract/client-document";
import Globals, {fromGame, ifDebugging} from "./Globals";
import {DevModeApi} from "./Utils/DevModeTypes";

interface EnrichmentOptions extends Record<string, any> {
	secrets: boolean,
	documents: boolean,
	links: boolean,
	rolls: boolean,
	rollData: Record<string, unknown> | (() => Record<string, unknown>),
	async: boolean,
	relativeTo: ClientDocumentMixin<any>
}

interface TextEditorEnricherConfig {
	pattern: RegExp,
	enricher: (match: RegExpMatchArray, options: EnrichmentOptions) => Promise<HTMLElement | null>
}

type CheckMode = (check: Roll, dc: Roll) => boolean;

const CHECK_MODES = {
	LESS_THAN: (check: Roll, dc: Roll) => (check.total ?? 0) < (dc.total ?? 0),
	LESS_THAN_EQUAL_TO: (check: Roll, dc: Roll) => (check.total ?? 0) <= (dc.total ?? 0),
	EQUAL_TO: (check: Roll, dc: Roll) => (check.total ?? 0) == (dc.total ?? 0),
	NOT_EQUAL_TO: (check: Roll, dc: Roll) => (check.total ?? 0) != (dc.total ?? 0),
	GREATER_THAN: (check: Roll, dc: Roll) => (check.total ?? 0) > (dc.total ?? 0),
	GREATER_THAN_EQUAL_TO: (check: Roll, dc: Roll) => (check.total ?? 0) >= (dc.total ?? 0),
}

function registerEnrichers(...config: TextEditorEnricherConfig[]) {
	((CONFIG as any).TextEditor.enrichers as TextEditorEnricherConfig[])
		.push(...config);
}

Hooks.once('devModeReady', (api: DevModeApi) => {
	api.registerPackageDebugFlag(Globals.ModuleName, "boolean").then();
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
Hooks.on("renderJournalTextPageSheet", (app: Application, jq: JQuery, data: any) => {
	jq.find("p:has(a[href='#open'])")
		.each((index, element) => {
			const last = jq.find(element)
				.siblings("p:has(a[href='#close'])")
				.last();

			if (last.length == 0) return;

			const div = document.createElement("div");
			div.className = "hidden-condition";

			const child = element.firstElementChild;
			if (child && child instanceof HTMLElement) {
				for (const dataKey in child.dataset) {
					div.dataset[dataKey] = child.dataset[dataKey];
				}
			}

			jq.find(element)
				.nextUntil(last)
				.appendTo(div);

			element.parentElement?.appendChild(div);

			element.remove();
			last.remove();
		});


	const speaker = ChatMessage.getSpeaker()?.actor;
	let rollData = {};
	if (speaker) {
		rollData = fromGame((g) => g.actors?.get(speaker)) ?? {};
	}

	jq.find("div[class='hidden-condition']")
		.each((index, element) => {
			const checkData = element.dataset["check"] ?? "1";
			const compareData = element.dataset["compare"] ?? ">=";
			let compare: CheckMode;

			switch (compareData) {
				case "<":
				case "!>=":
					compare = CHECK_MODES.LESS_THAN;
					break;
				case "<=":
				case "!>":
					compare = CHECK_MODES.LESS_THAN_EQUAL_TO;
					break;
				case "=":
				case "==":
					compare = CHECK_MODES.EQUAL_TO;
					break;
				case "!=":
				case "!==":
					compare = CHECK_MODES.NOT_EQUAL_TO;
					break;
				case ">":
				case "!<=":
					compare = CHECK_MODES.GREATER_THAN;
					break;
				case ">=":
				case "!<":
					compare = CHECK_MODES.GREATER_THAN_EQUAL_TO;
					break;
				default:
					compare = CHECK_MODES.GREATER_THAN;
					break;
			}

			const dcData = element.dataset["dc"] ?? "1";

			const check = Roll.create(checkData, rollData);
			const dc = Roll.create(dcData, rollData);

			check.evaluate({async: true}).then(checkEval =>
				dc.evaluate({async: true}).then(dcEval => {
					if (compare(checkEval, dcEval)) {
						Logger.Trace(`${checkEval.total} <${compareData}> ${dcEval.total} == true`)
						//Rather than hide it, we remove the element as to prevent weird html stuff / inspect element hacks

						ifDebugging(() => {
							element.style.border = "2px red";
							element.style.borderStyle = "dashed";
						}, () => element.remove());
					} else {
						Logger.Trace(`${checkEval.total} <${compareData}> ${dcEval.total} == false`)
					}
				})
			).then();
		});

	ContextMenu.create(app, jq, ".inline-roll.inline-result", buildRollContextMenuItems());
});

Hooks.once("init", () => {
	registerEnrichers({
		pattern: /\{%\s*hide (if|when|unless) \{(.*?)} (!?(?:<|<=|={1,2}|>=|>)) \{(.*?)}\s*%}/gi,
		enricher: formatHiddenCondition
	}, {
		pattern: /\{% end hide %}/gi,
		enricher: formatHiddenClose
	});
})

async function formatHiddenCondition(match: RegExpMatchArray, options: EnrichmentOptions): Promise<HTMLElement | null> {
	const anchor = document.createElement("a");
	anchor.href = "#open";
	const checkMode = match[1];
	let compare = match[3];

	switch (checkMode) {
		case "if":
		case "when":
			break;

		case "unless":
			compare = `!${compare}`
			break;
	}

	anchor.dataset["check"] = encodeURIComponent(match[2]);
	anchor.dataset["compare"] = compare;
	anchor.dataset["dc"] = encodeURIComponent(match[4]);
	return anchor;
}

async function formatHiddenClose(match: RegExpMatchArray, options: EnrichmentOptions): Promise<HTMLElement | null> {
	const anchor = document.createElement("a");
	anchor.href = "#close";
	return anchor;
}

function rerollInlineResult(target: JQuery<HTMLElement>, mode: string): Promise<InstanceType<ConfiguredDocumentClass<typeof ChatMessage>> | undefined> {
	const innerText = target.immediateText();
	const rollStr = target.data("roll");
	if (rollStr) {
		const rollData = Roll.fromJSON(decodeURIComponent(rollStr));
		const flavour = innerText.replace(`${rollData.total}`, "").replace(": ", "");
		Logger.Ok(flavour);
		return rollData.reroll({async: true})
			.then((newRoll) => newRoll.toMessage({flavor: flavour}, {rollMode: mode as keyof CONFIG.Dice.RollModes}))
			.then();
	}

	return Promise.resolve(undefined);
}

const DICE_ROLL_MODES = {
	/**
	 * This roll is visible to all players.
	 */
	PUBLIC: "publicroll",

	/**
	 * Rolls of this type are only visible to the player that rolled and any Game Master users.
	 */
	PRIVATE: "gmroll",

	/**
	 * A private dice roll only visible to Game Master users. The rolling player will not see the result of their own roll.
	 */
	BLIND: "blindroll",

	/**
	 * A private dice roll which is only visible to the user who rolled it.
	 */
	SELF: "selfroll"
};

function buildRollContextMenuItems(): ContextMenuEntry[] {
	const list: ContextMenuEntry[] = [];
	const ourGame = game;
	for (const [k, v] of Object.entries(DICE_ROLL_MODES)) {
		// noinspection SuspiciousTypeOfGuard
		const name = ourGame instanceof Game ? ourGame.i18n.localize(`CHAT.Roll${k.titleCase()}`) : k;
		list.push({
			name: `Roll as ${name}`,
			icon: '',
			callback: target => rerollInlineResult(target, v)
		});
	}
	return list;
}