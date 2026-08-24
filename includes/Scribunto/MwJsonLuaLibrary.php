<?php

namespace MediaWiki\Extension\MwJson\Scribunto;

use MediaWiki\Extension\MwJson\Mw\PipelineFactory;
use MediaWiki\Extension\MwJson\OOLD\Slots;
use MediaWiki\Extension\Scribunto\Engines\LuaCommon\LibraryBase;
use MediaWiki\MediaWikiServices;

/**
 * Exposes the PHP pipeline to Lua as `mw.ext.mwjson`.
 *
 * This is what makes the migration reversible without touching page content.
 * Module:Entity becomes a two-line shim that asks whether the PHP renderer is
 * enabled and, if not, falls through to the untouched Module:MwJson. Flipping
 * $wgMwJsonRenderer switches every page at once, in either direction, with no
 * edits and no cache purge beyond the usual.
 *
 * The boundary is deliberately narrow: strings in, wikitext out. Marshalling
 * deep tables across the Lua/PHP bridge is expensive, and none of it is needed
 * here, so the shim never sees the schema or the mapping.
 */
class MwJsonLuaLibrary extends LibraryBase {

	/** @inheritDoc */
	public function register(): array {
		return $this->getEngine()->registerInterface(
			__DIR__ . '/mw.mwjson.lua',
			[
				'enabled' => [ $this, 'isEnabled' ],
				'render' => [ $this, 'render' ],
			],
			[]
		);
	}

	/**
	 * Whether the PHP pipeline should handle this render.
	 *
	 * @return array{0:bool}
	 */
	public function isEnabled(): array {
		$renderer = MediaWikiServices::getInstance()->getMainConfig()->get( 'MwJsonRenderer' );
		return [ $renderer === 'php' ];
	}

	/**
	 * Render one slot of the current page.
	 *
	 * @param string $mode "header" or "footer".
	 * @param string|null $pageTitle Defaults to the page being parsed.
	 * @param string|null $jsondataJson Inline data, when the caller has some.
	 * @param string|null $jsonschemaJson Inline schema, likewise.
	 * @param string|null $template Inline template for the page itself.
	 * @return array{0:string} Wikitext, for Lua to return unchanged.
	 */
	public function render(
		string $mode = Slots::MODE_HEADER,
		?string $pageTitle = null,
		?string $jsondataJson = null,
		?string $jsonschemaJson = null,
		?string $template = null
	): array {
		$parser = $this->getParser();
		$title = $pageTitle !== null && $pageTitle !== ''
			? MediaWikiServices::getInstance()->getTitleFactory()->newFromText( $pageTitle )
			: $parser->getTitle();

		if ( $title === null ) {
			return [ '' ];
		}

		return [ ( new PipelineFactory() )->renderSlot(
			$parser,
			$parser->getPreprocessor()->newFrame(),
			$mode,
			$title,
			$this->decode( $jsondataJson ),
			$this->decode( $jsonschemaJson ) ?? [],
			$template
		) ];
	}

	/**
	 * @return array|null Null when there is nothing to decode, so the caller
	 *   can tell "not supplied" from "supplied but empty".
	 */
	private function decode( ?string $json ): ?array {
		if ( $json === null || trim( $json ) === '' ) {
			return null;
		}
		$decoded = json_decode( $json, true );
		return is_array( $decoded ) ? $decoded : null;
	}
}
