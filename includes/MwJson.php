<?php

use MediaWiki\MediaWikiServices;

class MwJson {

	public static function onBeforePageDisplay( $out, $skin ) {

		$out->addModules( 'ext.MwJson' );

		return true;

	}

	// see https://www.mediawiki.org/wiki/Manual:Hooks/ResourceLoaderGetConfigVars
	public static function onResourceLoaderGetConfigVars( array &$vars, $skin, Config $config ): void {
		$vars['wgMwJsonAllowSubmitInvalide'] = $config->get( 'MwJsonAllowSubmitInvalide' );
		$vars['wgMwJsonAiCompletionApiUrl'] = $config->get( 'MwJsonAiCompletionApiUrl' );
	}

	public static function onOutputPageParserOutput($out, $parserOutput) {
		return MwJson::transformSlotRenderResults($out, $parserOutput);
	}

	protected static function transformSlotRenderResults($out, $parserOutput)
	{
		//return;
		$config = MediaWikiServices::getInstance()->getMainConfig();
		$settings = $config->get( 'MwJsonSlotRenderResultTransformation' );
		if (!$settings["enabled"]) return;

		// Skip e.g. pages in NS Special
		if ( !$out->getTitle()->isContentPage() ) return; 

		//$wgHooks['BeforePageDisplay'][] = function ( $out, $skin ) {
		// get the HTML from the parser output when using hook OutputPageParserOutput
		$html = $parserOutput->getText();
		// get the HTML from the output when using hook BeforePageDisplay
		//$html = $out->getHtml();

		if ($html === null || trim($html) === "") return;

		// Ensure the HTML is properly encoded in UTF-8
		$html = mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8');

		// Note: this manipulation interactes with Skin:Citizen if wgCitizenEnableCollapsibleSections is true
		// The behavior of those section is correct but the elements are located in the wrong wrapper
		// which is not a major as long as those wrappers are not visible
		$wrap = $settings["wrap"];

		// Use DOMDocument to parse the HTML
		$dom = new DOMDocument('1.0', 'UTF-8');
		@$dom->loadHTML($html, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);

		// Use XPath to find the target div
		$xpath = new DOMXPath($dom);
		$parserOutputDivs = $xpath->query('//div[contains(@class, "mw-parser-output")]');

		$appendElement = function ($parent, $child) use (&$settings) {
			// skip table of contents which usually is handled separately by skins
			if ($settings["skip_toc"] && $child->hasAttributes() && $child->getAttribute('id') === 'toc') {
					return;
			}
			$parent->appendChild($child);
		};

		foreach ($parserOutputDivs as $div) {
			$slotHeaders = $xpath->query('.//*[contains(@class, "mw-slot-header")]', $div);

			if ($slotHeaders->length > 0) {
				$slots = ['main' => []];
				$currentSlot = 'main';

				// Iterate over all child nodes of the div
				foreach ($div->childNodes as $child) {
					if ($child->nodeType === XML_ELEMENT_NODE && $child->hasAttributes() && $child->getAttribute('class') === 'mw-slot-header') {
						// Create a new slot with the text content of the mw-slot-header
						$currentSlot = trim($child->textContent);
						$slots[$currentSlot] = [];
					} else {
						// Add the child to the current slot
						$slots[$currentSlot][] = $child;
					}
				}

				// Create a new document fragment to hold the wrapped slots
				$newFragment = $dom->createDocumentFragment();

				// Define the order of slots
				$orderedSlots = [];
				if ($settings["order"]) $orderedSlots = ['header', 'main', 'footer'];

				// Append slots in the defined order
				foreach ($orderedSlots as $slotName) {
					if (isset($slots[$slotName])) {
						if ($wrap) {
							$wrapperDiv = $dom->createElement('div');
							$wrapperDiv->setAttribute('id', 'mw-slot-wrapper-' . htmlspecialchars($slotName));
							$wrapperDiv->setAttribute('class', 'mw-slot-wrapper');
							// debug
							//$wrapperDiv->setAttribute('style', 'border: 1px solid #aaa;');
							//$wrapperDiv->appendChild($dom->createElement('p', '>' . htmlspecialchars($slotName)));

							foreach ($slots[$slotName] as $element) {
								$appendElement($wrapperDiv, $element);
							}

							$newFragment->appendChild($wrapperDiv);
						} else {
							foreach ($slots[$slotName] as $element) {
								$appendElement($newFragment, $element);
							}
						}
					}
				}

				// Append any remaining slots that are not in the predefined order
				foreach ($slots as $slotName => $elements) {
					if (!in_array($slotName, $orderedSlots)) {

						$details = $dom->createElement('details');
						$details->setAttribute('class', 'mw-slot-details');
						$summary = $dom->createElement('summary', htmlspecialchars($slotName));
						$summary->setAttribute('class', 'mw-slot-details-summary');
						$details->appendChild($summary);

						if ($wrap) {
							$wrapperDiv = $dom->createElement('div');
							$wrapperDiv->setAttribute('id', 'mw-slot-wrapper-' . htmlspecialchars($slotName));
							$wrapperDiv->setAttribute('class', 'mw-slot-wrapper');
							// debug
							//$wrapperDiv->setAttribute('style', 'border: 1px solid #aaa;');
							//$wrapperDiv->appendChild($dom->createElement('p', '>' . htmlspecialchars($slotName)));

							foreach ($elements as $element) {
								$appendElement($details, $element);
							}

							$wrapperDiv->appendChild($details);
							$newFragment->appendChild($wrapperDiv);
						} else {
							foreach ($elements as $element) {
								$appendElement($details, $element);
							}
							$newFragment->appendChild($details);
						}
					}
				}

				// Replace the original content with the new wrapped content
				while ($div->firstChild) {
					$div->removeChild($div->firstChild);
				}
				$div->appendChild($newFragment);
			}
		}

		// Save the modified HTML back to the parser output when using OutputPageParserOutput
		$parserOutput->setText($dom->saveHTML());
		// when using BeforePageDisplay
		//$out->clearHtml();
		//$out->addHtml( $dom->saveHTML() );

		// e.g. Skin:Citizen does wrap the toc => hide it in the main content section
		// custom toc is still displayed in the right sidebar
		if ($settings["hide_toc"]) $out->addInlineStyle( ".mw-slot-wrapper #toc { display: none; }" );

		return true;
	}
}
