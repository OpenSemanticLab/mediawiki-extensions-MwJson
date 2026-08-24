<?php

namespace MediaWiki\Extension\MwJson;

/**
 * Hook handlers for the OO-LD pipeline.
 *
 * Kept apart from the legacy MwJson class, which handles the slot render
 * transformation and the ResourceLoader wiring for the JavaScript editor.
 */
class Hooks {

	/**
	 * Register mw.ext.mwjson so Module:Entity can dispatch to the PHP pipeline.
	 *
	 * @param string $engine
	 * @param string[] &$extraLibraries
	 */
	public static function onScribuntoExternalLibraries( string $engine, array &$extraLibraries ): void {
		if ( $engine !== 'lua' ) {
			return;
		}
		$extraLibraries['mw.ext.mwjson'] = Scribunto\MwJsonLuaLibrary::class;
	}
}
