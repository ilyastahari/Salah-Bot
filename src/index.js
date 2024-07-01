require = require("esm")(module/*, options*/)
module.exports = require("./app.js")

require('dotenv').config();
console.log(process.env);