import process from "node:process";
import { db } from "../src/firebase/firebaseAdmin.js";

const loadMysql = async () => {
  try {
    const mod = await import("mysql2/promise");
    return mod.default ?? mod;
  } catch (error) {
    throw new Error("mysql2 is required. Run: npm i mysql2");
  }
};

const mysqlConfig = () => ({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

const checks = [
  { firestore: "team", mysql: "teams" },
  { firestore: "player", mysql: "players" },
  { firestore: "stats", mysql: "stats" },
  { firestore: "matches", mysql: "matches" },
  { firestore: "users", mysql: "app_users" },
];

const main = async () => {
  const mysql = await loadMysql();
  const conn = await mysql.createConnection(mysqlConfig());
  let hasMismatch = false;

  try {
    for (const item of checks) {
      const fsSnap = await db.collection(item.firestore).get();
      const [[row]] = await conn.query(`SELECT COUNT(*) AS c FROM ${item.mysql}`);
      const fsCount = fsSnap.size;
      const mysqlCount = Number(row.c || 0);
      const ok = fsCount === mysqlCount;
      if (!ok) hasMismatch = true;
      console.log(
        `${ok ? "OK   " : "DIFF "} ${item.firestore.padEnd(10)} Firestore=${fsCount} MySQL=${mysqlCount}`
      );
    }
  } finally {
    await conn.end();
  }

  if (hasMismatch) {
    process.exitCode = 2;
  }
};

main().catch((error) => {
  console.error("[error] verify failed:", error.message);
  process.exitCode = 1;
});
