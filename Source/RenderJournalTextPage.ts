import Globals, {fromGame, ifDebugging} from "./Globals";
import Logger from "./Utils/Logger";
import {ConfiguredDocumentClass} from "@league-of-foundry-developers/foundry-vtt-types/src/types/helperTypes";

import "./Utils/JQueryExt"
import ClickEvent = JQuery.ClickEvent;

type RollCheckMode = (check: Roll, dc: Roll) => boolean;
type DataCheckMode = (check: any, against: any) => boolean;

const ROLL_CHECK_MODES = {
	LESS_THAN: (check: Roll, dc: Roll): boolean => (check.total ?? 0) < (dc.total ?? 0),
	LESS_THAN_EQUAL_TO: (check: Roll, dc: Roll): boolean => (check.total ?? 0) <= (dc.total ?? 0),
	EQUAL_TO: (check: Roll, dc: Roll): boolean => (check.total ?? 0) == (dc.total ?? 0),
	NOT_EQUAL_TO: (check: Roll, dc: Roll): boolean => (check.total ?? 0) != (dc.total ?? 0),
	GREATER_THAN: (check: Roll, dc: Roll): boolean => (check.total ?? 0) > (dc.total ?? 0),
	GREATER_THAN_EQUAL_TO: (check: Roll, dc: Roll): boolean => (check.total ?? 0) >= (dc.total ?? 0),
}

const DATA_CHECK_MODES = {
	LESS_THAN: (check: any, against: any): boolean => check < against,
	LESS_THAN_EQUAL_TO: (check: any, against: any): boolean => check <= against,
	EQUAL_TO: (check: any, against: any): boolean => check == against,
	NOT_EQUAL_TO: (check: any, against: any): boolean => check != against,
	GREATER_THAN: (check: any, against: any): boolean => check > against,
	GREATER_THAN_EQUAL_TO: (check: any, against: any): boolean => check >= against,
}

function coerceInputToData<T>(data: T, input: string): T {
	Logger.Trace(`${typeof data}: {${input}}`);
	switch (typeof data) {
		case "boolean":
			switch (input.toLowerCase()) {
				case "true":
				case "1":
				case "on":
				case "yes":
				case "set":
					return true as T;
				default:
					return false as T;
			}
		case "number":
			if (input.indexOf('.') == -1)
				return parseInt(input) as T;
			else
				return parseFloat(input) as T;
		case "string":
			return input as T;
			
		default:
			return JSON.parse(input) as T;
	}
}

export function SetupRenderJournalTextPage() {
	Logger.Ok("Initialising RenderJournalTextPageSheet hook...");

// eslint-disable-next-line @typescript-eslint/no-unused-vars
	Hooks.on("renderJournalTextPageSheet", (app: Application, jq: JQuery, data: any) => {
		try {
			linkHiddenNodes(jq);

			const speaker = ChatMessage.getSpeaker()?.actor;
			let actor = {};
			if (speaker) {
				actor = fromGame((g) => g.actors?.get(speaker)) ?? {};
			}

			hideHiddenConditions(jq, actor);
		} catch (e) {
			console.log("An error occurred within render: ", e);
		}

		jq.on("click", `a.${Globals.DomConstants.classes.anchorSetFlag}`, (event) => onClickSetFlag(event, app))

		ContextMenu.create(app, jq, ".inline-roll.inline-result", buildRollContextMenuItems());
	});
}

function linkHiddenNodes(jq: JQuery) {
	const openSelector = `p:has(a[href='${Globals.DomConstants.href.openHiddenCondition}'])`;
	const closeSelector = `p:has(a[href='${Globals.DomConstants.href.close}'])`;

	jq.find(openSelector)
		.each((index, element) => {
			const last = jq.find(element)
				.siblings(closeSelector)
				.last();

			if (last.length == 0) return;

			const div = document.createElement("div");
			div.classList.add(Globals.DomConstants.classes.divHiddenNode);

			const child = element.firstElementChild;
			if (child && child instanceof HTMLElement) {
				for (const dataKey in child.dataset) {
					div.dataset[dataKey] = child.dataset[dataKey];
				}

				div.dataset[Globals.DomConstants.data.hiddenNodeType] = child.getAttribute("href") ?? "unknown";
			}

			jq.find(element)
				.nextUntil(last)
				.appendTo(div);

			element.parentElement?.appendChild(div);

			element.remove();
			last.remove();
		});
}

function hideHiddenConditions(jq: JQuery, actor: any) {
	const rollData = actor.getRollData() as Record<string, unknown>;
	const flags = actor.flags as Record<string, unknown>;
	jq.find(`div[data-type='${Globals.DomConstants.href.openHiddenCondition}'].${Globals.DomConstants.classes.divHiddenNode}`)
		.each((index, element) => {
			Logger.Trace(`#${index} - ${element}`);

			const propertyName = decodeURIComponent(element.dataset[Globals.DomConstants.data.hiddenConditionCheck] ?? "1");
			const compareData = element.dataset[Globals.DomConstants.data.hiddenConditionCompare] ?? ">=";
			const dcData = decodeURIComponent(element.dataset[Globals.DomConstants.data.hiddenConditionDC] ?? "1");
			const dataType = element.dataset[Globals.DomConstants.data.hiddenConditionCheckType]?.toLowerCase() ?? "roll";

			Logger.Trace(dataType);

			if (dataType == "roll") {
				let compare: RollCheckMode;

				switch (compareData) {
					case "<":
					case "!>=":
						compare = ROLL_CHECK_MODES.LESS_THAN;
						break;
					case "<=":
					case "!>":
						compare = ROLL_CHECK_MODES.LESS_THAN_EQUAL_TO;
						break;
					case "=":
					case "==":
						compare = ROLL_CHECK_MODES.EQUAL_TO;
						break;
					case "!=":
					case "!==":
						compare = ROLL_CHECK_MODES.NOT_EQUAL_TO;
						break;
					case ">":
					case "!<=":
						compare = ROLL_CHECK_MODES.GREATER_THAN;
						break;
					case ">=":
					case "!<":
						compare = ROLL_CHECK_MODES.GREATER_THAN_EQUAL_TO;
						break;
					default:
						compare = ROLL_CHECK_MODES.GREATER_THAN;
						break;
				}

				const check = Roll.create(propertyName, rollData);
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
							ifDebugging(() => {
								element.style.border = "2px green";
								element.style.borderStyle = "dashed";
							});

							Logger.Trace(`${checkEval.total} <${compareData}> ${dcEval.total} == false`)
						}
					})
				).then();
			} else if (dataType == "data" || dataType == "flag") {
				let compare: DataCheckMode;

				switch (compareData) {
					case "<":
					case "!>=":
						compare = DATA_CHECK_MODES.LESS_THAN;
						break;
					case "<=":
					case "!>":
						compare = DATA_CHECK_MODES.LESS_THAN_EQUAL_TO;
						break;
					case "=":
					case "==":
						compare = DATA_CHECK_MODES.EQUAL_TO;
						break;
					case "!=":
					case "!==":
						compare = DATA_CHECK_MODES.NOT_EQUAL_TO;
						break;
					case ">":
					case "!<=":
						compare = DATA_CHECK_MODES.GREATER_THAN;
						break;
					case ">=":
					case "!<":
						compare = DATA_CHECK_MODES.GREATER_THAN_EQUAL_TO;
						break;
					default:
						compare = DATA_CHECK_MODES.GREATER_THAN;
						break;
				}

				const property = dataType == "data"
					? foundry.utils.getProperty(rollData, propertyName)
					: foundry.utils.getProperty(flags, `${Globals.ModuleName}.${propertyName}`);

				const coerced = coerceInputToData(property, dcData);
				if (compare(property, coerced)) {
					Logger.Trace(`${propertyName}#${property} ${compareData} ${coerced} is true`)
					//Rather than hide it, we remove the element as to prevent weird html stuff / inspect element hacks

					ifDebugging(() => {
						element.style.border = "2px red";
						element.style.borderStyle = "dashed";
					}, () => element.remove());
				} else {
					ifDebugging(() => {
						element.style.border = "2px green";
						element.style.borderStyle = "dashed";
					});

					Logger.Trace(`${propertyName}#${property} (${typeof property}) ${compareData} ${coerced} (${typeof coerced}) is false`)
				}
			}
		});
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

async function onClickSetFlag(event: ClickEvent, app: Application) {
	event.preventDefault();
	const anchor = event.currentTarget as HTMLAnchorElement;

	//a.dataset[Globals.DomConstants.data.anchorSetFlag] = flag;
	// 	a.dataset[Globals.DomConstants.data.anchorSetFlagValue] = `${flagState}`

	const flagName = anchor.dataset[Globals.DomConstants.data.anchorSetFlag];
	const flagValue = anchor.dataset[Globals.DomConstants.data.anchorSetFlagValue];

	Logger.Trace(`Setting ${flagName} to ${flagValue}`)

	if (flagName) {
		const speaker = ChatMessage.getSpeaker()?.actor;
		let actor: any = {};
		if (speaker) {
			actor = fromGame((g) => g.actors?.get(speaker)) ?? {};
		}

		if (actor instanceof Actor) {
			const existing = actor.getFlag(Globals.ModuleName, flagName);
			const updatedValue = flagValue == "toggle" ? !existing : flagValue == "true";
			if (updatedValue != existing) {
				await actor.setFlag(Globals.ModuleName, flagName, updatedValue);
				//This... feels wrong
				(app as any)?.object?.parent?._sheet?.render();
			}
		}
	}
}