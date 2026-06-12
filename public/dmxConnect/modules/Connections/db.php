<?php
// Database Type : "MySQL"
// Database Adapter : "mysql"
$exports = <<<'JSON'
{
    "name": "db",
    "module": "dbconnector",
    "action": "connect",
    "options": {
        "server": "mysql",
        "databaseType": "MySQL",
        "connectionString": "mysql:host=localhost;sslverify=false;port=3307;dbname=task_tracker;user=root;password=%Joanne@01;charset=utf8"
    }
}
JSON;
?>