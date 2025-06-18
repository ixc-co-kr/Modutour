const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const cron = require('node-cron');
const path = require('path');
const ModeTourCrawler = require('./crawler/modeTourCrawler');

const app = express();
const PORT = process.env.PORT || 5001;

// ⭐ CORS 설정 (모든 도메인 허용)
app.use(cors({
  origin: ['http://localhost:5173','https://modetour.name'],  // Vite dev 서버(또는 CRA) 주소
  credentials: true,
}));
// preflight (OPTIONS) 도 허용
app.options('*', cors({
  origin: ['http://localhost:5173','https://modetour.name'],
  credentials: true,
}));

// ⭐ 응답 크기 제한 설정
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ⭐ 데이터베이스 연결 설정
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'modetour',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
});

// ⭐ 데이터베이스 연결 테스트
async function testDatabaseConnection() {
  try {
    console.log('🔄 AWS RDS 연결 준비 중...');
    const connection = await pool.getConnection();
    const connectionId = connection.threadId;
    console.log(`새로운 연결이 설정되었습니다. ID: ${connectionId}`);
    
    await connection.execute('SELECT 1');
    console.log('✅ AWS RDS MySQL 연결 성공!');
    
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ 데이터베이스 연결 실패:', error.message);
    return false;
  }
}

// ⭐ 테이블 생성 함수
async function createTables() {
  try {
    console.log('테이블 생성 시작...');
    const connection = await pool.getConnection();
    
    // products 테이블 생성
    const createProductsTable = `
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_name VARCHAR(500) NOT NULL,
        price VARCHAR(50),
        product_url TEXT,
        main_image TEXT,
        product_code VARCHAR(100) UNIQUE,
        category VARCHAR(100) DEFAULT '해외여행',
        description TEXT,
        has_departure_data BOOLEAN DEFAULT FALSE,
        crawling_status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_product_code (product_code),
        INDEX idx_category (category),
        INDEX idx_crawling_status (crawling_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    
    // ⭐ registered_products 테이블 생성 (네이버 EP용)
    const createRegisteredProductsTable = `
      CREATE TABLE IF NOT EXISTS registered_products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_code VARCHAR(100) UNIQUE NOT NULL,
        product_name VARCHAR(500) NOT NULL,
        price VARCHAR(50),
        product_url TEXT,
        main_image TEXT,
        category VARCHAR(100) DEFAULT '해외여행',
        description TEXT,
        naver_ad_status VARCHAR(50) DEFAULT 'pending',
        naver_ad_id VARCHAR(100),
        is_deleted BOOLEAN DEFAULT FALSE,
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_product_code (product_code),
        INDEX idx_naver_ad_status (naver_ad_status),
        INDEX idx_is_deleted (is_deleted)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    
    await connection.execute(createProductsTable);
    console.log('✅ products 테이블 생성/확인 완료');
    
    await connection.execute(createRegisteredProductsTable);
    console.log('✅ registered_products 테이블 생성/확인 완료');
    
    connection.release();
  } catch (error) {
    console.error('❌ 테이블 생성 실패:', error.message);
    throw error;
  }
}

// ⭐ 크롤링 실행 함수 (전체 모드로 수정)
async function startCrawling(isTestMode = false) {
  try {
    if (isTestMode) {
      console.log('🚀 1페이지 테스트 크롤링 시작...');
    } else {
      console.log('🚀 전체 크롤링 시작...');
      console.log('📊 예상 처리량: 372개 URL × 최대 100페이지 = 최대 37,200페이지');
      console.log('⏱️ 예상 소요시간: 3-6시간');
    }
    
    const crawler = new ModeTourCrawler();
    await crawler.run(isTestMode);
    
    if (isTestMode) {
      console.log('✅ 1페이지 테스트 크롤링 완료');
    } else {
      console.log('✅ 전체 크롤링 완료');
    }
  } catch (error) {
    console.error('❌ 크롤링 실패:', error.message);
  }
}

// ⭐ API 라우트 설정

// 1. 테스트 크롤링 API (1페이지만)
app.post('/api/crawl/test', async (req, res) => {
  try {
    console.log('🔄 1페이지 테스트 크롤링 시작...');
    
    res.json({
      success: true,
      message: '1페이지 테스트 크롤링이 시작되었습니다.',
      timestamp: new Date().toISOString()
    });
    
    setTimeout(() => {
      startCrawling(true);
    }, 1000);
    
  } catch (error) {
    console.error('테스트 크롤링 실패:', error);
    res.status(500).json({
      success: false,
      message: '테스트 크롤링 실행 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// ⭐ 2. 전체 크롤링 API (수정됨)
app.post('/api/crawl/start', async (req, res) => {
  try {
    console.log('🔄 전체 크롤링 시작...');
    
    res.json({
      success: true,
      message: '전체 크롤링이 시작되었습니다. 372개 URL의 모든 페이지를 크롤링합니다.',
      estimatedTime: '3-6시간',
      expectedPages: '최대 37,200페이지',
      timestamp: new Date().toISOString()
    });
    
    setTimeout(() => {
      startCrawling(false); // ⭐ 전체 모드로 실행
    }, 1000);
    
  } catch (error) {
    console.error('전체 크롤링 실패:', error);
    res.status(500).json({
      success: false,
      message: '전체 크롤링 실행 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 3. 크롤링 상태 확인 API
app.get('/api/crawl/status', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    const [rows] = await connection.execute(
      'SELECT COUNT(*) as count FROM products WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)'
    );
    
    const recentCount = rows[0].count;
    
    connection.release();
    
    res.json({
      success: true,
      status: 'running',
      recentProducts: recentCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('상태 확인 실패:', error);
    res.status(500).json({
      success: false,
      message: '상태 확인 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// ⭐ 대시보드 통계 API (절대 경로 사용)
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    console.log('대시보드 통계 조회 시작...');
    
    const connection = await pool.getConnection();
    
    // 1. 총 등록 상품 수
    const [totalRegistered] = await connection.execute(`
      SELECT COUNT(*) as total FROM registered_products WHERE is_deleted = FALSE
    `);
    
    // 2. 오늘 신규 수집 수
    const [todayNew] = await connection.execute(`
      SELECT COUNT(*) as today_count FROM products 
      WHERE DATE(created_at) = CURDATE() AND product_code NOT LIKE 'REG%'
    `);
    
    // ⭐ 3. EP 파일 정보 조회 (절대 경로 사용)
    const fs = require('fs');
    const path = require('path');
    let lastEpTime = null;
    let epUrl = null;
    let epFileName = null;
    
    try {
      // ⭐ 절대 경로 사용
      const epDirectory = path.join(__dirname, 'public', 'ep');
      console.log('EP 디렉토리 경로:', epDirectory);
      
      // 디렉토리가 없으면 생성
      if (!fs.existsSync(epDirectory)) {
        fs.mkdirSync(epDirectory, { recursive: true });
        console.log('EP 디렉토리 생성됨:', epDirectory);
      }
      
      // 파일 목록 조회
      const allFiles = fs.readdirSync(epDirectory);
      console.log('EP 디렉토리 전체 파일:', allFiles);
      
      const files = allFiles
        .filter(file => file.endsWith('.txt'))
        .map(file => {
          const filePath = path.join(epDirectory, file);
          const stats = fs.statSync(filePath);
          return {
            fileName: file,
            createdAt: stats.mtime,
            size: stats.size
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
      
      console.log('EP 파일 목록:', files);
      
      if (files.length > 0) {
        epFileName = files[0].fileName;
        lastEpTime = files[0].createdAt.toISOString().slice(0, 16).replace('T', ' ');
        epUrl = `http://localhost:${PORT}/ep/${epFileName}`;
        
        console.log('최신 EP 파일:', {
          fileName: epFileName,
          lastEpTime,
          epUrl,
          size: files[0].size
        });
      } else {
        console.log('EP 파일이 없습니다.');
        epUrl = null;
      }
      
    } catch (epError) {
      console.error('EP 파일 정보 조회 실패:', epError);
    }
    
    connection.release();
    
    const stats = {
      totalRegistered: totalRegistered[0].total,
      todayNewCount: todayNew[0].today_count,
      lastEpTime: lastEpTime || new Date().toISOString().slice(0, 16).replace('T', ' '),
      epUrl: epUrl,
      epFileName: epFileName
    };
    
    console.log('대시보드 통계:', stats);
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('대시보드 통계 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '대시보드 통계 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// ⭐ EP 파일 서빙 경로 수정
app.use('/ep', express.static(path.join(__dirname, 'public', 'ep')));


// ⭐ 5. 신규 상품 조회 API (description 필드 추가)
app.get('/api/products/new', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    
    console.log('신규 상품 조회 파라미터:', { page, limit, offset });

    const connection = await pool.getConnection();

    // ⭐ 전체 개수 확인
    const countQuery = `SELECT COUNT(*) as total FROM products WHERE product_code NOT LIKE 'REG%'`;
    const [countResult] = await connection.execute(countQuery);
    
    console.log('데이터베이스 전체 신규 상품 수:', countResult[0].total);

    // ⭐ 실제 상품 조회 (description 필드 추가)
    const productQuery = `
      SELECT 
        id, product_code, product_name, price, product_url,
        main_image, category, description, created_at, updated_at,
        has_departure_data, crawling_status
      FROM products 
      WHERE product_code NOT LIKE 'REG%'
      ORDER BY created_at DESC 
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    
    const [products] = await connection.execute(productQuery);

    console.log('실제 조회된 상품 수:', products.length);
    if (products.length > 0) {
      console.log('첫 번째 상품:', products[0]?.product_name);
      console.log('첫 번째 상품 설명:', products[0]?.description?.substring(0, 50) + '...');
    }

    connection.release();

    res.json({
      success: true,
      data: products,
      pagination: {
        page: page,
        limit: limit,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });

  } catch (error) {
    console.error('신규 상품 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '신규 상품 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// ⭐ 6. 등록된 상품 조회 API (디버깅 강화)
app.get('/api/products/registered', async (req, res) => {
  let connection;
  try {
    console.log('=== 등록된 상품 조회 API 시작 ===');
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    console.log('요청 파라미터:', { page, limit, offset });

    connection = await pool.getConnection();
    console.log('DB 연결 성공');

    // ⭐ 테이블 존재 및 데이터 확인
    const [tableCheck] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'registered_products'
    `);

    console.log('테이블 존재 여부:', tableCheck[0].count > 0);

    if (tableCheck[0].count === 0) {
      throw new Error('registered_products 테이블이 존재하지 않습니다.');
    }

    // ⭐ 전체 데이터 수 확인
    const [countResult] = await connection.execute(`
      SELECT COUNT(*) as total FROM registered_products WHERE is_deleted = FALSE
    `);

    console.log('전체 등록된 상품 수:', countResult[0].total);

    // ⭐ 실제 데이터 조회 (컬럼별로 안전하게)
    const [products] = await connection.execute(`
      SELECT 
        id, 
        product_code, 
        product_name, 
        COALESCE(price, '') as price,
        COALESCE(product_url, '') as product_url,
        COALESCE(main_image, '') as main_image,
        COALESCE(category, '해외여행') as category,
        COALESCE(description, '') as description,
        COALESCE(naver_ad_status, 'pending') as naver_ad_status,
        COALESCE(naver_ad_id, '') as naver_ad_id,
        registered_at,
        updated_at
      FROM registered_products 
      WHERE is_deleted = FALSE
      ORDER BY registered_at DESC 
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `);

    console.log('조회된 상품 수:', products.length);
    if (products.length > 0) {
      console.log('첫 번째 상품:', {
        id: products[0].id,
        product_code: products[0].product_code,
        product_name: products[0].product_name?.substring(0, 50)
      });
    }

    const responseData = {
      success: true,
      data: products,
      pagination: {
        page: page,
        limit: limit,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    };

    console.log('응답 데이터 구조:', {
      success: responseData.success,
      dataLength: responseData.data.length,
      pagination: responseData.pagination
    });

    res.json(responseData);
    console.log('=== API 응답 완료 ===');

  } catch (error) {
    console.error('=== 등록된 상품 조회 실패 ===');
    console.error('에러 타입:', error.constructor.name);
    console.error('에러 메시지:', error.message);
    console.error('에러 스택:', error.stack);
    
    res.status(500).json({
      success: false,
      message: '등록된 상품 조회 중 오류가 발생했습니다.',
      error: error.message,
      errorType: error.constructor.name
    });
  } finally {
    if (connection) {
      connection.release();
      console.log('DB 연결 해제');
    }
  }
});

// ⭐ 7. 신규 상품 수정 후 등록 API
app.post('/api/products/save-and-register', async (req, res) => {
  const { id, product_name, category, description, price } = req.body;
  
  if (!id) {
    return res.status(400).json({
      success: false,
      message: '상품 ID가 필요합니다.'
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    // ⭐ 1. 신규 상품 정보 업데이트
    await connection.execute(`
      UPDATE products 
      SET product_name = ?, category = ?, description = ?, price = ?
      WHERE id = ?
    `, [product_name, category, description, price, parseInt(id)]);
    
    // ⭐ 2. 업데이트된 상품 정보 조회
    const [productRows] = await connection.execute(
      'SELECT * FROM products WHERE id = ?',
      [parseInt(id)]
    );
    
    if (productRows.length === 0) {
      throw new Error('상품을 찾을 수 없습니다.');
    }
    
    const product = productRows[0];
    
    // ⭐ 3. 이미 등록된 상품인지 확인
    const [existingRows] = await connection.execute(
      'SELECT id FROM registered_products WHERE product_code = ? AND is_deleted = FALSE',
      [product.product_code]
    );

    if (existingRows.length > 0) {
      throw new Error('이미 등록된 상품입니다.');
    }
    
    // ⭐ 4. registered_products 테이블에 저장
    const [insertResult] = await connection.execute(`
      INSERT INTO registered_products (
        product_code, product_name, price, product_url, 
        main_image, category, description, naver_ad_status, 
        is_deleted, registered_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', FALSE, NOW())
    `, [
      product.product_code,
      product.product_name,
      product.price,
      product.product_url,
      product.main_image,
      product.category,
      product.description
    ]);
    
    await connection.commit();
    
    // ⭐ 5. 자동 EP 생성
    setTimeout(async () => {
      try {
        console.log('🔄 저장 후 등록 완료 - 자동 EP 생성...');
        const NaverEPService = require('./services/NaverEPService');
        await NaverEPService.generateNaverEP();
        console.log('✅ 자동 EP 생성 완료');
      } catch (error) {
        console.error('자동 EP 생성 실패:', error);
      }
    }, 1000);
    
    res.json({
      success: true,
      message: '상품이 저장 후 등록되었습니다.',
      data: {
        id: insertResult.insertId,
        product_code: product.product_code,
        product_name: product.product_name,
        registered_at: new Date()
      }
    });
    
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('롤백 실패:', rollbackError.message);
      }
    }
    console.error('저장 후 등록 실패:', error);
    res.status(500).json({
      success: false,
      message: error.message || '저장 후 등록 중 오류가 발생했습니다.',
      error: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ⭐ 8. 상품 등록 API
app.post('/api/products/register', async (req, res) => {
  const { productCodes } = req.body;
  
  if (!productCodes || !Array.isArray(productCodes) || productCodes.length === 0) {
    return res.status(400).json({
      success: false,
      message: '등록할 상품을 선택해주세요.'
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const registeredProducts = [];
    const failedProducts = [];

    for (const productCode of productCodes) {
      try {
        // ⭐ 신규 상품 정보 조회
        const [productRows] = await connection.execute(
          'SELECT * FROM products WHERE product_code = ?',
          [productCode]
        );

        if (productRows.length === 0) {
          failedProducts.push({ productCode, error: '상품을 찾을 수 없습니다.' });
          continue;
        }

        const product = productRows[0];

        // ⭐ 이미 등록된 상품인지 확인
        const [existingRows] = await connection.execute(
          'SELECT id FROM registered_products WHERE product_code = ? AND is_deleted = FALSE',
          [productCode]
        );

        if (existingRows.length > 0) {
          failedProducts.push({ productCode, error: '이미 등록된 상품입니다.' });
          continue;
        }

        // ⭐ registered_products 테이블에 저장
        const [insertResult] = await connection.execute(`
          INSERT INTO registered_products (
            product_code, product_name, price, product_url, 
            main_image, category, description, naver_ad_status, 
            is_deleted, registered_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', FALSE, NOW())
        `, [
          product.product_code,
          product.product_name,
          product.price,
          product.product_url,
          product.main_image,
          product.category,
          product.description
        ]);

        registeredProducts.push({
          ...product,
          id: insertResult.insertId,
          naver_ad_status: 'pending',
          registered_at: new Date()
        });

        console.log(`✅ 상품 등록 완료: ${product.product_name} (${product.product_code})`);

      } catch (error) {
        console.error(`상품 ${productCode} 등록 실패:`, error);
        failedProducts.push({ productCode, error: error.message });
      }
    }

    await connection.commit();

    // ⭐ 상품 등록 완료 후 자동으로 EP 생성
    if (registeredProducts.length > 0) {
      setTimeout(async () => {
        try {
          console.log('🔄 상품 등록 완료 후 자동 EP 생성...');
          const NaverEPService = require('./services/NaverEPService');
          await NaverEPService.generateNaverEP();
          console.log('✅ 자동 EP 생성 완료');
        } catch (error) {
          console.error('자동 EP 생성 실패:', error);
        }
      }, 2000);
    }

    res.json({
      success: true,
      message: `${registeredProducts.length}개 상품이 등록되었습니다.`,
      data: {
        registered: registeredProducts,
        failed: failedProducts,
        summary: {
          total: productCodes.length,
          success: registeredProducts.length,
          failed: failedProducts.length
        }
      }
    });

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('롤백 실패:', rollbackError.message);
      }
    }
    console.error('상품 등록 실패:', error);
    res.status(500).json({
      success: false,
      message: '상품 등록 중 오류가 발생했습니다.',
      error: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ⭐ 9. 등록된 상품 수정 API
app.put('/api/products/registered/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const { product_name, category, description, price } = req.body;
    
    const connection = await pool.getConnection();
    
    const [result] = await connection.execute(`
      UPDATE registered_products 
      SET product_name = ?, category = ?, description = ?, price = ?
      WHERE id = ? AND is_deleted = FALSE
    `, [product_name, category, description, price, productId]);
    
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '수정할 상품을 찾을 수 없습니다.'
      });
    }
    
    res.json({
      success: true,
      message: '상품이 성공적으로 수정되었습니다.'
    });
  } catch (error) {
    console.error('상품 수정 실패:', error);
    res.status(500).json({
      success: false,
      message: '상품 수정 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// ⭐ 10. 등록된 상품 삭제 API (소프트 삭제)
app.delete('/api/products/registered/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    
    const connection = await pool.getConnection();
    
    const [result] = await connection.execute(
      'UPDATE registered_products SET is_deleted = TRUE WHERE id = ?',
      [productId]
    );
    
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '삭제할 상품을 찾을 수 없습니다.'
      });
    }
    
    res.json({
      success: true,
      message: '상품이 성공적으로 삭제되었습니다.'
    });
  } catch (error) {
    console.error('상품 삭제 실패:', error);
    res.status(500).json({
      success: false,
      message: '상품 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// ⭐ EP 파일 서빙을 위한 정적 파일 라우트 추가
app.use('/ep', express.static('./public/ep'));

// ⭐ 자동 크롤링 스케줄 설정 (매일 오전 1시 - 전체 크롤링)
cron.schedule('0 1 * * *', () => {
  console.log('📄 스케줄: 매일 오전 1시 전체 크롤링 및 네이버 EP 자동 생성');
  startCrawling(false); // ⭐ 전체 모드로 실행
}, {
  timezone: "Asia/Seoul"
});

// ⭐ 서버 시작 함수
async function startServer() {
  try {
    console.log('🔄 서버 시작 준비 중...');
    
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      throw new Error('데이터베이스 연결 실패');
    }
    
    await createTables();
    console.log('✅ 데이터베이스 설정 완료');
    
    app.listen(PORT, () => {
      console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
      console.log(`📄 스케줄: 매일 오전 1시 전체 크롤링 자동 실행`);
      console.log('');
      console.log('🔗 사용 가능한 API:');
      console.log(`   - POST http://localhost:${PORT}/api/crawl/test (1페이지 테스트)`);
      console.log(`   - POST http://localhost:${PORT}/api/crawl/start (전체 크롤링)`);
      console.log(`   - GET  http://localhost:${PORT}/api/crawl/status (상태 확인)`);
      console.log(`   - GET  http://localhost:${PORT}/api/dashboard/stats (대시보드 통계)`);
      console.log(`   - GET  http://localhost:${PORT}/api/products/new (신규 상품)`);
      console.log(`   - GET  http://localhost:${PORT}/api/products/registered (등록 상품)`);
      console.log(`   - POST http://localhost:${PORT}/api/products/save-and-register (저장 후 등록)`);
      console.log(`   - GET  http://localhost:${PORT}/ep/ (EP 파일 다운로드)`);
    });
    
  } catch (error) {
    console.error('❌ 서버 시작 실패:', error.message);
    process.exit(1);
  }
}

// ⭐ 서버 종료 처리
process.on('SIGINT', async () => {
  console.log('\n🔄 서버 종료 중...');
  try {
    await pool.end();
    console.log('✅ 데이터베이스 연결 정리 완료');
  } catch (error) {
    console.error('❌ 데이터베이스 연결 정리 실패:', error.message);
  }
  console.log('👋 서버가 종료되었습니다.');
  process.exit(0);
});

// ⭐ 서버 시작
startServer();

// ⭐ pool 객체를 다른 모듈에서 사용할 수 있도록 export
module.exports = { pool };
