import Logger from "./Utils/Logger";


// eslint-disable-next-line @typescript-eslint/no-unused-vars
Hooks.on("renderJournalTextPageSheet", (_: Application, jq: JQuery, data: any) => {
	jq.find(".inline-roll.inline-result")
		.on("contextmenu", (ev) => {
			const innerText = ev.currentTarget.innerText;
			const rollStr = ev.currentTarget.dataset["roll"];
			if (rollStr) {
				const rollData = Roll.fromJSON(decodeURIComponent(rollStr));
				const flavour = innerText.replace(`: ${rollData.total}`, "");
				Logger.Ok(flavour);
				rollData.reroll({async: true})
					.then((newRoll) => newRoll.toMessage({flavor: flavour}, {rollMode: CONST.DICE_ROLL_MODES.PRIVATE}))
					.then();
			}
		});
});