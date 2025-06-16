const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('=== database.js 로딩 확인 ===');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('database.js 모듈 로딩 완료');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 20, // 연결 수 증가
  queueLimit: 0,
  acquireTimeout: 60000, // 연결 획득 타임아웃 증가
  timeout: 60000, // 쿼리 타임아웃 증가
  enableKeepAlive: true, // Keep-Alive 활성화
  keepAliveInitialDelay: 10000,
  reconnect: true, // 자동 재연결
  idleTimeout: 900000, // 15분 유휴 타임아웃
  maxIdle: 10, // 최대 유휴 연결 수
  maxReuses: 0, // 연결 재사용 제한 없음
  charset: 'utf8mb4'
});

// 연결 풀 이벤트 리스너 추가
pool.on('connection', function (connection) {
  console.log('새로운 연결이 설정되었습니다. ID: ' + connection.threadId);
});

pool.on('error', function(err) {
  console.error('MySQL 풀 에러:', err);
  if(err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('연결이 끊어졌습니다. 자동 재연결 시도 중...');
  } else {
    throw err;
  }
});

// 데이터베이스 연결 테스트 함수
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ AWS RDS MySQL 연결 성공!');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ 데이터베이스 연결 실패:', error.message);
    return false;
  }
}

// 데이터베이스 초기화 함수
async function initializeDatabase() {
  try {
    console.log('🔄 AWS RDS 연결 준비 중...');
    
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('데이터베이스 연결 실패');
    }
    
    await createTables();
    
    console.log('✅ 데이터베이스 설정 완료');
    return true;
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 실패:', error.message);
    throw error;
  }
}

// 테이블 생성 함수
async function createTables() {
  try {
    console.log('테이블 생성 시작...');
    
    const createProductsTable = `
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_name VARCHAR(255) NOT NULL,
        price VARCHAR(20) NOT NULL,
        product_url TEXT,
        main_image TEXT,
        product_code VARCHAR(50) UNIQUE,
        category VARCHAR(100),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_product_code (product_code),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await pool.execute(createProductsTable);
    console.log('✅ products 테이블 생성/확인 완료');
    
  } catch (error) {
    console.error('❌ 테이블 생성 실패:', error.message);
    throw error;
  }
}

module.exports = { 
  pool, 
  testConnection, 
  initializeDatabase,
  createTables
};
