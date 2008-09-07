var Jasper = (function() {
  // entrance
  function jasper(input) {
    var ret, sexps = parse(input)
    for (var key in sexps) ret = jeval(this, sexps[key])
    return ret
  }
  jasper.debug = false

  // jasper eval
  function jeval(context, stream) {
    if (emptyp(stream)) return null

    if (stream.constructor == Array) {
      if (emptyp(car(stream))) return null

      if (car(stream).constructor == Array && emptyp(cdr(stream))) {
        return jeval(context, car(stream))
      } else {
        return apply(context, car(stream), cdr(stream))
      }
    } else {
      return valueOfToken(context, stream)
    }
  }

  // important!
  function jevalForms(context, forms) {
    var ret
    for (var key in forms) ret = jeval(context, forms[key])
    return ret
  }

  // evaluate a token
  function valueOfToken(context, token) {
    if (/^([\"0-9].*|true|false|null|undefined)$/.test(token)) {
      // numbers and strings eval to themselves
      return eval(token)
    } else if (/^\'/.test(token)) {
      // quote literal
      return token.slice(1, token.length)
    } else if (typeof token == 'function') {
      return token
    } else {
      // it's a symbol - look it up
      return symbolLookup(context, token)
    }
  }

  // call a function or macro
  function apply(context, name, rest) {
    var result, args = [], form

    form = symbolLookup(context, name)

    if (!form) throw "Form undefined: " + name

    if (form.special || form.macro) {
      args = rest
    } else {
      for (var key in rest) args.push(jeval(context, rest[key]))
    }

    debug('funcall: ' + name + '; args: ' + args.toString())
    result = form.apply(context, args)
    if (result) debug('funcall: ' + name + '; result: ' + result.toString())
    return form.macro ? jeval(context, result) : result
  }

  function symbolLookup(context, target) {
    while (context) {
      if (typeof context[target] != 'undefined') return context[target]
      context = context.parentContext
    }
    throw "Can't find " + target
  }

  // our two parsing methods
  function parse(input) {
    var token, tokens = tokenize(input), stack = []

    while (tokens.length > 0) {
      token = tokens.shift()

      if (token == '(') {
        stack.push(parse(tokens))
      } else if (token == ')') {
        return stack
      } else {
        stack.push(token)
      }
    }

    return stack
  }

  function tokenize(input) {
    if (input.constructor == Array) return input
    var match, token, regexp = /\s*(\(|\)|".+?"|[^\s()]+|$)/g, tokens = []

    while ((match = input.match(regexp)).length > 1) {
      input = input.replace(match[0], '')
      tokens.push( match[0].replace( /^\s+|\s+$/g, '' ) )
    }

    return tokens
  }

  // debug
  this['puts'] = function(string) {
    if (console) return console.log(string)
    if (Ruby) return Ruby.puts(strin)
    if (print) return print(string)
  }

  this['debug'] = function(string) {
    if (jasper.debug) puts(string)
  }

  // everyone's favorites - list building blocks
  this['cons'] = function(a, b) {
    return append([a], b)
  }

  this['car'] = function(sexp) {
    return sexp[0]
  }

  this['cdr'] = function(sexp) {
    return sexp.slice(1, sexp.length)
  }

  // essentials
  this['if'] = function(sif, sthen, selse) {
    return jeval(this, sif) ? jeval(this, sthen) : jevalForms(this, [selse])
  }
  this['if'].special = true

  this['empty?'] = function(sexp) {
    return !sexp || sexp.length == 0
  }
  // alias
  var emptyp = this['empty?']

  this['list'] = function() {
    var i, arr = []
    for (i = 0; i < arguments.length; i++) arr.push(arguments[i])
    return arr
  }

  this['append'] = function() {
    var i, j, arr = []
    for (i = 0; i < arguments.length; i++)
      for (j = 0; j < arguments[i].length; j++)
        arr.push(arguments[i][j])
    return arr
  }

  this['progn'] = function() {
    var i, ret
    for (i = 0; i < arguments.length; i++) ret = jeval(this, arguments[i])
    return ret
  }

  // λ
  this['lambda'] = function(params, rest) {
    rest = Array.prototype.slice.call(arguments, 1, arguments.length)
    return function() {
      var i, context = {}
      context.parentContext = this

      if (params.length > 0) {
        // bind variables
        for (i = 0; i < params.length; i++) {
          if (params[i] == '&rest') {
            i++
            context[params[i]] = Array.prototype.slice.call(arguments, (i-1), arguments.length)
          } else {
            context[params[i]] = arguments[i]
          }
        }
      }

      return jevalForms(context, rest)
    }
  }
  this['lambda'].special = true

  // basic assignment
  this['='] = function(symbol, value) {
    this[symbol] = jeval(this, value)
  }
  this['='].special = true

  // basic comparison
  this['=='] = function(a, b) {
    return a == b
  }

  // can't write this in jasper, you can't apply eval
  this['js'] = function(string) {
    return eval(string)
  }

  // creation of macros
  this['defmacro'] = function(name, args, rest) {
    rest = Array.prototype.slice.call(arguments, 2, arguments.length)
    this[name] = lambda.call(this, args, rest)
    this[name].macro = true
    return null
  }
  this['defmacro'].special = true

  // math primitives
  this['+'] = function() {
    var sum = 0
    for (var i in arguments) sum += arguments[i]
    return sum
  }

  this['-'] = function() {
    var diff = 0
    for (var i in arguments) sum += arguments[i]
    return diff
  }

  this['<']  = function(a, b) { return a < b }
  this['<='] = function(a, b) { return a <= b }
  this['>']  = function(a, b) { return a > b }
  this['>='] = function(a, b) { return a >= b }

  // dirt simple api
  jasper.scope = this

  // Jasper(string)
  return jasper
})();

Jasper.load = function(file) {
  if ('Ruby' in window) {
    Jasper( Ruby.File.read(file) )
  } else if ('XMLHttpRequest' in window) {
    var xhr = new XMLHttpRequest
    xhr.open('GET', file, false)
    xhr.send(null)
    Jasper( xhr.responseText )
  } else {
    throw "Can't load " + file
  }
}

Jasper.init = function() {
  Jasper.load('core.jr')
}