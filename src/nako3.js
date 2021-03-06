/**
 * nadesiko v3 (demo version)
 */
const Parser = require('./nako_parser3')
const Lexer = require('./nako_lexer')
const Prepare = require('./nako_prepare')
const NakoGen = require('./nako_gen')
const PluginSystem = require('./plugin_system')

const prepare = new Prepare()
const parser = new Parser()
const lexer = new Lexer()

class NakoRuntimeError extends Error {
  constructor (msg, env) {
    const title = '[実行時エラー]'
    if (env && env.__varslist && env.__varslist[0].line) {
      msg = title + '(' + (env.__varslist[0].line + 1) + ') ' + msg
    } else {
      msg = title + ' ' + msg
    }
    super(msg)
  }
}

class NakoCompiler {
  constructor () {
    this.gen = new NakoGen(this)
    //
    this.debug = false
    this.silent = true
    this.debugParser = false
    this.debugJSCode = true
    this.debugLexer = false
    this.filename = 'inline'
    this.__varslist = null
    this.reset()
    this.gen.addPluginObject('PluginSystem', PluginSystem)
  }

  get log () {
    let s = this.__varslist[0]['表示ログ']
    s = s.replace(/\s+$/, '')
    return s
  }

  /**
   * コードを単語に分割する
   * @param code なでしこのプログラム
   * @param isFirst 最初の呼び出しかどうか
   * @param line なでしこのプログラムの行番号
   * @returns コード (なでしこ)
   */
  static tokenize (code, isFirst, line = 0) {
    return lexer.setInput(prepare.convert(code), isFirst, line)
  }

  static getHeader () {
    return NakoGen.getHeader()
  }

  /**
   * デバッグモードに設定する
   * @param flag デバッグモード
   */
  useDebug (flag = true) {
    this.debug = flag
  }

  /**
   * 環境のリセット
   */
  reset () {
    if (!this.__varslist) { // 初回
      this.__varslist = [{}, {}, {}]
      this.__self = this
    } else { // 二回目以降
      this.__varslist = [this.__varslist[0], {}, {}]
    }
    this.gen.reset()
    this.__vars = this.__varslist[2]
    this.clearLog()
  }

  /**
   * コードを生成
   * @param ast AST
   */
  generate (ast) {
    this.gen.registerFunction(ast)
    const js = this.gen.convGen(ast)
    const def = this.gen.getDefFuncCode()
    if (this.debug && this.debugJSCode) {
      console.log('--- generate ---')
      console.log(def + js)
    }
    return def + js
  }

  /**
   * コードをパースしてASTにする
   * @param code なでしこのプログラム
   * @return AST
   */
  parse (code) {
    // 関数を字句解析と構文解析に登録
    lexer.setFuncList(this.gen.plugins)
    parser.setFuncList(this.gen.plugins)
    parser.debug = this.debug
    // 単語に分割
    const tokens = NakoCompiler.tokenize(code, true)
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i]['type'] === 'code') {
        tokens.splice(i, 1, ... NakoCompiler.tokenize(tokens[i]['value'], false, tokens[i]['line']))
        i--
      }
    }
    if (this.debug && this.debugLexer) {
      console.log('--- lex ---')
      console.log(JSON.stringify(tokens, null, 2))
    }
    // 構文木を作成
    const ast = parser.parse(tokens)
    if (this.debug && this.debugParser) {
      console.log('--- ast ---')
      console.log(JSON.stringify(ast, null, 2))
    }
    return ast
  }

  /**
   * プログラムをコンパイルしてJavaScriptのコードを返す
   * @param code コード (なでしこ)
   * @returns コード (JavaScript)
   */
  compile (code) {
    const ast = this.parse(code)
    const js = this.generate(ast)
    return js
  }

  _run (code, isReset) {
    if (isReset) this.reset()
    if (!this.__varslist[0]['ナデシコバージョン']) {
      this.__varslist = this.getVarsList()
    }
    let js = this.compile(code)
    let __varslist = this.__varslist
    let __vars = this.__vars = this.__varslist[2] // eslint-disable-line
    let __self = this.__self // eslint-disable-line
    try {
      __varslist[0].line = -1 // コンパイルエラーを調べるため
      eval(js) // eslint-disable-line
    } catch (e) {
      this.js = js
      throw new NakoRuntimeError(
        e.name + ':' +
        e.message, this)
    }
    return this
  }

  run (code) {
    return this._run(code, false)
  }

  runReset (code) {
    return this._run(code, true)
  }

  clearLog () {
    this.__varslist[0]['表示ログ'] = ''
  }

  /**
   * eval()実行前に直接JSのオブジェクトを取得する場合
   * @returns {[*,*,*]}
   */
  getVarsList () {
    const v = this.gen.getVarsList()
    return [v[0], v[1], []]
  }

  /**
   * 完全にJSのコードを取得する場合
   * @returns {string}
   */
  getVarsCode () {
    return this.gen.getVarsCode()
  }

  /**
   * プラグイン・オブジェクトを追加(ブラウザ向け)
   * @param name プラグインの名前
   * @param po プラグイン・オブジェクト
   */
  addPluginObject (name, po) {
    this.gen.addPluginObject(name, po)
  }

  /**
   * プラグイン・ファイルを追加(Node.js向け)
   * @param objName オブジェクト名を登録
   * @param path 取り込むモジュールのファイルパス
   * @param po 登録するオブジェクト
   */
  addPluginFile (objName, path, po) {
    this.gen.addPluginFile(objName, path, po)
  }

  addFunc (key, josi, fn) {
    this.gen.addFunc(key, josi, fn)
  }

  setFunc (key, fn) {
    this.gen.setFunc(key, fn)
  }

  getFunc (key) {
    return this.gen.getFunc(key)
  }
}

module.exports = NakoCompiler
/*
// simple test code
const c = new NakoCompiler()
c.debug = true
c.debugParser = true
c.debugLexer = true
c.silent = false
c.runReset('対象日=1504191600を日時変換して「 」まで切り取る。対象日を表示。')
*/
