const mysql = require('mysql');

const pool  = mysql.createPool({
    connectionLimit: 10,
    host: "bmlx3df4ma7r1yh4.cbetxkdyhwsb.us-east-1.rds.amazonaws.com",
    user: "zuhl7jdh3f4x58ie",
    password: "b2jp21a9tv7mjluc",
    database: "zm58ztze96iwwvii"
});

module.exports = pool;