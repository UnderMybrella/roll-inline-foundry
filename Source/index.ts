import Logger from "./Utils/Logger";
import {ConfiguredDocumentClass} from "@league-of-foundry-developers/foundry-vtt-types/src/types/helperTypes";


// eslint-disable-next-line @typescript-eslint/no-unused-vars
Hooks.on("renderJournalTextPageSheet", (app: Application, jq: JQuery, data: any) => ContextMenu.create(app, jq, ".inline-roll.inline-result", buildRollContextMenuItems()));

function rerollInlineResult(target: JQuery<HTMLElement>, mode: string): Promise<InstanceType<ConfiguredDocumentClass<typeof ChatMessage>> | undefined> {
	const innerText = target.text();
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