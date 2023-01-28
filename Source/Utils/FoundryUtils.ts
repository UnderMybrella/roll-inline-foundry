import {
	ClientDocumentMixin
} from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/client/data/abstract/client-document";

export interface EnrichmentOptions extends Record<string, any> {
	secrets: boolean,
	documents: boolean,
	links: boolean,
	rolls: boolean,
	rollData: Record<string, unknown> | (() => Record<string, unknown>),
	async: boolean,
	relativeTo: ClientDocumentMixin<any>
}

export interface TextEditorEnricherConfig {
	pattern: RegExp,
	enricher: (match: RegExpMatchArray, options: EnrichmentOptions) => Promise<HTMLElement | null>
}

export function registerEnrichers(...config: TextEditorEnricherConfig[]) {
	((CONFIG as any).TextEditor.enrichers as TextEditorEnricherConfig[])
		.push(...config);
}