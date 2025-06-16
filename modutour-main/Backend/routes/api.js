const express = require('express');
const { pool } = require('../config/database');
const ModeTourCrawler = require('../crawler/modeTourCrawler');

const router = express.Router();

// 헬스 체크 API
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API 서버가 정상 작동 중입니다.',
    timestamp: new Date().toISOString()
  });
});

// 크롤링 시작 API (다중 JSONL 파일 사용)
router.post('/crawl/start', async (req, res) => {
  try {
    console.log('다중 JSONL + HTTP 크롤링 시작 요청 받음');
    const crawler = new ModeTourCrawler();
    
    // 다중 JSONL 파일 처리 (파일 경로는 크롤러 내부에서 관리)
    crawler.run().then(() => {
      console.log('다중 JSONL + HTTP 크롤링 완료');
    }).catch(error => {
      console.error('크롤링 오류:', error);
    });

    res.json({ 
      success: true, 
      message: '다중 JSONL 데이터와 HTTP 크롤링이 시작되었습니다.' 
    });
  } catch (error) {
    console.error('크롤링 시작 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '크롤링 시작 실패', 
      error: error.message 
    });
  }
});

// 신규 상품 조회 API (동적 패턴 - REG 제외 전체)
router.get('/products/new', async (req, res) => {
  try {
    // REG가 아닌 모든 상품을 신규 상품으로 조회
    const [allProducts] = await pool.execute(`
      SELECT * FROM products 
      WHERE product_code NOT LIKE 'REG%' 
      ORDER BY created_at DESC
    `);
    
    console.log(`신규 상품 조회: ${allProducts.length}개 (REG 제외 전체)`);
    
    res.json({ 
      success: true, 
      count: allProducts.length,
      data: allProducts 
    });
  } catch (error) {
    console.error('신규 상품 조회 실패:', error);
    
    res.json({ 
      success: true, 
      count: 0,
      data: [],
      note: '신규 상품이 없습니다.'
    });
  }
});

// 등록된 상품 조회 API (REG 접두사만)
router.get('/products', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM products WHERE product_code LIKE "REG%" ORDER BY created_at DESC');
    
    console.log(`등록된 상품 조회: ${rows.length}개 (REG 접두사만)`);
    
    res.json({ 
      success: true, 
      count: rows.length,
      data: rows 
    });
  } catch (error) {
    console.error('등록된 상품 조회 실패:', error);
    
    const products = [
      {
        id: 1,
        product_name: '[등록완료] 인천출발 세부 자유여행 3박5일',
        price: '489000',
        product_url: 'https://tourmake.modetour.co.kr/registered/1',
        main_image: 'https://via.placeholder.com/300x200?text=등록완료',
        product_code: 'REG001',
        category: '해외여행',
        description: '등록 완료된 세부 자유여행 패키지입니다.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    
    res.json({ 
      success: true, 
      count: products.length,
      data: products,
      note: '데이터베이스 연결 실패로 임시 데이터를 반환합니다.'
    });
  }
});

// 크롤링 상태 확인 API (한국 시간 변환 적용)
router.get('/crawl/status', async (req, res) => {
  try {
    const [total] = await pool.execute(`
      SELECT COUNT(*) as count, MAX(updated_at) as lastUpdate 
      FROM products 
      WHERE product_code NOT LIKE 'REG%'
    `);
    
    // 한국 시간으로 변환
    let lastUpdateKST = null;
    if (total[0].lastUpdate) {
      const lastUpdateDate = new Date(total[0].lastUpdate);
      lastUpdateKST = lastUpdateDate.toLocaleString('ko-KR', { 
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
    
    console.log(`크롤링 상태 확인: 총 ${total[0].count}개 상품, 최근 업데이트: ${lastUpdateKST}`);
    
    res.json({
      success: true,
      hasData: total[0].count > 0,
      lastUpdate: lastUpdateKST, // 한국 시간으로 변환된 날짜
      productCount: total[0].count
    });
  } catch (error) {
    console.error('상태 확인 실패:', error);
    
    res.json({
      success: true,
      hasData: false,
      lastUpdate: null,
      productCount: 0,
      note: '데이터베이스 연결 실패로 기본 상태를 반환합니다.'
    });
  }
});

// 신규 상품을 등록된 상품으로 이동 (동적 패턴)
router.post('/products/register/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // REG가 아닌 모든 상품에서 해당 ID 찾기
    const [productRows] = await pool.execute('SELECT * FROM products WHERE id = ? AND product_code NOT LIKE "REG%"', [id]);
    
    if (productRows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '신규 상품을 찾을 수 없습니다.' 
      });
    }
    
    const product = productRows[0];
    
    // REG 접두사로 새로운 상품 코드 생성
    const newProductCode = `REG${Date.now().toString().slice(-6)}`;
    
    await pool.execute(
      'UPDATE products SET product_code = ? WHERE id = ?', 
      [newProductCode, id]
    );
    
    console.log(`상품 등록 완료: ${product.product_name} (${product.product_code} → ${newProductCode})`);
    
    res.json({ 
      success: true, 
      message: '상품이 등록되었습니다.' 
    });
  } catch (error) {
    console.error('상품 등록 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '상품 등록 실패', 
      error: error.message 
    });
  }
});

// 상품 저장 API
router.post('/products', async (req, res) => {
  try {
    const { product_name, price, product_url, main_image, product_code, category, description } = req.body;
    
    const insertQuery = `
      INSERT INTO products (product_name, price, product_url, main_image, product_code, category, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        product_name = VALUES(product_name),
        price = VALUES(price),
        main_image = VALUES(main_image),
        category = VALUES(category),
        description = VALUES(description),
        updated_at = CURRENT_TIMESTAMP
    `;
    
    await pool.execute(insertQuery, [
      product_name,
      price,
      product_url,
      main_image,
      product_code,
      category,
      description
    ]);
    
    res.json({ 
      success: true, 
      message: '상품이 성공적으로 저장되었습니다.' 
    });
  } catch (error) {
    console.error('상품 저장 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '상품 저장 실패', 
      error: error.message 
    });
  }
});

// 상품 삭제 API
router.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.execute('DELETE FROM products WHERE id = ?', [id]);
    
    res.json({ 
      success: true, 
      message: '상품이 성공적으로 삭제되었습니다.' 
    });
  } catch (error) {
    console.error('상품 삭제 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '상품 삭제 실패', 
      error: error.message 
    });
  }
});

// 특정 상품 조회 API
router.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.execute('SELECT * FROM products WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '상품을 찾을 수 없습니다.' 
      });
    }
    
    res.json({ 
      success: true, 
      data: rows[0] 
    });
  } catch (error) {
    console.error('상품 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '상품 조회 실패', 
      error: error.message 
    });
  }
});

// 데이터베이스 연결 테스트 API
router.get('/db/test', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.execute('SELECT 1');
    connection.release();
    
    res.json({ 
      success: true, 
      message: 'AWS RDS 데이터베이스 연결이 정상입니다.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('데이터베이스 연결 테스트 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '데이터베이스 연결 실패', 
      error: error.message 
    });
  }
});

// 전체 상품 통계 API (동적 패턴)
router.get('/products/stats/summary', async (req, res) => {
  try {
    // REG가 아닌 모든 상품을 신규 상품으로 계산
    const [newCount] = await pool.execute('SELECT COUNT(*) as count FROM products WHERE product_code NOT LIKE "REG%"');
    const [regCount] = await pool.execute('SELECT COUNT(*) as count FROM products WHERE product_code LIKE "REG%"');
    const [totalCount] = await pool.execute('SELECT COUNT(*) as count FROM products');
    
    res.json({
      success: true,
      data: {
        newProducts: newCount[0].count,
        registeredProducts: regCount[0].count,
        totalProducts: totalCount[0].count
      }
    });
  } catch (error) {
    console.error('상품 통계 조회 실패:', error);
    res.json({
      success: true,
      data: {
        newProducts: 0,
        registeredProducts: 0,
        totalProducts: 0
      },
      note: '통계 조회 실패'
    });
  }
});

module.exports = router;
