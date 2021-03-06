var Base = require('mocha').reporters.Base,
    corredor = require('corredor-js');


/**
 * Initialize a new socket reporter.
 * @constructor
 * @param {Runner} runner mocha test runner.
 */
function SocketReporter(runner) {
  Base.call(this, runner);

  this.onEnd = this.onEnd.bind(this);
  runner.on('end', this.onEnd);
  this.onFail = this.onFail.bind(this);
  runner.on('fail', this.onFail);
  this.onPass = this.onPass.bind(this);
  runner.on('pass', this.onPass);
  this.onPending = this.onPending.bind(this);
  runner.on('pending', this.onPending);
  this.onSuite = this.onSuite.bind(this);
  runner.on('suite', this.onSuite);
  this.onSuiteEnd = this.onSuiteEnd.bind(this);
  runner.on('suite end', this.onSuiteEnd);

  this.status = 'PASS';
  this.result = new corredor.Publisher();
  this.result.connect('ipc:///tmp/mocha_tbpl_reporter_sink');
}
module.exports = SocketReporter;


SocketReporter.prototype = {
  __proto__: Base.prototype,
  /**
   * Output a summary of the mocha run.
   */
  onEnd: function() {
    this.result.send({action: 'suite_end'});
    this.result.send({action: 'fin'});
    this.result.close();
  },

  /**
   * @param {Test} test failing test.
   * @param {Error} err failure.
   */
  onFail: function(test, err) {
    this.status = 'FAIL';
    this.result.send({action: 'test_status',
                      test: this.getFile(test),
                      status: this.status,
                      subtest: this.getTitle(test),
                      expected: 'PASS'});
  },

  /**
   * @param {Test} test passing test.
   */
  onPass: function(test) {
    this.status = 'PASS';
    this.result.send({action: 'test_status',
                      test: this.getFile(test),
                      subtest: this.getTitle(test),
                      status: this.status});
  },

  /**
   * @param {Test} test pending test.
   */
  onPending: function(test) {
    this.status = 'NOTRUN';
    this.result.send({action: 'test_status',
                      test: this.getFile(test),
                      subtest: this.getTitle(test),
                      status: this.status});
  },

  /**
   * @param {Suite} started test suite.
   */
  onSuite: function(suite) {
    // NOTE: root suites have no attached test, file or manifest,
    // so we treat each test file as a suite
    if (!suite.root) {
      this.result.send({action: 'test_start',
                      test: this.getFile(suite)});
    }
  },

  /**
   * @param {Suite} finished suite.
   */
  onSuiteEnd: function(suite) {
    if (suite.parent && suite.parent.root) {
      var data = {action: 'test_end',
                  test: this.getFile(suite),
                  status: this.status};
      if (this.status != 'PASS') {
        data.expected = 'PASS';
      }
      this.result.send(data);
    }
  },

  /**
   * @param {Test} test some test.
   * @return {string} the title of the test.
   */
  getTitle: function(test) {
    return this.sanitize(test.fullTitle());
  },

  getFile: function(test) {
    if ('file' in test) {
      return test.file;
    }
    if ('parent' in test) {
      return this.getFile(test.parent);
    }

    return null;
  },

  /**
   * @param {string} str some string that could potentially have character
   *     sequences that tbpl would understand.
   * @return {string} sanitized string.
   */
  sanitize: function(str) {
    // These are controversial words and we must censor them!
    return str
        .replace(/PROCESS-CRASH/g, '*************')
        .replace(/TEST-END/g, '********')
        .replace(/TEST-KNOWN-FAIL/g, '***************')
        .replace(/TEST-PASS/g, '*********')
        .replace(/TEST-START/g, '***********')
        .replace(/TEST-UNEXPECTED-FAIL/g, '********************');
  }
};
