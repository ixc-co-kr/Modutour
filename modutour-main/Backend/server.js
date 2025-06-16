const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const { initializeDatabase, pool } = require('./config/database');
const ModeTourCrawler = require('./crawler/modeTourCrawler');

const app = express();
const PORT = process.env.PORT || 5001;

// 환경변수 확인
console.log('=== 환경변수 확인 ===');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('PORT:', PORT);
console.log('==================');

// CORS 설정 강화
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 미들웨어 설정
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ⭐ EP 파일 정적 서빙 추가
app.use('/ep', express.static(path.join(__dirname, 'public/ep')));

// ⭐ 파라미터 검증 함수
function validatePaginationParams(page, limit) {
  const validPage = Math.max(1, parseInt(page) || 1);
  const validLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const validOffset = (validPage - 1) * validLimit;
  
  return { page: validPage, limit: validLimit, offset: validOffset };
}

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.query && Object.keys(req.query).length > 0) {
    console.log('쿼리 파라미터:', req.query);
  }
  next();
});

// 헬스 체크 엔드포인트
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    port: PORT
  });
});

// 데이터베이스 테스트 엔드포인트
app.get('/api/db/test', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT 1 as test');
    res.json({
      success: true,
      message: '데이터베이스 연결 정상',
      data: rows
    });
  } catch (error) {
    console.error('데이터베이스 테스트 실패:', error);
    res.status(500).json({
      success: false,
      message: '데이터베이스 연결 실패',
      error: error.message
    });
  }
});

// ⭐ 신규 상품 조회 API 수정
app.get('/api/products/new', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    console.log('파라미터 확인:', { page, limit, offset });

    // ⭐ 모든 컬럼 포함하여 SELECT
    const [products] = await pool.execute(`
      SELECT 
        id, product_code, product_name, price, product_url,
        main_image, category, description, created_at, updated_at,
        has_departure_data, crawling_status
      FROM products 
      WHERE product_code NOT LIKE 'REG%'
      ORDER BY created_at DESC 
      LIMIT ${limit} OFFSET ${offset}
    `);

    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total FROM products WHERE product_code NOT LIKE 'REG%'
    `);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: page,
          limit: limit,
          total: countResult[0].total,
          totalPages: Math.ceil(countResult[0].total / limit)
        }
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

// ⭐ 등록된 상품 조회 API (MySQL 8.0.22+ 호환)
app.get('/api/products/registered', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const status = req.query.status;

    let whereClause = 'WHERE is_deleted = FALSE';
    let queryParams = [];

    if (status) {
      whereClause += ' AND naver_ad_status = ?';
      queryParams.push(status);
    }

    // ⭐ 템플릿 리터럴 사용
    const query = `
      SELECT 
        id, product_code, product_name, price, product_url,
        main_image, category, description, naver_ad_status,
        naver_ad_id, registered_at, updated_at
      FROM registered_products 
      ${whereClause}
      ORDER BY registered_at DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [products] = await pool.execute(query, queryParams);

    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total FROM registered_products ${whereClause}
    `, queryParams);

    // ⭐ 일관된 응답 구조
    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: page,
          limit: limit,
          total: countResult[0].total,
          totalPages: Math.ceil(countResult[0].total / limit)
        }
      }
    });

  } catch (error) {
    console.error('등록된 상품 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '등록된 상품 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// ⭐ 상품 등록 API (자동 EP 생성 포함)
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
        // 신규 상품 정보 조회
        const [productRows] = await connection.execute(
          'SELECT * FROM products WHERE product_code = ?',
          [productCode]
        );

        if (productRows.length === 0) {
          failedProducts.push({ productCode, error: '상품을 찾을 수 없습니다.' });
          continue;
        }

        const product = productRows[0];

        // 이미 등록된 상품인지 확인
        const [existingRows] = await connection.execute(
          'SELECT id FROM registered_products WHERE product_code = ? AND is_deleted = FALSE',
          [productCode]
        );

        if (existingRows.length > 0) {
          failedProducts.push({ productCode, error: '이미 등록된 상품입니다.' });
          continue;
        }

        // 등록된 상품 테이블에 저장
        const [insertResult] = await connection.execute(`
          INSERT INTO registered_products (
            product_code, product_name, price, product_url, 
            main_image, category, description, naver_ad_status, is_deleted
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', FALSE)
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
          naver_ad_status: 'pending'
        });

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

// ⭐ 신규 상품 수정 API
app.put('/api/products/new/:id', async (req, res) => {
  const { id } = req.params;
  const { product_name, category, description, price } = req.body;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 신규 상품 정보 조회
    const [existingProduct] = await connection.execute(
      'SELECT * FROM products WHERE id = ?',
      [parseInt(id)]
    );
    
    if (existingProduct.length === 0) {
      return res.status(404).json({
        success: false,
        message: '상품을 찾을 수 없습니다.'
      });
    }
    
    // 신규 상품 정보 업데이트
    await connection.execute(`
      UPDATE products 
      SET product_name = ?, category = ?, description = ?, price = ?
      WHERE id = ?
    `, [product_name, category, description, price, parseInt(id)]);
    
    res.json({
      success: true,
      message: '상품이 성공적으로 수정되었습니다.',
      data: {
        id: parseInt(id),
        product_name,
        category,
        description,
        price
      }
    });
    
  } catch (error) {
    console.error('신규 상품 수정 실패:', error);
    res.status(500).json({
      success: false,
      message: '상품 수정 중 오류가 발생했습니다.',
      error: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ⭐ 등록된 상품 수정 API (자동 EP 업데이트 포함)
app.put('/api/products/registered/:id', async (req, res) => {
  const { id } = req.params;
  const { product_name, category, description, price } = req.body;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 등록된 상품 정보 조회
    const [existingProduct] = await connection.execute(
      'SELECT * FROM registered_products WHERE id = ? AND is_deleted = FALSE',
      [parseInt(id)]
    );
    
    if (existingProduct.length === 0) {
      return res.status(404).json({
        success: false,
        message: '상품을 찾을 수 없습니다.'
      });
    }
    
    // 등록된 상품 정보 업데이트
    await connection.execute(`
      UPDATE registered_products 
      SET product_name = ?, category = ?, description = ?, price = ?
      WHERE id = ?
    `, [product_name, category, description, price, parseInt(id)]);
    
    // ⭐ 상품 수정 후 자동으로 EP 업데이트
    setTimeout(async () => {
      try {
        console.log('🔄 상품 수정 후 자동 EP 업데이트...');
        const NaverEPService = require('./services/NaverEPService');
        await NaverEPService.generateNaverEP();
        console.log('✅ 자동 EP 업데이트 완료');
      } catch (error) {
        console.error('자동 EP 업데이트 실패:', error);
      }
    }, 1000);
    
    res.json({
      success: true,
      message: '상품이 성공적으로 수정되었습니다.',
      data: {
        id: parseInt(id),
        product_name,
        category,
        description,
        price
      }
    });
    
  } catch (error) {
    console.error('등록된 상품 수정 실패:', error);
    res.status(500).json({
      success: false,
      message: '상품 수정 중 오류가 발생했습니다.',
      error: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ⭐ 등록된 상품 삭제 API (소프트 삭제 + 자동 EP 업데이트)
app.delete('/api/products/registered/:id', async (req, res) => {
  const { id } = req.params;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 기존 상품 정보 조회
    const [existingProduct] = await connection.execute(
      'SELECT * FROM registered_products WHERE id = ? AND is_deleted = FALSE',
      [parseInt(id)]
    );
    
    if (existingProduct.length === 0) {
      return res.status(404).json({
        success: false,
        message: '상품을 찾을 수 없습니다.'
      });
    }
    
    // 소프트 삭제
    await connection.execute(`
      UPDATE registered_products 
      SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW()
      WHERE id = ?
    `, [parseInt(id)]);
    
    // ⭐ 상품 삭제 후 자동으로 EP 업데이트
    setTimeout(async () => {
      try {
        console.log('🔄 상품 삭제 후 자동 EP 업데이트...');
        const NaverEPService = require('./services/NaverEPService');
        await NaverEPService.generateNaverEP();
        console.log('✅ 자동 EP 업데이트 완료');
      } catch (error) {
        console.error('자동 EP 업데이트 실패:', error);
      }
    }, 1000);
    
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
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ⭐ 네이버 EP 생성 API
app.post('/api/naver/generate-ep', async (req, res) => {
  try {
    console.log('🔄 네이버 EP 생성 요청...');
    
    const NaverEPService = require('./services/NaverEPService');
    const result = await NaverEPService.generateNaverEP();
    
    if (result) {
      // 기존 파일 정리
      NaverEPService.cleanupOldEPFiles();
      
      res.json({
        success: true,
        message: `${result.productCount}개 상품의 네이버 EP가 생성되었습니다.`,
        data: result
      });
    } else {
      res.json({
        success: false,
        message: '등록된 상품이 없어 EP를 생성할 수 없습니다.'
      });
    }
    
  } catch (error) {
    console.error('네이버 EP 생성 실패:', error);
    res.status(500).json({
      success: false,
      message: '네이버 EP 생성 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// ⭐ 네이버 EP 상태 조회 API
app.get('/api/naver/ep-status', async (req, res) => {
  try {
    const NaverEPService = require('./services/NaverEPService');
    const status = await NaverEPService.getEPStatus();
    
    res.json({
      success: true,
      data: status
    });
    
  } catch (error) {
    console.error('EP 상태 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: 'EP 상태 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 크롤링 상태 확인
app.get('/api/crawl/status', (req, res) => {
  res.json({
    success: true,
    message: '크롤링 서비스 정상 작동 중',
    schedule: '매일 오전 2시 자동 실행',
    lastRun: new Date().toISOString()
  });
});

// 크롤링 수동 실행
app.post('/api/crawl/run', async (req, res) => {
  try {
    console.log('🔄 수동 크롤링 시작...');
    
    res.json({
      success: true,
      message: '크롤링이 시작되었습니다.',
      timestamp: new Date().toISOString()
    });
    
    setTimeout(() => {
      startCrawling();
    }, 1000);
    
  } catch (error) {
    console.error('수동 크롤링 실패:', error);
    res.status(500).json({
      success: false,
      message: '크롤링 실행 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// ⭐ 크롤링 시작 API
app.post('/api/crawl/start', async (req, res) => {
  try {
    console.log('🔄 수동 크롤링 시작...');
    
    res.json({
      success: true,
      message: '크롤링이 시작되었습니다.',
      timestamp: new Date().toISOString()
    });
    
    setTimeout(() => {
      startCrawling();
    }, 1000);
    
  } catch (error) {
    console.error('수동 크롤링 실패:', error);
    res.status(500).json({
      success: false,
      message: '크롤링 실행 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 404 에러 핸들러
app.use('*', (req, res) => {
  console.log(`404 - 경로를 찾을 수 없음: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `경로를 찾을 수 없습니다: ${req.method} ${req.originalUrl}`,
    availableEndpoints: [
      'GET /api/health',
      'GET /api/products/new',
      'GET /api/products/registered',
      'POST /api/products/register',
      'PUT /api/products/new/:id',
      'PUT /api/products/registered/:id',
      'DELETE /api/products/registered/:id',
      'GET /api/crawl/status',
      'POST /api/crawl/run',
      'POST /api/crawl/start',
      'POST /api/naver/generate-ep',
      'GET /api/naver/ep-status'
    ]
  });
});

// 전역 에러 핸들러
app.use((error, req, res, next) => {
  console.error('전역 에러:', error);
  res.status(500).json({
    success: false,
    message: '서버 내부 오류가 발생했습니다.',
    error: process.env.NODE_ENV === 'development' ? error.message : '내부 서버 오류'
  });
});

// 크롤링 실행 함수
async function startCrawling() {
  try {
    console.log('🚀 자동 크롤링 시작...');
    const crawler = new ModeTourCrawler();
    await crawler.run();
    console.log('✅ 자동 크롤링 완료');
  } catch (error) {
    console.error('❌ 자동 크롤링 실패:', error.message);
  }
}

// 서버 시작 함수
async function startServer() {
  try {
    console.log('🔄 서버 시작 준비 중...');
    
    // 데이터베이스 초기화
    await initializeDatabase();
    
    // 매일 오전 2시에 크롤링 실행
    cron.schedule('0 2 * * *', () => {
      console.log('⏰ 오전 2시 자동 크롤링 시작');
      startCrawling();
    }, {
      timezone: "Asia/Seoul"
    });
    
    // ⭐ 매일 오전 1시에 EP 자동 생성 (네이버 EP 업데이트 시간에 맞춤)
    cron.schedule('0 1 * * *', async () => {
      console.log('⏰ 오전 1시 자동 네이버 EP 생성 시작');
      try {
        const NaverEPService = require('./services/NaverEPService');
        await NaverEPService.generateNaverEP();
        console.log('✅ 자동 네이버 EP 생성 완료');
      } catch (error) {
        console.error('❌ 자동 네이버 EP 생성 실패:', error);
      }
    }, {
      timezone: "Asia/Seoul"
    });
    
    app.listen(PORT, () => {
      console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
      console.log(`🌐 API 엔드포인트: http://localhost:${PORT}/api`);
      console.log('📋 사용 가능한 엔드포인트:');
      console.log('   GET  /api/health');
      console.log('   GET  /api/products/new');
      console.log('   GET  /api/products/registered');
      console.log('   POST /api/products/register');
      console.log('   PUT  /api/products/new/:id');
      console.log('   PUT  /api/products/registered/:id');
      console.log('   DELETE /api/products/registered/:id');
      console.log('   GET  /api/crawl/status');
      console.log('   POST /api/crawl/run');
      console.log('   POST /api/crawl/start');
      console.log('   POST /api/naver/generate-ep');
      console.log('   GET  /api/naver/ep-status');
      console.log('   GET  /ep/* (EP 파일 다운로드)');
      console.log('📊 AWS RDS 연결 상태: 정상');
      console.log('⏰ 크롤링 스케줄: 매일 오전 2시 자동 실행');
      console.log('📄 네이버 EP 스케줄: 매일 오전 1시 자동 생성');
    });
    
  } catch (error) {
    console.error('❌ 서버 시작 실패:', error);
    process.exit(1);
  }
}

// 서버 종료 처리
process.on('SIGINT', async () => {
  console.log('\n🔄 서버 종료 중...');
  
  try {
    if (pool) {
      await pool.end();
      console.log('✅ 데이터베이스 연결 정리 완료');
    }
  } catch (error) {
    console.error('❌ 종료 중 오류:', error);
  }
  
  console.log('👋 서버가 종료되었습니다.');
  process.exit(0);
});

// 서버 시작
startServer();
