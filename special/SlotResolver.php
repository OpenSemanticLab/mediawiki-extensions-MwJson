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

class SpecialSlotResolver extends SpecialPage {
	public function __construct() {
		parent::__construct( 'SlotResolver', '' );
	}

	public function _execute( $par ) {
        global $wgScriptPath;
        global $wgOut;
        
        $parts = explode("/", $par);
        

		$redirect_url = "";
		$msg = "";

        $page = "";
        $slot = "main";
        $content = "";
        if ($parts[1]) $slot = $parts[1];
        if ($parts[0]) {
            $page = $parts[0];
            $query = ["title" => $page, "action" => "raw", "slot" => $slot];
            //$redirect_url = wfAppendQuery( wfScript( 'index' ), $query );// $page . "&action=raw&slot=" . $slot;
            //$msg = wfAppendQuery( wfScript( 'index' ), $query );// $page . "&action=raw&slot=" . $slot;
            //$redirect_url = "/wiki/" . $page . "?action=raw&slot=" . $slot;
            $msg = "/wiki/" . $page . "?action=raw&slot=" . $slot;


            //create a WikiPage object from the title string
            $wikiPage = new WikiPage(Title::newFromText($page));

            $content = WSSlots::getSlotContent( $wikiPage, $slot )->getText();
        }


		if ( $redirect_url != "") {
            header('Content-Type: application/schema+json');
            $out->redirect( $redirect_url, '302' ); //https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
        }
        elseif ( $content ) {
            $wgOut->disable();
            ob_start();
            header('Content-Type: application/schema+json; charset=UTF-8');
            echo($content);
        }
		else {
            $out = $this->getOutput();
            $out->setPageTitle("Slot Resolver");
            $out->addHTML($msg);
        }
	}

    public function execute( $par ) {
        global $wgScriptPath;
        global $wgOut;
        
        // extract params from <ns>/<file>
        //e.g. Category/AnnotationProperty.slot_jsonschema.json
        //ToDo: Consider
        //<repo>/<package-id>/<version>/<path>/<file>
        //https://raw.githubusercontent.com/OpenSemanticWorld-Packages/world.opensemantic.core/0599a766decf07d9cdc4a338cb37d0614ae7f447/core/Category/AnnotationProperty.slot_jsonschema.json

        $parts = explode("/", $par);
        $file = array_pop($parts);
        $ns = array_pop($parts);
        $fileParts =  explode(".", $file);
        $extension = array_pop($fileParts);
        $slot = str_replace("slot_", "", array_pop($fileParts));
        $page = $ns . ":" . implode(".", $fileParts);

		$redirect_url = "";
		$msg = "";
        $content = "";

        //create a WikiPage object from the title string
        $wikiPage = new WikiPage(Title::newFromText($page));
        $content = WSSlots::getSlotContent( $wikiPage, $slot )->getText();

		if ( $redirect_url != "") {
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
        }
		else {
            // print result
            $out = $this->getOutput();
            $out->setPageTitle("Slot Resolver");
            $out->addHTML($msg);
        }
	}
}
