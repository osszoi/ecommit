#!/usr/bin/env node

/* eslint-disable no-var */
/* eslint-disable flowtype/require-valid-file-annotation */
'use strict';

var cli = require(__dirname + '/../index.cjs');
if (!cli.autoRun) {
  cli.main().catch(function(error) {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}