import mysql from "mysql2/promise";

let pool = null;

const getConfig = () => ({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  connectionLimit: Number(process.env.MYSQL_POOL_SIZE || 10),
  waitForConnections: true,
  queueLimit: 0,
});

export const isMysqlConfigured = () =>
  Boolean(
    process.env.MYSQL_HOST &&
      process.env.MYSQL_USER &&
      process.env.MYSQL_DATABASE
  );

export const getMysqlPool = () => {
  if (!isMysqlConfigured()) {
    throw new Error("MySQL is not configured. Missing MYSQL_HOST/MYSQL_USER/MYSQL_DATABASE.");
  }
  if (!pool) {
    pool = mysql.createPool(getConfig());
  }
  return pool;
};

export default getMysqlPool;
