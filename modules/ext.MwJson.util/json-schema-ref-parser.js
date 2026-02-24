/* @apidevtools/json-schema-ref-parser v15.2.2
 * Built from https://github.com/APIDevTools/json-schema-ref-parser
 * Bundled with webpack 5 for browser use (UMD, global: $RefParser)
 *
 * Applied patches:
 * - #338: Disabled 'extended' sorting criteria in bundle logic
 *   (https://github.com/APIDevTools/json-schema-ref-parser/issues/338)
 */
(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["$RefParser"] = factory();
	else
		root["$RefParser"] = factory();
})(this, () => {
return /******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/base64-js/index.js"
/*!*****************************************!*\
  !*** ./node_modules/base64-js/index.js ***!
  \*****************************************/
(__unused_webpack_module, exports) {

"use strict";


exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}


/***/ },

/***/ "./node_modules/buffer/index.js"
/*!**************************************!*\
  !*** ./node_modules/buffer/index.js ***!
  \**************************************/
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */



const base64 = __webpack_require__(/*! base64-js */ "./node_modules/base64-js/index.js")
const ieee754 = __webpack_require__(/*! ieee754 */ "./node_modules/ieee754/index.js")
const customInspectSymbol =
  (typeof Symbol === 'function' && typeof Symbol['for'] === 'function') // eslint-disable-line dot-notation
    ? Symbol['for']('nodejs.util.inspect.custom') // eslint-disable-line dot-notation
    : null

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

const K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    const arr = new Uint8Array(1)
    const proto = { foo: function () { return 42 } }
    Object.setPrototypeOf(proto, Uint8Array.prototype)
    Object.setPrototypeOf(arr, proto)
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  const buf = new Uint8Array(length)
  Object.setPrototypeOf(buf, Buffer.prototype)
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayView(value)
  }

  if (value == null) {
    throw new TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof SharedArrayBuffer !== 'undefined' &&
      (isInstance(value, SharedArrayBuffer) ||
      (value && isInstance(value.buffer, SharedArrayBuffer)))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  const valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  const b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(value[Symbol.toPrimitive]('string'), encodingOrOffset, length)
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Object.setPrototypeOf(Buffer.prototype, Uint8Array.prototype)
Object.setPrototypeOf(Buffer, Uint8Array)

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpreted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  const length = byteLength(string, encoding) | 0
  let buf = createBuffer(length)

  const actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  const length = array.length < 0 ? 0 : checked(array.length) | 0
  const buf = createBuffer(length)
  for (let i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayView (arrayView) {
  if (isInstance(arrayView, Uint8Array)) {
    const copy = new Uint8Array(arrayView)
    return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength)
  }
  return fromArrayLike(arrayView)
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  let buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  Object.setPrototypeOf(buf, Buffer.prototype)

  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    const len = checked(obj.length) | 0
    const buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  let x = a.length
  let y = b.length

  for (let i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  let i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  const buffer = Buffer.allocUnsafe(length)
  let pos = 0
  for (i = 0; i < list.length; ++i) {
    let buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      if (pos + buf.length > buffer.length) {
        if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf)
        buf.copy(buffer, pos)
      } else {
        Uint8Array.prototype.set.call(
          buffer,
          buf,
          pos
        )
      }
    } else if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    } else {
      buf.copy(buffer, pos)
    }
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  const len = string.length
  const mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  let loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  let loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coercion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  const i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  const len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (let i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  const len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (let i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  const len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (let i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  const length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  let str = ''
  const max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}
if (customInspectSymbol) {
  Buffer.prototype[customInspectSymbol] = Buffer.prototype.inspect
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  let x = thisEnd - thisStart
  let y = end - start
  const len = Math.min(x, y)

  const thisCopy = this.slice(thisStart, thisEnd)
  const targetCopy = target.slice(start, end)

  for (let i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  let indexSize = 1
  let arrLength = arr.length
  let valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  let i
  if (dir) {
    let foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      let found = true
      for (let j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  const remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  const strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  let i
  for (i = 0; i < length; ++i) {
    const parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  const remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  let loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
      case 'latin1':
      case 'binary':
        return asciiWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  const res = []

  let i = start
  while (i < end) {
    const firstByte = buf[i]
    let codePoint = null
    let bytesPerSequence = (firstByte > 0xEF)
      ? 4
      : (firstByte > 0xDF)
          ? 3
          : (firstByte > 0xBF)
              ? 2
              : 1

    if (i + bytesPerSequence <= end) {
      let secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
const MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  const len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  let res = ''
  let i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  let ret = ''
  end = Math.min(buf.length, end)

  for (let i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  let ret = ''
  end = Math.min(buf.length, end)

  for (let i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  const len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  let out = ''
  for (let i = start; i < end; ++i) {
    out += hexSliceLookupTable[buf[i]]
  }
  return out
}

function utf16leSlice (buf, start, end) {
  const bytes = buf.slice(start, end)
  let res = ''
  // If bytes.length is odd, the last 8 bits must be ignored (same as node.js)
  for (let i = 0; i < bytes.length - 1; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  const len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  const newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  Object.setPrototypeOf(newBuf, Buffer.prototype)

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUintLE =
Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  let val = this[offset]
  let mul = 1
  let i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUintBE =
Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  let val = this[offset + --byteLength]
  let mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUint8 =
Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUint16LE =
Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUint16BE =
Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUint32LE =
Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUint32BE =
Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readBigUInt64LE = defineBigIntMethod(function readBigUInt64LE (offset) {
  offset = offset >>> 0
  validateNumber(offset, 'offset')
  const first = this[offset]
  const last = this[offset + 7]
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 8)
  }

  const lo = first +
    this[++offset] * 2 ** 8 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 24

  const hi = this[++offset] +
    this[++offset] * 2 ** 8 +
    this[++offset] * 2 ** 16 +
    last * 2 ** 24

  return BigInt(lo) + (BigInt(hi) << BigInt(32))
})

Buffer.prototype.readBigUInt64BE = defineBigIntMethod(function readBigUInt64BE (offset) {
  offset = offset >>> 0
  validateNumber(offset, 'offset')
  const first = this[offset]
  const last = this[offset + 7]
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 8)
  }

  const hi = first * 2 ** 24 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 8 +
    this[++offset]

  const lo = this[++offset] * 2 ** 24 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 8 +
    last

  return (BigInt(hi) << BigInt(32)) + BigInt(lo)
})

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  let val = this[offset]
  let mul = 1
  let i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  let i = byteLength
  let mul = 1
  let val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  const val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  const val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readBigInt64LE = defineBigIntMethod(function readBigInt64LE (offset) {
  offset = offset >>> 0
  validateNumber(offset, 'offset')
  const first = this[offset]
  const last = this[offset + 7]
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 8)
  }

  const val = this[offset + 4] +
    this[offset + 5] * 2 ** 8 +
    this[offset + 6] * 2 ** 16 +
    (last << 24) // Overflow

  return (BigInt(val) << BigInt(32)) +
    BigInt(first +
    this[++offset] * 2 ** 8 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 24)
})

Buffer.prototype.readBigInt64BE = defineBigIntMethod(function readBigInt64BE (offset) {
  offset = offset >>> 0
  validateNumber(offset, 'offset')
  const first = this[offset]
  const last = this[offset + 7]
  if (first === undefined || last === undefined) {
    boundsError(offset, this.length - 8)
  }

  const val = (first << 24) + // Overflow
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 8 +
    this[++offset]

  return (BigInt(val) << BigInt(32)) +
    BigInt(this[++offset] * 2 ** 24 +
    this[++offset] * 2 ** 16 +
    this[++offset] * 2 ** 8 +
    last)
})

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUintLE =
Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    const maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  let mul = 1
  let i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUintBE =
Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    const maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  let i = byteLength - 1
  let mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUint8 =
Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUint16LE =
Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUint16BE =
Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUint32LE =
Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUint32BE =
Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function wrtBigUInt64LE (buf, value, offset, min, max) {
  checkIntBI(value, min, max, buf, offset, 7)

  let lo = Number(value & BigInt(0xffffffff))
  buf[offset++] = lo
  lo = lo >> 8
  buf[offset++] = lo
  lo = lo >> 8
  buf[offset++] = lo
  lo = lo >> 8
  buf[offset++] = lo
  let hi = Number(value >> BigInt(32) & BigInt(0xffffffff))
  buf[offset++] = hi
  hi = hi >> 8
  buf[offset++] = hi
  hi = hi >> 8
  buf[offset++] = hi
  hi = hi >> 8
  buf[offset++] = hi
  return offset
}

function wrtBigUInt64BE (buf, value, offset, min, max) {
  checkIntBI(value, min, max, buf, offset, 7)

  let lo = Number(value & BigInt(0xffffffff))
  buf[offset + 7] = lo
  lo = lo >> 8
  buf[offset + 6] = lo
  lo = lo >> 8
  buf[offset + 5] = lo
  lo = lo >> 8
  buf[offset + 4] = lo
  let hi = Number(value >> BigInt(32) & BigInt(0xffffffff))
  buf[offset + 3] = hi
  hi = hi >> 8
  buf[offset + 2] = hi
  hi = hi >> 8
  buf[offset + 1] = hi
  hi = hi >> 8
  buf[offset] = hi
  return offset + 8
}

Buffer.prototype.writeBigUInt64LE = defineBigIntMethod(function writeBigUInt64LE (value, offset = 0) {
  return wrtBigUInt64LE(this, value, offset, BigInt(0), BigInt('0xffffffffffffffff'))
})

Buffer.prototype.writeBigUInt64BE = defineBigIntMethod(function writeBigUInt64BE (value, offset = 0) {
  return wrtBigUInt64BE(this, value, offset, BigInt(0), BigInt('0xffffffffffffffff'))
})

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    const limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  let i = 0
  let mul = 1
  let sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    const limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  let i = byteLength - 1
  let mul = 1
  let sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeBigInt64LE = defineBigIntMethod(function writeBigInt64LE (value, offset = 0) {
  return wrtBigUInt64LE(this, value, offset, -BigInt('0x8000000000000000'), BigInt('0x7fffffffffffffff'))
})

Buffer.prototype.writeBigInt64BE = defineBigIntMethod(function writeBigInt64BE (value, offset = 0) {
  return wrtBigUInt64BE(this, value, offset, -BigInt('0x8000000000000000'), BigInt('0x7fffffffffffffff'))
})

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  const len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      const code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  } else if (typeof val === 'boolean') {
    val = Number(val)
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  let i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    const bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    const len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// CUSTOM ERRORS
// =============

// Simplified versions from Node, changed for Buffer-only usage
const errors = {}
function E (sym, getMessage, Base) {
  errors[sym] = class NodeError extends Base {
    constructor () {
      super()

      Object.defineProperty(this, 'message', {
        value: getMessage.apply(this, arguments),
        writable: true,
        configurable: true
      })

      // Add the error code to the name to include it in the stack trace.
      this.name = `${this.name} [${sym}]`
      // Access the stack to generate the error message including the error code
      // from the name.
      this.stack // eslint-disable-line no-unused-expressions
      // Reset the name to the actual name.
      delete this.name
    }

    get code () {
      return sym
    }

    set code (value) {
      Object.defineProperty(this, 'code', {
        configurable: true,
        enumerable: true,
        value,
        writable: true
      })
    }

    toString () {
      return `${this.name} [${sym}]: ${this.message}`
    }
  }
}

E('ERR_BUFFER_OUT_OF_BOUNDS',
  function (name) {
    if (name) {
      return `${name} is outside of buffer bounds`
    }

    return 'Attempt to access memory outside buffer bounds'
  }, RangeError)
E('ERR_INVALID_ARG_TYPE',
  function (name, actual) {
    return `The "${name}" argument must be of type number. Received type ${typeof actual}`
  }, TypeError)
E('ERR_OUT_OF_RANGE',
  function (str, range, input) {
    let msg = `The value of "${str}" is out of range.`
    let received = input
    if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
      received = addNumericalSeparator(String(input))
    } else if (typeof input === 'bigint') {
      received = String(input)
      if (input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32))) {
        received = addNumericalSeparator(received)
      }
      received += 'n'
    }
    msg += ` It must be ${range}. Received ${received}`
    return msg
  }, RangeError)

function addNumericalSeparator (val) {
  let res = ''
  let i = val.length
  const start = val[0] === '-' ? 1 : 0
  for (; i >= start + 4; i -= 3) {
    res = `_${val.slice(i - 3, i)}${res}`
  }
  return `${val.slice(0, i)}${res}`
}

// CHECK FUNCTIONS
// ===============

function checkBounds (buf, offset, byteLength) {
  validateNumber(offset, 'offset')
  if (buf[offset] === undefined || buf[offset + byteLength] === undefined) {
    boundsError(offset, buf.length - (byteLength + 1))
  }
}

function checkIntBI (value, min, max, buf, offset, byteLength) {
  if (value > max || value < min) {
    const n = typeof min === 'bigint' ? 'n' : ''
    let range
    if (byteLength > 3) {
      if (min === 0 || min === BigInt(0)) {
        range = `>= 0${n} and < 2${n} ** ${(byteLength + 1) * 8}${n}`
      } else {
        range = `>= -(2${n} ** ${(byteLength + 1) * 8 - 1}${n}) and < 2 ** ` +
                `${(byteLength + 1) * 8 - 1}${n}`
      }
    } else {
      range = `>= ${min}${n} and <= ${max}${n}`
    }
    throw new errors.ERR_OUT_OF_RANGE('value', range, value)
  }
  checkBounds(buf, offset, byteLength)
}

function validateNumber (value, name) {
  if (typeof value !== 'number') {
    throw new errors.ERR_INVALID_ARG_TYPE(name, 'number', value)
  }
}

function boundsError (value, length, type) {
  if (Math.floor(value) !== value) {
    validateNumber(value, type)
    throw new errors.ERR_OUT_OF_RANGE(type || 'offset', 'an integer', value)
  }

  if (length < 0) {
    throw new errors.ERR_BUFFER_OUT_OF_BOUNDS()
  }

  throw new errors.ERR_OUT_OF_RANGE(type || 'offset',
                                    `>= ${type ? 1 : 0} and <= ${length}`,
                                    value)
}

// HELPER FUNCTIONS
// ================

const INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  let codePoint
  const length = string.length
  let leadSurrogate = null
  const bytes = []

  for (let i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  const byteArray = []
  for (let i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  let c, hi, lo
  const byteArray = []
  for (let i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  let i
  for (i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

// Create lookup table for `toString('hex')`
// See: https://github.com/feross/buffer/issues/219
const hexSliceLookupTable = (function () {
  const alphabet = '0123456789abcdef'
  const table = new Array(256)
  for (let i = 0; i < 16; ++i) {
    const i16 = i * 16
    for (let j = 0; j < 16; ++j) {
      table[i16 + j] = alphabet[i] + alphabet[j]
    }
  }
  return table
})()

// Return not function with Error if BigInt not supported
function defineBigIntMethod (fn) {
  return typeof BigInt === 'undefined' ? BufferBigIntNotDefined : fn
}

function BufferBigIntNotDefined () {
  throw new Error('BigInt not supported')
}


/***/ },

/***/ "./node_modules/ieee754/index.js"
/*!***************************************!*\
  !*** ./node_modules/ieee754/index.js ***!
  \***************************************/
(__unused_webpack_module, exports) {

/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}


/***/ },

/***/ "./node_modules/process/browser.js"
/*!*****************************************!*\
  !*** ./node_modules/process/browser.js ***!
  \*****************************************/
(module) {

// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };


/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/bundle.js"
/*!*****************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/bundle.js ***!
  \*****************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _ref_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./ref.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/ref.js");
/* harmony import */ var _pointer_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./pointer.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/pointer.js");
/* harmony import */ var _util_url_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./util/url.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/url.js");



/**
 * Bundles all external JSON references into the main JSON schema, thus resulting in a schema that
 * only has *internal* references, not any *external* references.
 * This method mutates the JSON schema object, adding new references and re-mapping existing ones.
 *
 * @param parser
 * @param options
 */
function bundle(parser, options) {
    // console.log('Bundling $ref pointers in %s', parser.$refs._root$Ref.path);
    // Build an inventory of all $ref pointers in the JSON Schema
    const inventory = [];
    crawl(parser, "schema", parser.$refs._root$Ref.path + "#", "#", 0, inventory, parser.$refs, options);
    // Remap all $ref pointers
    remap(inventory, options);
}
/**
 * Recursively crawls the given value, and inventories all JSON references.
 *
 * @param parent - The object containing the value to crawl. If the value is not an object or array, it will be ignored.
 * @param key - The property key of `parent` to be crawled
 * @param path - The full path of the property being crawled, possibly with a JSON Pointer in the hash
 * @param pathFromRoot - The path of the property being crawled, from the schema root
 * @param indirections
 * @param inventory - An array of already-inventoried $ref pointers
 * @param $refs
 * @param options
 */
function crawl(parent, key, path, pathFromRoot, indirections, inventory, $refs, options) {
    const obj = key === null ? parent : parent[key];
    const bundleOptions = (options.bundle || {});
    const isExcludedPath = bundleOptions.excludedPathMatcher || (() => false);
    if (obj && typeof obj === "object" && !ArrayBuffer.isView(obj) && !isExcludedPath(pathFromRoot)) {
        if (_ref_js__WEBPACK_IMPORTED_MODULE_0__["default"].isAllowed$Ref(obj)) {
            inventory$Ref(parent, key, path, pathFromRoot, indirections, inventory, $refs, options);
        }
        else {
            // Crawl the object in a specific order that's optimized for bundling.
            // This is important because it determines how `pathFromRoot` gets built,
            // which later determines which keys get dereferenced and which ones get remapped
            const keys = Object.keys(obj).sort((a, b) => {
                // Most people will expect references to be bundled into the the "definitions" property,
                // so we always crawl that property first, if it exists.
                if (a === "definitions" || a === "$defs") {
                    return -1;
                }
                else if (b === "definitions" || b === "$defs") {
                    return 1;
                }
                else {
                    // Otherwise, crawl the keys based on their length.
                    // This produces the shortest possible bundled references
                    return a.length - b.length;
                }
            });
            for (const key of keys) {
                const keyPath = _pointer_js__WEBPACK_IMPORTED_MODULE_1__["default"].join(path, key);
                const keyPathFromRoot = _pointer_js__WEBPACK_IMPORTED_MODULE_1__["default"].join(pathFromRoot, key);
                const value = obj[key];
                if (_ref_js__WEBPACK_IMPORTED_MODULE_0__["default"].isAllowed$Ref(value)) {
                    inventory$Ref(obj, key, path, keyPathFromRoot, indirections, inventory, $refs, options);
                }
                else {
                    crawl(obj, key, keyPath, keyPathFromRoot, indirections, inventory, $refs, options);
                }
                // We need to ensure that we have an object to work with here because we may be crawling
                // an `examples` schema and `value` may be nullish.
                if (value && typeof value === "object" && !Array.isArray(value)) {
                    if ("$ref" in value) {
                        bundleOptions?.onBundle?.(value["$ref"], obj[key], obj, key);
                    }
                }
            }
        }
    }
}
/**
 * Inventories the given JSON Reference (i.e. records detailed information about it so we can
 * optimize all $refs in the schema), and then crawls the resolved value.
 *
 * @param $refParent - The object that contains a JSON Reference as one of its keys
 * @param $refKey - The key in `$refParent` that is a JSON Reference
 * @param path - The full path of the JSON Reference at `$refKey`, possibly with a JSON Pointer in the hash
 * @param indirections - unknown
 * @param pathFromRoot - The path of the JSON Reference at `$refKey`, from the schema root
 * @param inventory - An array of already-inventoried $ref pointers
 * @param $refs
 * @param options
 */
function inventory$Ref($refParent, $refKey, path, pathFromRoot, indirections, inventory, $refs, options) {
    const $ref = $refKey === null ? $refParent : $refParent[$refKey];
    const $refPath = _util_url_js__WEBPACK_IMPORTED_MODULE_2__.resolve(path, $ref.$ref);
    const pointer = $refs._resolve($refPath, pathFromRoot, options);
    if (pointer === null) {
        return;
    }
    const parsed = _pointer_js__WEBPACK_IMPORTED_MODULE_1__["default"].parse(pathFromRoot);
    const depth = parsed.length;
    const file = _util_url_js__WEBPACK_IMPORTED_MODULE_2__.stripHash(pointer.path);
    const hash = _util_url_js__WEBPACK_IMPORTED_MODULE_2__.getHash(pointer.path);
    const external = file !== $refs._root$Ref.path;
    const extended = _ref_js__WEBPACK_IMPORTED_MODULE_0__["default"].isExtended$Ref($ref);
    indirections += pointer.indirections;
    const existingEntry = findInInventory(inventory, $refParent, $refKey);
    if (existingEntry) {
        // This $Ref has already been inventoried, so we don't need to process it again
        if (depth < existingEntry.depth || indirections < existingEntry.indirections) {
            removeFromInventory(inventory, existingEntry);
        }
        else {
            return;
        }
    }
    inventory.push({
        $ref, // The JSON Reference (e.g. {$ref: string})
        parent: $refParent, // The object that contains this $ref pointer
        key: $refKey, // The key in `parent` that is the $ref pointer
        pathFromRoot, // The path to the $ref pointer, from the JSON Schema root
        depth, // How far from the JSON Schema root is this $ref pointer?
        file, // The file that the $ref pointer resolves to
        hash, // The hash within `file` that the $ref pointer resolves to
        value: pointer.value, // The resolved value of the $ref pointer
        circular: pointer.circular, // Is this $ref pointer DIRECTLY circular? (i.e. it references itself)
        extended, // Does this $ref extend its resolved value? (i.e. it has extra properties, in addition to "$ref")
        external, // Does this $ref pointer point to a file other than the main JSON Schema file?
        indirections, // The number of indirect references that were traversed to resolve the value
    });
    // Recursively crawl the resolved value
    if (!existingEntry || external) {
        crawl(pointer.value, null, pointer.path, pathFromRoot, indirections + 1, inventory, $refs, options);
    }
}
/**
 * Re-maps every $ref pointer, so that they're all relative to the root of the JSON Schema.
 * Each referenced value is dereferenced EXACTLY ONCE.  All subsequent references to the same
 * value are re-mapped to point to the first reference.
 *
 * @example: {
 *    first: { $ref: somefile.json#/some/part },
 *    second: { $ref: somefile.json#/another/part },
 *    third: { $ref: somefile.json },
 *    fourth: { $ref: somefile.json#/some/part/sub/part }
 *  }
 *
 * In this example, there are four references to the same file, but since the third reference points
 * to the ENTIRE file, that's the only one we need to dereference.  The other three can just be
 * remapped to point inside the third one.
 *
 * On the other hand, if the third reference DIDN'T exist, then the first and second would both need
 * to be dereferenced, since they point to different parts of the file. The fourth reference does NOT
 * need to be dereferenced, because it can be remapped to point inside the first one.
 *
 * @param inventory
 */
function remap(inventory, options) {
    // Group & sort all the $ref pointers, so they're in the order that we need to dereference/remap them
    inventory.sort((a, b) => {
        if (a.file !== b.file) {
            // Group all the $refs that point to the same file
            return a.file < b.file ? -1 : +1;
        }
        else if (a.hash !== b.hash) {
            // Group all the $refs that point to the same part of the file
            return a.hash < b.hash ? -1 : +1;
        }
        else if (a.circular !== b.circular) {
            // If the $ref points to itself, then sort it higher than other $refs that point to this $ref
            return a.circular ? -1 : +1;
        }
        /* fix: disable the criteria 'extended', see https://github.com/APIDevTools/json-schema-ref-parser/issues/338
        else if (a.extended !== b.extended) {
            // If the $ref extends the resolved value, then sort it lower than other $refs that don't extend the value
            return a.extended ? +1 : -1;
        }*/
        else if (a.indirections !== b.indirections) {
            // Sort direct references higher than indirect references
            return a.indirections - b.indirections;
        }
        else if (a.depth !== b.depth) {
            // Sort $refs by how close they are to the JSON Schema root
            return a.depth - b.depth;
        }
        else {
            // Determine how far each $ref is from the "definitions" property.
            // Most people will expect references to be bundled into the the "definitions" property if possible.
            const aDefinitionsIndex = Math.max(a.pathFromRoot.lastIndexOf("/definitions"), a.pathFromRoot.lastIndexOf("/$defs"));
            const bDefinitionsIndex = Math.max(b.pathFromRoot.lastIndexOf("/definitions"), b.pathFromRoot.lastIndexOf("/$defs"));
            if (aDefinitionsIndex !== bDefinitionsIndex) {
                // Give higher priority to the $ref that's closer to the "definitions" property
                return bDefinitionsIndex - aDefinitionsIndex;
            }
            else {
                // All else is equal, so use the shorter path, which will produce the shortest possible reference
                return a.pathFromRoot.length - b.pathFromRoot.length;
            }
        }
    });
    let file, hash, pathFromRoot;
    for (const entry of inventory) {
        // console.log('Re-mapping $ref pointer "%s" at %s', entry.$ref.$ref, entry.pathFromRoot);
        if (!entry.external) {
            // This $ref already resolves to the main JSON Schema file
            entry.$ref.$ref = entry.hash;
        }
        else if (entry.file === file && entry.hash === hash) {
            // This $ref points to the same value as the previous $ref, so remap it to the same path
            entry.$ref.$ref = pathFromRoot;
        }
        else if (entry.file === file && entry.hash.indexOf(hash + "/") === 0) {
            // This $ref points to a sub-value of the previous $ref, so remap it beneath that path
            entry.$ref.$ref = _pointer_js__WEBPACK_IMPORTED_MODULE_1__["default"].join(pathFromRoot, _pointer_js__WEBPACK_IMPORTED_MODULE_1__["default"].parse(entry.hash.replace(hash, "#")));
        }
        else {
            // We've moved to a new file or new hash
            file = entry.file;
            hash = entry.hash;
            pathFromRoot = entry.pathFromRoot;
            // This is the first $ref to point to this value, so dereference the value.
            // Any other $refs that point to the same value will point to this $ref instead
            entry.$ref = entry.parent[entry.key] = _ref_js__WEBPACK_IMPORTED_MODULE_0__["default"].dereference(entry.$ref, entry.value, options);
            if (entry.circular) {
                // This $ref points to itself
                entry.$ref.$ref = entry.pathFromRoot;
            }
        }
    }
    // we want to ensure that any $refs that point to another $ref are remapped to point to the final value
    // let hadChange = true;
    // while (hadChange) {
    //   hadChange = false;
    //   for (const entry of inventory) {
    //     if (entry.$ref && typeof entry.$ref === "object" && "$ref" in entry.$ref) {
    //       const resolved = inventory.find((e: InventoryEntry) => e.pathFromRoot === entry.$ref.$ref);
    //       if (resolved) {
    //         const resolvedPointsToAnotherRef =
    //           resolved.$ref && typeof resolved.$ref === "object" && "$ref" in resolved.$ref;
    //         if (resolvedPointsToAnotherRef && entry.$ref.$ref !== resolved.$ref.$ref) {
    //           // console.log('Re-mapping $ref pointer "%s" at %s', entry.$ref.$ref, entry.pathFromRoot);
    //           entry.$ref.$ref = resolved.$ref.$ref;
    //           hadChange = true;
    //         }
    //       }
    //     }
    //   }
    // }
}
/**
 * TODO
 */
function findInInventory(inventory, $refParent, $refKey) {
    for (const existingEntry of inventory) {
        if (existingEntry && existingEntry.parent === $refParent && existingEntry.key === $refKey) {
            return existingEntry;
        }
    }
    return undefined;
}
function removeFromInventory(inventory, entry) {
    const index = inventory.indexOf(entry);
    inventory.splice(index, 1);
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (bundle);


/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/dereference.js"
/*!**********************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/dereference.js ***!
  \**********************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _ref_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./ref.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/ref.js");
/* harmony import */ var _pointer_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./pointer.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/pointer.js");
/* harmony import */ var _util_url_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./util/url.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/url.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./util/errors.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/errors.js");




/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (dereference);
/**
 * Crawls the JSON schema, finds all JSON references, and dereferences them.
 * This method mutates the JSON schema object, replacing JSON references with their resolved value.
 *
 * @param parser
 * @param options
 */
function dereference(parser, options) {
    const start = Date.now();
    // console.log('Dereferencing $ref pointers in %s', parser.$refs._root$Ref.path);
    const dereferenced = crawl(parser.schema, parser.$refs._root$Ref.path, "#", new Set(), new Set(), new Map(), parser.$refs, options, start);
    parser.$refs.circular = dereferenced.circular;
    parser.schema = dereferenced.value;
}
/**
 * Recursively crawls the given value, and dereferences any JSON references.
 *
 * @param obj - The value to crawl. If it's not an object or array, it will be ignored.
 * @param path - The full path of `obj`, possibly with a JSON Pointer in the hash
 * @param pathFromRoot - The path of `obj` from the schema root
 * @param parents - An array of the parent objects that have already been dereferenced
 * @param processedObjects - An array of all the objects that have already been processed
 * @param dereferencedCache - An map of all the dereferenced objects
 * @param $refs
 * @param options
 * @param startTime - The time when the dereferencing started
 * @returns
 */
function crawl(obj, path, pathFromRoot, parents, processedObjects, dereferencedCache, $refs, options, startTime) {
    let dereferenced;
    const result = {
        value: obj,
        circular: false,
    };
    checkDereferenceTimeout(startTime, options);
    const derefOptions = (options.dereference || {});
    const isExcludedPath = derefOptions.excludedPathMatcher || (() => false);
    if (derefOptions?.circular === "ignore" || !processedObjects.has(obj)) {
        if (obj && typeof obj === "object" && !ArrayBuffer.isView(obj) && !isExcludedPath(pathFromRoot)) {
            parents.add(obj);
            processedObjects.add(obj);
            if (_ref_js__WEBPACK_IMPORTED_MODULE_0__["default"].isAllowed$Ref(obj, options)) {
                dereferenced = dereference$Ref(obj, path, pathFromRoot, parents, processedObjects, dereferencedCache, $refs, options, startTime);
                result.circular = dereferenced.circular;
                result.value = dereferenced.value;
            }
            else {
                for (const key of Object.keys(obj)) {
                    checkDereferenceTimeout(startTime, options);
                    const keyPath = _pointer_js__WEBPACK_IMPORTED_MODULE_1__["default"].join(path, key);
                    const keyPathFromRoot = _pointer_js__WEBPACK_IMPORTED_MODULE_1__["default"].join(pathFromRoot, key);
                    if (isExcludedPath(keyPathFromRoot)) {
                        continue;
                    }
                    const value = obj[key];
                    let circular = false;
                    if (_ref_js__WEBPACK_IMPORTED_MODULE_0__["default"].isAllowed$Ref(value, options)) {
                        dereferenced = dereference$Ref(value, keyPath, keyPathFromRoot, parents, processedObjects, dereferencedCache, $refs, options, startTime);
                        circular = dereferenced.circular;
                        // Avoid pointless mutations; breaks frozen objects to no profit
                        if (obj[key] !== dereferenced.value) {
                            // If we have properties we want to preserve from our dereferenced schema then we need
                            // to copy them over to our new object.
                            const preserved = new Map();
                            if (derefOptions?.preservedProperties) {
                                if (typeof obj[key] === "object" && !Array.isArray(obj[key])) {
                                    derefOptions?.preservedProperties.forEach((prop) => {
                                        if (prop in obj[key]) {
                                            preserved.set(prop, obj[key][prop]);
                                        }
                                    });
                                }
                            }
                            obj[key] = dereferenced.value;
                            // If we have data to preserve and our dereferenced object is still an object then
                            // we need copy back our preserved data into our dereferenced schema.
                            if (derefOptions?.preservedProperties) {
                                if (preserved.size && typeof obj[key] === "object" && !Array.isArray(obj[key])) {
                                    preserved.forEach((value, prop) => {
                                        obj[key][prop] = value;
                                    });
                                }
                            }
                            derefOptions?.onDereference?.(value.$ref, obj[key], obj, key);
                        }
                    }
                    else {
                        if (!parents.has(value)) {
                            dereferenced = crawl(value, keyPath, keyPathFromRoot, parents, processedObjects, dereferencedCache, $refs, options, startTime);
                            circular = dereferenced.circular;
                            // Avoid pointless mutations; breaks frozen objects to no profit
                            if (obj[key] !== dereferenced.value) {
                                obj[key] = dereferenced.value;
                            }
                        }
                        else {
                            circular = foundCircularReference(keyPath, $refs, options);
                        }
                    }
                    // Set the "isCircular" flag if this or any other property is circular
                    result.circular = result.circular || circular;
                }
            }
            parents.delete(obj);
        }
    }
    return result;
}
/**
 * Dereferences the given JSON Reference, and then crawls the resulting value.
 *
 * @param $ref - The JSON Reference to resolve
 * @param path - The full path of `$ref`, possibly with a JSON Pointer in the hash
 * @param pathFromRoot - The path of `$ref` from the schema root
 * @param parents - An array of the parent objects that have already been dereferenced
 * @param processedObjects - An array of all the objects that have already been dereferenced
 * @param dereferencedCache - An map of all the dereferenced objects
 * @param $refs
 * @param options
 * @returns
 */
function dereference$Ref($ref, path, pathFromRoot, parents, processedObjects, dereferencedCache, $refs, options, startTime) {
    const isExternalRef = _ref_js__WEBPACK_IMPORTED_MODULE_0__["default"].isExternal$Ref($ref);
    const shouldResolveOnCwd = isExternalRef && options?.dereference?.externalReferenceResolution === "root";
    const $refPath = _util_url_js__WEBPACK_IMPORTED_MODULE_2__.resolve(shouldResolveOnCwd ? _util_url_js__WEBPACK_IMPORTED_MODULE_2__.cwd() : path, $ref.$ref);
    const cache = dereferencedCache.get($refPath);
    if (cache) {
        // If the object we found is circular we can immediately return it because it would have been
        // cached with everything we need already and we don't need to re-process anything inside it.
        //
        // If the cached object however is _not_ circular and there are additional keys alongside our
        // `$ref` pointer here we should merge them back in and return that.
        if (!cache.circular) {
            const refKeys = Object.keys($ref);
            if (refKeys.length > 1) {
                const extraKeys = {};
                for (const key of refKeys) {
                    if (key !== "$ref" && !(key in cache.value)) {
                        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                        extraKeys[key] = $ref[key];
                    }
                }
                return {
                    circular: cache.circular,
                    value: Object.assign({}, cache.value, extraKeys),
                };
            }
            return cache;
        }
        // If both our cached value and our incoming `$ref` are the same then we can return what we
        // got out of the cache, otherwise we should re-process this value. We need to do this because
        // the current dereference caching mechanism doesn't take into account that `$ref` are neither
        // unique or reference the same file.
        //
        // For example if `schema.yaml` references `definitions/child.yaml` and
        // `definitions/parent.yaml` references `child.yaml` then `$ref: 'child.yaml'` may get cached
        // for `definitions/child.yaml`, resulting in `schema.yaml` being having an invalid reference
        // to `child.yaml`.
        //
        // This check is not perfect and the design of the dereference caching mechanism needs a total
        // overhaul.
        if (typeof cache.value === "object" && "$ref" in cache.value && "$ref" in $ref) {
            if (cache.value.$ref === $ref.$ref) {
                // Fire onCircular for cached circular refs so callers are notified of every occurrence
                foundCircularReference(path, $refs, options);
                return cache;
            }
            else {
                // no-op - fall through to re-process (handles external ref edge case)
            }
        }
        else {
            foundCircularReference(path, $refs, options);
            return cache;
        }
    }
    const pointer = $refs._resolve($refPath, path, options);
    if (pointer === null) {
        return {
            circular: false,
            value: null,
        };
    }
    // Check for circular references
    const directCircular = pointer.circular;
    let circular = directCircular || parents.has(pointer.value);
    if (circular) {
        foundCircularReference(path, $refs, options);
    }
    // Dereference the JSON reference
    let dereferencedValue = _ref_js__WEBPACK_IMPORTED_MODULE_0__["default"].dereference($ref, pointer.value, options);
    // Crawl the dereferenced value (unless it's circular)
    if (!circular) {
        // Determine if the dereferenced value is circular
        const dereferenced = crawl(dereferencedValue, pointer.path, pathFromRoot, parents, processedObjects, dereferencedCache, $refs, options, startTime);
        circular = dereferenced.circular;
        dereferencedValue = dereferenced.value;
    }
    if (circular && !directCircular && options.dereference?.circular === "ignore") {
        // The user has chosen to "ignore" circular references, so don't change the value
        dereferencedValue = $ref;
    }
    if (directCircular) {
        // The pointer is a DIRECT circular reference (i.e. it references itself).
        // So replace the $ref path with the absolute path from the JSON Schema root
        dereferencedValue.$ref = pathFromRoot;
    }
    const dereferencedObject = {
        circular,
        value: dereferencedValue,
    };
    // only cache if no extra properties than $ref
    if (Object.keys($ref).length === 1) {
        dereferencedCache.set($refPath, dereferencedObject);
    }
    return dereferencedObject;
}
/**
 * Check if we've run past our allowed timeout and throw an error if we have.
 *
 * @param startTime - The time when the dereferencing started.
 * @param options
 */
function checkDereferenceTimeout(startTime, options) {
    if (options && options.timeoutMs) {
        if (Date.now() - startTime > options.timeoutMs) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.TimeoutError(options.timeoutMs);
        }
    }
}
/**
 * Called when a circular reference is found.
 * It sets the {@link $Refs#circular} flag, executes the options.dereference.onCircular callback,
 * and throws an error if options.dereference.circular is false.
 *
 * @param keyPath - The JSON Reference path of the circular reference
 * @param $refs
 * @param options
 * @returns - always returns true, to indicate that a circular reference was found
 */
function foundCircularReference(keyPath, $refs, options) {
    $refs.circular = true;
    options?.dereference?.onCircular?.(keyPath);
    if (!options.dereference.circular) {
        const error = new ReferenceError(`Circular $ref pointer found at ${keyPath}`);
        throw error;
    }
    return true;
}


/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/index.js"
/*!****************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/index.js ***!
  \****************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   $RefParser: () => (/* binding */ $RefParser),
/* harmony export */   $Refs: () => (/* reexport safe */ _refs_js__WEBPACK_IMPORTED_MODULE_0__["default"]),
/* harmony export */   FileResolver: () => (/* reexport safe */ _resolvers_file_js__WEBPACK_IMPORTED_MODULE_7__["default"]),
/* harmony export */   HTTPResolver: () => (/* reexport safe */ _resolvers_http_js__WEBPACK_IMPORTED_MODULE_8__["default"]),
/* harmony export */   InvalidPointerError: () => (/* reexport safe */ _util_errors_js__WEBPACK_IMPORTED_MODULE_9__.InvalidPointerError),
/* harmony export */   JSONParserError: () => (/* reexport safe */ _util_errors_js__WEBPACK_IMPORTED_MODULE_9__.JSONParserError),
/* harmony export */   JSONParserErrorGroup: () => (/* reexport safe */ _util_errors_js__WEBPACK_IMPORTED_MODULE_9__.JSONParserErrorGroup),
/* harmony export */   MissingPointerError: () => (/* reexport safe */ _util_errors_js__WEBPACK_IMPORTED_MODULE_9__.MissingPointerError),
/* harmony export */   ParserError: () => (/* reexport safe */ _util_errors_js__WEBPACK_IMPORTED_MODULE_9__.ParserError),
/* harmony export */   ResolverError: () => (/* reexport safe */ _util_errors_js__WEBPACK_IMPORTED_MODULE_9__.ResolverError),
/* harmony export */   UnmatchedParserError: () => (/* reexport safe */ _util_errors_js__WEBPACK_IMPORTED_MODULE_9__.UnmatchedParserError),
/* harmony export */   UnmatchedResolverError: () => (/* reexport safe */ _util_errors_js__WEBPACK_IMPORTED_MODULE_9__.UnmatchedResolverError),
/* harmony export */   bundle: () => (/* binding */ bundle),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   dereference: () => (/* binding */ dereference),
/* harmony export */   dereferenceInternal: () => (/* reexport safe */ _dereference_js__WEBPACK_IMPORTED_MODULE_5__["default"]),
/* harmony export */   getJsonSchemaRefParserDefaultOptions: () => (/* reexport safe */ _options_js__WEBPACK_IMPORTED_MODULE_11__.getJsonSchemaRefParserDefaultOptions),
/* harmony export */   isHandledError: () => (/* reexport safe */ _util_errors_js__WEBPACK_IMPORTED_MODULE_9__.isHandledError),
/* harmony export */   isUnsafeUrl: () => (/* reexport safe */ _util_url_js__WEBPACK_IMPORTED_MODULE_6__.isUnsafeUrl),
/* harmony export */   jsonSchemaParserNormalizeArgs: () => (/* reexport safe */ _normalize_args_js__WEBPACK_IMPORTED_MODULE_2__["default"]),
/* harmony export */   parse: () => (/* binding */ parse),
/* harmony export */   resolve: () => (/* binding */ resolve)
/* harmony export */ });
/* harmony import */ var _refs_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./refs.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/refs.js");
/* harmony import */ var _parse_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./parse.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/parse.js");
/* harmony import */ var _normalize_args_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./normalize-args.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/normalize-args.js");
/* harmony import */ var _resolve_external_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./resolve-external.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/resolve-external.js");
/* harmony import */ var _bundle_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./bundle.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/bundle.js");
/* harmony import */ var _dereference_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./dereference.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/dereference.js");
/* harmony import */ var _util_url_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./util/url.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/url.js");
/* harmony import */ var _resolvers_file_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./resolvers/file.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/resolvers/file.js");
/* harmony import */ var _resolvers_http_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./resolvers/http.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/resolvers/http.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./util/errors.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/errors.js");
/* harmony import */ var _util_maybe_js__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./util/maybe.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/maybe.js");
/* harmony import */ var _options_js__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./options.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/options.js");
/* provided dependency */ var Buffer = __webpack_require__(/*! buffer */ "./node_modules/buffer/index.js")["Buffer"];













/**
 * This class parses a JSON schema, builds a map of its JSON references and their resolved values,
 * and provides methods for traversing, manipulating, and dereferencing those references.
 *
 * @class
 */
class $RefParser {
    /**
     * The parsed (and possibly dereferenced) JSON schema object
     *
     * @type {object}
     * @readonly
     */
    schema = null;
    /**
     * The resolved JSON references
     *
     * @type {$Refs}
     * @readonly
     */
    $refs = new _refs_js__WEBPACK_IMPORTED_MODULE_0__["default"]();
    async parse() {
        const args = (0,_normalize_args_js__WEBPACK_IMPORTED_MODULE_2__["default"])(arguments);
        let promise;
        if (!args.path && !args.schema) {
            const err = new Error(`Expected a file path, URL, or object. Got ${args.path || args.schema}`);
            return (0,_util_maybe_js__WEBPACK_IMPORTED_MODULE_10__["default"])(args.callback, Promise.reject(err));
        }
        // Reset everything
        this.schema = null;
        this.$refs = new _refs_js__WEBPACK_IMPORTED_MODULE_0__["default"]();
        // If the path is a filesystem path, then convert it to a URL.
        // NOTE: According to the JSON Reference spec, these should already be URLs,
        // but, in practice, many people use local filesystem paths instead.
        // So we're being generous here and doing the conversion automatically.
        // This is not intended to be a 100% bulletproof solution.
        // If it doesn't work for your use-case, then use a URL instead.
        let pathType = "http";
        if (_util_url_js__WEBPACK_IMPORTED_MODULE_6__.isFileSystemPath(args.path)) {
            args.path = _util_url_js__WEBPACK_IMPORTED_MODULE_6__.fromFileSystemPath(args.path);
            pathType = "file";
        }
        else if (!args.path && args.schema && "$id" in args.schema && args.schema.$id) {
            // when schema id has defined an URL should use that hostname to request the references,
            // instead of using the current page URL
            const params = _util_url_js__WEBPACK_IMPORTED_MODULE_6__.parse(args.schema.$id);
            const port = params.port ?? (params.protocol === "https:" ? 443 : 80);
            args.path = `${params.protocol}//${params.hostname}:${port}`;
        }
        // Resolve the absolute path of the schema
        args.path = _util_url_js__WEBPACK_IMPORTED_MODULE_6__.resolve(_util_url_js__WEBPACK_IMPORTED_MODULE_6__.cwd(), args.path);
        if (args.schema && typeof args.schema === "object") {
            // A schema object was passed-in.
            // So immediately add a new $Ref with the schema object as its value
            const $ref = this.$refs._add(args.path);
            $ref.value = args.schema;
            $ref.pathType = pathType;
            promise = Promise.resolve(args.schema);
        }
        else {
            // Parse the schema file/url
            promise = (0,_parse_js__WEBPACK_IMPORTED_MODULE_1__["default"])(args.path, this.$refs, args.options);
        }
        try {
            const result = await promise;
            if (result !== null && typeof result === "object" && !Buffer.isBuffer(result)) {
                this.schema = result;
                return (0,_util_maybe_js__WEBPACK_IMPORTED_MODULE_10__["default"])(args.callback, Promise.resolve(this.schema));
            }
            else if (args.options.continueOnError) {
                this.schema = null; // it's already set to null at line 79, but let's set it again for the sake of readability
                return (0,_util_maybe_js__WEBPACK_IMPORTED_MODULE_10__["default"])(args.callback, Promise.resolve(this.schema));
            }
            else {
                throw new SyntaxError(`"${this.$refs._root$Ref.path || result}" is not a valid JSON Schema`);
            }
        }
        catch (err) {
            if (!args.options.continueOnError || !(0,_util_errors_js__WEBPACK_IMPORTED_MODULE_9__.isHandledError)(err)) {
                return (0,_util_maybe_js__WEBPACK_IMPORTED_MODULE_10__["default"])(args.callback, Promise.reject(err));
            }
            if (this.$refs._$refs[_util_url_js__WEBPACK_IMPORTED_MODULE_6__.stripHash(args.path)]) {
                this.$refs._$refs[_util_url_js__WEBPACK_IMPORTED_MODULE_6__.stripHash(args.path)].addError(err);
            }
            return (0,_util_maybe_js__WEBPACK_IMPORTED_MODULE_10__["default"])(args.callback, Promise.resolve(null));
        }
    }
    static parse() {
        const parser = new $RefParser();
        return parser.parse.apply(parser, arguments);
    }
    async resolve() {
        const args = (0,_normalize_args_js__WEBPACK_IMPORTED_MODULE_2__["default"])(arguments);
        try {
            await this.parse(args.path, args.schema, args.options);
            await (0,_resolve_external_js__WEBPACK_IMPORTED_MODULE_3__["default"])(this, args.options);
            finalize(this);
            return (0,_util_maybe_js__WEBPACK_IMPORTED_MODULE_10__["default"])(args.callback, Promise.resolve(this.$refs));
        }
        catch (err) {
            return (0,_util_maybe_js__WEBPACK_IMPORTED_MODULE_10__["default"])(args.callback, Promise.reject(err));
        }
    }
    static resolve() {
        const instance = new $RefParser();
        return instance.resolve.apply(instance, arguments);
    }
    static bundle() {
        const instance = new $RefParser();
        return instance.bundle.apply(instance, arguments);
    }
    async bundle() {
        const args = (0,_normalize_args_js__WEBPACK_IMPORTED_MODULE_2__["default"])(arguments);
        try {
            await this.resolve(args.path, args.schema, args.options);
            (0,_bundle_js__WEBPACK_IMPORTED_MODULE_4__["default"])(this, args.options);
            finalize(this);
            return (0,_util_maybe_js__WEBPACK_IMPORTED_MODULE_10__["default"])(args.callback, Promise.resolve(this.schema));
        }
        catch (err) {
            return (0,_util_maybe_js__WEBPACK_IMPORTED_MODULE_10__["default"])(args.callback, Promise.reject(err));
        }
    }
    static dereference() {
        const instance = new $RefParser();
        return instance.dereference.apply(instance, arguments);
    }
    async dereference() {
        const args = (0,_normalize_args_js__WEBPACK_IMPORTED_MODULE_2__["default"])(arguments);
        try {
            await this.resolve(args.path, args.schema, args.options);
            (0,_dereference_js__WEBPACK_IMPORTED_MODULE_5__["default"])(this, args.options);
            finalize(this);
            return (0,_util_maybe_js__WEBPACK_IMPORTED_MODULE_10__["default"])(args.callback, Promise.resolve(this.schema));
        }
        catch (err) {
            return (0,_util_maybe_js__WEBPACK_IMPORTED_MODULE_10__["default"])(args.callback, Promise.reject(err));
        }
    }
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ($RefParser);
function finalize(parser) {
    const errors = _util_errors_js__WEBPACK_IMPORTED_MODULE_9__.JSONParserErrorGroup.getParserErrors(parser);
    if (errors.length > 0) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_9__.JSONParserErrorGroup(parser);
    }
}
const parse = $RefParser.parse;
const resolve = $RefParser.resolve;
const bundle = $RefParser.bundle;
const dereference = $RefParser.dereference;



/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/normalize-args.js"
/*!*************************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/normalize-args.js ***!
  \*************************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   normalizeArgs: () => (/* binding */ normalizeArgs)
/* harmony export */ });
/* harmony import */ var _options_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./options.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/options.js");

/**
 * Normalizes the given arguments, accounting for optional args.
 */
function normalizeArgs(_args) {
    let path;
    let schema;
    let options;
    let callback;
    const args = Array.prototype.slice.call(_args);
    if (typeof args[args.length - 1] === "function") {
        // The last parameter is a callback function
        callback = args.pop();
    }
    if (typeof args[0] === "string") {
        // The first parameter is the path
        path = args[0];
        if (typeof args[2] === "object") {
            // The second parameter is the schema, and the third parameter is the options
            schema = args[1];
            options = args[2];
        }
        else {
            // The second parameter is the options
            schema = undefined;
            options = args[1];
        }
    }
    else {
        // The first parameter is the schema
        path = "";
        schema = args[0];
        options = args[1];
    }
    try {
        options = (0,_options_js__WEBPACK_IMPORTED_MODULE_0__.getNewOptions)(options);
    }
    catch (e) {
        console.error(`JSON Schema Ref Parser: Error normalizing options: ${e}`);
    }
    if (!options.mutateInputSchema && typeof schema === "object") {
        // Make a deep clone of the schema, so that we don't alter the original object
        schema = JSON.parse(JSON.stringify(schema));
    }
    return {
        path,
        schema,
        options,
        callback,
    };
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (normalizeArgs);


/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/options.js"
/*!******************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/options.js ***!
  \******************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getJsonSchemaRefParserDefaultOptions: () => (/* binding */ getJsonSchemaRefParserDefaultOptions),
/* harmony export */   getNewOptions: () => (/* binding */ getNewOptions)
/* harmony export */ });
/* harmony import */ var _parsers_json_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./parsers/json.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/parsers/json.js");
/* harmony import */ var _parsers_yaml_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./parsers/yaml.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/parsers/yaml.js");
/* harmony import */ var _parsers_text_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./parsers/text.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/parsers/text.js");
/* harmony import */ var _parsers_binary_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./parsers/binary.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/parsers/binary.js");
/* harmony import */ var _resolvers_file_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./resolvers/file.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/resolvers/file.js");
/* harmony import */ var _resolvers_http_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./resolvers/http.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/resolvers/http.js");






const getJsonSchemaRefParserDefaultOptions = () => {
    const defaults = {
        /**
         * Determines how different types of files will be parsed.
         *
         * You can add additional parsers of your own, replace an existing one with
         * your own implementation, or disable any parser by setting it to false.
         */
        parse: {
            json: { ..._parsers_json_js__WEBPACK_IMPORTED_MODULE_0__["default"] },
            yaml: { ..._parsers_yaml_js__WEBPACK_IMPORTED_MODULE_1__["default"] },
            text: { ..._parsers_text_js__WEBPACK_IMPORTED_MODULE_2__["default"] },
            binary: { ..._parsers_binary_js__WEBPACK_IMPORTED_MODULE_3__["default"] },
        },
        /**
         * Determines how JSON References will be resolved.
         *
         * You can add additional resolvers of your own, replace an existing one with
         * your own implementation, or disable any resolver by setting it to false.
         */
        resolve: {
            file: { ..._resolvers_file_js__WEBPACK_IMPORTED_MODULE_4__["default"] },
            http: { ..._resolvers_http_js__WEBPACK_IMPORTED_MODULE_5__["default"] },
            /**
             * Determines whether external $ref pointers will be resolved.
             * If this option is disabled, then none of above resolvers will be called.
             * Instead, external $ref pointers will simply be ignored.
             *
             * @type {boolean}
             */
            external: true,
        },
        /**
         * By default, JSON Schema $Ref Parser throws the first error it encounters. Setting `continueOnError` to `true`
         * causes it to keep processing as much as possible and then throw a single error that contains all errors
         * that were encountered.
         */
        continueOnError: false,
        /**
         * Determines the types of JSON references that are allowed.
         */
        bundle: {
            /**
             * A function, called for each path, which can return true to stop this path and all
             * subpaths from being processed further. This is useful in schemas where some
             * subpaths contain literal $ref keys that should not be changed.
             *
             * @type {function}
             */
            excludedPathMatcher: () => false,
        },
        /**
         * Determines the types of JSON references that are allowed.
         */
        dereference: {
            /**
             * Dereference circular (recursive) JSON references?
             * If false, then a {@link ReferenceError} will be thrown if a circular reference is found.
             * If "ignore", then circular references will not be dereferenced.
             *
             * @type {boolean|string}
             */
            circular: true,
            /**
             * A function, called for each path, which can return true to stop this path and all
             * subpaths from being dereferenced further. This is useful in schemas where some
             * subpaths contain literal $ref keys that should not be dereferenced.
             *
             * @type {function}
             */
            excludedPathMatcher: () => false,
            referenceResolution: "relative",
            mergeKeys: true,
        },
        mutateInputSchema: true,
    };
    return defaults;
};
const getNewOptions = (options) => {
    const newOptions = getJsonSchemaRefParserDefaultOptions();
    if (options) {
        merge(newOptions, options);
    }
    return newOptions;
};
/**
 * Merges the properties of the source object into the target object.
 *
 * @param target - The object that we're populating
 * @param source - The options that are being merged
 * @returns
 */
function merge(target, source) {
    if (isMergeable(source)) {
        // prevent prototype pollution
        const keys = Object.keys(source).filter((key) => !["__proto__", "constructor", "prototype"].includes(key));
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const sourceSetting = source[key];
            const targetSetting = target[key];
            if (isMergeable(sourceSetting)) {
                // It's a nested object, so merge it recursively
                target[key] = merge(targetSetting || {}, sourceSetting);
            }
            else if (sourceSetting !== undefined) {
                // It's a scalar value, function, or array. No merging necessary. Just overwrite the target value.
                target[key] = sourceSetting;
            }
        }
    }
    return target;
}
/**
 * Determines whether the given value can be merged,
 * or if it is a scalar value that should just override the target value.
 *
 * @param val
 * @returns
 */
function isMergeable(val) {
    return val && typeof val === "object" && !Array.isArray(val) && !(val instanceof RegExp) && !(val instanceof Date);
}


/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/parse.js"
/*!****************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/parse.js ***!
  \****************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_url_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./util/url.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/url.js");
/* harmony import */ var _util_plugins_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./util/plugins.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/plugins.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./util/errors.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/errors.js");
/* provided dependency */ var Buffer = __webpack_require__(/*! buffer */ "./node_modules/buffer/index.js")["Buffer"];



/**
 * Reads and parses the specified file path or URL.
 */
async function parse(path, $refs, options) {
    // Remove the URL fragment, if any
    const hashIndex = path.indexOf("#");
    let hash = "";
    if (hashIndex >= 0) {
        hash = path.substring(hashIndex);
        // Remove the URL fragment, if any
        path = path.substring(0, hashIndex);
    }
    // Add a new $Ref for this file, even though we don't have the value yet.
    // This ensures that we don't simultaneously read & parse the same file multiple times
    const $ref = $refs._add(path);
    // This "file object" will be passed to all resolvers and parsers.
    const file = {
        url: path,
        hash,
        extension: _util_url_js__WEBPACK_IMPORTED_MODULE_0__.getExtension(path),
    };
    // Read the file and then parse the data
    try {
        const resolver = await readFile(file, options, $refs);
        $ref.pathType = resolver.plugin.name;
        file.data = resolver.result;
        const parser = await parseFile(file, options, $refs);
        $ref.value = parser.result;
        return parser.result;
    }
    catch (err) {
        if ((0,_util_errors_js__WEBPACK_IMPORTED_MODULE_2__.isHandledError)(err)) {
            $ref.value = err;
        }
        throw err;
    }
}
/**
 * Reads the given file, using the configured resolver plugins
 *
 * @param file           - An object containing information about the referenced file
 * @param file.url       - The full URL of the referenced file
 * @param file.extension - The lowercased file extension (e.g. ".txt", ".html", etc.)
 * @param options
 * @param $refs
 * @returns
 * The promise resolves with the raw file contents and the resolver that was used.
 */
async function readFile(file, options, $refs) {
    // console.log('Reading %s', file.url);
    // Find the resolvers that can read this file
    let resolvers = (0,_util_plugins_js__WEBPACK_IMPORTED_MODULE_1__.all)(options.resolve);
    resolvers = (0,_util_plugins_js__WEBPACK_IMPORTED_MODULE_1__.filter)(resolvers, "canRead", file, undefined, $refs);
    // Run the resolvers, in order, until one of them succeeds
    (0,_util_plugins_js__WEBPACK_IMPORTED_MODULE_1__.sort)(resolvers);
    try {
        const data = await (0,_util_plugins_js__WEBPACK_IMPORTED_MODULE_1__.run)(resolvers, "read", file, $refs);
        return data;
    }
    catch (err) {
        if (!err && options.continueOnError) {
            // No resolver could be matched
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.UnmatchedResolverError(file.url);
        }
        else if (!err || !("error" in err)) {
            // Throw a generic, friendly error.
            throw new SyntaxError(`Unable to resolve $ref pointer "${file.url}"`);
        }
        // Throw the original error, if it's one of our own (user-friendly) errors.
        else if (err.error instanceof _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.ResolverError) {
            throw err.error;
        }
        else {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.ResolverError(err, file.url);
        }
    }
}
/**
 * Parses the given file's contents, using the configured parser plugins.
 *
 * @param file           - An object containing information about the referenced file
 * @param file.url       - The full URL of the referenced file
 * @param file.extension - The lowercased file extension (e.g. ".txt", ".html", etc.)
 * @param file.data      - The file contents. This will be whatever data type was returned by the resolver
 * @param options
 * @param $refs
 *
 * @returns
 * The promise resolves with the parsed file contents and the parser that was used.
 */
async function parseFile(file, options, $refs) {
    // Find the parsers that can read this file type.
    // If none of the parsers are an exact match for this file, then we'll try ALL of them.
    // This handles situations where the file IS a supported type, just with an unknown extension.
    const allParsers = (0,_util_plugins_js__WEBPACK_IMPORTED_MODULE_1__.all)(options.parse);
    const filteredParsers = (0,_util_plugins_js__WEBPACK_IMPORTED_MODULE_1__.filter)(allParsers, "canParse", file);
    const parsers = filteredParsers.length > 0 ? filteredParsers : allParsers;
    // Run the parsers, in order, until one of them succeeds
    (0,_util_plugins_js__WEBPACK_IMPORTED_MODULE_1__.sort)(parsers);
    try {
        const parser = await (0,_util_plugins_js__WEBPACK_IMPORTED_MODULE_1__.run)(parsers, "parse", file, $refs);
        if (!parser.plugin.allowEmpty && isEmpty(parser.result)) {
            throw new SyntaxError(`Error parsing "${file.url}" as ${parser.plugin.name}. \nParsed value is empty`);
        }
        else {
            return parser;
        }
    }
    catch (err) {
        if (!err && options.continueOnError) {
            // No resolver could be matched
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.UnmatchedParserError(file.url);
        }
        else if (err && err.message && err.message.startsWith("Error parsing")) {
            throw err;
        }
        else if (!err || !("error" in err)) {
            throw new SyntaxError(`Unable to parse ${file.url}`);
        }
        else if (err.error instanceof _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.ParserError) {
            throw err.error;
        }
        else {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.ParserError(err.error.message, file.url);
        }
    }
}
/**
 * Determines whether the parsed value is "empty".
 *
 * @param value
 * @returns
 */
function isEmpty(value) {
    return (value === undefined ||
        (typeof value === "object" && Object.keys(value).length === 0) ||
        (typeof value === "string" && value.trim().length === 0) ||
        (Buffer.isBuffer(value) && value.length === 0));
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (parse);


/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/parsers/binary.js"
/*!*************************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/parsers/binary.js ***!
  \*************************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* provided dependency */ var Buffer = __webpack_require__(/*! buffer */ "./node_modules/buffer/index.js")["Buffer"];
const BINARY_REGEXP = /\.(jpeg|jpg|gif|png|bmp|ico)$/i;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({
    /**
     * The order that this parser will run, in relation to other parsers.
     */
    order: 400,
    /**
     * Whether to allow "empty" files (zero bytes).
     */
    allowEmpty: true,
    /**
     * Determines whether this parser can parse a given file reference.
     * Parsers that return true will be tried, in order, until one successfully parses the file.
     * Parsers that return false will be skipped, UNLESS all parsers returned false, in which case
     * every parser will be tried.
     */
    canParse(file) {
        // Use this parser if the file is a Buffer, and has a known binary extension
        return Buffer.isBuffer(file.data) && BINARY_REGEXP.test(file.url);
    },
    /**
     * Parses the given data as a Buffer (byte array).
     */
    parse(file) {
        if (Buffer.isBuffer(file.data)) {
            return file.data;
        }
        else {
            // This will reject if data is anything other than a string or typed array
            return Buffer.from(file.data);
        }
    },
});


/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/parsers/json.js"
/*!***********************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/parsers/json.js ***!
  \***********************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../util/errors.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/errors.js");
/* provided dependency */ var Buffer = __webpack_require__(/*! buffer */ "./node_modules/buffer/index.js")["Buffer"];

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({
    /**
     * The order that this parser will run, in relation to other parsers.
     */
    order: 100,
    /**
     * Whether to allow "empty" files. This includes zero-byte files, as well as empty JSON objects.
     */
    allowEmpty: true,
    /**
     * Determines whether this parser can parse a given file reference.
     * Parsers that match will be tried, in order, until one successfully parses the file.
     * Parsers that don't match will be skipped, UNLESS none of the parsers match, in which case
     * every parser will be tried.
     */
    canParse: ".json",
    /**
     * Allow JSON files with byte order marks (BOM)
     */
    allowBOM: true,
    /**
     * Parses the given file as JSON
     */
    async parse(file) {
        let data = file.data;
        if (Buffer.isBuffer(data)) {
            data = data.toString();
        }
        if (typeof data === "string") {
            if (data.trim().length === 0) {
                return; // This mirrors the YAML behavior
            }
            else {
                try {
                    return JSON.parse(data);
                }
                catch (e) {
                    if (this.allowBOM) {
                        try {
                            // find the first curly brace
                            const firstCurlyBrace = data.indexOf("{");
                            // remove any characters before the first curly brace
                            data = data.slice(firstCurlyBrace);
                            return JSON.parse(data);
                        }
                        catch (e) {
                            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.ParserError(e.message, file.url);
                        }
                    }
                    throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.ParserError(e.message, file.url);
                }
            }
        }
        else {
            // data is already a JavaScript value (object, array, number, null, NaN, etc.)
            return data;
        }
    },
});


/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/parsers/text.js"
/*!***********************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/parsers/text.js ***!
  \***********************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../util/errors.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/errors.js");
/* provided dependency */ var Buffer = __webpack_require__(/*! buffer */ "./node_modules/buffer/index.js")["Buffer"];

const TEXT_REGEXP = /\.(txt|htm|html|md|xml|js|min|map|css|scss|less|svg)$/i;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({
    /**
     * The order that this parser will run, in relation to other parsers.
     */
    order: 300,
    /**
     * Whether to allow "empty" files (zero bytes).
     */
    allowEmpty: true,
    /**
     * The encoding that the text is expected to be in.
     */
    encoding: "utf8",
    /**
     * Determines whether this parser can parse a given file reference.
     * Parsers that return true will be tried, in order, until one successfully parses the file.
     * Parsers that return false will be skipped, UNLESS all parsers returned false, in which case
     * every parser will be tried.
     */
    canParse(file) {
        // Use this parser if the file is a string or Buffer, and has a known text-based extension
        return (typeof file.data === "string" || Buffer.isBuffer(file.data)) && TEXT_REGEXP.test(file.url);
    },
    /**
     * Parses the given file as text
     */
    parse(file) {
        if (typeof file.data === "string") {
            return file.data;
        }
        else if (Buffer.isBuffer(file.data)) {
            return file.data.toString(this.encoding);
        }
        else {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.ParserError("data is not text", file.url);
        }
    },
});


/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/parsers/yaml.js"
/*!***********************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/parsers/yaml.js ***!
  \***********************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../util/errors.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/errors.js");
/* harmony import */ var js_yaml__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! js-yaml */ "./node_modules/js-yaml/dist/js-yaml.mjs");
/* provided dependency */ var Buffer = __webpack_require__(/*! buffer */ "./node_modules/buffer/index.js")["Buffer"];



/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({
    /**
     * The order that this parser will run, in relation to other parsers.
     */
    order: 200,
    /**
     * Whether to allow "empty" files. This includes zero-byte files, as well as empty JSON objects.
     */
    allowEmpty: true,
    /**
     * Determines whether this parser can parse a given file reference.
     * Parsers that match will be tried, in order, until one successfully parses the file.
     * Parsers that don't match will be skipped, UNLESS none of the parsers match, in which case
     * every parser will be tried.
     */
    canParse: [".yaml", ".yml", ".json"], // JSON is valid YAML
    /**
     * Parses the given file as YAML
     *
     * @param file           - An object containing information about the referenced file
     * @param file.url       - The full URL of the referenced file
     * @param file.extension - The lowercased file extension (e.g. ".txt", ".html", etc.)
     * @param file.data      - The file contents. This will be whatever data type was returned by the resolver
     * @returns
     */
    async parse(file) {
        let data = file.data;
        if (Buffer.isBuffer(data)) {
            data = data.toString();
        }
        if (typeof data === "string") {
            try {
                return js_yaml__WEBPACK_IMPORTED_MODULE_1__["default"].load(data, { schema: js_yaml__WEBPACK_IMPORTED_MODULE_1__.JSON_SCHEMA });
            }
            catch {
                try {
                    // fallback to non JSON_SCHEMA
                    return js_yaml__WEBPACK_IMPORTED_MODULE_1__["default"].load(data);
                }
                catch (e) {
                    throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.ParserError(e?.message || "Parser Error", file.url);
                }
            }
        }
        else {
            // data is already a JavaScript value (object, array, number, null, NaN, etc.)
            return data;
        }
    },
});


/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/pointer.js"
/*!******************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/pointer.js ***!
  \******************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   nullSymbol: () => (/* binding */ nullSymbol)
/* harmony export */ });
/* harmony import */ var _ref_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./ref.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/ref.js");
/* harmony import */ var _util_url_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./util/url.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/url.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./util/errors.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/errors.js");



const nullSymbol = Symbol("null");
const slashes = /\//g;
const tildes = /~/g;
const escapedSlash = /~1/g;
const escapedTilde = /~0/g;
/**
 * This class represents a single JSON pointer and its resolved value.
 *
 * @param $ref
 * @param path
 * @param [friendlyPath] - The original user-specified path (used for error messages)
 * @class
 */
class Pointer {
    /**
     * The {@link $Ref} object that contains this {@link Pointer} object.
     */
    $ref;
    /**
     * The file path or URL, containing the JSON pointer in the hash.
     * This path is relative to the path of the main JSON schema file.
     */
    path;
    /**
     * The original path or URL, used for error messages.
     */
    originalPath;
    /**
     * The value of the JSON pointer.
     * Can be any JSON type, not just objects. Unknown file types are represented as Buffers (byte arrays).
     */
    value;
    /**
     * Indicates whether the pointer references itself.
     */
    circular;
    /**
     * The number of indirect references that were traversed to resolve the value.
     * Resolving a single pointer may require resolving multiple $Refs.
     */
    indirections;
    constructor($ref, path, friendlyPath) {
        this.$ref = $ref;
        this.path = path;
        this.originalPath = friendlyPath || path;
        this.value = undefined;
        this.circular = false;
        this.indirections = 0;
    }
    /**
     * Resolves the value of a nested property within the given object.
     *
     * @param obj - The object that will be crawled
     * @param options
     * @param pathFromRoot - the path of place that initiated resolving
     *
     * @returns
     * Returns a JSON pointer whose {@link Pointer#value} is the resolved value.
     * If resolving this value required resolving other JSON references, then
     * the {@link Pointer#$ref} and {@link Pointer#path} will reflect the resolution path
     * of the resolved value.
     */
    resolve(obj, options, pathFromRoot) {
        const tokens = Pointer.parse(this.path, this.originalPath);
        const found = [];
        // Crawl the object, one token at a time
        this.value = unwrapOrThrow(obj);
        for (let i = 0; i < tokens.length; i++) {
            if (resolveIf$Ref(this, options, pathFromRoot)) {
                // The $ref path has changed, so append the remaining tokens to the path
                this.path = Pointer.join(this.path, tokens.slice(i));
            }
            const token = tokens[i];
            if (this.value[token] === undefined || (this.value[token] === null && i === tokens.length - 1)) {
                // one final case is if the entry itself includes slashes, and was parsed out as a token - we can join the remaining tokens and try again
                let didFindSubstringSlashMatch = false;
                for (let j = tokens.length - 1; j > i; j--) {
                    const joinedToken = tokens.slice(i, j + 1).join("/");
                    if (this.value[joinedToken] !== undefined) {
                        this.value = this.value[joinedToken];
                        i = j;
                        didFindSubstringSlashMatch = true;
                        break;
                    }
                }
                if (didFindSubstringSlashMatch) {
                    continue;
                }
                // If the token we're looking for ended up not containing any slashes but is
                // actually instead pointing to an existing `null` value then we should use that
                // `null` value.
                if (token in this.value && this.value[token] === null) {
                    // We use a `null` symbol for internal tracking to differentiate between a general `null`
                    // value and our expected `null` value.
                    this.value = nullSymbol;
                    continue;
                }
                this.value = null;
                const path = this.$ref.path || "";
                const targetRef = this.path.replace(path, "");
                const targetFound = Pointer.join("", found);
                const parentPath = pathFromRoot?.replace(path, "");
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.MissingPointerError(token, decodeURI(this.originalPath), targetRef, targetFound, parentPath);
            }
            else {
                this.value = this.value[token];
            }
            found.push(token);
        }
        // Resolve the final value
        if (!this.value || (this.value.$ref && _util_url_js__WEBPACK_IMPORTED_MODULE_1__.resolve(this.path, this.value.$ref) !== pathFromRoot)) {
            resolveIf$Ref(this, options, pathFromRoot);
        }
        return this;
    }
    /**
     * Sets the value of a nested property within the given object.
     *
     * @param obj - The object that will be crawled
     * @param value - the value to assign
     * @param options
     *
     * @returns
     * Returns the modified object, or an entirely new object if the entire object is overwritten.
     */
    set(obj, value, options) {
        const tokens = Pointer.parse(this.path);
        let token;
        if (tokens.length === 0) {
            // There are no tokens, replace the entire object with the new value
            this.value = value;
            return value;
        }
        // Crawl the object, one token at a time
        this.value = unwrapOrThrow(obj);
        for (let i = 0; i < tokens.length - 1; i++) {
            resolveIf$Ref(this, options);
            token = tokens[i];
            if (this.value && this.value[token] !== undefined) {
                // The token exists
                this.value = this.value[token];
            }
            else {
                // The token doesn't exist, so create it
                this.value = setValue(this, token, {});
            }
        }
        // Set the value of the final token
        resolveIf$Ref(this, options);
        token = tokens[tokens.length - 1];
        setValue(this, token, value);
        // Return the updated object
        return obj;
    }
    /**
     * Parses a JSON pointer (or a path containing a JSON pointer in the hash)
     * and returns an array of the pointer's tokens.
     * (e.g. "schema.json#/definitions/person/name" => ["definitions", "person", "name"])
     *
     * The pointer is parsed according to RFC 6901
     * {@link https://tools.ietf.org/html/rfc6901#section-3}
     *
     * @param path
     * @param [originalPath]
     * @returns
     */
    static parse(path, originalPath) {
        // Get the JSON pointer from the path's hash
        const pointer = _util_url_js__WEBPACK_IMPORTED_MODULE_1__.getHash(path).substring(1);
        // If there's no pointer, then there are no tokens,
        // so return an empty array
        if (!pointer) {
            return [];
        }
        // Split into an array
        const split = pointer.split("/");
        // Decode each part, according to RFC 6901
        for (let i = 0; i < split.length; i++) {
            split[i] = split[i].replace(escapedSlash, "/").replace(escapedTilde, "~");
        }
        if (split[0] !== "") {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.InvalidPointerError(pointer, originalPath === undefined ? path : originalPath);
        }
        return split.slice(1);
    }
    /**
     * Creates a JSON pointer path, by joining one or more tokens to a base path.
     *
     * @param base - The base path (e.g. "schema.json#/definitions/person")
     * @param tokens - The token(s) to append (e.g. ["name", "first"])
     * @returns
     */
    static join(base, tokens) {
        // Ensure that the base path contains a hash
        if (base.indexOf("#") === -1) {
            base += "#";
        }
        // Append each token to the base path
        tokens = Array.isArray(tokens) ? tokens : [tokens];
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            // Encode the token, according to RFC 6901
            // RFC 6901 only requires encoding ~ as ~0 and / as ~1
            // We do NOT use encodeURIComponent as it encodes characters like $ which should remain literal
            base += "/" + token.replace(tildes, "~0").replace(slashes, "~1");
        }
        return base;
    }
}
/**
 * If the given pointer's {@link Pointer#value} is a JSON reference,
 * then the reference is resolved and {@link Pointer#value} is replaced with the resolved value.
 * In addition, {@link Pointer#path} and {@link Pointer#$ref} are updated to reflect the
 * resolution path of the new value.
 *
 * @param pointer
 * @param options
 * @param [pathFromRoot] - the path of place that initiated resolving
 * @returns - Returns `true` if the resolution path changed
 */
function resolveIf$Ref(pointer, options, pathFromRoot) {
    // Is the value a JSON reference? (and allowed?)
    if (_ref_js__WEBPACK_IMPORTED_MODULE_0__["default"].isAllowed$Ref(pointer.value, options)) {
        const $refPath = _util_url_js__WEBPACK_IMPORTED_MODULE_1__.resolve(pointer.path, pointer.value.$ref);
        if ($refPath === pointer.path && !isRootPath(pathFromRoot)) {
            // The value is a reference to itself, so there's nothing to do.
            pointer.circular = true;
        }
        else {
            const resolved = pointer.$ref.$refs._resolve($refPath, pointer.path, options);
            if (resolved === null) {
                return false;
            }
            pointer.indirections += resolved.indirections + 1;
            if (_ref_js__WEBPACK_IMPORTED_MODULE_0__["default"].isExtended$Ref(pointer.value)) {
                // This JSON reference "extends" the resolved value, rather than simply pointing to it.
                // So the resolved path does NOT change.  Just the value does.
                pointer.value = _ref_js__WEBPACK_IMPORTED_MODULE_0__["default"].dereference(pointer.value, resolved.value, options);
                return false;
            }
            else {
                // Resolve the reference
                pointer.$ref = resolved.$ref;
                pointer.path = resolved.path;
                pointer.value = resolved.value;
            }
            return true;
        }
    }
    return undefined;
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Pointer);
/**
 * Sets the specified token value of the {@link Pointer#value}.
 *
 * The token is evaluated according to RFC 6901.
 * {@link https://tools.ietf.org/html/rfc6901#section-4}
 *
 * @param pointer - The JSON Pointer whose value will be modified
 * @param token - A JSON Pointer token that indicates how to modify `obj`
 * @param value - The value to assign
 * @returns - Returns the assigned value
 */
function setValue(pointer, token, value) {
    if (pointer.value && typeof pointer.value === "object") {
        if (token === "-" && Array.isArray(pointer.value)) {
            pointer.value.push(value);
        }
        else {
            pointer.value[token] = value;
        }
    }
    else {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JSONParserError(`Error assigning $ref pointer "${pointer.path}". \nCannot set "${token}" of a non-object.`);
    }
    return value;
}
function unwrapOrThrow(value) {
    if ((0,_util_errors_js__WEBPACK_IMPORTED_MODULE_2__.isHandledError)(value)) {
        throw value;
    }
    return value;
}
function isRootPath(pathFromRoot) {
    return typeof pathFromRoot == "string" && Pointer.parse(pathFromRoot).length == 0;
}


/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/ref.js"
/*!**************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/ref.js ***!
  \**************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _pointer_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./pointer.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/pointer.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./util/errors.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/errors.js");
/* harmony import */ var _util_url_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./util/url.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/url.js");



/**
 * This class represents a single JSON reference and its resolved value.
 *
 * @class
 */
class $Ref {
    /**
     * The file path or URL of the referenced file.
     * This path is relative to the path of the main JSON schema file.
     *
     * This path does NOT contain document fragments (JSON pointers). It always references an ENTIRE file.
     * Use methods such as {@link $Ref#get}, {@link $Ref#resolve}, and {@link $Ref#exists} to get
     * specific JSON pointers within the file.
     *
     * @type {string}
     */
    path;
    /**
     * The resolved value of the JSON reference.
     * Can be any JSON type, not just objects. Unknown file types are represented as Buffers (byte arrays).
     *
     * @type {?*}
     */
    value;
    /**
     * The {@link $Refs} object that contains this {@link $Ref} object.
     *
     * @type {$Refs}
     */
    $refs;
    /**
     * Indicates the type of {@link $Ref#path} (e.g. "file", "http", etc.)
     */
    pathType;
    /**
     * List of all errors. Undefined if no errors.
     */
    errors = [];
    constructor($refs) {
        this.$refs = $refs;
    }
    /**
     * Pushes an error to errors array.
     *
     * @param err - The error to be pushed
     * @returns
     */
    addError(err) {
        if (this.errors === undefined) {
            this.errors = [];
        }
        const existingErrors = this.errors.map(({ footprint }) => footprint);
        // the path has been almost certainly set at this point,
        // but just in case something went wrong, normalizeError injects path if necessary
        // moreover, certain errors might point at the same spot, so filter them out to reduce noise
        if ("errors" in err && Array.isArray(err.errors)) {
            this.errors.push(...err.errors.map(_util_errors_js__WEBPACK_IMPORTED_MODULE_1__.normalizeError).filter(({ footprint }) => !existingErrors.includes(footprint)));
        }
        else if (!("footprint" in err) || !existingErrors.includes(err.footprint)) {
            this.errors.push((0,_util_errors_js__WEBPACK_IMPORTED_MODULE_1__.normalizeError)(err));
        }
    }
    /**
     * Determines whether the given JSON reference exists within this {@link $Ref#value}.
     *
     * @param path - The full path being resolved, optionally with a JSON pointer in the hash
     * @param options
     * @returns
     */
    exists(path, options) {
        try {
            this.resolve(path, options);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Resolves the given JSON reference within this {@link $Ref#value} and returns the resolved value.
     *
     * @param path - The full path being resolved, optionally with a JSON pointer in the hash
     * @param options
     * @returns - Returns the resolved value
     */
    get(path, options) {
        return this.resolve(path, options)?.value;
    }
    /**
     * Resolves the given JSON reference within this {@link $Ref#value}.
     *
     * @param path - The full path being resolved, optionally with a JSON pointer in the hash
     * @param options
     * @param friendlyPath - The original user-specified path (used for error messages)
     * @param pathFromRoot - The path of `obj` from the schema root
     * @returns
     */
    resolve(path, options, friendlyPath, pathFromRoot) {
        const pointer = new _pointer_js__WEBPACK_IMPORTED_MODULE_0__["default"](this, path, friendlyPath);
        try {
            const resolved = pointer.resolve(this.value, options, pathFromRoot);
            if (resolved.value === _pointer_js__WEBPACK_IMPORTED_MODULE_0__.nullSymbol) {
                resolved.value = null;
            }
            return resolved;
        }
        catch (err) {
            if (!options || !options.continueOnError || !(0,_util_errors_js__WEBPACK_IMPORTED_MODULE_1__.isHandledError)(err)) {
                throw err;
            }
            if (err.path === null) {
                err.path = (0,_util_url_js__WEBPACK_IMPORTED_MODULE_2__.safePointerToPath)((0,_util_url_js__WEBPACK_IMPORTED_MODULE_2__.getHash)(pathFromRoot));
            }
            if (err instanceof _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.InvalidPointerError) {
                err.source = decodeURI((0,_util_url_js__WEBPACK_IMPORTED_MODULE_2__.stripHash)(pathFromRoot));
            }
            this.addError(err);
            return null;
        }
    }
    /**
     * Sets the value of a nested property within this {@link $Ref#value}.
     * If the property, or any of its parents don't exist, they will be created.
     *
     * @param path - The full path of the property to set, optionally with a JSON pointer in the hash
     * @param value - The value to assign
     */
    set(path, value) {
        const pointer = new _pointer_js__WEBPACK_IMPORTED_MODULE_0__["default"](this, path);
        this.value = pointer.set(this.value, value);
        if (this.value === _pointer_js__WEBPACK_IMPORTED_MODULE_0__.nullSymbol) {
            this.value = null;
        }
    }
    /**
     * Determines whether the given value is a JSON reference.
     *
     * @param value - The value to inspect
     * @returns
     */
    static is$Ref(value) {
        return (Boolean(value) &&
            typeof value === "object" &&
            value !== null &&
            "$ref" in value &&
            typeof value.$ref === "string" &&
            value.$ref.length > 0);
    }
    /**
     * Determines whether the given value is an external JSON reference.
     *
     * @param value - The value to inspect
     * @returns
     */
    static isExternal$Ref(value) {
        return $Ref.is$Ref(value) && value.$ref[0] !== "#";
    }
    /**
     * Determines whether the given value is a JSON reference, and whether it is allowed by the options.
     * For example, if it references an external file, then options.resolve.external must be true.
     *
     * @param value - The value to inspect
     * @param options
     * @returns
     */
    static isAllowed$Ref(value, options) {
        if (this.is$Ref(value)) {
            if (value.$ref.substring(0, 2) === "#/" || value.$ref === "#") {
                // It's a JSON Pointer reference, which is always allowed
                return true;
            }
            else if (value.$ref[0] !== "#" && (!options || options.resolve?.external)) {
                // It's an external reference, which is allowed by the options
                return true;
            }
        }
        return undefined;
    }
    /**
     * Determines whether the given value is a JSON reference that "extends" its resolved value.
     * That is, it has extra properties (in addition to "$ref"), so rather than simply pointing to
     * an existing value, this $ref actually creates a NEW value that is a shallow copy of the resolved
     * value, plus the extra properties.
     *
     * @example: {
       person: {
         properties: {
           firstName: { type: string }
           lastName: { type: string }
         }
       }
       employee: {
         properties: {
           $ref: #/person/properties
           salary: { type: number }
         }
       }
     }
     *  In this example, "employee" is an extended $ref, since it extends "person" with an additional
     *  property (salary).  The result is a NEW value that looks like this:
     *
     *  {
     *    properties: {
     *      firstName: { type: string }
     *      lastName: { type: string }
     *      salary: { type: number }
     *    }
     *  }
     *
     * @param value - The value to inspect
     * @returns
     */
    static isExtended$Ref(value) {
        return $Ref.is$Ref(value) && Object.keys(value).length > 1;
    }
    /**
     * Returns the resolved value of a JSON Reference.
     * If necessary, the resolved value is merged with the JSON Reference to create a new object
     *
     * @example: {
    person: {
      properties: {
        firstName: { type: string }
        lastName: { type: string }
      }
    }
    employee: {
      properties: {
        $ref: #/person/properties
        salary: { type: number }
      }
    }
    } When "person" and "employee" are merged, you end up with the following object:
     *
     *  {
     *    properties: {
     *      firstName: { type: string }
     *      lastName: { type: string }
     *      salary: { type: number }
     *    }
     *  }
     *
     * @param $ref - The JSON reference object (the one with the "$ref" property)
     * @param resolvedValue - The resolved value, which can be any type
     * @param options - The options
     * @returns - Returns the dereferenced value
     */
    static dereference($ref, resolvedValue, options) {
        if (resolvedValue && typeof resolvedValue === "object" && $Ref.isExtended$Ref($ref)) {
            const merged = {};
            for (const key of Object.keys($ref)) {
                if (key !== "$ref") {
                    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                    merged[key] = $ref[key];
                }
            }
            const mergeKeys = options?.dereference?.mergeKeys ?? true;
            for (const _key of Object.keys(resolvedValue)) {
                const key = _key;
                if (!(key in merged)) {
                    merged[key] = resolvedValue[key];
                }
                else {
                    // TODO: this behavior should be configurable from options on the CLI
                    // Key is already in merged, so we should merge them if both are objects
                    if (mergeKeys &&
                        typeof merged[key] === "object" &&
                        merged[key] !== null &&
                        typeof resolvedValue[key] === "object" &&
                        resolvedValue[key] !== null) {
                        merged[key] = deepMerge(resolvedValue[key], merged[key]);
                    }
                }
            }
            return merged;
        }
        else {
            // Completely replace the original reference with the resolved value
            return resolvedValue;
        }
    }
}
function deepMerge(target, source) {
    //return {...target, ...source};
    // If either isn't an object, just return source (overwrite)
    if (typeof target !== "object" || target === null) {
        return source;
    }
    if (typeof source !== "object" || source === null) {
        return source;
    }
    // Ensure we don't mutate target directly
    const output = Array.isArray(target) ? [...target] : { ...target };
    for (const key of Object.keys(source)) {
        // @ts-expect-error
        if (Array.isArray(source[key])) {
            // If it's an array, replace entirely (you can customize this to concat instead)
            // @ts-expect-error
            output[key] = [...source[key]];
            // @ts-expect-error
        }
        else if (typeof source[key] === "object" && source[key] !== null) {
            // @ts-expect-error
            output[key] = deepMerge(target[key], source[key]);
        }
        else {
            // @ts-expect-error
            output[key] = source[key];
        }
    }
    return output;
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ($Ref);


/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/refs.js"
/*!***************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/refs.js ***!
  \***************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ $Refs)
/* harmony export */ });
/* harmony import */ var _ref_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./ref.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/ref.js");
/* harmony import */ var _util_url_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./util/url.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/url.js");
/* harmony import */ var _util_convert_path_to_posix_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./util/convert-path-to-posix.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/convert-path-to-posix.js");



/**
 * When you call the resolve method, the value that gets passed to the callback function (or Promise) is a $Refs object. This same object is accessible via the parser.$refs property of $RefParser objects.
 *
 * This object is a map of JSON References and their resolved values. It also has several convenient helper methods that make it easy for you to navigate and manipulate the JSON References.
 *
 * See https://apidevtools.com/json-schema-ref-parser/docs/refs.html
 */
class $Refs {
    /**
     * This property is true if the schema contains any circular references. You may want to check this property before serializing the dereferenced schema as JSON, since JSON.stringify() does not support circular references by default.
     *
     * See https://apidevtools.com/json-schema-ref-parser/docs/refs.html#circular
     */
    circular;
    /**
     * Returns the paths/URLs of all the files in your schema (including the main schema file).
     *
     * See https://apidevtools.com/json-schema-ref-parser/docs/refs.html#pathstypes
     *
     * @param types (optional) Optionally only return certain types of paths ("file", "http", etc.)
     */
    paths(...types) {
        const paths = getPaths(this._$refs, types.flat());
        return paths.map((path) => {
            return (0,_util_convert_path_to_posix_js__WEBPACK_IMPORTED_MODULE_2__["default"])(path.decoded);
        });
    }
    /**
     * Returns a map of paths/URLs and their correspond values.
     *
     * See https://apidevtools.com/json-schema-ref-parser/docs/refs.html#valuestypes
     *
     * @param types (optional) Optionally only return values from certain locations ("file", "http", etc.)
     */
    values(...types) {
        const $refs = this._$refs;
        const paths = getPaths($refs, types.flat());
        return paths.reduce((obj, path) => {
            obj[(0,_util_convert_path_to_posix_js__WEBPACK_IMPORTED_MODULE_2__["default"])(path.decoded)] = $refs[path.encoded].value;
            return obj;
        }, {});
    }
    /**
     * Returns `true` if the given path exists in the schema; otherwise, returns `false`
     *
     * See https://apidevtools.com/json-schema-ref-parser/docs/refs.html#existsref
     *
     * @param $ref The JSON Reference path, optionally with a JSON Pointer in the hash
     */
    /**
     * Determines whether the given JSON reference exists.
     *
     * @param path - The path being resolved, optionally with a JSON pointer in the hash
     * @param [options]
     * @returns
     */
    exists(path, options) {
        try {
            this._resolve(path, "", options);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Resolves the given JSON reference and returns the resolved value.
     *
     * @param path - The path being resolved, with a JSON pointer in the hash
     * @param [options]
     * @returns - Returns the resolved value
     */
    get(path, options) {
        return this._resolve(path, "", options).value;
    }
    /**
     * Sets the value at the given path in the schema. If the property, or any of its parents, don't exist, they will be created.
     *
     * @param path The JSON Reference path, optionally with a JSON Pointer in the hash
     * @param value The value to assign. Can be anything (object, string, number, etc.)
     */
    set(path, value) {
        const absPath = _util_url_js__WEBPACK_IMPORTED_MODULE_1__.resolve(this._root$Ref.path, path);
        const withoutHash = _util_url_js__WEBPACK_IMPORTED_MODULE_1__.stripHash(absPath);
        const $ref = this._$refs[withoutHash];
        if (!$ref) {
            throw new Error(`Error resolving $ref pointer "${path}". \n"${withoutHash}" not found.`);
        }
        $ref.set(absPath, value);
    }
    /**
     * Returns the specified {@link $Ref} object, or undefined.
     *
     * @param path - The path being resolved, optionally with a JSON pointer in the hash
     * @returns
     * @protected
     */
    _get$Ref(path) {
        path = _util_url_js__WEBPACK_IMPORTED_MODULE_1__.resolve(this._root$Ref.path, path);
        const withoutHash = _util_url_js__WEBPACK_IMPORTED_MODULE_1__.stripHash(path);
        return this._$refs[withoutHash];
    }
    /**
     * Creates a new {@link $Ref} object and adds it to this {@link $Refs} object.
     *
     * @param path  - The file path or URL of the referenced file
     */
    _add(path) {
        const withoutHash = _util_url_js__WEBPACK_IMPORTED_MODULE_1__.stripHash(path);
        const $ref = new _ref_js__WEBPACK_IMPORTED_MODULE_0__["default"](this);
        $ref.path = withoutHash;
        this._$refs[withoutHash] = $ref;
        this._root$Ref = this._root$Ref || $ref;
        return $ref;
    }
    /**
     * Resolves the given JSON reference.
     *
     * @param path - The path being resolved, optionally with a JSON pointer in the hash
     * @param pathFromRoot - The path of `obj` from the schema root
     * @param [options]
     * @returns
     * @protected
     */
    _resolve(path, pathFromRoot, options) {
        const absPath = _util_url_js__WEBPACK_IMPORTED_MODULE_1__.resolve(this._root$Ref.path, path);
        const withoutHash = _util_url_js__WEBPACK_IMPORTED_MODULE_1__.stripHash(absPath);
        const $ref = this._$refs[withoutHash];
        if (!$ref) {
            throw new Error(`Error resolving $ref pointer "${path}". \n"${withoutHash}" not found.`);
        }
        return $ref.resolve(absPath, options, path, pathFromRoot);
    }
    /**
     * A map of paths/urls to {@link $Ref} objects
     *
     * @type {object}
     * @protected
     */
    _$refs = {};
    /**
     * The {@link $Ref} object that is the root of the JSON schema.
     *
     * @type {$Ref}
     * @protected
     */
    _root$Ref;
    constructor() {
        /**
         * Indicates whether the schema contains any circular references.
         *
         * @type {boolean}
         */
        this.circular = false;
        this._$refs = {};
        // @ts-ignore
        this._root$Ref = null;
    }
    /**
     * Returns the paths of all the files/URLs that are referenced by the JSON schema,
     * including the schema itself.
     *
     * @param [types] - Only return paths of the given types ("file", "http", etc.)
     * @returns
     */
    /**
     * Returns the map of JSON references and their resolved values.
     *
     * @param [types] - Only return references of the given types ("file", "http", etc.)
     * @returns
     */
    /**
     * Returns a POJO (plain old JavaScript object) for serialization as JSON.
     *
     * @returns {object}
     */
    toJSON = this.values;
}
/**
 * Returns the encoded and decoded paths keys of the given object.
 *
 * @param $refs - The object whose keys are URL-encoded paths
 * @param [types] - Only return paths of the given types ("file", "http", etc.)
 * @returns
 */
function getPaths($refs, types) {
    let paths = Object.keys($refs);
    // Filter the paths by type
    types = Array.isArray(types[0]) ? types[0] : Array.prototype.slice.call(types);
    if (types.length > 0 && types[0]) {
        paths = paths.filter((key) => {
            return types.includes($refs[key].pathType);
        });
    }
    // Decode local filesystem paths
    return paths.map((path) => {
        return {
            encoded: path,
            decoded: $refs[path].pathType === "file" ? _util_url_js__WEBPACK_IMPORTED_MODULE_1__.toFileSystemPath(path, true) : path,
        };
    });
}


/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/resolve-external.js"
/*!***************************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/resolve-external.js ***!
  \***************************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _ref_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./ref.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/ref.js");
/* harmony import */ var _pointer_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./pointer.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/pointer.js");
/* harmony import */ var _parse_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./parse.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/parse.js");
/* harmony import */ var _util_url_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./util/url.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/url.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./util/errors.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/errors.js");





/**
 * Crawls the JSON schema, finds all external JSON references, and resolves their values.
 * This method does not mutate the JSON schema. The resolved values are added to {@link $RefParser#$refs}.
 *
 * NOTE: We only care about EXTERNAL references here. INTERNAL references are only relevant when dereferencing.
 *
 * @returns
 * The promise resolves once all JSON references in the schema have been resolved,
 * including nested references that are contained in externally-referenced files.
 */
function resolveExternal(parser, options) {
    if (!options.resolve?.external) {
        // Nothing to resolve, so exit early
        return Promise.resolve();
    }
    try {
        // console.log('Resolving $ref pointers in %s', parser.$refs._root$Ref.path);
        const promises = crawl(parser.schema, parser.$refs._root$Ref.path + "#", parser.$refs, options);
        return Promise.all(promises);
    }
    catch (e) {
        return Promise.reject(e);
    }
}
/**
 * Recursively crawls the given value, and resolves any external JSON references.
 *
 * @param obj - The value to crawl. If it's not an object or array, it will be ignored.
 * @param path - The full path of `obj`, possibly with a JSON Pointer in the hash
 * @param {boolean} external - Whether `obj` was found in an external document.
 * @param $refs
 * @param options
 * @param seen - Internal.
 *
 * @returns
 * Returns an array of promises. There will be one promise for each JSON reference in `obj`.
 * If `obj` does not contain any JSON references, then the array will be empty.
 * If any of the JSON references point to files that contain additional JSON references,
 * then the corresponding promise will internally reference an array of promises.
 */
function crawl(obj, path, $refs, options, seen, external) {
    seen ||= new Set();
    let promises = [];
    if (obj && typeof obj === "object" && !ArrayBuffer.isView(obj) && !seen.has(obj)) {
        seen.add(obj); // Track previously seen objects to avoid infinite recursion
        if (_ref_js__WEBPACK_IMPORTED_MODULE_0__["default"].isExternal$Ref(obj)) {
            promises.push(resolve$Ref(obj, path, $refs, options));
        }
        const keys = Object.keys(obj);
        for (const key of keys) {
            const keyPath = _pointer_js__WEBPACK_IMPORTED_MODULE_1__["default"].join(path, key);
            const value = obj[key];
            promises = promises.concat(crawl(value, keyPath, $refs, options, seen, external));
        }
    }
    return promises;
}
/**
 * Resolves the given JSON Reference, and then crawls the resulting value.
 *
 * @param $ref - The JSON Reference to resolve
 * @param path - The full path of `$ref`, possibly with a JSON Pointer in the hash
 * @param $refs
 * @param options
 *
 * @returns
 * The promise resolves once all JSON references in the object have been resolved,
 * including nested references that are contained in externally-referenced files.
 */
async function resolve$Ref($ref, path, $refs, options) {
    const shouldResolveOnCwd = options.dereference?.externalReferenceResolution === "root";
    const resolvedPath = _util_url_js__WEBPACK_IMPORTED_MODULE_3__.resolve(shouldResolveOnCwd ? _util_url_js__WEBPACK_IMPORTED_MODULE_3__.cwd() : path, $ref.$ref);
    const withoutHash = _util_url_js__WEBPACK_IMPORTED_MODULE_3__.stripHash(resolvedPath);
    // $ref.$ref = url.relative($refs._root$Ref.path, resolvedPath);
    // Do we already have this $ref?
    const ref = $refs._$refs[withoutHash];
    if (ref) {
        // We've already parsed this $ref, so use the existing value
        return Promise.resolve(ref.value);
    }
    // Parse the $referenced file/url
    try {
        const result = await (0,_parse_js__WEBPACK_IMPORTED_MODULE_2__["default"])(resolvedPath, $refs, options);
        // Crawl the parsed value
        // console.log('Resolving $ref pointers in %s', withoutHash);
        const promises = crawl(result, withoutHash + "#", $refs, options, new Set(), true);
        return Promise.all(promises);
    }
    catch (err) {
        if (!options?.continueOnError || !(0,_util_errors_js__WEBPACK_IMPORTED_MODULE_4__.isHandledError)(err)) {
            throw err;
        }
        if ($refs._$refs[withoutHash]) {
            err.source = decodeURI(_util_url_js__WEBPACK_IMPORTED_MODULE_3__.stripHash(path));
            err.path = _util_url_js__WEBPACK_IMPORTED_MODULE_3__.safePointerToPath(_util_url_js__WEBPACK_IMPORTED_MODULE_3__.getHash(path));
        }
        return [];
    }
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (resolveExternal);


/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/resolvers/file.js"
/*!*************************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/resolvers/file.js ***!
  \*************************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_url_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../util/url.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/url.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../util/errors.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/errors.js");


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({
    /**
     * The order that this resolver will run, in relation to other resolvers.
     */
    order: 100,
    /**
     * Determines whether this resolver can read a given file reference.
     * Resolvers that return true will be tried, in order, until one successfully resolves the file.
     * Resolvers that return false will not be given a chance to resolve the file.
     */
    canRead(file) {
        return _util_url_js__WEBPACK_IMPORTED_MODULE_0__.isFileSystemPath(file.url);
    },
    /**
     * Reads the given file and returns its raw contents as a Buffer.
     */
    async read(file) {
        let path;
        const fs = await __webpack_require__.e(/*! import() */ "_c30b").then(__webpack_require__.t.bind(__webpack_require__, /*! fs */ "?c30b", 19));
        try {
            path = _util_url_js__WEBPACK_IMPORTED_MODULE_0__.toFileSystemPath(file.url);
        }
        catch (err) {
            const e = err;
            e.message = `Malformed URI: ${file.url}: ${e.message}`;
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.ResolverError(e, file.url);
        }
        // strip trailing slashes
        if (path.endsWith("/") || path.endsWith("\\")) {
            path = path.slice(0, -1);
        }
        try {
            return await fs.promises.readFile(path);
        }
        catch (err) {
            const e = err;
            e.message = `Error opening file ${path}: ${e.message}`;
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.ResolverError(e, path);
        }
    },
});


/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/resolvers/http.js"
/*!*************************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/resolvers/http.js ***!
  \*************************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_url_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../util/url.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/url.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../util/errors.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/errors.js");
/* provided dependency */ var Buffer = __webpack_require__(/*! buffer */ "./node_modules/buffer/index.js")["Buffer"];


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({
    /**
     * The order that this resolver will run, in relation to other resolvers.
     */
    order: 200,
    /**
     * HTTP headers to send when downloading files.
     *
     * @example:
     * {
     *   "User-Agent": "JSON Schema $Ref Parser",
     *   Accept: "application/json"
     * }
     */
    headers: null,
    /**
     * HTTP request timeout (in milliseconds).
     */
    timeout: 60_000, // 60 seconds
    /**
     * The maximum number of HTTP redirects to follow.
     * To disable automatic following of redirects, set this to zero.
     */
    redirects: 5,
    /**
     * The `withCredentials` option of XMLHttpRequest.
     * Set this to `true` if you're downloading files from a CORS-enabled server that requires authentication
     */
    withCredentials: false,
    /**
     * Set this to `false` if you want to allow unsafe URLs (e.g., `127.0.0.1`, localhost, and other internal URLs).
     */
    safeUrlResolver: true,
    /**
     * Determines whether this resolver can read a given file reference.
     * Resolvers that return true will be tried in order, until one successfully resolves the file.
     * Resolvers that return false will not be given a chance to resolve the file.
     */
    canRead(file) {
        return _util_url_js__WEBPACK_IMPORTED_MODULE_0__.isHttp(file.url) && (!this.safeUrlResolver || !_util_url_js__WEBPACK_IMPORTED_MODULE_0__.isUnsafeUrl(file.url));
    },
    /**
     * Reads the given URL and returns its raw contents as a Buffer.
     */
    read(file) {
        const u = _util_url_js__WEBPACK_IMPORTED_MODULE_0__.parse(file.url);
        if (typeof window !== "undefined" && !u.protocol) {
            // Use the protocol of the current page
            u.protocol = _util_url_js__WEBPACK_IMPORTED_MODULE_0__.parse(location.href).protocol;
        }
        return download(u, this);
    },
});
/**
 * Downloads the given file.
 * @returns
 * The promise resolves with the raw downloaded data, or rejects if there is an HTTP error.
 */
async function download(u, httpOptions, _redirects) {
    u = _util_url_js__WEBPACK_IMPORTED_MODULE_0__.parse(u);
    const redirects = _redirects || [];
    redirects.push(u.href);
    try {
        const res = await get(u, httpOptions);
        if (res.status >= 400) {
            const error = new Error(`HTTP ERROR ${res.status}`);
            error.status = res.status;
            throw error;
        }
        else if (res.status >= 300) {
            if (!Number.isNaN(httpOptions.redirects) && redirects.length > httpOptions.redirects) {
                const error = new Error(`Error downloading ${redirects[0]}. \nToo many redirects: \n  ${redirects.join(" \n  ")}`);
                error.status = res.status;
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.ResolverError(error);
            }
            else if (!("location" in res.headers) || !res.headers.location) {
                const error = new Error(`HTTP ${res.status} redirect with no location header`);
                error.status = res.status;
                throw error;
            }
            else {
                const redirectTo = _util_url_js__WEBPACK_IMPORTED_MODULE_0__.resolve(u.href, res.headers.location);
                return download(redirectTo, httpOptions, redirects);
            }
        }
        else {
            if (res.body) {
                const buf = await res.arrayBuffer();
                return Buffer.from(buf);
            }
            return Buffer.alloc(0);
        }
    }
    catch (err) {
        const e = err;
        e.message = `Error downloading ${u.href}: ${e.message}`;
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.ResolverError(e, u.href);
    }
}
/**
 * Sends an HTTP GET request.
 * The promise resolves with the HTTP Response object.
 */
async function get(u, httpOptions) {
    let controller;
    let timeoutId;
    if (httpOptions.timeout && typeof AbortController !== "undefined") {
        controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), httpOptions.timeout);
    }
    const response = await fetch(u, {
        method: "GET",
        headers: httpOptions.headers || {},
        credentials: httpOptions.withCredentials ? "include" : "same-origin",
        signal: controller ? controller.signal : null,
    });
    if (timeoutId) {
        clearTimeout(timeoutId);
    }
    return response;
}


/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/convert-path-to-posix.js"
/*!*************************************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/convert-path-to-posix.js ***!
  \*************************************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ convertPathToPosix)
/* harmony export */ });
const win32Sep = "\\";
function convertPathToPosix(filePath) {
    const isExtendedLengthPath = filePath.startsWith("\\\\?\\");
    if (isExtendedLengthPath) {
        return filePath;
    }
    return filePath.split(win32Sep).join("/");
}


/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/errors.js"
/*!**********************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/errors.js ***!
  \**********************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   InvalidPointerError: () => (/* binding */ InvalidPointerError),
/* harmony export */   JSONParserError: () => (/* binding */ JSONParserError),
/* harmony export */   JSONParserErrorGroup: () => (/* binding */ JSONParserErrorGroup),
/* harmony export */   MissingPointerError: () => (/* binding */ MissingPointerError),
/* harmony export */   ParserError: () => (/* binding */ ParserError),
/* harmony export */   ResolverError: () => (/* binding */ ResolverError),
/* harmony export */   TimeoutError: () => (/* binding */ TimeoutError),
/* harmony export */   UnmatchedParserError: () => (/* binding */ UnmatchedParserError),
/* harmony export */   UnmatchedResolverError: () => (/* binding */ UnmatchedResolverError),
/* harmony export */   getDeepKeys: () => (/* binding */ getDeepKeys),
/* harmony export */   isHandledError: () => (/* binding */ isHandledError),
/* harmony export */   normalizeError: () => (/* binding */ normalizeError),
/* harmony export */   toJSON: () => (/* binding */ toJSON)
/* harmony export */ });
/* harmony import */ var _url_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./url.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/url.js");

const nonJsonTypes = ["function", "symbol", "undefined"];
const protectedProps = ["constructor", "prototype", "__proto__"];
const objectPrototype = Object.getPrototypeOf({});
/**
 * Custom JSON serializer for Error objects.
 * Returns all built-in error properties, as well as extended properties.
 */
function toJSON() {
    // HACK: We have to cast the objects to `any` so we can use symbol indexers.
    // see https://github.com/Microsoft/TypeScript/issues/1863
    const pojo = {};
    const error = this;
    for (const key of getDeepKeys(error)) {
        if (typeof key === "string") {
            const value = error[key];
            const type = typeof value;
            if (!nonJsonTypes.includes(type)) {
                pojo[key] = value;
            }
        }
    }
    return pojo;
}
/**
 * Returns own, inherited, enumerable, non-enumerable, string, and symbol keys of `obj`.
 * Does NOT return members of the base Object prototype, or the specified omitted keys.
 */
function getDeepKeys(obj, omit = []) {
    let keys = [];
    // Crawl the prototype chain, finding all the string and symbol keys
    while (obj && obj !== objectPrototype) {
        keys = keys.concat(Object.getOwnPropertyNames(obj), Object.getOwnPropertySymbols(obj));
        obj = Object.getPrototypeOf(obj);
    }
    // De-duplicate the list of keys
    const uniqueKeys = new Set(keys);
    // Remove any omitted keys
    for (const key of omit.concat(protectedProps)) {
        uniqueKeys.delete(key);
    }
    return uniqueKeys;
}
class JSONParserError extends Error {
    name;
    message;
    source;
    path;
    code;
    constructor(message, source) {
        super();
        this.code = "EUNKNOWN";
        this.name = "JSONParserError";
        this.message = message;
        this.source = source;
        this.path = null;
    }
    toJSON = toJSON.bind(this);
    get footprint() {
        return `${this.path}+${this.source}+${this.code}+${this.message}`;
    }
}
class JSONParserErrorGroup extends Error {
    files;
    constructor(parser) {
        super();
        this.files = parser;
        this.name = "JSONParserErrorGroup";
        this.message = `${this.errors.length} error${this.errors.length > 1 ? "s" : ""} occurred while reading '${(0,_url_js__WEBPACK_IMPORTED_MODULE_0__.toFileSystemPath)(parser.$refs._root$Ref.path)}'`;
    }
    toJSON = toJSON.bind(this);
    static getParserErrors(parser) {
        const errors = [];
        for (const $ref of Object.values(parser.$refs._$refs)) {
            if ($ref.errors) {
                errors.push(...$ref.errors);
            }
        }
        return errors;
    }
    get errors() {
        return JSONParserErrorGroup.getParserErrors(this.files);
    }
}
class ParserError extends JSONParserError {
    code = "EPARSER";
    name = "ParserError";
    constructor(message, source) {
        super(`Error parsing ${source}: ${message}`, source);
    }
}
class UnmatchedParserError extends JSONParserError {
    code = "EUNMATCHEDPARSER";
    name = "UnmatchedParserError";
    constructor(source) {
        super(`Could not find parser for "${source}"`, source);
    }
}
class ResolverError extends JSONParserError {
    code = "ERESOLVER";
    name = "ResolverError";
    ioErrorCode;
    constructor(ex, source) {
        super(ex.message || `Error reading file "${source}"`, source);
        if ("code" in ex) {
            this.ioErrorCode = String(ex.code);
        }
    }
}
class UnmatchedResolverError extends JSONParserError {
    code = "EUNMATCHEDRESOLVER";
    name = "UnmatchedResolverError";
    constructor(source) {
        super(`Could not find resolver for "${source}"`, source);
    }
}
class MissingPointerError extends JSONParserError {
    code = "EMISSINGPOINTER";
    name = "MissingPointerError";
    targetToken;
    targetRef;
    targetFound;
    parentPath;
    constructor(token, path, targetRef, targetFound, parentPath) {
        super(`Missing $ref pointer "${(0,_url_js__WEBPACK_IMPORTED_MODULE_0__.getHash)(path)}". Token "${token}" does not exist.`, (0,_url_js__WEBPACK_IMPORTED_MODULE_0__.stripHash)(path));
        this.targetToken = token;
        this.targetRef = targetRef;
        this.targetFound = targetFound;
        this.parentPath = parentPath;
    }
}
class TimeoutError extends JSONParserError {
    code = "ETIMEOUT";
    name = "TimeoutError";
    constructor(timeout) {
        super(`Dereferencing timeout reached: ${timeout}ms`);
    }
}
class InvalidPointerError extends JSONParserError {
    code = "EUNMATCHEDRESOLVER";
    name = "InvalidPointerError";
    constructor(pointer, path) {
        super(`Invalid $ref pointer "${pointer}". Pointers must begin with "#/"`, (0,_url_js__WEBPACK_IMPORTED_MODULE_0__.stripHash)(path));
    }
}
function isHandledError(err) {
    return err instanceof JSONParserError || err instanceof JSONParserErrorGroup;
}
function normalizeError(err) {
    if (err.path === null) {
        err.path = [];
    }
    return err;
}


/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/is-windows.js"
/*!**************************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/is-windows.js ***!
  \**************************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isWindows: () => (/* binding */ isWindows)
/* harmony export */ });
const isWindowsConst = /^win/.test(globalThis.process ? globalThis.process.platform : "");
const isWindows = () => isWindowsConst;


/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/maybe.js"
/*!*********************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/maybe.js ***!
  \*********************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ maybe)
/* harmony export */ });
/* harmony import */ var _next_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./next.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/next.js");

function maybe(cb, promise) {
    if (cb) {
        promise.then(function (result) {
            (0,_next_js__WEBPACK_IMPORTED_MODULE_0__["default"])(function () {
                cb(null, result);
            });
        }, function (err) {
            (0,_next_js__WEBPACK_IMPORTED_MODULE_0__["default"])(function () {
                cb(err);
            });
        });
        return undefined;
    }
    else {
        return promise;
    }
}


/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/next.js"
/*!********************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/next.js ***!
  \********************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* provided dependency */ var process = __webpack_require__(/*! process/browser.js */ "./node_modules/process/browser.js");
function makeNext() {
    if (typeof process === "object" && typeof process.nextTick === "function") {
        return process.nextTick;
    }
    else if (typeof setImmediate === "function") {
        return setImmediate;
    }
    else {
        return function next(f) {
            setTimeout(f, 0);
        };
    }
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (makeNext());


/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/plugins.js"
/*!***********************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/plugins.js ***!
  \***********************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   all: () => (/* binding */ all),
/* harmony export */   filter: () => (/* binding */ filter),
/* harmony export */   run: () => (/* binding */ run),
/* harmony export */   sort: () => (/* binding */ sort)
/* harmony export */ });
/**
 * Returns the given plugins as an array, rather than an object map.
 * All other methods in this module expect an array of plugins rather than an object map.
 *
 * @returns
 */
function all(plugins) {
    return Object.keys(plugins || {})
        .filter((key) => {
        return typeof plugins[key] === "object";
    })
        .map((key) => {
        plugins[key].name = key;
        return plugins[key];
    });
}
/**
 * Filters the given plugins, returning only the ones return `true` for the given method.
 */
function filter(plugins, method, file, callback, $refs) {
    return plugins.filter((plugin) => {
        return !!getResult(plugin, method, file, callback, $refs);
    });
}
/**
 * Sorts the given plugins, in place, by their `order` property.
 */
function sort(plugins) {
    for (const plugin of plugins) {
        plugin.order = plugin.order || Number.MAX_SAFE_INTEGER;
    }
    return plugins.sort((a, b) => {
        return a.order - b.order;
    });
}
/**
 * Runs the specified method of the given plugins, in order, until one of them returns a successful result.
 * Each method can return a synchronous value, a Promise, or call an error-first callback.
 * If the promise resolves successfully, or the callback is called without an error, then the result
 * is immediately returned and no further plugins are called.
 * If the promise rejects, or the callback is called with an error, then the next plugin is called.
 * If ALL plugins fail, then the last error is thrown.
 */
async function run(plugins, method, file, $refs) {
    let plugin;
    let lastError;
    let index = 0;
    return new Promise((resolve, reject) => {
        runNextPlugin();
        function runNextPlugin() {
            plugin = plugins[index++];
            if (!plugin) {
                // There are no more functions, so re-throw the last error
                return reject(lastError);
            }
            try {
                // console.log('  %s', plugin.name);
                const result = getResult(plugin, method, file, callback, $refs);
                if (result && typeof result.then === "function") {
                    // A promise was returned
                    result.then(onSuccess, onError);
                }
                else if (result !== undefined) {
                    // A synchronous result was returned
                    onSuccess(result);
                }
                else if (index === plugins.length) {
                    throw new Error("No promise has been returned or callback has been called.");
                }
            }
            catch (e) {
                onError(e);
            }
        }
        function callback(err, result) {
            if (err) {
                onError(err);
            }
            else {
                onSuccess(result);
            }
        }
        function onSuccess(result) {
            // console.log('    success');
            resolve({
                plugin,
                result: result,
            });
        }
        function onError(error) {
            // console.log('    %s', err.message || err);
            lastError = {
                plugin,
                error,
            };
            runNextPlugin();
        }
    });
}
/**
 * Returns the value of the given property.
 * If the property is a function, then the result of the function is returned.
 * If the value is a RegExp, then it will be tested against the file URL.
 * If the value is an array, then it will be compared against the file extension.
 */
function getResult(obj, prop, file, callback, $refs) {
    const value = obj[prop];
    if (typeof value === "function") {
        return value.apply(obj, [file, callback, $refs]);
    }
    if (!callback) {
        // The synchronous plugin functions (canParse and canRead)
        // allow a "shorthand" syntax, where the user can match
        // files by RegExp or by file extension.
        if (value instanceof RegExp) {
            return value.test(file.url);
        }
        else if (typeof value === "string") {
            return value === file.extension;
        }
        else if (Array.isArray(value)) {
            return value.indexOf(file.extension) !== -1;
        }
    }
    return value;
}


/***/ },

/***/ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/url.js"
/*!*******************************************************************************!*\
  !*** ./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/url.js ***!
  \*******************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   cwd: () => (/* binding */ cwd),
/* harmony export */   fromFileSystemPath: () => (/* binding */ fromFileSystemPath),
/* harmony export */   getExtension: () => (/* binding */ getExtension),
/* harmony export */   getHash: () => (/* binding */ getHash),
/* harmony export */   getProtocol: () => (/* binding */ getProtocol),
/* harmony export */   isFileSystemPath: () => (/* binding */ isFileSystemPath),
/* harmony export */   isHttp: () => (/* binding */ isHttp),
/* harmony export */   isUnsafeUrl: () => (/* binding */ isUnsafeUrl),
/* harmony export */   parse: () => (/* binding */ parse),
/* harmony export */   resolve: () => (/* binding */ resolve),
/* harmony export */   safePointerToPath: () => (/* binding */ safePointerToPath),
/* harmony export */   stripHash: () => (/* binding */ stripHash),
/* harmony export */   stripQuery: () => (/* binding */ stripQuery),
/* harmony export */   toFileSystemPath: () => (/* binding */ toFileSystemPath)
/* harmony export */ });
/* harmony import */ var _convert_path_to_posix_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./convert-path-to-posix.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/convert-path-to-posix.js");
/* harmony import */ var _is_windows_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./is-windows.js */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/util/is-windows.js");
/* provided dependency */ var process = __webpack_require__(/*! process/browser.js */ "./node_modules/process/browser.js");

const forwardSlashPattern = /\//g;
const protocolPattern = /^(\w{2,}):\/\//i;
const jsonPointerSlash = /~1/g;
const jsonPointerTilde = /~0/g;

const isAbsoluteWin32Path = /^[a-zA-Z]:\\/;
// RegExp patterns to URL-encode special characters in local filesystem paths
const urlEncodePatterns = [
    [/\?/g, "%3F"],
    [/#/g, "%23"],
];
// RegExp patterns to URL-decode special characters for local filesystem paths
const urlDecodePatterns = [/%23/g, "#", /%24/g, "$", /%26/g, "&", /%2C/g, ",", /%40/g, "@"];
const parse = (u) => new URL(u);
/**
 * Returns resolved target URL relative to a base URL in a manner similar to that of a Web browser resolving an anchor tag HREF.
 *
 * @returns
 */
function resolve(from, to) {
    // we use a non-existent URL to check if its a relative URL
    const fromUrl = new URL((0,_convert_path_to_posix_js__WEBPACK_IMPORTED_MODULE_0__["default"])(from), "https://aaa.nonexistanturl.com");
    const resolvedUrl = new URL((0,_convert_path_to_posix_js__WEBPACK_IMPORTED_MODULE_0__["default"])(to), fromUrl);
    const endSpaces = to.match(/(\s*)$/)?.[1] || "";
    if (resolvedUrl.hostname === "aaa.nonexistanturl.com") {
        // `from` is a relative URL.
        const { pathname, search, hash } = resolvedUrl;
        return pathname + search + decodeURIComponent(hash) + endSpaces;
    }
    const resolved = resolvedUrl.toString() + endSpaces;
    // if there is a #, we want to split on the first one only, and decode the part after
    if (resolved.includes("#")) {
        const [base, hash] = resolved.split("#", 2);
        return base + "#" + decodeURIComponent(hash || "");
    }
    return resolved;
}
/**
 * Returns the current working directory (in Node) or the current page URL (in browsers).
 *
 * @returns
 */
function cwd() {
    if (typeof window !== "undefined" && window.location && window.location.href) {
        const href = window.location.href;
        if (!href || !href.startsWith("http")) {
            // try parsing as url, and if it fails, return root url /
            try {
                new URL(href);
                return href;
            }
            catch {
                return "/";
            }
        }
        return href;
    }
    if (typeof process !== "undefined" && process.cwd) {
        const path = process.cwd();
        const lastChar = path.slice(-1);
        if (lastChar === "/" || lastChar === "\\") {
            return path;
        }
        else {
            return path + "/";
        }
    }
    return "/";
}
/**
 * Returns the protocol of the given URL, or `undefined` if it has no protocol.
 *
 * @param path
 * @returns
 */
function getProtocol(path) {
    const match = protocolPattern.exec(path || "");
    if (match) {
        return match[1].toLowerCase();
    }
    return undefined;
}
/**
 * Returns the lowercased file extension of the given URL,
 * or an empty string if it has no extension.
 *
 * @param path
 * @returns
 */
function getExtension(path) {
    const lastDot = path.lastIndexOf(".");
    if (lastDot >= 0) {
        return stripQuery(path.substring(lastDot).toLowerCase());
    }
    return "";
}
/**
 * Removes the query, if any, from the given path.
 *
 * @param path
 * @returns
 */
function stripQuery(path) {
    const queryIndex = path.indexOf("?");
    if (queryIndex >= 0) {
        path = path.substring(0, queryIndex);
    }
    return path;
}
/**
 * Returns the hash (URL fragment), of the given path.
 * If there is no hash, then the root hash ("#") is returned.
 *
 * @param path
 * @returns
 */
function getHash(path) {
    if (!path) {
        return "#";
    }
    const hashIndex = path.indexOf("#");
    if (hashIndex >= 0) {
        return path.substring(hashIndex);
    }
    return "#";
}
/**
 * Removes the hash (URL fragment), if any, from the given path.
 *
 * @param path
 * @returns
 */
function stripHash(path) {
    if (!path) {
        return "";
    }
    const hashIndex = path.indexOf("#");
    if (hashIndex >= 0) {
        path = path.substring(0, hashIndex);
    }
    return path;
}
/**
 * Determines whether the given path is an HTTP(S) URL.
 *
 * @param path
 * @returns
 */
function isHttp(path) {
    const protocol = getProtocol(path);
    if (protocol === "http" || protocol === "https") {
        return true;
    }
    else if (protocol === undefined) {
        // There is no protocol.  If we're running in a browser, then assume it's HTTP.
        return typeof window !== "undefined";
    }
    else {
        // It's some other protocol, such as "ftp://", "mongodb://", etc.
        return false;
    }
}
/**
 * Determines whether the given url is an unsafe or internal url.
 *
 * @param path - The URL or path to check
 * @returns true if the URL is unsafe/internal, false otherwise
 */
function isUnsafeUrl(path) {
    if (!path || typeof path !== "string") {
        return true;
    }
    // Trim whitespace and convert to lowercase for comparison
    const normalizedPath = path.trim().toLowerCase();
    // Empty or just whitespace
    if (!normalizedPath) {
        return true;
    }
    // JavaScript protocols
    if (normalizedPath.startsWith("javascript:") ||
        normalizedPath.startsWith("vbscript:") ||
        normalizedPath.startsWith("data:")) {
        return true;
    }
    // File protocol
    if (normalizedPath.startsWith("file:")) {
        return true;
    }
    // if we're in the browser, we assume that it is safe
    if (typeof window !== "undefined" && window.location && window.location.href) {
        return false;
    }
    // Local/internal network addresses
    const localPatterns = [
        // Localhost variations
        "localhost",
        "127.0.0.1",
        "::1",
        // Private IP ranges (RFC 1918)
        "10.",
        "172.16.",
        "172.17.",
        "172.18.",
        "172.19.",
        "172.20.",
        "172.21.",
        "172.22.",
        "172.23.",
        "172.24.",
        "172.25.",
        "172.26.",
        "172.27.",
        "172.28.",
        "172.29.",
        "172.30.",
        "172.31.",
        "192.168.",
        // Link-local addresses
        "169.254.",
        // Internal domains
        ".local",
        ".internal",
        ".intranet",
        ".corp",
        ".home",
        ".lan",
    ];
    try {
        // Try to parse as URL
        const url = new URL(normalizedPath.startsWith("//") ? "http:" + normalizedPath : normalizedPath);
        const hostname = url.hostname.toLowerCase();
        // Check against local patterns
        for (const pattern of localPatterns) {
            if (hostname === pattern || hostname.startsWith(pattern) || hostname.endsWith(pattern)) {
                return true;
            }
        }
        // Check for IP addresses in private ranges
        if (isPrivateIP(hostname)) {
            return true;
        }
        // Check for non-standard ports that might indicate internal services
        const port = url.port;
        if (port && isInternalPort(parseInt(port))) {
            return true;
        }
    }
    catch {
        // If URL parsing fails, check if it's a relative path or contains suspicious patterns
        // Relative paths starting with / are generally safe for same-origin
        if (normalizedPath.startsWith("/") && !normalizedPath.startsWith("//")) {
            return false;
        }
        // Check for localhost patterns in non-URL strings
        for (const pattern of localPatterns) {
            if (normalizedPath.includes(pattern)) {
                return true;
            }
        }
    }
    return false;
}
/**
 * Helper function to check if an IP address is in a private range
 */
function isPrivateIP(ip) {
    const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = ip.match(ipRegex);
    if (!match) {
        return false;
    }
    const [, a, b, c, d] = match.map(Number);
    // Validate IP format
    if (a > 255 || b > 255 || c > 255 || d > 255) {
        return false;
    }
    // Private IP ranges
    return (a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) // Link-local
    );
}
/**
 * Helper function to check if a port is typically used for internal services
 */
function isInternalPort(port) {
    const internalPorts = [
        22, // SSH
        23, // Telnet
        25, // SMTP
        53, // DNS
        135, // RPC
        139, // NetBIOS
        445, // SMB
        993, // IMAPS
        995, // POP3S
        1433, // SQL Server
        1521, // Oracle
        3306, // MySQL
        3389, // RDP
        5432, // PostgreSQL
        5900, // VNC
        6379, // Redis
        8080, // Common internal web
        8443, // Common internal HTTPS
        9200, // Elasticsearch
        27017, // MongoDB
    ];
    return internalPorts.includes(port);
}
/**
 * Determines whether the given path is a filesystem path.
 * This includes "file://" URLs.
 *
 * @param path
 * @returns
 */
function isFileSystemPath(path) {
    // @ts-ignore
    if (typeof window !== "undefined" || (typeof process !== "undefined" && process.browser)) {
        // We're running in a browser, so assume that all paths are URLs.
        // This way, even relative paths will be treated as URLs rather than as filesystem paths
        return false;
    }
    const protocol = getProtocol(path);
    return protocol === undefined || protocol === "file";
}
/**
 * Converts a filesystem path to a properly-encoded URL.
 *
 * This is intended to handle situations where JSON Schema $Ref Parser is called
 * with a filesystem path that contains characters which are not allowed in URLs.
 *
 * @example
 * The following filesystem paths would be converted to the following URLs:
 *
 *    <"!@#$%^&*+=?'>.json              ==>   %3C%22!@%23$%25%5E&*+=%3F\'%3E.json
 *    C:\\My Documents\\File (1).json   ==>   C:/My%20Documents/File%20(1).json
 *    file://Project #42/file.json      ==>   file://Project%20%2342/file.json
 *
 * @param path
 * @returns
 */
function fromFileSystemPath(path) {
    // Step 1: On Windows, replace backslashes with forward slashes,
    // rather than encoding them as "%5C"
    if ((0,_is_windows_js__WEBPACK_IMPORTED_MODULE_1__.isWindows)()) {
        const projectDir = cwd();
        const upperPath = path.toUpperCase();
        const projectDirPosixPath = (0,_convert_path_to_posix_js__WEBPACK_IMPORTED_MODULE_0__["default"])(projectDir);
        const posixUpper = projectDirPosixPath.toUpperCase();
        const hasProjectDir = upperPath.includes(posixUpper);
        const hasProjectUri = upperPath.includes(posixUpper);
        const isAbsolutePath = isAbsoluteWin32Path.test(path) ||
            path.startsWith("http://") ||
            path.startsWith("https://") ||
            path.startsWith("file://");
        if (!(hasProjectDir || hasProjectUri || isAbsolutePath) && !projectDir.startsWith("http")) {
            const join = (a, b) => {
                if (a.endsWith("/") || a.endsWith("\\")) {
                    return a + b;
                }
                else {
                    return a + "/" + b;
                }
            };
            path = join(projectDir, path);
        }
        path = (0,_convert_path_to_posix_js__WEBPACK_IMPORTED_MODULE_0__["default"])(path);
    }
    // Step 2: `encodeURI` will take care of MOST characters
    path = encodeURI(path);
    // Step 3: Manually encode characters that are not encoded by `encodeURI`.
    // This includes characters such as "#" and "?", which have special meaning in URLs,
    // but are just normal characters in a filesystem path.
    for (const pattern of urlEncodePatterns) {
        path = path.replace(pattern[0], pattern[1]);
    }
    return path;
}
/**
 * Converts a URL to a local filesystem path.
 */
function toFileSystemPath(path, keepFileProtocol) {
    // Step 1: `decodeURI` will decode characters such as Cyrillic characters, spaces, etc.
    path = decodeURI(path);
    // Step 2: Manually decode characters that are not decoded by `decodeURI`.
    // This includes characters such as "#" and "?", which have special meaning in URLs,
    // but are just normal characters in a filesystem path.
    for (let i = 0; i < urlDecodePatterns.length; i += 2) {
        path = path.replace(urlDecodePatterns[i], urlDecodePatterns[i + 1]);
    }
    // Step 3: If it's a "file://" URL, then format it consistently
    // or convert it to a local filesystem path
    let isFileUrl = path.toLowerCase().startsWith("file://");
    if (isFileUrl) {
        // Strip-off the protocol, and the initial "/", if there is one
        path = path.replace(/^file:\/\//, "").replace(/^\//, "");
        // insert a colon (":") after the drive letter on Windows
        if ((0,_is_windows_js__WEBPACK_IMPORTED_MODULE_1__.isWindows)() && path[1] === "/") {
            path = `${path[0]}:${path.substring(1)}`;
        }
        if (keepFileProtocol) {
            // Return the consistently-formatted "file://" URL
            path = "file:///" + path;
        }
        else {
            // Convert the "file://" URL to a local filesystem path.
            // On Windows, it will start with something like "C:/".
            // On Posix, it will start with "/"
            isFileUrl = false;
            path = (0,_is_windows_js__WEBPACK_IMPORTED_MODULE_1__.isWindows)() ? path : "/" + path;
        }
    }
    // Step 4: Normalize Windows paths (unless it's a "file://" URL)
    if ((0,_is_windows_js__WEBPACK_IMPORTED_MODULE_1__.isWindows)() && !isFileUrl) {
        // Replace forward slashes with backslashes
        path = path.replace(forwardSlashPattern, "\\");
        // Capitalize the drive letter
        if (path.match(/^[a-z]:\\/i)) {
            path = path[0].toUpperCase() + path.substring(1);
        }
    }
    return path;
}
/**
 * Converts a $ref pointer to a valid JSON Path.
 *
 * @param pointer
 * @returns
 */
function safePointerToPath(pointer) {
    if (pointer.length <= 1 || pointer[0] !== "#" || pointer[1] !== "/") {
        return [];
    }
    return pointer
        .slice(2)
        .split("/")
        .map((value) => {
        return value.replace(jsonPointerSlash, "/").replace(jsonPointerTilde, "~");
    });
}


/***/ },

/***/ "./node_modules/js-yaml/dist/js-yaml.mjs"
/*!***********************************************!*\
  !*** ./node_modules/js-yaml/dist/js-yaml.mjs ***!
  \***********************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CORE_SCHEMA: () => (/* binding */ CORE_SCHEMA),
/* harmony export */   DEFAULT_SCHEMA: () => (/* binding */ DEFAULT_SCHEMA),
/* harmony export */   FAILSAFE_SCHEMA: () => (/* binding */ FAILSAFE_SCHEMA),
/* harmony export */   JSON_SCHEMA: () => (/* binding */ JSON_SCHEMA),
/* harmony export */   Schema: () => (/* binding */ Schema),
/* harmony export */   Type: () => (/* binding */ Type),
/* harmony export */   YAMLException: () => (/* binding */ YAMLException),
/* harmony export */   "default": () => (/* binding */ jsYaml),
/* harmony export */   dump: () => (/* binding */ dump),
/* harmony export */   load: () => (/* binding */ load),
/* harmony export */   loadAll: () => (/* binding */ loadAll),
/* harmony export */   safeDump: () => (/* binding */ safeDump),
/* harmony export */   safeLoad: () => (/* binding */ safeLoad),
/* harmony export */   safeLoadAll: () => (/* binding */ safeLoadAll),
/* harmony export */   types: () => (/* binding */ types)
/* harmony export */ });

/*! js-yaml 4.1.1 https://github.com/nodeca/js-yaml @license MIT */
function isNothing(subject) {
  return (typeof subject === 'undefined') || (subject === null);
}


function isObject(subject) {
  return (typeof subject === 'object') && (subject !== null);
}


function toArray(sequence) {
  if (Array.isArray(sequence)) return sequence;
  else if (isNothing(sequence)) return [];

  return [ sequence ];
}


function extend(target, source) {
  var index, length, key, sourceKeys;

  if (source) {
    sourceKeys = Object.keys(source);

    for (index = 0, length = sourceKeys.length; index < length; index += 1) {
      key = sourceKeys[index];
      target[key] = source[key];
    }
  }

  return target;
}


function repeat(string, count) {
  var result = '', cycle;

  for (cycle = 0; cycle < count; cycle += 1) {
    result += string;
  }

  return result;
}


function isNegativeZero(number) {
  return (number === 0) && (Number.NEGATIVE_INFINITY === 1 / number);
}


var isNothing_1      = isNothing;
var isObject_1       = isObject;
var toArray_1        = toArray;
var repeat_1         = repeat;
var isNegativeZero_1 = isNegativeZero;
var extend_1         = extend;

var common = {
	isNothing: isNothing_1,
	isObject: isObject_1,
	toArray: toArray_1,
	repeat: repeat_1,
	isNegativeZero: isNegativeZero_1,
	extend: extend_1
};

// YAML error class. http://stackoverflow.com/questions/8458984


function formatError(exception, compact) {
  var where = '', message = exception.reason || '(unknown reason)';

  if (!exception.mark) return message;

  if (exception.mark.name) {
    where += 'in "' + exception.mark.name + '" ';
  }

  where += '(' + (exception.mark.line + 1) + ':' + (exception.mark.column + 1) + ')';

  if (!compact && exception.mark.snippet) {
    where += '\n\n' + exception.mark.snippet;
  }

  return message + ' ' + where;
}


function YAMLException$1(reason, mark) {
  // Super constructor
  Error.call(this);

  this.name = 'YAMLException';
  this.reason = reason;
  this.mark = mark;
  this.message = formatError(this, false);

  // Include stack trace in error object
  if (Error.captureStackTrace) {
    // Chrome and NodeJS
    Error.captureStackTrace(this, this.constructor);
  } else {
    // FF, IE 10+ and Safari 6+. Fallback for others
    this.stack = (new Error()).stack || '';
  }
}


// Inherit from Error
YAMLException$1.prototype = Object.create(Error.prototype);
YAMLException$1.prototype.constructor = YAMLException$1;


YAMLException$1.prototype.toString = function toString(compact) {
  return this.name + ': ' + formatError(this, compact);
};


var exception = YAMLException$1;

// get snippet for a single line, respecting maxLength
function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
  var head = '';
  var tail = '';
  var maxHalfLength = Math.floor(maxLineLength / 2) - 1;

  if (position - lineStart > maxHalfLength) {
    head = ' ... ';
    lineStart = position - maxHalfLength + head.length;
  }

  if (lineEnd - position > maxHalfLength) {
    tail = ' ...';
    lineEnd = position + maxHalfLength - tail.length;
  }

  return {
    str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, '→') + tail,
    pos: position - lineStart + head.length // relative position
  };
}


function padStart(string, max) {
  return common.repeat(' ', max - string.length) + string;
}


function makeSnippet(mark, options) {
  options = Object.create(options || null);

  if (!mark.buffer) return null;

  if (!options.maxLength) options.maxLength = 79;
  if (typeof options.indent      !== 'number') options.indent      = 1;
  if (typeof options.linesBefore !== 'number') options.linesBefore = 3;
  if (typeof options.linesAfter  !== 'number') options.linesAfter  = 2;

  var re = /\r?\n|\r|\0/g;
  var lineStarts = [ 0 ];
  var lineEnds = [];
  var match;
  var foundLineNo = -1;

  while ((match = re.exec(mark.buffer))) {
    lineEnds.push(match.index);
    lineStarts.push(match.index + match[0].length);

    if (mark.position <= match.index && foundLineNo < 0) {
      foundLineNo = lineStarts.length - 2;
    }
  }

  if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;

  var result = '', i, line;
  var lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
  var maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);

  for (i = 1; i <= options.linesBefore; i++) {
    if (foundLineNo - i < 0) break;
    line = getLine(
      mark.buffer,
      lineStarts[foundLineNo - i],
      lineEnds[foundLineNo - i],
      mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]),
      maxLineLength
    );
    result = common.repeat(' ', options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) +
      ' | ' + line.str + '\n' + result;
  }

  line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
  result += common.repeat(' ', options.indent) + padStart((mark.line + 1).toString(), lineNoLength) +
    ' | ' + line.str + '\n';
  result += common.repeat('-', options.indent + lineNoLength + 3 + line.pos) + '^' + '\n';

  for (i = 1; i <= options.linesAfter; i++) {
    if (foundLineNo + i >= lineEnds.length) break;
    line = getLine(
      mark.buffer,
      lineStarts[foundLineNo + i],
      lineEnds[foundLineNo + i],
      mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]),
      maxLineLength
    );
    result += common.repeat(' ', options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) +
      ' | ' + line.str + '\n';
  }

  return result.replace(/\n$/, '');
}


var snippet = makeSnippet;

var TYPE_CONSTRUCTOR_OPTIONS = [
  'kind',
  'multi',
  'resolve',
  'construct',
  'instanceOf',
  'predicate',
  'represent',
  'representName',
  'defaultStyle',
  'styleAliases'
];

var YAML_NODE_KINDS = [
  'scalar',
  'sequence',
  'mapping'
];

function compileStyleAliases(map) {
  var result = {};

  if (map !== null) {
    Object.keys(map).forEach(function (style) {
      map[style].forEach(function (alias) {
        result[String(alias)] = style;
      });
    });
  }

  return result;
}

function Type$1(tag, options) {
  options = options || {};

  Object.keys(options).forEach(function (name) {
    if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
      throw new exception('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
    }
  });

  // TODO: Add tag format check.
  this.options       = options; // keep original options in case user wants to extend this type later
  this.tag           = tag;
  this.kind          = options['kind']          || null;
  this.resolve       = options['resolve']       || function () { return true; };
  this.construct     = options['construct']     || function (data) { return data; };
  this.instanceOf    = options['instanceOf']    || null;
  this.predicate     = options['predicate']     || null;
  this.represent     = options['represent']     || null;
  this.representName = options['representName'] || null;
  this.defaultStyle  = options['defaultStyle']  || null;
  this.multi         = options['multi']         || false;
  this.styleAliases  = compileStyleAliases(options['styleAliases'] || null);

  if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
    throw new exception('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
  }
}

var type = Type$1;

/*eslint-disable max-len*/





function compileList(schema, name) {
  var result = [];

  schema[name].forEach(function (currentType) {
    var newIndex = result.length;

    result.forEach(function (previousType, previousIndex) {
      if (previousType.tag === currentType.tag &&
          previousType.kind === currentType.kind &&
          previousType.multi === currentType.multi) {

        newIndex = previousIndex;
      }
    });

    result[newIndex] = currentType;
  });

  return result;
}


function compileMap(/* lists... */) {
  var result = {
        scalar: {},
        sequence: {},
        mapping: {},
        fallback: {},
        multi: {
          scalar: [],
          sequence: [],
          mapping: [],
          fallback: []
        }
      }, index, length;

  function collectType(type) {
    if (type.multi) {
      result.multi[type.kind].push(type);
      result.multi['fallback'].push(type);
    } else {
      result[type.kind][type.tag] = result['fallback'][type.tag] = type;
    }
  }

  for (index = 0, length = arguments.length; index < length; index += 1) {
    arguments[index].forEach(collectType);
  }
  return result;
}


function Schema$1(definition) {
  return this.extend(definition);
}


Schema$1.prototype.extend = function extend(definition) {
  var implicit = [];
  var explicit = [];

  if (definition instanceof type) {
    // Schema.extend(type)
    explicit.push(definition);

  } else if (Array.isArray(definition)) {
    // Schema.extend([ type1, type2, ... ])
    explicit = explicit.concat(definition);

  } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
    // Schema.extend({ explicit: [ type1, type2, ... ], implicit: [ type1, type2, ... ] })
    if (definition.implicit) implicit = implicit.concat(definition.implicit);
    if (definition.explicit) explicit = explicit.concat(definition.explicit);

  } else {
    throw new exception('Schema.extend argument should be a Type, [ Type ], ' +
      'or a schema definition ({ implicit: [...], explicit: [...] })');
  }

  implicit.forEach(function (type$1) {
    if (!(type$1 instanceof type)) {
      throw new exception('Specified list of YAML types (or a single Type object) contains a non-Type object.');
    }

    if (type$1.loadKind && type$1.loadKind !== 'scalar') {
      throw new exception('There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.');
    }

    if (type$1.multi) {
      throw new exception('There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.');
    }
  });

  explicit.forEach(function (type$1) {
    if (!(type$1 instanceof type)) {
      throw new exception('Specified list of YAML types (or a single Type object) contains a non-Type object.');
    }
  });

  var result = Object.create(Schema$1.prototype);

  result.implicit = (this.implicit || []).concat(implicit);
  result.explicit = (this.explicit || []).concat(explicit);

  result.compiledImplicit = compileList(result, 'implicit');
  result.compiledExplicit = compileList(result, 'explicit');
  result.compiledTypeMap  = compileMap(result.compiledImplicit, result.compiledExplicit);

  return result;
};


var schema = Schema$1;

var str = new type('tag:yaml.org,2002:str', {
  kind: 'scalar',
  construct: function (data) { return data !== null ? data : ''; }
});

var seq = new type('tag:yaml.org,2002:seq', {
  kind: 'sequence',
  construct: function (data) { return data !== null ? data : []; }
});

var map = new type('tag:yaml.org,2002:map', {
  kind: 'mapping',
  construct: function (data) { return data !== null ? data : {}; }
});

var failsafe = new schema({
  explicit: [
    str,
    seq,
    map
  ]
});

function resolveYamlNull(data) {
  if (data === null) return true;

  var max = data.length;

  return (max === 1 && data === '~') ||
         (max === 4 && (data === 'null' || data === 'Null' || data === 'NULL'));
}

function constructYamlNull() {
  return null;
}

function isNull(object) {
  return object === null;
}

var _null = new type('tag:yaml.org,2002:null', {
  kind: 'scalar',
  resolve: resolveYamlNull,
  construct: constructYamlNull,
  predicate: isNull,
  represent: {
    canonical: function () { return '~';    },
    lowercase: function () { return 'null'; },
    uppercase: function () { return 'NULL'; },
    camelcase: function () { return 'Null'; },
    empty:     function () { return '';     }
  },
  defaultStyle: 'lowercase'
});

function resolveYamlBoolean(data) {
  if (data === null) return false;

  var max = data.length;

  return (max === 4 && (data === 'true' || data === 'True' || data === 'TRUE')) ||
         (max === 5 && (data === 'false' || data === 'False' || data === 'FALSE'));
}

function constructYamlBoolean(data) {
  return data === 'true' ||
         data === 'True' ||
         data === 'TRUE';
}

function isBoolean(object) {
  return Object.prototype.toString.call(object) === '[object Boolean]';
}

var bool = new type('tag:yaml.org,2002:bool', {
  kind: 'scalar',
  resolve: resolveYamlBoolean,
  construct: constructYamlBoolean,
  predicate: isBoolean,
  represent: {
    lowercase: function (object) { return object ? 'true' : 'false'; },
    uppercase: function (object) { return object ? 'TRUE' : 'FALSE'; },
    camelcase: function (object) { return object ? 'True' : 'False'; }
  },
  defaultStyle: 'lowercase'
});

function isHexCode(c) {
  return ((0x30/* 0 */ <= c) && (c <= 0x39/* 9 */)) ||
         ((0x41/* A */ <= c) && (c <= 0x46/* F */)) ||
         ((0x61/* a */ <= c) && (c <= 0x66/* f */));
}

function isOctCode(c) {
  return ((0x30/* 0 */ <= c) && (c <= 0x37/* 7 */));
}

function isDecCode(c) {
  return ((0x30/* 0 */ <= c) && (c <= 0x39/* 9 */));
}

function resolveYamlInteger(data) {
  if (data === null) return false;

  var max = data.length,
      index = 0,
      hasDigits = false,
      ch;

  if (!max) return false;

  ch = data[index];

  // sign
  if (ch === '-' || ch === '+') {
    ch = data[++index];
  }

  if (ch === '0') {
    // 0
    if (index + 1 === max) return true;
    ch = data[++index];

    // base 2, base 8, base 16

    if (ch === 'b') {
      // base 2
      index++;

      for (; index < max; index++) {
        ch = data[index];
        if (ch === '_') continue;
        if (ch !== '0' && ch !== '1') return false;
        hasDigits = true;
      }
      return hasDigits && ch !== '_';
    }


    if (ch === 'x') {
      // base 16
      index++;

      for (; index < max; index++) {
        ch = data[index];
        if (ch === '_') continue;
        if (!isHexCode(data.charCodeAt(index))) return false;
        hasDigits = true;
      }
      return hasDigits && ch !== '_';
    }


    if (ch === 'o') {
      // base 8
      index++;

      for (; index < max; index++) {
        ch = data[index];
        if (ch === '_') continue;
        if (!isOctCode(data.charCodeAt(index))) return false;
        hasDigits = true;
      }
      return hasDigits && ch !== '_';
    }
  }

  // base 10 (except 0)

  // value should not start with `_`;
  if (ch === '_') return false;

  for (; index < max; index++) {
    ch = data[index];
    if (ch === '_') continue;
    if (!isDecCode(data.charCodeAt(index))) {
      return false;
    }
    hasDigits = true;
  }

  // Should have digits and should not end with `_`
  if (!hasDigits || ch === '_') return false;

  return true;
}

function constructYamlInteger(data) {
  var value = data, sign = 1, ch;

  if (value.indexOf('_') !== -1) {
    value = value.replace(/_/g, '');
  }

  ch = value[0];

  if (ch === '-' || ch === '+') {
    if (ch === '-') sign = -1;
    value = value.slice(1);
    ch = value[0];
  }

  if (value === '0') return 0;

  if (ch === '0') {
    if (value[1] === 'b') return sign * parseInt(value.slice(2), 2);
    if (value[1] === 'x') return sign * parseInt(value.slice(2), 16);
    if (value[1] === 'o') return sign * parseInt(value.slice(2), 8);
  }

  return sign * parseInt(value, 10);
}

function isInteger(object) {
  return (Object.prototype.toString.call(object)) === '[object Number]' &&
         (object % 1 === 0 && !common.isNegativeZero(object));
}

var int = new type('tag:yaml.org,2002:int', {
  kind: 'scalar',
  resolve: resolveYamlInteger,
  construct: constructYamlInteger,
  predicate: isInteger,
  represent: {
    binary:      function (obj) { return obj >= 0 ? '0b' + obj.toString(2) : '-0b' + obj.toString(2).slice(1); },
    octal:       function (obj) { return obj >= 0 ? '0o'  + obj.toString(8) : '-0o'  + obj.toString(8).slice(1); },
    decimal:     function (obj) { return obj.toString(10); },
    /* eslint-disable max-len */
    hexadecimal: function (obj) { return obj >= 0 ? '0x' + obj.toString(16).toUpperCase() :  '-0x' + obj.toString(16).toUpperCase().slice(1); }
  },
  defaultStyle: 'decimal',
  styleAliases: {
    binary:      [ 2,  'bin' ],
    octal:       [ 8,  'oct' ],
    decimal:     [ 10, 'dec' ],
    hexadecimal: [ 16, 'hex' ]
  }
});

var YAML_FLOAT_PATTERN = new RegExp(
  // 2.5e4, 2.5 and integers
  '^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?' +
  // .2e4, .2
  // special case, seems not from spec
  '|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?' +
  // .inf
  '|[-+]?\\.(?:inf|Inf|INF)' +
  // .nan
  '|\\.(?:nan|NaN|NAN))$');

function resolveYamlFloat(data) {
  if (data === null) return false;

  if (!YAML_FLOAT_PATTERN.test(data) ||
      // Quick hack to not allow integers end with `_`
      // Probably should update regexp & check speed
      data[data.length - 1] === '_') {
    return false;
  }

  return true;
}

function constructYamlFloat(data) {
  var value, sign;

  value  = data.replace(/_/g, '').toLowerCase();
  sign   = value[0] === '-' ? -1 : 1;

  if ('+-'.indexOf(value[0]) >= 0) {
    value = value.slice(1);
  }

  if (value === '.inf') {
    return (sign === 1) ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

  } else if (value === '.nan') {
    return NaN;
  }
  return sign * parseFloat(value, 10);
}


var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;

function representYamlFloat(object, style) {
  var res;

  if (isNaN(object)) {
    switch (style) {
      case 'lowercase': return '.nan';
      case 'uppercase': return '.NAN';
      case 'camelcase': return '.NaN';
    }
  } else if (Number.POSITIVE_INFINITY === object) {
    switch (style) {
      case 'lowercase': return '.inf';
      case 'uppercase': return '.INF';
      case 'camelcase': return '.Inf';
    }
  } else if (Number.NEGATIVE_INFINITY === object) {
    switch (style) {
      case 'lowercase': return '-.inf';
      case 'uppercase': return '-.INF';
      case 'camelcase': return '-.Inf';
    }
  } else if (common.isNegativeZero(object)) {
    return '-0.0';
  }

  res = object.toString(10);

  // JS stringifier can build scientific format without dots: 5e-100,
  // while YAML requres dot: 5.e-100. Fix it with simple hack

  return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace('e', '.e') : res;
}

function isFloat(object) {
  return (Object.prototype.toString.call(object) === '[object Number]') &&
         (object % 1 !== 0 || common.isNegativeZero(object));
}

var float = new type('tag:yaml.org,2002:float', {
  kind: 'scalar',
  resolve: resolveYamlFloat,
  construct: constructYamlFloat,
  predicate: isFloat,
  represent: representYamlFloat,
  defaultStyle: 'lowercase'
});

var json = failsafe.extend({
  implicit: [
    _null,
    bool,
    int,
    float
  ]
});

var core = json;

var YAML_DATE_REGEXP = new RegExp(
  '^([0-9][0-9][0-9][0-9])'          + // [1] year
  '-([0-9][0-9])'                    + // [2] month
  '-([0-9][0-9])$');                   // [3] day

var YAML_TIMESTAMP_REGEXP = new RegExp(
  '^([0-9][0-9][0-9][0-9])'          + // [1] year
  '-([0-9][0-9]?)'                   + // [2] month
  '-([0-9][0-9]?)'                   + // [3] day
  '(?:[Tt]|[ \\t]+)'                 + // ...
  '([0-9][0-9]?)'                    + // [4] hour
  ':([0-9][0-9])'                    + // [5] minute
  ':([0-9][0-9])'                    + // [6] second
  '(?:\\.([0-9]*))?'                 + // [7] fraction
  '(?:[ \\t]*(Z|([-+])([0-9][0-9]?)' + // [8] tz [9] tz_sign [10] tz_hour
  '(?::([0-9][0-9]))?))?$');           // [11] tz_minute

function resolveYamlTimestamp(data) {
  if (data === null) return false;
  if (YAML_DATE_REGEXP.exec(data) !== null) return true;
  if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
  return false;
}

function constructYamlTimestamp(data) {
  var match, year, month, day, hour, minute, second, fraction = 0,
      delta = null, tz_hour, tz_minute, date;

  match = YAML_DATE_REGEXP.exec(data);
  if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);

  if (match === null) throw new Error('Date resolve error');

  // match: [1] year [2] month [3] day

  year = +(match[1]);
  month = +(match[2]) - 1; // JS month starts with 0
  day = +(match[3]);

  if (!match[4]) { // no hour
    return new Date(Date.UTC(year, month, day));
  }

  // match: [4] hour [5] minute [6] second [7] fraction

  hour = +(match[4]);
  minute = +(match[5]);
  second = +(match[6]);

  if (match[7]) {
    fraction = match[7].slice(0, 3);
    while (fraction.length < 3) { // milli-seconds
      fraction += '0';
    }
    fraction = +fraction;
  }

  // match: [8] tz [9] tz_sign [10] tz_hour [11] tz_minute

  if (match[9]) {
    tz_hour = +(match[10]);
    tz_minute = +(match[11] || 0);
    delta = (tz_hour * 60 + tz_minute) * 60000; // delta in mili-seconds
    if (match[9] === '-') delta = -delta;
  }

  date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));

  if (delta) date.setTime(date.getTime() - delta);

  return date;
}

function representYamlTimestamp(object /*, style*/) {
  return object.toISOString();
}

var timestamp = new type('tag:yaml.org,2002:timestamp', {
  kind: 'scalar',
  resolve: resolveYamlTimestamp,
  construct: constructYamlTimestamp,
  instanceOf: Date,
  represent: representYamlTimestamp
});

function resolveYamlMerge(data) {
  return data === '<<' || data === null;
}

var merge = new type('tag:yaml.org,2002:merge', {
  kind: 'scalar',
  resolve: resolveYamlMerge
});

/*eslint-disable no-bitwise*/





// [ 64, 65, 66 ] -> [ padding, CR, LF ]
var BASE64_MAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r';


function resolveYamlBinary(data) {
  if (data === null) return false;

  var code, idx, bitlen = 0, max = data.length, map = BASE64_MAP;

  // Convert one by one.
  for (idx = 0; idx < max; idx++) {
    code = map.indexOf(data.charAt(idx));

    // Skip CR/LF
    if (code > 64) continue;

    // Fail on illegal characters
    if (code < 0) return false;

    bitlen += 6;
  }

  // If there are any bits left, source was corrupted
  return (bitlen % 8) === 0;
}

function constructYamlBinary(data) {
  var idx, tailbits,
      input = data.replace(/[\r\n=]/g, ''), // remove CR/LF & padding to simplify scan
      max = input.length,
      map = BASE64_MAP,
      bits = 0,
      result = [];

  // Collect by 6*4 bits (3 bytes)

  for (idx = 0; idx < max; idx++) {
    if ((idx % 4 === 0) && idx) {
      result.push((bits >> 16) & 0xFF);
      result.push((bits >> 8) & 0xFF);
      result.push(bits & 0xFF);
    }

    bits = (bits << 6) | map.indexOf(input.charAt(idx));
  }

  // Dump tail

  tailbits = (max % 4) * 6;

  if (tailbits === 0) {
    result.push((bits >> 16) & 0xFF);
    result.push((bits >> 8) & 0xFF);
    result.push(bits & 0xFF);
  } else if (tailbits === 18) {
    result.push((bits >> 10) & 0xFF);
    result.push((bits >> 2) & 0xFF);
  } else if (tailbits === 12) {
    result.push((bits >> 4) & 0xFF);
  }

  return new Uint8Array(result);
}

function representYamlBinary(object /*, style*/) {
  var result = '', bits = 0, idx, tail,
      max = object.length,
      map = BASE64_MAP;

  // Convert every three bytes to 4 ASCII characters.

  for (idx = 0; idx < max; idx++) {
    if ((idx % 3 === 0) && idx) {
      result += map[(bits >> 18) & 0x3F];
      result += map[(bits >> 12) & 0x3F];
      result += map[(bits >> 6) & 0x3F];
      result += map[bits & 0x3F];
    }

    bits = (bits << 8) + object[idx];
  }

  // Dump tail

  tail = max % 3;

  if (tail === 0) {
    result += map[(bits >> 18) & 0x3F];
    result += map[(bits >> 12) & 0x3F];
    result += map[(bits >> 6) & 0x3F];
    result += map[bits & 0x3F];
  } else if (tail === 2) {
    result += map[(bits >> 10) & 0x3F];
    result += map[(bits >> 4) & 0x3F];
    result += map[(bits << 2) & 0x3F];
    result += map[64];
  } else if (tail === 1) {
    result += map[(bits >> 2) & 0x3F];
    result += map[(bits << 4) & 0x3F];
    result += map[64];
    result += map[64];
  }

  return result;
}

function isBinary(obj) {
  return Object.prototype.toString.call(obj) ===  '[object Uint8Array]';
}

var binary = new type('tag:yaml.org,2002:binary', {
  kind: 'scalar',
  resolve: resolveYamlBinary,
  construct: constructYamlBinary,
  predicate: isBinary,
  represent: representYamlBinary
});

var _hasOwnProperty$3 = Object.prototype.hasOwnProperty;
var _toString$2       = Object.prototype.toString;

function resolveYamlOmap(data) {
  if (data === null) return true;

  var objectKeys = [], index, length, pair, pairKey, pairHasKey,
      object = data;

  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];
    pairHasKey = false;

    if (_toString$2.call(pair) !== '[object Object]') return false;

    for (pairKey in pair) {
      if (_hasOwnProperty$3.call(pair, pairKey)) {
        if (!pairHasKey) pairHasKey = true;
        else return false;
      }
    }

    if (!pairHasKey) return false;

    if (objectKeys.indexOf(pairKey) === -1) objectKeys.push(pairKey);
    else return false;
  }

  return true;
}

function constructYamlOmap(data) {
  return data !== null ? data : [];
}

var omap = new type('tag:yaml.org,2002:omap', {
  kind: 'sequence',
  resolve: resolveYamlOmap,
  construct: constructYamlOmap
});

var _toString$1 = Object.prototype.toString;

function resolveYamlPairs(data) {
  if (data === null) return true;

  var index, length, pair, keys, result,
      object = data;

  result = new Array(object.length);

  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];

    if (_toString$1.call(pair) !== '[object Object]') return false;

    keys = Object.keys(pair);

    if (keys.length !== 1) return false;

    result[index] = [ keys[0], pair[keys[0]] ];
  }

  return true;
}

function constructYamlPairs(data) {
  if (data === null) return [];

  var index, length, pair, keys, result,
      object = data;

  result = new Array(object.length);

  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];

    keys = Object.keys(pair);

    result[index] = [ keys[0], pair[keys[0]] ];
  }

  return result;
}

var pairs = new type('tag:yaml.org,2002:pairs', {
  kind: 'sequence',
  resolve: resolveYamlPairs,
  construct: constructYamlPairs
});

var _hasOwnProperty$2 = Object.prototype.hasOwnProperty;

function resolveYamlSet(data) {
  if (data === null) return true;

  var key, object = data;

  for (key in object) {
    if (_hasOwnProperty$2.call(object, key)) {
      if (object[key] !== null) return false;
    }
  }

  return true;
}

function constructYamlSet(data) {
  return data !== null ? data : {};
}

var set = new type('tag:yaml.org,2002:set', {
  kind: 'mapping',
  resolve: resolveYamlSet,
  construct: constructYamlSet
});

var _default = core.extend({
  implicit: [
    timestamp,
    merge
  ],
  explicit: [
    binary,
    omap,
    pairs,
    set
  ]
});

/*eslint-disable max-len,no-use-before-define*/







var _hasOwnProperty$1 = Object.prototype.hasOwnProperty;


var CONTEXT_FLOW_IN   = 1;
var CONTEXT_FLOW_OUT  = 2;
var CONTEXT_BLOCK_IN  = 3;
var CONTEXT_BLOCK_OUT = 4;


var CHOMPING_CLIP  = 1;
var CHOMPING_STRIP = 2;
var CHOMPING_KEEP  = 3;


var PATTERN_NON_PRINTABLE         = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
var PATTERN_FLOW_INDICATORS       = /[,\[\]\{\}]/;
var PATTERN_TAG_HANDLE            = /^(?:!|!!|![a-z\-]+!)$/i;
var PATTERN_TAG_URI               = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;


function _class(obj) { return Object.prototype.toString.call(obj); }

function is_EOL(c) {
  return (c === 0x0A/* LF */) || (c === 0x0D/* CR */);
}

function is_WHITE_SPACE(c) {
  return (c === 0x09/* Tab */) || (c === 0x20/* Space */);
}

function is_WS_OR_EOL(c) {
  return (c === 0x09/* Tab */) ||
         (c === 0x20/* Space */) ||
         (c === 0x0A/* LF */) ||
         (c === 0x0D/* CR */);
}

function is_FLOW_INDICATOR(c) {
  return c === 0x2C/* , */ ||
         c === 0x5B/* [ */ ||
         c === 0x5D/* ] */ ||
         c === 0x7B/* { */ ||
         c === 0x7D/* } */;
}

function fromHexCode(c) {
  var lc;

  if ((0x30/* 0 */ <= c) && (c <= 0x39/* 9 */)) {
    return c - 0x30;
  }

  /*eslint-disable no-bitwise*/
  lc = c | 0x20;

  if ((0x61/* a */ <= lc) && (lc <= 0x66/* f */)) {
    return lc - 0x61 + 10;
  }

  return -1;
}

function escapedHexLen(c) {
  if (c === 0x78/* x */) { return 2; }
  if (c === 0x75/* u */) { return 4; }
  if (c === 0x55/* U */) { return 8; }
  return 0;
}

function fromDecimalCode(c) {
  if ((0x30/* 0 */ <= c) && (c <= 0x39/* 9 */)) {
    return c - 0x30;
  }

  return -1;
}

function simpleEscapeSequence(c) {
  /* eslint-disable indent */
  return (c === 0x30/* 0 */) ? '\x00' :
        (c === 0x61/* a */) ? '\x07' :
        (c === 0x62/* b */) ? '\x08' :
        (c === 0x74/* t */) ? '\x09' :
        (c === 0x09/* Tab */) ? '\x09' :
        (c === 0x6E/* n */) ? '\x0A' :
        (c === 0x76/* v */) ? '\x0B' :
        (c === 0x66/* f */) ? '\x0C' :
        (c === 0x72/* r */) ? '\x0D' :
        (c === 0x65/* e */) ? '\x1B' :
        (c === 0x20/* Space */) ? ' ' :
        (c === 0x22/* " */) ? '\x22' :
        (c === 0x2F/* / */) ? '/' :
        (c === 0x5C/* \ */) ? '\x5C' :
        (c === 0x4E/* N */) ? '\x85' :
        (c === 0x5F/* _ */) ? '\xA0' :
        (c === 0x4C/* L */) ? '\u2028' :
        (c === 0x50/* P */) ? '\u2029' : '';
}

function charFromCodepoint(c) {
  if (c <= 0xFFFF) {
    return String.fromCharCode(c);
  }
  // Encode UTF-16 surrogate pair
  // https://en.wikipedia.org/wiki/UTF-16#Code_points_U.2B010000_to_U.2B10FFFF
  return String.fromCharCode(
    ((c - 0x010000) >> 10) + 0xD800,
    ((c - 0x010000) & 0x03FF) + 0xDC00
  );
}

// set a property of a literal object, while protecting against prototype pollution,
// see https://github.com/nodeca/js-yaml/issues/164 for more details
function setProperty(object, key, value) {
  // used for this specific key only because Object.defineProperty is slow
  if (key === '__proto__') {
    Object.defineProperty(object, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: value
    });
  } else {
    object[key] = value;
  }
}

var simpleEscapeCheck = new Array(256); // integer, for fast access
var simpleEscapeMap = new Array(256);
for (var i = 0; i < 256; i++) {
  simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
  simpleEscapeMap[i] = simpleEscapeSequence(i);
}


function State$1(input, options) {
  this.input = input;

  this.filename  = options['filename']  || null;
  this.schema    = options['schema']    || _default;
  this.onWarning = options['onWarning'] || null;
  // (Hidden) Remove? makes the loader to expect YAML 1.1 documents
  // if such documents have no explicit %YAML directive
  this.legacy    = options['legacy']    || false;

  this.json      = options['json']      || false;
  this.listener  = options['listener']  || null;

  this.implicitTypes = this.schema.compiledImplicit;
  this.typeMap       = this.schema.compiledTypeMap;

  this.length     = input.length;
  this.position   = 0;
  this.line       = 0;
  this.lineStart  = 0;
  this.lineIndent = 0;

  // position of first leading tab in the current line,
  // used to make sure there are no tabs in the indentation
  this.firstTabInLine = -1;

  this.documents = [];

  /*
  this.version;
  this.checkLineBreaks;
  this.tagMap;
  this.anchorMap;
  this.tag;
  this.anchor;
  this.kind;
  this.result;*/

}


function generateError(state, message) {
  var mark = {
    name:     state.filename,
    buffer:   state.input.slice(0, -1), // omit trailing \0
    position: state.position,
    line:     state.line,
    column:   state.position - state.lineStart
  };

  mark.snippet = snippet(mark);

  return new exception(message, mark);
}

function throwError(state, message) {
  throw generateError(state, message);
}

function throwWarning(state, message) {
  if (state.onWarning) {
    state.onWarning.call(null, generateError(state, message));
  }
}


var directiveHandlers = {

  YAML: function handleYamlDirective(state, name, args) {

    var match, major, minor;

    if (state.version !== null) {
      throwError(state, 'duplication of %YAML directive');
    }

    if (args.length !== 1) {
      throwError(state, 'YAML directive accepts exactly one argument');
    }

    match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);

    if (match === null) {
      throwError(state, 'ill-formed argument of the YAML directive');
    }

    major = parseInt(match[1], 10);
    minor = parseInt(match[2], 10);

    if (major !== 1) {
      throwError(state, 'unacceptable YAML version of the document');
    }

    state.version = args[0];
    state.checkLineBreaks = (minor < 2);

    if (minor !== 1 && minor !== 2) {
      throwWarning(state, 'unsupported YAML version of the document');
    }
  },

  TAG: function handleTagDirective(state, name, args) {

    var handle, prefix;

    if (args.length !== 2) {
      throwError(state, 'TAG directive accepts exactly two arguments');
    }

    handle = args[0];
    prefix = args[1];

    if (!PATTERN_TAG_HANDLE.test(handle)) {
      throwError(state, 'ill-formed tag handle (first argument) of the TAG directive');
    }

    if (_hasOwnProperty$1.call(state.tagMap, handle)) {
      throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
    }

    if (!PATTERN_TAG_URI.test(prefix)) {
      throwError(state, 'ill-formed tag prefix (second argument) of the TAG directive');
    }

    try {
      prefix = decodeURIComponent(prefix);
    } catch (err) {
      throwError(state, 'tag prefix is malformed: ' + prefix);
    }

    state.tagMap[handle] = prefix;
  }
};


function captureSegment(state, start, end, checkJson) {
  var _position, _length, _character, _result;

  if (start < end) {
    _result = state.input.slice(start, end);

    if (checkJson) {
      for (_position = 0, _length = _result.length; _position < _length; _position += 1) {
        _character = _result.charCodeAt(_position);
        if (!(_character === 0x09 ||
              (0x20 <= _character && _character <= 0x10FFFF))) {
          throwError(state, 'expected valid JSON character');
        }
      }
    } else if (PATTERN_NON_PRINTABLE.test(_result)) {
      throwError(state, 'the stream contains non-printable characters');
    }

    state.result += _result;
  }
}

function mergeMappings(state, destination, source, overridableKeys) {
  var sourceKeys, key, index, quantity;

  if (!common.isObject(source)) {
    throwError(state, 'cannot merge mappings; the provided source object is unacceptable');
  }

  sourceKeys = Object.keys(source);

  for (index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
    key = sourceKeys[index];

    if (!_hasOwnProperty$1.call(destination, key)) {
      setProperty(destination, key, source[key]);
      overridableKeys[key] = true;
    }
  }
}

function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode,
  startLine, startLineStart, startPos) {

  var index, quantity;

  // The output is a plain object here, so keys can only be strings.
  // We need to convert keyNode to a string, but doing so can hang the process
  // (deeply nested arrays that explode exponentially using aliases).
  if (Array.isArray(keyNode)) {
    keyNode = Array.prototype.slice.call(keyNode);

    for (index = 0, quantity = keyNode.length; index < quantity; index += 1) {
      if (Array.isArray(keyNode[index])) {
        throwError(state, 'nested arrays are not supported inside keys');
      }

      if (typeof keyNode === 'object' && _class(keyNode[index]) === '[object Object]') {
        keyNode[index] = '[object Object]';
      }
    }
  }

  // Avoid code execution in load() via toString property
  // (still use its own toString for arrays, timestamps,
  // and whatever user schema extensions happen to have @@toStringTag)
  if (typeof keyNode === 'object' && _class(keyNode) === '[object Object]') {
    keyNode = '[object Object]';
  }


  keyNode = String(keyNode);

  if (_result === null) {
    _result = {};
  }

  if (keyTag === 'tag:yaml.org,2002:merge') {
    if (Array.isArray(valueNode)) {
      for (index = 0, quantity = valueNode.length; index < quantity; index += 1) {
        mergeMappings(state, _result, valueNode[index], overridableKeys);
      }
    } else {
      mergeMappings(state, _result, valueNode, overridableKeys);
    }
  } else {
    if (!state.json &&
        !_hasOwnProperty$1.call(overridableKeys, keyNode) &&
        _hasOwnProperty$1.call(_result, keyNode)) {
      state.line = startLine || state.line;
      state.lineStart = startLineStart || state.lineStart;
      state.position = startPos || state.position;
      throwError(state, 'duplicated mapping key');
    }

    setProperty(_result, keyNode, valueNode);
    delete overridableKeys[keyNode];
  }

  return _result;
}

function readLineBreak(state) {
  var ch;

  ch = state.input.charCodeAt(state.position);

  if (ch === 0x0A/* LF */) {
    state.position++;
  } else if (ch === 0x0D/* CR */) {
    state.position++;
    if (state.input.charCodeAt(state.position) === 0x0A/* LF */) {
      state.position++;
    }
  } else {
    throwError(state, 'a line break is expected');
  }

  state.line += 1;
  state.lineStart = state.position;
  state.firstTabInLine = -1;
}

function skipSeparationSpace(state, allowComments, checkIndent) {
  var lineBreaks = 0,
      ch = state.input.charCodeAt(state.position);

  while (ch !== 0) {
    while (is_WHITE_SPACE(ch)) {
      if (ch === 0x09/* Tab */ && state.firstTabInLine === -1) {
        state.firstTabInLine = state.position;
      }
      ch = state.input.charCodeAt(++state.position);
    }

    if (allowComments && ch === 0x23/* # */) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 0x0A/* LF */ && ch !== 0x0D/* CR */ && ch !== 0);
    }

    if (is_EOL(ch)) {
      readLineBreak(state);

      ch = state.input.charCodeAt(state.position);
      lineBreaks++;
      state.lineIndent = 0;

      while (ch === 0x20/* Space */) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
    } else {
      break;
    }
  }

  if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
    throwWarning(state, 'deficient indentation');
  }

  return lineBreaks;
}

function testDocumentSeparator(state) {
  var _position = state.position,
      ch;

  ch = state.input.charCodeAt(_position);

  // Condition state.position === state.lineStart is tested
  // in parent on each call, for efficiency. No needs to test here again.
  if ((ch === 0x2D/* - */ || ch === 0x2E/* . */) &&
      ch === state.input.charCodeAt(_position + 1) &&
      ch === state.input.charCodeAt(_position + 2)) {

    _position += 3;

    ch = state.input.charCodeAt(_position);

    if (ch === 0 || is_WS_OR_EOL(ch)) {
      return true;
    }
  }

  return false;
}

function writeFoldedLines(state, count) {
  if (count === 1) {
    state.result += ' ';
  } else if (count > 1) {
    state.result += common.repeat('\n', count - 1);
  }
}


function readPlainScalar(state, nodeIndent, withinFlowCollection) {
  var preceding,
      following,
      captureStart,
      captureEnd,
      hasPendingContent,
      _line,
      _lineStart,
      _lineIndent,
      _kind = state.kind,
      _result = state.result,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (is_WS_OR_EOL(ch)      ||
      is_FLOW_INDICATOR(ch) ||
      ch === 0x23/* # */    ||
      ch === 0x26/* & */    ||
      ch === 0x2A/* * */    ||
      ch === 0x21/* ! */    ||
      ch === 0x7C/* | */    ||
      ch === 0x3E/* > */    ||
      ch === 0x27/* ' */    ||
      ch === 0x22/* " */    ||
      ch === 0x25/* % */    ||
      ch === 0x40/* @ */    ||
      ch === 0x60/* ` */) {
    return false;
  }

  if (ch === 0x3F/* ? */ || ch === 0x2D/* - */) {
    following = state.input.charCodeAt(state.position + 1);

    if (is_WS_OR_EOL(following) ||
        withinFlowCollection && is_FLOW_INDICATOR(following)) {
      return false;
    }
  }

  state.kind = 'scalar';
  state.result = '';
  captureStart = captureEnd = state.position;
  hasPendingContent = false;

  while (ch !== 0) {
    if (ch === 0x3A/* : */) {
      following = state.input.charCodeAt(state.position + 1);

      if (is_WS_OR_EOL(following) ||
          withinFlowCollection && is_FLOW_INDICATOR(following)) {
        break;
      }

    } else if (ch === 0x23/* # */) {
      preceding = state.input.charCodeAt(state.position - 1);

      if (is_WS_OR_EOL(preceding)) {
        break;
      }

    } else if ((state.position === state.lineStart && testDocumentSeparator(state)) ||
               withinFlowCollection && is_FLOW_INDICATOR(ch)) {
      break;

    } else if (is_EOL(ch)) {
      _line = state.line;
      _lineStart = state.lineStart;
      _lineIndent = state.lineIndent;
      skipSeparationSpace(state, false, -1);

      if (state.lineIndent >= nodeIndent) {
        hasPendingContent = true;
        ch = state.input.charCodeAt(state.position);
        continue;
      } else {
        state.position = captureEnd;
        state.line = _line;
        state.lineStart = _lineStart;
        state.lineIndent = _lineIndent;
        break;
      }
    }

    if (hasPendingContent) {
      captureSegment(state, captureStart, captureEnd, false);
      writeFoldedLines(state, state.line - _line);
      captureStart = captureEnd = state.position;
      hasPendingContent = false;
    }

    if (!is_WHITE_SPACE(ch)) {
      captureEnd = state.position + 1;
    }

    ch = state.input.charCodeAt(++state.position);
  }

  captureSegment(state, captureStart, captureEnd, false);

  if (state.result) {
    return true;
  }

  state.kind = _kind;
  state.result = _result;
  return false;
}

function readSingleQuotedScalar(state, nodeIndent) {
  var ch,
      captureStart, captureEnd;

  ch = state.input.charCodeAt(state.position);

  if (ch !== 0x27/* ' */) {
    return false;
  }

  state.kind = 'scalar';
  state.result = '';
  state.position++;
  captureStart = captureEnd = state.position;

  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 0x27/* ' */) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);

      if (ch === 0x27/* ' */) {
        captureStart = state.position;
        state.position++;
        captureEnd = state.position;
      } else {
        return true;
      }

    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;

    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, 'unexpected end of the document within a single quoted scalar');

    } else {
      state.position++;
      captureEnd = state.position;
    }
  }

  throwError(state, 'unexpected end of the stream within a single quoted scalar');
}

function readDoubleQuotedScalar(state, nodeIndent) {
  var captureStart,
      captureEnd,
      hexLength,
      hexResult,
      tmp,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch !== 0x22/* " */) {
    return false;
  }

  state.kind = 'scalar';
  state.result = '';
  state.position++;
  captureStart = captureEnd = state.position;

  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 0x22/* " */) {
      captureSegment(state, captureStart, state.position, true);
      state.position++;
      return true;

    } else if (ch === 0x5C/* \ */) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);

      if (is_EOL(ch)) {
        skipSeparationSpace(state, false, nodeIndent);

        // TODO: rework to inline fn with no type cast?
      } else if (ch < 256 && simpleEscapeCheck[ch]) {
        state.result += simpleEscapeMap[ch];
        state.position++;

      } else if ((tmp = escapedHexLen(ch)) > 0) {
        hexLength = tmp;
        hexResult = 0;

        for (; hexLength > 0; hexLength--) {
          ch = state.input.charCodeAt(++state.position);

          if ((tmp = fromHexCode(ch)) >= 0) {
            hexResult = (hexResult << 4) + tmp;

          } else {
            throwError(state, 'expected hexadecimal character');
          }
        }

        state.result += charFromCodepoint(hexResult);

        state.position++;

      } else {
        throwError(state, 'unknown escape sequence');
      }

      captureStart = captureEnd = state.position;

    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;

    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, 'unexpected end of the document within a double quoted scalar');

    } else {
      state.position++;
      captureEnd = state.position;
    }
  }

  throwError(state, 'unexpected end of the stream within a double quoted scalar');
}

function readFlowCollection(state, nodeIndent) {
  var readNext = true,
      _line,
      _lineStart,
      _pos,
      _tag     = state.tag,
      _result,
      _anchor  = state.anchor,
      following,
      terminator,
      isPair,
      isExplicitPair,
      isMapping,
      overridableKeys = Object.create(null),
      keyNode,
      keyTag,
      valueNode,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch === 0x5B/* [ */) {
    terminator = 0x5D;/* ] */
    isMapping = false;
    _result = [];
  } else if (ch === 0x7B/* { */) {
    terminator = 0x7D;/* } */
    isMapping = true;
    _result = {};
  } else {
    return false;
  }

  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }

  ch = state.input.charCodeAt(++state.position);

  while (ch !== 0) {
    skipSeparationSpace(state, true, nodeIndent);

    ch = state.input.charCodeAt(state.position);

    if (ch === terminator) {
      state.position++;
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = isMapping ? 'mapping' : 'sequence';
      state.result = _result;
      return true;
    } else if (!readNext) {
      throwError(state, 'missed comma between flow collection entries');
    } else if (ch === 0x2C/* , */) {
      // "flow collection entries can never be completely empty", as per YAML 1.2, section 7.4
      throwError(state, "expected the node content, but found ','");
    }

    keyTag = keyNode = valueNode = null;
    isPair = isExplicitPair = false;

    if (ch === 0x3F/* ? */) {
      following = state.input.charCodeAt(state.position + 1);

      if (is_WS_OR_EOL(following)) {
        isPair = isExplicitPair = true;
        state.position++;
        skipSeparationSpace(state, true, nodeIndent);
      }
    }

    _line = state.line; // Save the current line.
    _lineStart = state.lineStart;
    _pos = state.position;
    composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
    keyTag = state.tag;
    keyNode = state.result;
    skipSeparationSpace(state, true, nodeIndent);

    ch = state.input.charCodeAt(state.position);

    if ((isExplicitPair || state.line === _line) && ch === 0x3A/* : */) {
      isPair = true;
      ch = state.input.charCodeAt(++state.position);
      skipSeparationSpace(state, true, nodeIndent);
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      valueNode = state.result;
    }

    if (isMapping) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
    } else if (isPair) {
      _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
    } else {
      _result.push(keyNode);
    }

    skipSeparationSpace(state, true, nodeIndent);

    ch = state.input.charCodeAt(state.position);

    if (ch === 0x2C/* , */) {
      readNext = true;
      ch = state.input.charCodeAt(++state.position);
    } else {
      readNext = false;
    }
  }

  throwError(state, 'unexpected end of the stream within a flow collection');
}

function readBlockScalar(state, nodeIndent) {
  var captureStart,
      folding,
      chomping       = CHOMPING_CLIP,
      didReadContent = false,
      detectedIndent = false,
      textIndent     = nodeIndent,
      emptyLines     = 0,
      atMoreIndented = false,
      tmp,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch === 0x7C/* | */) {
    folding = false;
  } else if (ch === 0x3E/* > */) {
    folding = true;
  } else {
    return false;
  }

  state.kind = 'scalar';
  state.result = '';

  while (ch !== 0) {
    ch = state.input.charCodeAt(++state.position);

    if (ch === 0x2B/* + */ || ch === 0x2D/* - */) {
      if (CHOMPING_CLIP === chomping) {
        chomping = (ch === 0x2B/* + */) ? CHOMPING_KEEP : CHOMPING_STRIP;
      } else {
        throwError(state, 'repeat of a chomping mode identifier');
      }

    } else if ((tmp = fromDecimalCode(ch)) >= 0) {
      if (tmp === 0) {
        throwError(state, 'bad explicit indentation width of a block scalar; it cannot be less than one');
      } else if (!detectedIndent) {
        textIndent = nodeIndent + tmp - 1;
        detectedIndent = true;
      } else {
        throwError(state, 'repeat of an indentation width identifier');
      }

    } else {
      break;
    }
  }

  if (is_WHITE_SPACE(ch)) {
    do { ch = state.input.charCodeAt(++state.position); }
    while (is_WHITE_SPACE(ch));

    if (ch === 0x23/* # */) {
      do { ch = state.input.charCodeAt(++state.position); }
      while (!is_EOL(ch) && (ch !== 0));
    }
  }

  while (ch !== 0) {
    readLineBreak(state);
    state.lineIndent = 0;

    ch = state.input.charCodeAt(state.position);

    while ((!detectedIndent || state.lineIndent < textIndent) &&
           (ch === 0x20/* Space */)) {
      state.lineIndent++;
      ch = state.input.charCodeAt(++state.position);
    }

    if (!detectedIndent && state.lineIndent > textIndent) {
      textIndent = state.lineIndent;
    }

    if (is_EOL(ch)) {
      emptyLines++;
      continue;
    }

    // End of the scalar.
    if (state.lineIndent < textIndent) {

      // Perform the chomping.
      if (chomping === CHOMPING_KEEP) {
        state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);
      } else if (chomping === CHOMPING_CLIP) {
        if (didReadContent) { // i.e. only if the scalar is not empty.
          state.result += '\n';
        }
      }

      // Break this `while` cycle and go to the funciton's epilogue.
      break;
    }

    // Folded style: use fancy rules to handle line breaks.
    if (folding) {

      // Lines starting with white space characters (more-indented lines) are not folded.
      if (is_WHITE_SPACE(ch)) {
        atMoreIndented = true;
        // except for the first content line (cf. Example 8.1)
        state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);

      // End of more-indented block.
      } else if (atMoreIndented) {
        atMoreIndented = false;
        state.result += common.repeat('\n', emptyLines + 1);

      // Just one line break - perceive as the same line.
      } else if (emptyLines === 0) {
        if (didReadContent) { // i.e. only if we have already read some scalar content.
          state.result += ' ';
        }

      // Several line breaks - perceive as different lines.
      } else {
        state.result += common.repeat('\n', emptyLines);
      }

    // Literal style: just add exact number of line breaks between content lines.
    } else {
      // Keep all line breaks except the header line break.
      state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);
    }

    didReadContent = true;
    detectedIndent = true;
    emptyLines = 0;
    captureStart = state.position;

    while (!is_EOL(ch) && (ch !== 0)) {
      ch = state.input.charCodeAt(++state.position);
    }

    captureSegment(state, captureStart, state.position, false);
  }

  return true;
}

function readBlockSequence(state, nodeIndent) {
  var _line,
      _tag      = state.tag,
      _anchor   = state.anchor,
      _result   = [],
      following,
      detected  = false,
      ch;

  // there is a leading tab before this token, so it can't be a block sequence/mapping;
  // it can still be flow sequence/mapping or a scalar
  if (state.firstTabInLine !== -1) return false;

  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }

  ch = state.input.charCodeAt(state.position);

  while (ch !== 0) {
    if (state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, 'tab characters must not be used in indentation');
    }

    if (ch !== 0x2D/* - */) {
      break;
    }

    following = state.input.charCodeAt(state.position + 1);

    if (!is_WS_OR_EOL(following)) {
      break;
    }

    detected = true;
    state.position++;

    if (skipSeparationSpace(state, true, -1)) {
      if (state.lineIndent <= nodeIndent) {
        _result.push(null);
        ch = state.input.charCodeAt(state.position);
        continue;
      }
    }

    _line = state.line;
    composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
    _result.push(state.result);
    skipSeparationSpace(state, true, -1);

    ch = state.input.charCodeAt(state.position);

    if ((state.line === _line || state.lineIndent > nodeIndent) && (ch !== 0)) {
      throwError(state, 'bad indentation of a sequence entry');
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }

  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = 'sequence';
    state.result = _result;
    return true;
  }
  return false;
}

function readBlockMapping(state, nodeIndent, flowIndent) {
  var following,
      allowCompact,
      _line,
      _keyLine,
      _keyLineStart,
      _keyPos,
      _tag          = state.tag,
      _anchor       = state.anchor,
      _result       = {},
      overridableKeys = Object.create(null),
      keyTag        = null,
      keyNode       = null,
      valueNode     = null,
      atExplicitKey = false,
      detected      = false,
      ch;

  // there is a leading tab before this token, so it can't be a block sequence/mapping;
  // it can still be flow sequence/mapping or a scalar
  if (state.firstTabInLine !== -1) return false;

  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }

  ch = state.input.charCodeAt(state.position);

  while (ch !== 0) {
    if (!atExplicitKey && state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, 'tab characters must not be used in indentation');
    }

    following = state.input.charCodeAt(state.position + 1);
    _line = state.line; // Save the current line.

    //
    // Explicit notation case. There are two separate blocks:
    // first for the key (denoted by "?") and second for the value (denoted by ":")
    //
    if ((ch === 0x3F/* ? */ || ch === 0x3A/* : */) && is_WS_OR_EOL(following)) {

      if (ch === 0x3F/* ? */) {
        if (atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }

        detected = true;
        atExplicitKey = true;
        allowCompact = true;

      } else if (atExplicitKey) {
        // i.e. 0x3A/* : */ === character after the explicit key.
        atExplicitKey = false;
        allowCompact = true;

      } else {
        throwError(state, 'incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line');
      }

      state.position += 1;
      ch = following;

    //
    // Implicit notation case. Flow-style node as the key first, then ":", and the value.
    //
    } else {
      _keyLine = state.line;
      _keyLineStart = state.lineStart;
      _keyPos = state.position;

      if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
        // Neither implicit nor explicit notation.
        // Reading is done. Go to the epilogue.
        break;
      }

      if (state.line === _line) {
        ch = state.input.charCodeAt(state.position);

        while (is_WHITE_SPACE(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }

        if (ch === 0x3A/* : */) {
          ch = state.input.charCodeAt(++state.position);

          if (!is_WS_OR_EOL(ch)) {
            throwError(state, 'a whitespace character is expected after the key-value separator within a block mapping');
          }

          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }

          detected = true;
          atExplicitKey = false;
          allowCompact = false;
          keyTag = state.tag;
          keyNode = state.result;

        } else if (detected) {
          throwError(state, 'can not read an implicit mapping pair; a colon is missed');

        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true; // Keep the result of `composeNode`.
        }

      } else if (detected) {
        throwError(state, 'can not read a block mapping entry; a multiline key may not be an implicit key');

      } else {
        state.tag = _tag;
        state.anchor = _anchor;
        return true; // Keep the result of `composeNode`.
      }
    }

    //
    // Common reading code for both explicit and implicit notations.
    //
    if (state.line === _line || state.lineIndent > nodeIndent) {
      if (atExplicitKey) {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
      }

      if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
        if (atExplicitKey) {
          keyNode = state.result;
        } else {
          valueNode = state.result;
        }
      }

      if (!atExplicitKey) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
        keyTag = keyNode = valueNode = null;
      }

      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
    }

    if ((state.line === _line || state.lineIndent > nodeIndent) && (ch !== 0)) {
      throwError(state, 'bad indentation of a mapping entry');
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }

  //
  // Epilogue.
  //

  // Special case: last mapping's node contains only the key in explicit notation.
  if (atExplicitKey) {
    storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
  }

  // Expose the resulting mapping.
  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = 'mapping';
    state.result = _result;
  }

  return detected;
}

function readTagProperty(state) {
  var _position,
      isVerbatim = false,
      isNamed    = false,
      tagHandle,
      tagName,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch !== 0x21/* ! */) return false;

  if (state.tag !== null) {
    throwError(state, 'duplication of a tag property');
  }

  ch = state.input.charCodeAt(++state.position);

  if (ch === 0x3C/* < */) {
    isVerbatim = true;
    ch = state.input.charCodeAt(++state.position);

  } else if (ch === 0x21/* ! */) {
    isNamed = true;
    tagHandle = '!!';
    ch = state.input.charCodeAt(++state.position);

  } else {
    tagHandle = '!';
  }

  _position = state.position;

  if (isVerbatim) {
    do { ch = state.input.charCodeAt(++state.position); }
    while (ch !== 0 && ch !== 0x3E/* > */);

    if (state.position < state.length) {
      tagName = state.input.slice(_position, state.position);
      ch = state.input.charCodeAt(++state.position);
    } else {
      throwError(state, 'unexpected end of the stream within a verbatim tag');
    }
  } else {
    while (ch !== 0 && !is_WS_OR_EOL(ch)) {

      if (ch === 0x21/* ! */) {
        if (!isNamed) {
          tagHandle = state.input.slice(_position - 1, state.position + 1);

          if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
            throwError(state, 'named tag handle cannot contain such characters');
          }

          isNamed = true;
          _position = state.position + 1;
        } else {
          throwError(state, 'tag suffix cannot contain exclamation marks');
        }
      }

      ch = state.input.charCodeAt(++state.position);
    }

    tagName = state.input.slice(_position, state.position);

    if (PATTERN_FLOW_INDICATORS.test(tagName)) {
      throwError(state, 'tag suffix cannot contain flow indicator characters');
    }
  }

  if (tagName && !PATTERN_TAG_URI.test(tagName)) {
    throwError(state, 'tag name cannot contain such characters: ' + tagName);
  }

  try {
    tagName = decodeURIComponent(tagName);
  } catch (err) {
    throwError(state, 'tag name is malformed: ' + tagName);
  }

  if (isVerbatim) {
    state.tag = tagName;

  } else if (_hasOwnProperty$1.call(state.tagMap, tagHandle)) {
    state.tag = state.tagMap[tagHandle] + tagName;

  } else if (tagHandle === '!') {
    state.tag = '!' + tagName;

  } else if (tagHandle === '!!') {
    state.tag = 'tag:yaml.org,2002:' + tagName;

  } else {
    throwError(state, 'undeclared tag handle "' + tagHandle + '"');
  }

  return true;
}

function readAnchorProperty(state) {
  var _position,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch !== 0x26/* & */) return false;

  if (state.anchor !== null) {
    throwError(state, 'duplication of an anchor property');
  }

  ch = state.input.charCodeAt(++state.position);
  _position = state.position;

  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }

  if (state.position === _position) {
    throwError(state, 'name of an anchor node must contain at least one character');
  }

  state.anchor = state.input.slice(_position, state.position);
  return true;
}

function readAlias(state) {
  var _position, alias,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch !== 0x2A/* * */) return false;

  ch = state.input.charCodeAt(++state.position);
  _position = state.position;

  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }

  if (state.position === _position) {
    throwError(state, 'name of an alias node must contain at least one character');
  }

  alias = state.input.slice(_position, state.position);

  if (!_hasOwnProperty$1.call(state.anchorMap, alias)) {
    throwError(state, 'unidentified alias "' + alias + '"');
  }

  state.result = state.anchorMap[alias];
  skipSeparationSpace(state, true, -1);
  return true;
}

function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
  var allowBlockStyles,
      allowBlockScalars,
      allowBlockCollections,
      indentStatus = 1, // 1: this>parent, 0: this=parent, -1: this<parent
      atNewLine  = false,
      hasContent = false,
      typeIndex,
      typeQuantity,
      typeList,
      type,
      flowIndent,
      blockIndent;

  if (state.listener !== null) {
    state.listener('open', state);
  }

  state.tag    = null;
  state.anchor = null;
  state.kind   = null;
  state.result = null;

  allowBlockStyles = allowBlockScalars = allowBlockCollections =
    CONTEXT_BLOCK_OUT === nodeContext ||
    CONTEXT_BLOCK_IN  === nodeContext;

  if (allowToSeek) {
    if (skipSeparationSpace(state, true, -1)) {
      atNewLine = true;

      if (state.lineIndent > parentIndent) {
        indentStatus = 1;
      } else if (state.lineIndent === parentIndent) {
        indentStatus = 0;
      } else if (state.lineIndent < parentIndent) {
        indentStatus = -1;
      }
    }
  }

  if (indentStatus === 1) {
    while (readTagProperty(state) || readAnchorProperty(state)) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        allowBlockCollections = allowBlockStyles;

        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      } else {
        allowBlockCollections = false;
      }
    }
  }

  if (allowBlockCollections) {
    allowBlockCollections = atNewLine || allowCompact;
  }

  if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
    if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
      flowIndent = parentIndent;
    } else {
      flowIndent = parentIndent + 1;
    }

    blockIndent = state.position - state.lineStart;

    if (indentStatus === 1) {
      if (allowBlockCollections &&
          (readBlockSequence(state, blockIndent) ||
           readBlockMapping(state, blockIndent, flowIndent)) ||
          readFlowCollection(state, flowIndent)) {
        hasContent = true;
      } else {
        if ((allowBlockScalars && readBlockScalar(state, flowIndent)) ||
            readSingleQuotedScalar(state, flowIndent) ||
            readDoubleQuotedScalar(state, flowIndent)) {
          hasContent = true;

        } else if (readAlias(state)) {
          hasContent = true;

          if (state.tag !== null || state.anchor !== null) {
            throwError(state, 'alias node should not have any properties');
          }

        } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
          hasContent = true;

          if (state.tag === null) {
            state.tag = '?';
          }
        }

        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
      }
    } else if (indentStatus === 0) {
      // Special case: block sequences are allowed to have same indentation level as the parent.
      // http://www.yaml.org/spec/1.2/spec.html#id2799784
      hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
    }
  }

  if (state.tag === null) {
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = state.result;
    }

  } else if (state.tag === '?') {
    // Implicit resolving is not allowed for non-scalar types, and '?'
    // non-specific tag is only automatically assigned to plain scalars.
    //
    // We only need to check kind conformity in case user explicitly assigns '?'
    // tag, for example like this: "!<?> [0]"
    //
    if (state.result !== null && state.kind !== 'scalar') {
      throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
    }

    for (typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
      type = state.implicitTypes[typeIndex];

      if (type.resolve(state.result)) { // `state.result` updated in resolver if matched
        state.result = type.construct(state.result);
        state.tag = type.tag;
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
        break;
      }
    }
  } else if (state.tag !== '!') {
    if (_hasOwnProperty$1.call(state.typeMap[state.kind || 'fallback'], state.tag)) {
      type = state.typeMap[state.kind || 'fallback'][state.tag];
    } else {
      // looking for multi type
      type = null;
      typeList = state.typeMap.multi[state.kind || 'fallback'];

      for (typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) {
        if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
          type = typeList[typeIndex];
          break;
        }
      }
    }

    if (!type) {
      throwError(state, 'unknown tag !<' + state.tag + '>');
    }

    if (state.result !== null && type.kind !== state.kind) {
      throwError(state, 'unacceptable node kind for !<' + state.tag + '> tag; it should be "' + type.kind + '", not "' + state.kind + '"');
    }

    if (!type.resolve(state.result, state.tag)) { // `state.result` updated in resolver if matched
      throwError(state, 'cannot resolve a node with !<' + state.tag + '> explicit tag');
    } else {
      state.result = type.construct(state.result, state.tag);
      if (state.anchor !== null) {
        state.anchorMap[state.anchor] = state.result;
      }
    }
  }

  if (state.listener !== null) {
    state.listener('close', state);
  }
  return state.tag !== null ||  state.anchor !== null || hasContent;
}

function readDocument(state) {
  var documentStart = state.position,
      _position,
      directiveName,
      directiveArgs,
      hasDirectives = false,
      ch;

  state.version = null;
  state.checkLineBreaks = state.legacy;
  state.tagMap = Object.create(null);
  state.anchorMap = Object.create(null);

  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    skipSeparationSpace(state, true, -1);

    ch = state.input.charCodeAt(state.position);

    if (state.lineIndent > 0 || ch !== 0x25/* % */) {
      break;
    }

    hasDirectives = true;
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;

    while (ch !== 0 && !is_WS_OR_EOL(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }

    directiveName = state.input.slice(_position, state.position);
    directiveArgs = [];

    if (directiveName.length < 1) {
      throwError(state, 'directive name must not be less than one character in length');
    }

    while (ch !== 0) {
      while (is_WHITE_SPACE(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }

      if (ch === 0x23/* # */) {
        do { ch = state.input.charCodeAt(++state.position); }
        while (ch !== 0 && !is_EOL(ch));
        break;
      }

      if (is_EOL(ch)) break;

      _position = state.position;

      while (ch !== 0 && !is_WS_OR_EOL(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }

      directiveArgs.push(state.input.slice(_position, state.position));
    }

    if (ch !== 0) readLineBreak(state);

    if (_hasOwnProperty$1.call(directiveHandlers, directiveName)) {
      directiveHandlers[directiveName](state, directiveName, directiveArgs);
    } else {
      throwWarning(state, 'unknown document directive "' + directiveName + '"');
    }
  }

  skipSeparationSpace(state, true, -1);

  if (state.lineIndent === 0 &&
      state.input.charCodeAt(state.position)     === 0x2D/* - */ &&
      state.input.charCodeAt(state.position + 1) === 0x2D/* - */ &&
      state.input.charCodeAt(state.position + 2) === 0x2D/* - */) {
    state.position += 3;
    skipSeparationSpace(state, true, -1);

  } else if (hasDirectives) {
    throwError(state, 'directives end mark is expected');
  }

  composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
  skipSeparationSpace(state, true, -1);

  if (state.checkLineBreaks &&
      PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
    throwWarning(state, 'non-ASCII line breaks are interpreted as content');
  }

  state.documents.push(state.result);

  if (state.position === state.lineStart && testDocumentSeparator(state)) {

    if (state.input.charCodeAt(state.position) === 0x2E/* . */) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    }
    return;
  }

  if (state.position < (state.length - 1)) {
    throwError(state, 'end of the stream or a document separator is expected');
  } else {
    return;
  }
}


function loadDocuments(input, options) {
  input = String(input);
  options = options || {};

  if (input.length !== 0) {

    // Add tailing `\n` if not exists
    if (input.charCodeAt(input.length - 1) !== 0x0A/* LF */ &&
        input.charCodeAt(input.length - 1) !== 0x0D/* CR */) {
      input += '\n';
    }

    // Strip BOM
    if (input.charCodeAt(0) === 0xFEFF) {
      input = input.slice(1);
    }
  }

  var state = new State$1(input, options);

  var nullpos = input.indexOf('\0');

  if (nullpos !== -1) {
    state.position = nullpos;
    throwError(state, 'null byte is not allowed in input');
  }

  // Use 0 as string terminator. That significantly simplifies bounds check.
  state.input += '\0';

  while (state.input.charCodeAt(state.position) === 0x20/* Space */) {
    state.lineIndent += 1;
    state.position += 1;
  }

  while (state.position < (state.length - 1)) {
    readDocument(state);
  }

  return state.documents;
}


function loadAll$1(input, iterator, options) {
  if (iterator !== null && typeof iterator === 'object' && typeof options === 'undefined') {
    options = iterator;
    iterator = null;
  }

  var documents = loadDocuments(input, options);

  if (typeof iterator !== 'function') {
    return documents;
  }

  for (var index = 0, length = documents.length; index < length; index += 1) {
    iterator(documents[index]);
  }
}


function load$1(input, options) {
  var documents = loadDocuments(input, options);

  if (documents.length === 0) {
    /*eslint-disable no-undefined*/
    return undefined;
  } else if (documents.length === 1) {
    return documents[0];
  }
  throw new exception('expected a single document in the stream, but found more');
}


var loadAll_1 = loadAll$1;
var load_1    = load$1;

var loader = {
	loadAll: loadAll_1,
	load: load_1
};

/*eslint-disable no-use-before-define*/





var _toString       = Object.prototype.toString;
var _hasOwnProperty = Object.prototype.hasOwnProperty;

var CHAR_BOM                  = 0xFEFF;
var CHAR_TAB                  = 0x09; /* Tab */
var CHAR_LINE_FEED            = 0x0A; /* LF */
var CHAR_CARRIAGE_RETURN      = 0x0D; /* CR */
var CHAR_SPACE                = 0x20; /* Space */
var CHAR_EXCLAMATION          = 0x21; /* ! */
var CHAR_DOUBLE_QUOTE         = 0x22; /* " */
var CHAR_SHARP                = 0x23; /* # */
var CHAR_PERCENT              = 0x25; /* % */
var CHAR_AMPERSAND            = 0x26; /* & */
var CHAR_SINGLE_QUOTE         = 0x27; /* ' */
var CHAR_ASTERISK             = 0x2A; /* * */
var CHAR_COMMA                = 0x2C; /* , */
var CHAR_MINUS                = 0x2D; /* - */
var CHAR_COLON                = 0x3A; /* : */
var CHAR_EQUALS               = 0x3D; /* = */
var CHAR_GREATER_THAN         = 0x3E; /* > */
var CHAR_QUESTION             = 0x3F; /* ? */
var CHAR_COMMERCIAL_AT        = 0x40; /* @ */
var CHAR_LEFT_SQUARE_BRACKET  = 0x5B; /* [ */
var CHAR_RIGHT_SQUARE_BRACKET = 0x5D; /* ] */
var CHAR_GRAVE_ACCENT         = 0x60; /* ` */
var CHAR_LEFT_CURLY_BRACKET   = 0x7B; /* { */
var CHAR_VERTICAL_LINE        = 0x7C; /* | */
var CHAR_RIGHT_CURLY_BRACKET  = 0x7D; /* } */

var ESCAPE_SEQUENCES = {};

ESCAPE_SEQUENCES[0x00]   = '\\0';
ESCAPE_SEQUENCES[0x07]   = '\\a';
ESCAPE_SEQUENCES[0x08]   = '\\b';
ESCAPE_SEQUENCES[0x09]   = '\\t';
ESCAPE_SEQUENCES[0x0A]   = '\\n';
ESCAPE_SEQUENCES[0x0B]   = '\\v';
ESCAPE_SEQUENCES[0x0C]   = '\\f';
ESCAPE_SEQUENCES[0x0D]   = '\\r';
ESCAPE_SEQUENCES[0x1B]   = '\\e';
ESCAPE_SEQUENCES[0x22]   = '\\"';
ESCAPE_SEQUENCES[0x5C]   = '\\\\';
ESCAPE_SEQUENCES[0x85]   = '\\N';
ESCAPE_SEQUENCES[0xA0]   = '\\_';
ESCAPE_SEQUENCES[0x2028] = '\\L';
ESCAPE_SEQUENCES[0x2029] = '\\P';

var DEPRECATED_BOOLEANS_SYNTAX = [
  'y', 'Y', 'yes', 'Yes', 'YES', 'on', 'On', 'ON',
  'n', 'N', 'no', 'No', 'NO', 'off', 'Off', 'OFF'
];

var DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;

function compileStyleMap(schema, map) {
  var result, keys, index, length, tag, style, type;

  if (map === null) return {};

  result = {};
  keys = Object.keys(map);

  for (index = 0, length = keys.length; index < length; index += 1) {
    tag = keys[index];
    style = String(map[tag]);

    if (tag.slice(0, 2) === '!!') {
      tag = 'tag:yaml.org,2002:' + tag.slice(2);
    }
    type = schema.compiledTypeMap['fallback'][tag];

    if (type && _hasOwnProperty.call(type.styleAliases, style)) {
      style = type.styleAliases[style];
    }

    result[tag] = style;
  }

  return result;
}

function encodeHex(character) {
  var string, handle, length;

  string = character.toString(16).toUpperCase();

  if (character <= 0xFF) {
    handle = 'x';
    length = 2;
  } else if (character <= 0xFFFF) {
    handle = 'u';
    length = 4;
  } else if (character <= 0xFFFFFFFF) {
    handle = 'U';
    length = 8;
  } else {
    throw new exception('code point within a string may not be greater than 0xFFFFFFFF');
  }

  return '\\' + handle + common.repeat('0', length - string.length) + string;
}


var QUOTING_TYPE_SINGLE = 1,
    QUOTING_TYPE_DOUBLE = 2;

function State(options) {
  this.schema        = options['schema'] || _default;
  this.indent        = Math.max(1, (options['indent'] || 2));
  this.noArrayIndent = options['noArrayIndent'] || false;
  this.skipInvalid   = options['skipInvalid'] || false;
  this.flowLevel     = (common.isNothing(options['flowLevel']) ? -1 : options['flowLevel']);
  this.styleMap      = compileStyleMap(this.schema, options['styles'] || null);
  this.sortKeys      = options['sortKeys'] || false;
  this.lineWidth     = options['lineWidth'] || 80;
  this.noRefs        = options['noRefs'] || false;
  this.noCompatMode  = options['noCompatMode'] || false;
  this.condenseFlow  = options['condenseFlow'] || false;
  this.quotingType   = options['quotingType'] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
  this.forceQuotes   = options['forceQuotes'] || false;
  this.replacer      = typeof options['replacer'] === 'function' ? options['replacer'] : null;

  this.implicitTypes = this.schema.compiledImplicit;
  this.explicitTypes = this.schema.compiledExplicit;

  this.tag = null;
  this.result = '';

  this.duplicates = [];
  this.usedDuplicates = null;
}

// Indents every line in a string. Empty lines (\n only) are not indented.
function indentString(string, spaces) {
  var ind = common.repeat(' ', spaces),
      position = 0,
      next = -1,
      result = '',
      line,
      length = string.length;

  while (position < length) {
    next = string.indexOf('\n', position);
    if (next === -1) {
      line = string.slice(position);
      position = length;
    } else {
      line = string.slice(position, next + 1);
      position = next + 1;
    }

    if (line.length && line !== '\n') result += ind;

    result += line;
  }

  return result;
}

function generateNextLine(state, level) {
  return '\n' + common.repeat(' ', state.indent * level);
}

function testImplicitResolving(state, str) {
  var index, length, type;

  for (index = 0, length = state.implicitTypes.length; index < length; index += 1) {
    type = state.implicitTypes[index];

    if (type.resolve(str)) {
      return true;
    }
  }

  return false;
}

// [33] s-white ::= s-space | s-tab
function isWhitespace(c) {
  return c === CHAR_SPACE || c === CHAR_TAB;
}

// Returns true if the character can be printed without escaping.
// From YAML 1.2: "any allowed characters known to be non-printable
// should also be escaped. [However,] This isn’t mandatory"
// Derived from nb-char - \t - #x85 - #xA0 - #x2028 - #x2029.
function isPrintable(c) {
  return  (0x00020 <= c && c <= 0x00007E)
      || ((0x000A1 <= c && c <= 0x00D7FF) && c !== 0x2028 && c !== 0x2029)
      || ((0x0E000 <= c && c <= 0x00FFFD) && c !== CHAR_BOM)
      ||  (0x10000 <= c && c <= 0x10FFFF);
}

// [34] ns-char ::= nb-char - s-white
// [27] nb-char ::= c-printable - b-char - c-byte-order-mark
// [26] b-char  ::= b-line-feed | b-carriage-return
// Including s-white (for some reason, examples doesn't match specs in this aspect)
// ns-char ::= c-printable - b-line-feed - b-carriage-return - c-byte-order-mark
function isNsCharOrWhitespace(c) {
  return isPrintable(c)
    && c !== CHAR_BOM
    // - b-char
    && c !== CHAR_CARRIAGE_RETURN
    && c !== CHAR_LINE_FEED;
}

// [127]  ns-plain-safe(c) ::= c = flow-out  ⇒ ns-plain-safe-out
//                             c = flow-in   ⇒ ns-plain-safe-in
//                             c = block-key ⇒ ns-plain-safe-out
//                             c = flow-key  ⇒ ns-plain-safe-in
// [128] ns-plain-safe-out ::= ns-char
// [129]  ns-plain-safe-in ::= ns-char - c-flow-indicator
// [130]  ns-plain-char(c) ::=  ( ns-plain-safe(c) - “:” - “#” )
//                            | ( /* An ns-char preceding */ “#” )
//                            | ( “:” /* Followed by an ns-plain-safe(c) */ )
function isPlainSafe(c, prev, inblock) {
  var cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
  var cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
  return (
    // ns-plain-safe
    inblock ? // c = flow-in
      cIsNsCharOrWhitespace
      : cIsNsCharOrWhitespace
        // - c-flow-indicator
        && c !== CHAR_COMMA
        && c !== CHAR_LEFT_SQUARE_BRACKET
        && c !== CHAR_RIGHT_SQUARE_BRACKET
        && c !== CHAR_LEFT_CURLY_BRACKET
        && c !== CHAR_RIGHT_CURLY_BRACKET
  )
    // ns-plain-char
    && c !== CHAR_SHARP // false on '#'
    && !(prev === CHAR_COLON && !cIsNsChar) // false on ': '
    || (isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP) // change to true on '[^ ]#'
    || (prev === CHAR_COLON && cIsNsChar); // change to true on ':[^ ]'
}

// Simplified test for values allowed as the first character in plain style.
function isPlainSafeFirst(c) {
  // Uses a subset of ns-char - c-indicator
  // where ns-char = nb-char - s-white.
  // No support of ( ( “?” | “:” | “-” ) /* Followed by an ns-plain-safe(c)) */ ) part
  return isPrintable(c) && c !== CHAR_BOM
    && !isWhitespace(c) // - s-white
    // - (c-indicator ::=
    // “-” | “?” | “:” | “,” | “[” | “]” | “{” | “}”
    && c !== CHAR_MINUS
    && c !== CHAR_QUESTION
    && c !== CHAR_COLON
    && c !== CHAR_COMMA
    && c !== CHAR_LEFT_SQUARE_BRACKET
    && c !== CHAR_RIGHT_SQUARE_BRACKET
    && c !== CHAR_LEFT_CURLY_BRACKET
    && c !== CHAR_RIGHT_CURLY_BRACKET
    // | “#” | “&” | “*” | “!” | “|” | “=” | “>” | “'” | “"”
    && c !== CHAR_SHARP
    && c !== CHAR_AMPERSAND
    && c !== CHAR_ASTERISK
    && c !== CHAR_EXCLAMATION
    && c !== CHAR_VERTICAL_LINE
    && c !== CHAR_EQUALS
    && c !== CHAR_GREATER_THAN
    && c !== CHAR_SINGLE_QUOTE
    && c !== CHAR_DOUBLE_QUOTE
    // | “%” | “@” | “`”)
    && c !== CHAR_PERCENT
    && c !== CHAR_COMMERCIAL_AT
    && c !== CHAR_GRAVE_ACCENT;
}

// Simplified test for values allowed as the last character in plain style.
function isPlainSafeLast(c) {
  // just not whitespace or colon, it will be checked to be plain character later
  return !isWhitespace(c) && c !== CHAR_COLON;
}

// Same as 'string'.codePointAt(pos), but works in older browsers.
function codePointAt(string, pos) {
  var first = string.charCodeAt(pos), second;
  if (first >= 0xD800 && first <= 0xDBFF && pos + 1 < string.length) {
    second = string.charCodeAt(pos + 1);
    if (second >= 0xDC00 && second <= 0xDFFF) {
      // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
      return (first - 0xD800) * 0x400 + second - 0xDC00 + 0x10000;
    }
  }
  return first;
}

// Determines whether block indentation indicator is required.
function needIndentIndicator(string) {
  var leadingSpaceRe = /^\n* /;
  return leadingSpaceRe.test(string);
}

var STYLE_PLAIN   = 1,
    STYLE_SINGLE  = 2,
    STYLE_LITERAL = 3,
    STYLE_FOLDED  = 4,
    STYLE_DOUBLE  = 5;

// Determines which scalar styles are possible and returns the preferred style.
// lineWidth = -1 => no limit.
// Pre-conditions: str.length > 0.
// Post-conditions:
//    STYLE_PLAIN or STYLE_SINGLE => no \n are in the string.
//    STYLE_LITERAL => no lines are suitable for folding (or lineWidth is -1).
//    STYLE_FOLDED => a line > lineWidth and can be folded (and lineWidth != -1).
function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth,
  testAmbiguousType, quotingType, forceQuotes, inblock) {

  var i;
  var char = 0;
  var prevChar = null;
  var hasLineBreak = false;
  var hasFoldableLine = false; // only checked if shouldTrackWidth
  var shouldTrackWidth = lineWidth !== -1;
  var previousLineBreak = -1; // count the first line correctly
  var plain = isPlainSafeFirst(codePointAt(string, 0))
          && isPlainSafeLast(codePointAt(string, string.length - 1));

  if (singleLineOnly || forceQuotes) {
    // Case: no block styles.
    // Check for disallowed characters to rule out plain and single.
    for (i = 0; i < string.length; char >= 0x10000 ? i += 2 : i++) {
      char = codePointAt(string, i);
      if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
  } else {
    // Case: block styles permitted.
    for (i = 0; i < string.length; char >= 0x10000 ? i += 2 : i++) {
      char = codePointAt(string, i);
      if (char === CHAR_LINE_FEED) {
        hasLineBreak = true;
        // Check if any line can be folded.
        if (shouldTrackWidth) {
          hasFoldableLine = hasFoldableLine ||
            // Foldable line = too long, and not more-indented.
            (i - previousLineBreak - 1 > lineWidth &&
             string[previousLineBreak + 1] !== ' ');
          previousLineBreak = i;
        }
      } else if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
    // in case the end is missing a \n
    hasFoldableLine = hasFoldableLine || (shouldTrackWidth &&
      (i - previousLineBreak - 1 > lineWidth &&
       string[previousLineBreak + 1] !== ' '));
  }
  // Although every style can represent \n without escaping, prefer block styles
  // for multiline, since they're more readable and they don't add empty lines.
  // Also prefer folding a super-long line.
  if (!hasLineBreak && !hasFoldableLine) {
    // Strings interpretable as another type have to be quoted;
    // e.g. the string 'true' vs. the boolean true.
    if (plain && !forceQuotes && !testAmbiguousType(string)) {
      return STYLE_PLAIN;
    }
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  // Edge case: block indentation indicator can only have one digit.
  if (indentPerLevel > 9 && needIndentIndicator(string)) {
    return STYLE_DOUBLE;
  }
  // At this point we know block styles are valid.
  // Prefer literal style unless we want to fold.
  if (!forceQuotes) {
    return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
  }
  return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
}

// Note: line breaking/folding is implemented for only the folded style.
// NB. We drop the last trailing newline (if any) of a returned block scalar
//  since the dumper adds its own newline. This always works:
//    • No ending newline => unaffected; already using strip "-" chomping.
//    • Ending newline    => removed then restored.
//  Importantly, this keeps the "+" chomp indicator from gaining an extra line.
function writeScalar(state, string, level, iskey, inblock) {
  state.dump = (function () {
    if (string.length === 0) {
      return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
    }
    if (!state.noCompatMode) {
      if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
        return state.quotingType === QUOTING_TYPE_DOUBLE ? ('"' + string + '"') : ("'" + string + "'");
      }
    }

    var indent = state.indent * Math.max(1, level); // no 0-indent scalars
    // As indentation gets deeper, let the width decrease monotonically
    // to the lower bound min(state.lineWidth, 40).
    // Note that this implies
    //  state.lineWidth ≤ 40 + state.indent: width is fixed at the lower bound.
    //  state.lineWidth > 40 + state.indent: width decreases until the lower bound.
    // This behaves better than a constant minimum width which disallows narrower options,
    // or an indent threshold which causes the width to suddenly increase.
    var lineWidth = state.lineWidth === -1
      ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);

    // Without knowing if keys are implicit/explicit, assume implicit for safety.
    var singleLineOnly = iskey
      // No block styles in flow mode.
      || (state.flowLevel > -1 && level >= state.flowLevel);
    function testAmbiguity(string) {
      return testImplicitResolving(state, string);
    }

    switch (chooseScalarStyle(string, singleLineOnly, state.indent, lineWidth,
      testAmbiguity, state.quotingType, state.forceQuotes && !iskey, inblock)) {

      case STYLE_PLAIN:
        return string;
      case STYLE_SINGLE:
        return "'" + string.replace(/'/g, "''") + "'";
      case STYLE_LITERAL:
        return '|' + blockHeader(string, state.indent)
          + dropEndingNewline(indentString(string, indent));
      case STYLE_FOLDED:
        return '>' + blockHeader(string, state.indent)
          + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
      case STYLE_DOUBLE:
        return '"' + escapeString(string) + '"';
      default:
        throw new exception('impossible error: invalid scalar style');
    }
  }());
}

// Pre-conditions: string is valid for a block scalar, 1 <= indentPerLevel <= 9.
function blockHeader(string, indentPerLevel) {
  var indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : '';

  // note the special case: the string '\n' counts as a "trailing" empty line.
  var clip =          string[string.length - 1] === '\n';
  var keep = clip && (string[string.length - 2] === '\n' || string === '\n');
  var chomp = keep ? '+' : (clip ? '' : '-');

  return indentIndicator + chomp + '\n';
}

// (See the note for writeScalar.)
function dropEndingNewline(string) {
  return string[string.length - 1] === '\n' ? string.slice(0, -1) : string;
}

// Note: a long line without a suitable break point will exceed the width limit.
// Pre-conditions: every char in str isPrintable, str.length > 0, width > 0.
function foldString(string, width) {
  // In folded style, $k$ consecutive newlines output as $k+1$ newlines—
  // unless they're before or after a more-indented line, or at the very
  // beginning or end, in which case $k$ maps to $k$.
  // Therefore, parse each chunk as newline(s) followed by a content line.
  var lineRe = /(\n+)([^\n]*)/g;

  // first line (possibly an empty line)
  var result = (function () {
    var nextLF = string.indexOf('\n');
    nextLF = nextLF !== -1 ? nextLF : string.length;
    lineRe.lastIndex = nextLF;
    return foldLine(string.slice(0, nextLF), width);
  }());
  // If we haven't reached the first content line yet, don't add an extra \n.
  var prevMoreIndented = string[0] === '\n' || string[0] === ' ';
  var moreIndented;

  // rest of the lines
  var match;
  while ((match = lineRe.exec(string))) {
    var prefix = match[1], line = match[2];
    moreIndented = (line[0] === ' ');
    result += prefix
      + (!prevMoreIndented && !moreIndented && line !== ''
        ? '\n' : '')
      + foldLine(line, width);
    prevMoreIndented = moreIndented;
  }

  return result;
}

// Greedy line breaking.
// Picks the longest line under the limit each time,
// otherwise settles for the shortest line over the limit.
// NB. More-indented lines *cannot* be folded, as that would add an extra \n.
function foldLine(line, width) {
  if (line === '' || line[0] === ' ') return line;

  // Since a more-indented line adds a \n, breaks can't be followed by a space.
  var breakRe = / [^ ]/g; // note: the match index will always be <= length-2.
  var match;
  // start is an inclusive index. end, curr, and next are exclusive.
  var start = 0, end, curr = 0, next = 0;
  var result = '';

  // Invariants: 0 <= start <= length-1.
  //   0 <= curr <= next <= max(0, length-2). curr - start <= width.
  // Inside the loop:
  //   A match implies length >= 2, so curr and next are <= length-2.
  while ((match = breakRe.exec(line))) {
    next = match.index;
    // maintain invariant: curr - start <= width
    if (next - start > width) {
      end = (curr > start) ? curr : next; // derive end <= length-2
      result += '\n' + line.slice(start, end);
      // skip the space that was output as \n
      start = end + 1;                    // derive start <= length-1
    }
    curr = next;
  }

  // By the invariants, start <= length-1, so there is something left over.
  // It is either the whole string or a part starting from non-whitespace.
  result += '\n';
  // Insert a break if the remainder is too long and there is a break available.
  if (line.length - start > width && curr > start) {
    result += line.slice(start, curr) + '\n' + line.slice(curr + 1);
  } else {
    result += line.slice(start);
  }

  return result.slice(1); // drop extra \n joiner
}

// Escapes a double-quoted string.
function escapeString(string) {
  var result = '';
  var char = 0;
  var escapeSeq;

  for (var i = 0; i < string.length; char >= 0x10000 ? i += 2 : i++) {
    char = codePointAt(string, i);
    escapeSeq = ESCAPE_SEQUENCES[char];

    if (!escapeSeq && isPrintable(char)) {
      result += string[i];
      if (char >= 0x10000) result += string[i + 1];
    } else {
      result += escapeSeq || encodeHex(char);
    }
  }

  return result;
}

function writeFlowSequence(state, level, object) {
  var _result = '',
      _tag    = state.tag,
      index,
      length,
      value;

  for (index = 0, length = object.length; index < length; index += 1) {
    value = object[index];

    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }

    // Write only valid elements, put null instead of invalid elements.
    if (writeNode(state, level, value, false, false) ||
        (typeof value === 'undefined' &&
         writeNode(state, level, null, false, false))) {

      if (_result !== '') _result += ',' + (!state.condenseFlow ? ' ' : '');
      _result += state.dump;
    }
  }

  state.tag = _tag;
  state.dump = '[' + _result + ']';
}

function writeBlockSequence(state, level, object, compact) {
  var _result = '',
      _tag    = state.tag,
      index,
      length,
      value;

  for (index = 0, length = object.length; index < length; index += 1) {
    value = object[index];

    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }

    // Write only valid elements, put null instead of invalid elements.
    if (writeNode(state, level + 1, value, true, true, false, true) ||
        (typeof value === 'undefined' &&
         writeNode(state, level + 1, null, true, true, false, true))) {

      if (!compact || _result !== '') {
        _result += generateNextLine(state, level);
      }

      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        _result += '-';
      } else {
        _result += '- ';
      }

      _result += state.dump;
    }
  }

  state.tag = _tag;
  state.dump = _result || '[]'; // Empty sequence if no valid values.
}

function writeFlowMapping(state, level, object) {
  var _result       = '',
      _tag          = state.tag,
      objectKeyList = Object.keys(object),
      index,
      length,
      objectKey,
      objectValue,
      pairBuffer;

  for (index = 0, length = objectKeyList.length; index < length; index += 1) {

    pairBuffer = '';
    if (_result !== '') pairBuffer += ', ';

    if (state.condenseFlow) pairBuffer += '"';

    objectKey = objectKeyList[index];
    objectValue = object[objectKey];

    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }

    if (!writeNode(state, level, objectKey, false, false)) {
      continue; // Skip this pair because of invalid key;
    }

    if (state.dump.length > 1024) pairBuffer += '? ';

    pairBuffer += state.dump + (state.condenseFlow ? '"' : '') + ':' + (state.condenseFlow ? '' : ' ');

    if (!writeNode(state, level, objectValue, false, false)) {
      continue; // Skip this pair because of invalid value.
    }

    pairBuffer += state.dump;

    // Both key and value are valid.
    _result += pairBuffer;
  }

  state.tag = _tag;
  state.dump = '{' + _result + '}';
}

function writeBlockMapping(state, level, object, compact) {
  var _result       = '',
      _tag          = state.tag,
      objectKeyList = Object.keys(object),
      index,
      length,
      objectKey,
      objectValue,
      explicitPair,
      pairBuffer;

  // Allow sorting keys so that the output file is deterministic
  if (state.sortKeys === true) {
    // Default sorting
    objectKeyList.sort();
  } else if (typeof state.sortKeys === 'function') {
    // Custom sort function
    objectKeyList.sort(state.sortKeys);
  } else if (state.sortKeys) {
    // Something is wrong
    throw new exception('sortKeys must be a boolean or a function');
  }

  for (index = 0, length = objectKeyList.length; index < length; index += 1) {
    pairBuffer = '';

    if (!compact || _result !== '') {
      pairBuffer += generateNextLine(state, level);
    }

    objectKey = objectKeyList[index];
    objectValue = object[objectKey];

    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }

    if (!writeNode(state, level + 1, objectKey, true, true, true)) {
      continue; // Skip this pair because of invalid key.
    }

    explicitPair = (state.tag !== null && state.tag !== '?') ||
                   (state.dump && state.dump.length > 1024);

    if (explicitPair) {
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += '?';
      } else {
        pairBuffer += '? ';
      }
    }

    pairBuffer += state.dump;

    if (explicitPair) {
      pairBuffer += generateNextLine(state, level);
    }

    if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
      continue; // Skip this pair because of invalid value.
    }

    if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
      pairBuffer += ':';
    } else {
      pairBuffer += ': ';
    }

    pairBuffer += state.dump;

    // Both key and value are valid.
    _result += pairBuffer;
  }

  state.tag = _tag;
  state.dump = _result || '{}'; // Empty mapping if no valid pairs.
}

function detectType(state, object, explicit) {
  var _result, typeList, index, length, type, style;

  typeList = explicit ? state.explicitTypes : state.implicitTypes;

  for (index = 0, length = typeList.length; index < length; index += 1) {
    type = typeList[index];

    if ((type.instanceOf  || type.predicate) &&
        (!type.instanceOf || ((typeof object === 'object') && (object instanceof type.instanceOf))) &&
        (!type.predicate  || type.predicate(object))) {

      if (explicit) {
        if (type.multi && type.representName) {
          state.tag = type.representName(object);
        } else {
          state.tag = type.tag;
        }
      } else {
        state.tag = '?';
      }

      if (type.represent) {
        style = state.styleMap[type.tag] || type.defaultStyle;

        if (_toString.call(type.represent) === '[object Function]') {
          _result = type.represent(object, style);
        } else if (_hasOwnProperty.call(type.represent, style)) {
          _result = type.represent[style](object, style);
        } else {
          throw new exception('!<' + type.tag + '> tag resolver accepts not "' + style + '" style');
        }

        state.dump = _result;
      }

      return true;
    }
  }

  return false;
}

// Serializes `object` and writes it to global `result`.
// Returns true on success, or false on invalid object.
//
function writeNode(state, level, object, block, compact, iskey, isblockseq) {
  state.tag = null;
  state.dump = object;

  if (!detectType(state, object, false)) {
    detectType(state, object, true);
  }

  var type = _toString.call(state.dump);
  var inblock = block;
  var tagStr;

  if (block) {
    block = (state.flowLevel < 0 || state.flowLevel > level);
  }

  var objectOrArray = type === '[object Object]' || type === '[object Array]',
      duplicateIndex,
      duplicate;

  if (objectOrArray) {
    duplicateIndex = state.duplicates.indexOf(object);
    duplicate = duplicateIndex !== -1;
  }

  if ((state.tag !== null && state.tag !== '?') || duplicate || (state.indent !== 2 && level > 0)) {
    compact = false;
  }

  if (duplicate && state.usedDuplicates[duplicateIndex]) {
    state.dump = '*ref_' + duplicateIndex;
  } else {
    if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
      state.usedDuplicates[duplicateIndex] = true;
    }
    if (type === '[object Object]') {
      if (block && (Object.keys(state.dump).length !== 0)) {
        writeBlockMapping(state, level, state.dump, compact);
        if (duplicate) {
          state.dump = '&ref_' + duplicateIndex + state.dump;
        }
      } else {
        writeFlowMapping(state, level, state.dump);
        if (duplicate) {
          state.dump = '&ref_' + duplicateIndex + ' ' + state.dump;
        }
      }
    } else if (type === '[object Array]') {
      if (block && (state.dump.length !== 0)) {
        if (state.noArrayIndent && !isblockseq && level > 0) {
          writeBlockSequence(state, level - 1, state.dump, compact);
        } else {
          writeBlockSequence(state, level, state.dump, compact);
        }
        if (duplicate) {
          state.dump = '&ref_' + duplicateIndex + state.dump;
        }
      } else {
        writeFlowSequence(state, level, state.dump);
        if (duplicate) {
          state.dump = '&ref_' + duplicateIndex + ' ' + state.dump;
        }
      }
    } else if (type === '[object String]') {
      if (state.tag !== '?') {
        writeScalar(state, state.dump, level, iskey, inblock);
      }
    } else if (type === '[object Undefined]') {
      return false;
    } else {
      if (state.skipInvalid) return false;
      throw new exception('unacceptable kind of an object to dump ' + type);
    }

    if (state.tag !== null && state.tag !== '?') {
      // Need to encode all characters except those allowed by the spec:
      //
      // [35] ns-dec-digit    ::=  [#x30-#x39] /* 0-9 */
      // [36] ns-hex-digit    ::=  ns-dec-digit
      //                         | [#x41-#x46] /* A-F */ | [#x61-#x66] /* a-f */
      // [37] ns-ascii-letter ::=  [#x41-#x5A] /* A-Z */ | [#x61-#x7A] /* a-z */
      // [38] ns-word-char    ::=  ns-dec-digit | ns-ascii-letter | “-”
      // [39] ns-uri-char     ::=  “%” ns-hex-digit ns-hex-digit | ns-word-char | “#”
      //                         | “;” | “/” | “?” | “:” | “@” | “&” | “=” | “+” | “$” | “,”
      //                         | “_” | “.” | “!” | “~” | “*” | “'” | “(” | “)” | “[” | “]”
      //
      // Also need to encode '!' because it has special meaning (end of tag prefix).
      //
      tagStr = encodeURI(
        state.tag[0] === '!' ? state.tag.slice(1) : state.tag
      ).replace(/!/g, '%21');

      if (state.tag[0] === '!') {
        tagStr = '!' + tagStr;
      } else if (tagStr.slice(0, 18) === 'tag:yaml.org,2002:') {
        tagStr = '!!' + tagStr.slice(18);
      } else {
        tagStr = '!<' + tagStr + '>';
      }

      state.dump = tagStr + ' ' + state.dump;
    }
  }

  return true;
}

function getDuplicateReferences(object, state) {
  var objects = [],
      duplicatesIndexes = [],
      index,
      length;

  inspectNode(object, objects, duplicatesIndexes);

  for (index = 0, length = duplicatesIndexes.length; index < length; index += 1) {
    state.duplicates.push(objects[duplicatesIndexes[index]]);
  }
  state.usedDuplicates = new Array(length);
}

function inspectNode(object, objects, duplicatesIndexes) {
  var objectKeyList,
      index,
      length;

  if (object !== null && typeof object === 'object') {
    index = objects.indexOf(object);
    if (index !== -1) {
      if (duplicatesIndexes.indexOf(index) === -1) {
        duplicatesIndexes.push(index);
      }
    } else {
      objects.push(object);

      if (Array.isArray(object)) {
        for (index = 0, length = object.length; index < length; index += 1) {
          inspectNode(object[index], objects, duplicatesIndexes);
        }
      } else {
        objectKeyList = Object.keys(object);

        for (index = 0, length = objectKeyList.length; index < length; index += 1) {
          inspectNode(object[objectKeyList[index]], objects, duplicatesIndexes);
        }
      }
    }
  }
}

function dump$1(input, options) {
  options = options || {};

  var state = new State(options);

  if (!state.noRefs) getDuplicateReferences(input, state);

  var value = input;

  if (state.replacer) {
    value = state.replacer.call({ '': value }, '', value);
  }

  if (writeNode(state, 0, value, true, true)) return state.dump + '\n';

  return '';
}

var dump_1 = dump$1;

var dumper = {
	dump: dump_1
};

function renamed(from, to) {
  return function () {
    throw new Error('Function yaml.' + from + ' is removed in js-yaml 4. ' +
      'Use yaml.' + to + ' instead, which is now safe by default.');
  };
}


var Type                = type;
var Schema              = schema;
var FAILSAFE_SCHEMA     = failsafe;
var JSON_SCHEMA         = json;
var CORE_SCHEMA         = core;
var DEFAULT_SCHEMA      = _default;
var load                = loader.load;
var loadAll             = loader.loadAll;
var dump                = dumper.dump;
var YAMLException       = exception;

// Re-export all types in case user wants to create custom schema
var types = {
  binary:    binary,
  float:     float,
  map:       map,
  null:      _null,
  pairs:     pairs,
  set:       set,
  timestamp: timestamp,
  bool:      bool,
  int:       int,
  merge:     merge,
  omap:      omap,
  seq:       seq,
  str:       str
};

// Removed functions from JS-YAML 3.0.x
var safeLoad            = renamed('safeLoad', 'load');
var safeLoadAll         = renamed('safeLoadAll', 'loadAll');
var safeDump            = renamed('safeDump', 'dump');

var jsYaml = {
	Type: Type,
	Schema: Schema,
	FAILSAFE_SCHEMA: FAILSAFE_SCHEMA,
	JSON_SCHEMA: JSON_SCHEMA,
	CORE_SCHEMA: CORE_SCHEMA,
	DEFAULT_SCHEMA: DEFAULT_SCHEMA,
	load: load,
	loadAll: loadAll,
	dump: dump,
	YAMLException: YAMLException,
	types: types,
	safeLoad: safeLoad,
	safeLoadAll: safeLoadAll,
	safeDump: safeDump
};




/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Check if module exists (development only)
/******/ 		if (__webpack_modules__[moduleId] === undefined) {
/******/ 			var e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = __webpack_modules__;
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/create fake namespace object */
/******/ 	(() => {
/******/ 		var getProto = Object.getPrototypeOf ? (obj) => (Object.getPrototypeOf(obj)) : (obj) => (obj.__proto__);
/******/ 		var leafPrototypes;
/******/ 		// create a fake namespace object
/******/ 		// mode & 1: value is a module id, require it
/******/ 		// mode & 2: merge all properties of value into the ns
/******/ 		// mode & 4: return value when already ns object
/******/ 		// mode & 16: return value when it's Promise-like
/******/ 		// mode & 8|1: behave like require
/******/ 		__webpack_require__.t = function(value, mode) {
/******/ 			if(mode & 1) value = this(value);
/******/ 			if(mode & 8) return value;
/******/ 			if(typeof value === 'object' && value) {
/******/ 				if((mode & 4) && value.__esModule) return value;
/******/ 				if((mode & 16) && typeof value.then === 'function') return value;
/******/ 			}
/******/ 			var ns = Object.create(null);
/******/ 			__webpack_require__.r(ns);
/******/ 			var def = {};
/******/ 			leafPrototypes = leafPrototypes || [null, getProto({}), getProto([]), getProto(getProto)];
/******/ 			for(var current = mode & 2 && value; (typeof current == 'object' || typeof current == 'function') && !~leafPrototypes.indexOf(current); current = getProto(current)) {
/******/ 				Object.getOwnPropertyNames(current).forEach((key) => (def[key] = () => (value[key])));
/******/ 			}
/******/ 			def['default'] = () => (value);
/******/ 			__webpack_require__.d(ns, def);
/******/ 			return ns;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/ensure chunk */
/******/ 	(() => {
/******/ 		__webpack_require__.f = {};
/******/ 		// This file contains only the entry chunk.
/******/ 		// The chunk loading function for additional chunks
/******/ 		__webpack_require__.e = (chunkId) => {
/******/ 			return Promise.all(Object.keys(__webpack_require__.f).reduce((promises, key) => {
/******/ 				__webpack_require__.f[key](chunkId, promises);
/******/ 				return promises;
/******/ 			}, []));
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/get javascript chunk filename */
/******/ 	(() => {
/******/ 		// This function allow to reference async chunks
/******/ 		__webpack_require__.u = (chunkId) => {
/******/ 			// return url for filenames based on template
/******/ 			return "" + chunkId + ".json-schema-ref-parser.js";
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/global */
/******/ 	(() => {
/******/ 		__webpack_require__.g = (function() {
/******/ 			if (typeof globalThis === 'object') return globalThis;
/******/ 			try {
/******/ 				return this || new Function('return this')();
/******/ 			} catch (e) {
/******/ 				if (typeof window === 'object') return window;
/******/ 			}
/******/ 		})();
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/load script */
/******/ 	(() => {
/******/ 		var inProgress = {};
/******/ 		var dataWebpackPrefix = "$RefParser:";
/******/ 		// loadScript function to load a script via script tag
/******/ 		__webpack_require__.l = (url, done, key, chunkId) => {
/******/ 			if(inProgress[url]) { inProgress[url].push(done); return; }
/******/ 			var script, needAttach;
/******/ 			if(key !== undefined) {
/******/ 				var scripts = document.getElementsByTagName("script");
/******/ 				for(var i = 0; i < scripts.length; i++) {
/******/ 					var s = scripts[i];
/******/ 					if(s.getAttribute("src") == url || s.getAttribute("data-webpack") == dataWebpackPrefix + key) { script = s; break; }
/******/ 				}
/******/ 			}
/******/ 			if(!script) {
/******/ 				needAttach = true;
/******/ 				script = document.createElement('script');
/******/ 		
/******/ 				script.charset = 'utf-8';
/******/ 				if (__webpack_require__.nc) {
/******/ 					script.setAttribute("nonce", __webpack_require__.nc);
/******/ 				}
/******/ 				script.setAttribute("data-webpack", dataWebpackPrefix + key);
/******/ 		
/******/ 				script.src = url;
/******/ 			}
/******/ 			inProgress[url] = [done];
/******/ 			var onScriptComplete = (prev, event) => {
/******/ 				// avoid mem leaks in IE.
/******/ 				script.onerror = script.onload = null;
/******/ 				clearTimeout(timeout);
/******/ 				var doneFns = inProgress[url];
/******/ 				delete inProgress[url];
/******/ 				script.parentNode && script.parentNode.removeChild(script);
/******/ 				doneFns && doneFns.forEach((fn) => (fn(event)));
/******/ 				if(prev) return prev(event);
/******/ 			}
/******/ 			var timeout = setTimeout(onScriptComplete.bind(null, undefined, { type: 'timeout', target: script }), 120000);
/******/ 			script.onerror = onScriptComplete.bind(null, script.onerror);
/******/ 			script.onload = onScriptComplete.bind(null, script.onload);
/******/ 			needAttach && document.head.appendChild(script);
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/publicPath */
/******/ 	(() => {
/******/ 		var scriptUrl;
/******/ 		if (__webpack_require__.g.importScripts) scriptUrl = __webpack_require__.g.location + "";
/******/ 		var document = __webpack_require__.g.document;
/******/ 		if (!scriptUrl && document) {
/******/ 			if (document.currentScript && document.currentScript.tagName.toUpperCase() === 'SCRIPT')
/******/ 				scriptUrl = document.currentScript.src;
/******/ 			if (!scriptUrl) {
/******/ 				var scripts = document.getElementsByTagName("script");
/******/ 				if(scripts.length) {
/******/ 					var i = scripts.length - 1;
/******/ 					while (i > -1 && (!scriptUrl || !/^http(s?):/.test(scriptUrl))) scriptUrl = scripts[i--].src;
/******/ 				}
/******/ 			}
/******/ 		}
/******/ 		// When supporting browsers where an automatic publicPath is not supported you must specify an output.publicPath manually via configuration
/******/ 		// or pass an empty string ("") and set the __webpack_public_path__ variable from your code to use your own logic.
/******/ 		if (!scriptUrl) throw new Error("Automatic publicPath is not supported in this browser");
/******/ 		scriptUrl = scriptUrl.replace(/^blob:/, "").replace(/#.*$/, "").replace(/\?.*$/, "").replace(/\/[^\/]+$/, "/");
/******/ 		__webpack_require__.p = scriptUrl;
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/jsonp chunk loading */
/******/ 	(() => {
/******/ 		// no baseURI
/******/ 		
/******/ 		// object to store loaded and loading chunks
/******/ 		// undefined = chunk not loaded, null = chunk preloaded/prefetched
/******/ 		// [resolve, reject, Promise] = chunk loading, 0 = chunk loaded
/******/ 		var installedChunks = {
/******/ 			"main": 0
/******/ 		};
/******/ 		
/******/ 		__webpack_require__.f.j = (chunkId, promises) => {
/******/ 				// JSONP chunk loading for javascript
/******/ 				var installedChunkData = __webpack_require__.o(installedChunks, chunkId) ? installedChunks[chunkId] : undefined;
/******/ 				if(installedChunkData !== 0) { // 0 means "already installed".
/******/ 		
/******/ 					// a Promise means "currently loading".
/******/ 					if(installedChunkData) {
/******/ 						promises.push(installedChunkData[2]);
/******/ 					} else {
/******/ 						if(true) { // all chunks have JS
/******/ 							// setup Promise in chunk cache
/******/ 							var promise = new Promise((resolve, reject) => (installedChunkData = installedChunks[chunkId] = [resolve, reject]));
/******/ 							promises.push(installedChunkData[2] = promise);
/******/ 		
/******/ 							// start chunk loading
/******/ 							var url = __webpack_require__.p + __webpack_require__.u(chunkId);
/******/ 							// create error before stack unwound to get useful stacktrace later
/******/ 							var error = new Error();
/******/ 							var loadingEnded = (event) => {
/******/ 								if(__webpack_require__.o(installedChunks, chunkId)) {
/******/ 									installedChunkData = installedChunks[chunkId];
/******/ 									if(installedChunkData !== 0) installedChunks[chunkId] = undefined;
/******/ 									if(installedChunkData) {
/******/ 										var errorType = event && (event.type === 'load' ? 'missing' : event.type);
/******/ 										var realSrc = event && event.target && event.target.src;
/******/ 										error.message = 'Loading chunk ' + chunkId + ' failed.\n(' + errorType + ': ' + realSrc + ')';
/******/ 										error.name = 'ChunkLoadError';
/******/ 										error.type = errorType;
/******/ 										error.request = realSrc;
/******/ 										installedChunkData[1](error);
/******/ 									}
/******/ 								}
/******/ 							};
/******/ 							__webpack_require__.l(url, loadingEnded, "chunk-" + chunkId, chunkId);
/******/ 						}
/******/ 					}
/******/ 				}
/******/ 		};
/******/ 		
/******/ 		// no prefetching
/******/ 		
/******/ 		// no preloaded
/******/ 		
/******/ 		// no HMR
/******/ 		
/******/ 		// no HMR manifest
/******/ 		
/******/ 		// no on chunks loaded
/******/ 		
/******/ 		// install a JSONP callback for chunk loading
/******/ 		var webpackJsonpCallback = (parentChunkLoadingFunction, data) => {
/******/ 			var [chunkIds, moreModules, runtime] = data;
/******/ 			// add "moreModules" to the modules object,
/******/ 			// then flag all "chunkIds" as loaded and fire callback
/******/ 			var moduleId, chunkId, i = 0;
/******/ 			if(chunkIds.some((id) => (installedChunks[id] !== 0))) {
/******/ 				for(moduleId in moreModules) {
/******/ 					if(__webpack_require__.o(moreModules, moduleId)) {
/******/ 						__webpack_require__.m[moduleId] = moreModules[moduleId];
/******/ 					}
/******/ 				}
/******/ 				if(runtime) var result = runtime(__webpack_require__);
/******/ 			}
/******/ 			if(parentChunkLoadingFunction) parentChunkLoadingFunction(data);
/******/ 			for(;i < chunkIds.length; i++) {
/******/ 				chunkId = chunkIds[i];
/******/ 				if(__webpack_require__.o(installedChunks, chunkId) && installedChunks[chunkId]) {
/******/ 					installedChunks[chunkId][0]();
/******/ 				}
/******/ 				installedChunks[chunkId] = 0;
/******/ 			}
/******/ 		
/******/ 		}
/******/ 		
/******/ 		var chunkLoadingGlobal = this["webpackChunk$RefParser"] = this["webpackChunk$RefParser"] || [];
/******/ 		chunkLoadingGlobal.forEach(webpackJsonpCallback.bind(null, 0));
/******/ 		chunkLoadingGlobal.push = webpackJsonpCallback.bind(null, chunkLoadingGlobal.push.bind(chunkLoadingGlobal));
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be in strict mode.
(() => {
"use strict";
/*!******************!*\
  !*** ./entry.js ***!
  \******************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _apidevtools_json_schema_ref_parser__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @apidevtools/json-schema-ref-parser */ "./node_modules/@apidevtools/json-schema-ref-parser/dist/lib/index.js");

window.$RefParser = _apidevtools_json_schema_ref_parser__WEBPACK_IMPORTED_MODULE_0__["default"];
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (_apidevtools_json_schema_ref_parser__WEBPACK_IMPORTED_MODULE_0__["default"]);

})();

__webpack_exports__ = __webpack_exports__["default"];
/******/ 	return __webpack_exports__;
/******/ })()
;
});