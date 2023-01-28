import Globals from "./Globals";
import {DevModeApi} from "./Utils/DevModeTypes";
import {SetupRenderJournalTextPage} from "./RenderJournalTextPage";
import {EnrichmentOptions, registerEnrichers} from "./Utils/FoundryUtils";

function setup() {
	Hooks.once('devModeReady', (api: DevModeApi) => {
		api.registerPackageDebugFlag(Globals.ModuleName, "boolean").then();
	});

	Hooks.once("init", () => {
		registerEnrichers({
				pattern: /\{%\s*hide (if|when|unless) (flag|data|roll) \{(.*?)} (!?(?:<|<=|={1,2}|>=|>)) \{(.*?)}\s*%}/gi,
				enricher: formatHiddenCondition
			},
			{
				pattern: /\{%\s*end hide\s*%}/gi,
				enricher: formatHiddenClose
			},
			{
				pattern: /\{%\s*set flag \{(?<flag_name>.*?)\} (?<flag_state>enabled|disabled)(?<flag_config>( with (text|icon|icon style) \{(.+?)})*)\s*%}/gi,
				enricher: formatFlagButton
			});
	});

	SetupRenderJournalTextPage();
}

setup();

async function formatHiddenCondition(match: RegExpMatchArray, options: EnrichmentOptions): Promise<HTMLElement | null> {
	const anchor = document.createElement("a");
	anchor.href = Globals.DomConstants.href.openHiddenCondition;

	const checkMode = match[1];
	let compare = match[4];

	switch (checkMode) {
		case "if":
		case "when":
			break;

		case "unless":
			compare = `!${compare}`
			break;
	}

	anchor.dataset[Globals.DomConstants.data.hiddenConditionCheck] = encodeURIComponent(match[3]);
	anchor.dataset[Globals.DomConstants.data.hiddenConditionCheckType] = match[2];
	anchor.dataset[Globals.DomConstants.data.hiddenConditionCompare] = compare;
	anchor.dataset[Globals.DomConstants.data.hiddenConditionDC] = encodeURIComponent(match[5]);
	return anchor;
}

async function formatHiddenClose(match: RegExpMatchArray, options: EnrichmentOptions): Promise<HTMLElement | null> {
	const anchor = document.createElement("a");
	anchor.href = Globals.DomConstants.href.close;
	return anchor;
}

const FLAG_CONFIG_VALUE = /with (text|icon|icon style) \{(.+?)}/gi
async function formatFlagButton(match: RegExpMatchArray, options: EnrichmentOptions): Promise<HTMLElement | null> {
	const a = document.createElement("a");
	const flag = match.groups?.flag_name ?? "";
	const flagState = match.groups?.flag_state == "enabled";
	const flagConfig: Record<string, any> = {};

	for (const flagMatch of match.groups?.flag_config?.matchAll(FLAG_CONFIG_VALUE) ?? []) {
		flagConfig[flagMatch[1].replace(' ', '_')] = flagMatch[2];
	}
	
	const text = flagConfig.text ?? `Set ${flag}`;
	const icon = flagConfig.icon;

	a.dataset[Globals.DomConstants.data.anchorSetFlag] = flag;
	a.dataset[Globals.DomConstants.data.anchorSetFlagValue] = `${flagState}`;
	a.classList.add(Globals.DomConstants.classes.anchorSetFlag);

	if (icon) {
		const inner = document.createElement("i");

		inner.classList.add(`fa-${icon}`);

		switch (flagConfig.icon_style) {
			case "regular":
				inner.classList.add("far");
				break;
			case "light":
				inner.classList.add("fal");
				break;
			case "thin":
				break;
			case "duotone":
				inner.classList.add("fad");
				break;
			case "brands":
				inner.classList.add("fab");
				break;


			case "solid":
			default:
				inner.classList.add("fas");
				break;
		}


		a.appendChild(inner);
	}

	const textNode = document.createTextNode(text);
	a.appendChild(textNode);

	return a;
}