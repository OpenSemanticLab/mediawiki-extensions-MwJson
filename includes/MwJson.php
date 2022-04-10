<?php

class MwJson {

	public static function onBeforePageDisplay( $out ) {

		$out->addModules( 'ext.MwJson' );

		return true;

	}

}
