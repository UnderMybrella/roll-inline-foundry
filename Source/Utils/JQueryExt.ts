declare global {
	interface JQuery {
		immediateText(): string;
	}
}

$.fn.immediateText = function() {
	return this.contents().not(this.children()).text();
};

export default {};