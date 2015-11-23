<?php
    $data = json_decode(file_get_contents("php://input"));
    $description = mysql_real_escape_string($data->description);
    mysql_connect("localhost","root","");
    mysql_select_db("test");
    mysql_query("INSERT INTO items(description) VALUES('".$description."')");
?>