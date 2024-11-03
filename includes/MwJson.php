<?php

class MwJson {

	public static function onBeforePageDisplay( $out ) {

		$out->addModules( 'ext.MwJson' );

		return true;

	}

	// see https://www.mediawiki.org/wiki/Manual:Hooks/ResourceLoaderGetConfigVars
	public static function onResourceLoaderGetConfigVars( array &$vars, $skin, Config $config ): void {
		$vars['wgMwJsonAllowSubmitInvalide'] = $config->get( 'MwJsonAllowSubmitInvalide' );
		$vars['wgMwJsonAiCompletionApiUrl'] = $config->get( 'MwJsonAiCompletionApiUrl' );
	}

}
