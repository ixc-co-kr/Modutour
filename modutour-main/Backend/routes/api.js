const express = require('express');
const { pool } = require('../config/database'); // DB 연결 설정
const ModeTourCrawler = require('../crawler/modeTourCrawler'); // 기존 크롤러 모듈
const NaverAdService = require('../services/NaverEPService'); // 기존 네이버 광고 서비스 모듈
const fs = require('fs'); // ✅ 추가: 파일 시스템 모듈
const path = require('path'); // ✅ 추가: 경로 모듈

const router = express.Router();

// --- ✅ 추가: 유틸리티 함수 (EP 파일 생성에 필요) ---

/**
 * 네이버 EP 양식에 맞게 텍스트를 정리하는 함수
 * @param {string} text - 정리할 텍스트
 * @returns {string} - 정리된 텍스트
 */
function sanitizeEPText(text) {
  if (!text) return '';
  return text.replace(/\t|\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * 여행 상품 데이터를 네이버 EP 양식에 맞게 검증하는 함수
 * @param {object} product - 검증할 상품 객체
 * @returns {string[]} - 에러 메시지 배열 (에러가 없으면 빈 배열)
 */
function validateTravelProductData(product) {
  const errors = [];
  if (!product.product_code || product.product_code.length > 50) {
    errors.push('상품 ID는 필수이며 50자 이하여야 합니다.');
  }
  if (!product.product_name || product.product_name.length > 100) {
    errors.push('상품명은 필수이며 100자 이하여야 합니다.');
  }
  const price = parseInt(String(product.price).replace(/[^\d]/g, '')) || 0;
  if (price <= 0) {
    errors.push('가격은 0보다 큰 정수여야 합니다.');
  }
  if (!product.product_url || !product.product_url.startsWith('http')) {
    errors.push('상품 URL은 필수이며 http://로 시작해야 합니다.');
  }
  if (!product.main_image || !product.main_image.startsWith('http')) {
    errors.push('이미지 URL은 필수이며 http://로 시작해야 합니다.');
  }
  return errors;
}

/**
 * 최신 EP 파일을 찾는 함수
 * @returns {object|null} - 최신 EP 파일 정보 또는 null
 */
function getLatestEPFile() {
  try {
    // ✅ 경로 확인: products.js는 'routes' 폴더에 있으므로, '..'로 상위 폴더(Backend)로 이동 후 'public/ep'
    const epDir = path.join(__dirname, '..', 'public', 'ep');
    if (!fs.existsSync(epDir)) {
      fs.mkdirSync(epDir, { recursive: true });
      return null;
    }
    const files = fs.readdirSync(epDir)
      .filter(file => file.startsWith('naver_ep_') && file.endsWith('.txt'))
      .map(file => {
        const filePath = path.join(epDir, file);
        const stats = fs.statSync(filePath);
        return { name: file, path: filePath, mtime: stats.mtime, size: stats.size };
      })
      .sort((a, b) => b.mtime - a.mtime);
    return files.length > 0 ? files[0] : null;
  } catch (error) {
    console.error('최신 EP 파일 찾기 실패:', error);
    return null;
  }
}

// --- 기존 API 라우트 정의 ---

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
    const crawler = new ModeTourCrawler(); // ModeTourCrawler 인스턴스 생성

    // 비동기적으로 크롤링 실행
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

// ⭐ ✅ 추가: 대시보드 및 피드 관리 통계 조회 API
router.get('/dashboard/stats', async (req, res) => {
    try {
      const [regCountResult] = await pool.execute('SELECT COUNT(*) as count FROM registered_products WHERE is_deleted = FALSE');
      const [newCountResult] = await pool.execute('SELECT COUNT(*) as count FROM products WHERE DATE(created_at) = CURDATE() AND product_code NOT LIKE "REG%"');
      
      const totalRegistered = regCountResult[0].count;
      const todayNewCount = newCountResult[0].count;
      
      const latestEPFile = getLatestEPFile(); // EP 파일 정보를 가져오는 유틸리티 함수
      let lastEpTime = '생성된 피드 없음';
      let epProductCount = 0;
      let epUrl = '';

      if (latestEPFile) {
        lastEpTime = latestEPFile.mtime.toLocaleString('ko-KR', {
          year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
        }).replace(/\. /g, '-').replace('.', '').replace(',', '');

        const epContent = fs.readFileSync(latestEPFile.path, 'utf8');
        const beginMatches = epContent.match(/<<<begin>>>/g);
        epProductCount = beginMatches ? beginMatches.length : 0;
        epUrl = `https://modetour.name/ep/${latestEPFile.name}`;
      }
      
      res.json({
          success: true,
          message: '피드 관리 통계 조회 성공',
          data: {
              totalRegistered: totalRegistered,
              todayNewCount: todayNewCount,
              lastEpTime: lastEpTime,
              epProductCount: epProductCount,
              epUrl: epUrl
          }
      });
    } catch (error) {
        console.error('대시보드 통계 조회 실패:', error);
        res.status(500).json({ success: false, message: '통계 조회 실패', error: error.message });
    }
});

// ⭐ ✅ 추가: 수동 피드 생성 API
router.post('/feed/generate', async (req, res) => {
  try {
    const [products] = await pool.execute(
      'SELECT * FROM registered_products WHERE is_deleted = FALSE ORDER BY registered_at DESC'
    );
    if (products.length === 0) {
      return res.status(400).json({ success: false, message: '등록된 상품이 없어 피드를 생성할 수 없습니다.' });
    }
    
    const generateNumber = Date.now();
    const epFileName = `naver_ep_${generateNumber}.txt`;
    const epDir = path.join(__dirname, '..', 'public', 'ep'); // EP 파일 저장 경로
    const epFilePath = path.join(epDir, epFileName);

    if (!fs.existsSync(epDir)) {
      fs.mkdirSync(epDir, { recursive: true });
    }
    
    let epContent = '';
    let validProducts = 0;
    
    products.forEach(product => {
      const errors = validateTravelProductData(product); // EP 데이터 검증 유틸리티 함수
      if (errors.length > 0) {
        console.warn(`상품 ${product.product_code} 검증 실패:`, errors);
        return;
      }
      epContent += `<<<begin>>>\n<<<mapid>>>${sanitizeEPText(product.product_code)}\n<<<pname>>>${sanitizeEPText(product.product_name)}\n`;
      const price = parseInt(String(product.price).replace(/[^\d]/g, '')) || 0;
      epContent += `<<<price>>>${price}\n<<<pgurl>>>${product.product_url}\n<<<igurl>>>${product.main_image}\n`;
      const travelCategory = product.category || '해외여행';
      epContent += `<<<cate1>>>${sanitizeEPText(travelCategory)}\n<<<deliv>>>0\n`;
      if (travelCategory) epContent += `<<<brand>>>${sanitizeEPText(travelCategory)}\n`;
      if (product.description) epContent += `<<<event>>>${sanitizeEPText(product.description).substring(0, 50)}\n`;
      epContent += `<<<ftend>>>\n\n`;
      validProducts++;
    });

    if (validProducts === 0) {
      return res.status(400).json({ success: false, message: '유효한 상품이 없어 EP 파일을 생성할 수 없습니다.' });
    }
    
    fs.writeFileSync(epFilePath, epContent, 'utf8');
    
    res.json({
      success: true, message: `EP 피드 생성 완료 (유효한 상품 ${validProducts}개)`,
      data: {
        fileName: epFileName, validProducts: validProducts,
        epUrl: `https://modetour.name/ep/${epFileName}`,
        generatedAt: new Date().toLocaleString('ko-KR')
      }
    });
  } catch (error) {
    console.error('EP 피드 생성 오류:', error);
    res.status(500).json({ success: false, message: 'EP 피드 생성 실패', error: error.message });
  }
});

module.exports = router;
