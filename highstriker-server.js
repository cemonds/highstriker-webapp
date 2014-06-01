#!/usr/bin/env node
var app = require('./app');

app.start(process.env.PORT || 3000);