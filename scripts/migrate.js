"use strict";
// Run separately with DATABASE_URL set; never store connection credentials in code.
const fs=require("node:fs");
const path=require("node:path");
const {Pool}=require("pg");
async function main(){
 if(!process.env.DATABASE_URL){
  console.log("No DATABASE_URL configured. Persistent match history is disabled.");
  return;
 }
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
 try{
  for(const file of ["001_initial.sql","002_headquarters.sql"]){
    const sql=fs.readFileSync(path.join(__dirname,"../sql",file),"utf8");
    await pool.query(sql);
  }
  console.log("ROGUE FACTORY schema is up to date.");
 }finally{await pool.end();}
}
main().catch(error=>{console.error("Migration failed:",error.message);process.exitCode=1;});
