<?php
/**
 * SpecialPage to redirect to a specific page slot
 *
 * @file
 * @ingroup Extensions
 */

use SpecialPage;
use WSSlots\WSSlots;
use WikiPage;
use \MediaWiki\MediaWikiServices;

class SpecialSlotResolver extends SpecialPage {
	public function __construct() {
		parent::__construct( 'SlotResolver', '' );
	}


    public function execute( $par ) {
        global $wgScriptPath;
        global $wgOut;

        $this->setHeaders();
        
        // extract params from <ns>/<file>
        //e.g. Category/AnnotationProperty.slot_jsonschema.json
        //ToDo: Consider
        //<repo>/<package-id>/<version>/<path>/<file>
        //https://raw.githubusercontent.com/OpenSemanticWorld-Packages/world.opensemantic.core/0599a766decf07d9cdc4a338cb37d0614ae7f447/core/Category/AnnotationProperty.slot_jsonschema.json

        $parts = explode("/", $par); // ["Category", "AnnotationProperty.slot_jsonschema.json"]
        $file = array_pop($parts); // "AnnotationProperty.slot_jsonschema.json"
        $ns = array_pop($parts); // "Category"
        $fileParts =  explode(".", $file); // ["AnnotationProperty", "slot_jsonschema", "json"]
        $extension = array_pop($fileParts); // "json"
        $slot = str_replace("slot_", "", array_pop($fileParts)); // "jsonschema"
        $page = $ns . ":" . implode(".", $fileParts); // "AnnotationProperty"

		$redirect_url = "";
		$msg = "";
        $content = "";

        if ( $slot === "bundle" ) {
            $cache = MediaWikiServices::getInstance()->getMainObjectStash();
            $cacheKey = $cache->makeKey( 'LuaCache', implode(".", $fileParts) . ".header.schema" );
            $msg .= $cacheKey;
            $content = $cache->get( $cacheKey );    
        }
        else {
        //create a WikiPage object from the title string
        $wikiPage = new WikiPage(Title::newFromText($page));
        $content = WSSlots::getSlotContent( $wikiPage, $slot )->getText();
        }

		if ( $redirect_url != "") {
            $out = $this->getOutput();
            // redirect (temp. moved)
            $out->redirect( $redirect_url, '302' ); //https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
        }
        elseif ( $content ) {
            // return raw slot content
            $wgOut->disable();
            ob_start();
            if( strpos( $slot, "json" ) !== false) {
                header('Content-Type: application/json; charset=UTF-8');
            }
            echo($content);
            //exit;
        }
		else {
            // print result
            $out = $this->getOutput();
            $out->setPageTitle("Slot Resolver");
            $out->addHTML($msg);
        }
	}
}
