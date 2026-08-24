<?php

namespace MediaWiki\Extension\MwJson\ParserFunctions;

use MediaWiki\Extension\MwJson\Mw\PipelineFactory;
use MediaWiki\Extension\MwJson\OOLD\Slots;
use MediaWiki\MediaWikiServices;
use Parser;
use PPFrame;

/**
 * `{{#mwjson:header}}` and `{{#mwjson:footer}}`, the eventual replacement for
 * `{{#invoke:Entity|header}}` in every page's header and footer slot.
 *
 * Registering it early costs nothing, since no page calls it yet, and it gives
 * the parity harness a PHP entry point that goes through a full page parse
 * without any wiki content having to change first.
 *
 * Named parameters mirror the arguments Module:Entity accepts:
 *
 *     {{#mwjson: header }}
 *     {{#mwjson: header | page = Item:OSW... }}
 *     {{#mwjson: header | jsondata = {...} | jsonschema = {...} }}
 */
class MwJsonParserFunction {

	public static function onParserFirstCallInit( Parser $parser ): void {
		$parser->setFunctionHook(
			'mwjson',
			[ self::class, 'render' ],
			Parser::SFH_OBJECT_ARGS
		);
	}

	/**
	 * @param Parser $parser
	 * @param PPFrame $frame
	 * @param array $args Unexpanded arguments.
	 */
	public static function render( Parser $parser, PPFrame $frame, array $args ): string {
		$parsed = self::parseArguments( $frame, $args );
		$mode = $parsed[0] ?? Slots::MODE_HEADER;

		if ( $mode !== Slots::MODE_HEADER && $mode !== Slots::MODE_FOOTER ) {
			return '<span class="error">' . htmlspecialchars(
				"#mwjson: expected \"header\" or \"footer\", got \"$mode\""
			) . '</span>';
		}

		$services = MediaWikiServices::getInstance();
		$title = isset( $parsed['page'] ) && $parsed['page'] !== ''
			? $services->getTitleFactory()->newFromText( $parsed['page'] )
			: $parser->getTitle();

		if ( $title === null ) {
			return '';
		}

		return ( new PipelineFactory() )->renderSlot(
			$parser,
			$frame,
			$mode,
			$title,
			self::decode( $parsed['jsondata'] ?? null ),
			self::decode( $parsed['jsonschema'] ?? null ) ?? [],
			$parsed['template'] ?? null
		);
	}

	/**
	 * Split SFH_OBJECT_ARGS parameters into positional and named, expanding
	 * each. Expansion has to happen here rather than via SFH_NO_HASH, because
	 * a jsondata argument may itself contain templates.
	 *
	 * @param array $args
	 * @return array<int|string,string>
	 */
	private static function parseArguments( PPFrame $frame, array $args ): array {
		$parsed = [];
		$position = 0;

		foreach ( $args as $arg ) {
			$expanded = trim( $frame->expand( $arg ) );
			$parts = explode( '=', $expanded, 2 );

			if ( count( $parts ) === 2 ) {
				$parsed[trim( $parts[0] )] = trim( $parts[1] );
			} else {
				$parsed[$position++] = $expanded;
			}
		}

		return $parsed;
	}

	private static function decode( ?string $json ): ?array {
		if ( $json === null || trim( $json ) === '' ) {
			return null;
		}
		$decoded = json_decode( $json, true );
		return is_array( $decoded ) ? $decoded : null;
	}
}
