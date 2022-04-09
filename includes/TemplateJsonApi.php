<?php

class TemplateJsonApi {

	public static function onBeforePageDisplay( $out ) {

		$out->addModules( 'ext.TemplateJsonApi' );

		return true;

	}

}
