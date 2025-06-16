const { pool } = require('./database');

console.log('createTables.js 모듈 로딩 시작');

async function createProductsTable() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_name VARCHAR(500) NOT NULL,
      price VARCHAR(100),
      product_url TEXT,
      main_image TEXT,
      product_code VARCHAR(10),
      category VARCHAR(100),
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_product_code (product_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    console.log('테이블 생성 시작...');
    await pool.execute(createTableQuery);
    console.log('✅ products 테이블 생성/확인 완료');
    return true;
  } catch (error) {
    console.error('❌ 테이블 생성 실패:', error);
    return false;
  }
}

console.log('createTables.js 모듈 로딩 완료');
module.exports = { createProductsTable };
