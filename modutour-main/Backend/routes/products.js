const express = require('express');
const { pool } = require('../config/database'); // ✅ 경로 확인: db 연결 설정 파일
const NaverAdService = require('../services/NaverEPService'); // ✅ 기존 서비스 파일
const fs = require('fs'); // 파일 시스템 모듈 추가
const path = require('path'); // 경로 모듈 추가

const router = express.Router();

// --- 유틸리티 함수 (EP 파일 생성에 필요) ---

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

// --- API 라우트 정의 ---

// ✅ (기존 코드) 상품 등록 API
router.post('/register', async (req, res) => {
  const { productCodes } = req.body;
  if (!productCodes || !Array.isArray(productCodes) || productCodes.length === 0) {
    return res.status(400).json({ success: false, message: '등록할 상품을 선택해주세요.' });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const registeredProducts = [];
    const failedProducts = [];
    for (const productCode of productCodes) {
      try {
        const [productRows] = await connection.execute('SELECT * FROM products WHERE product_code = ?', [productCode]);
        if (productRows.length === 0) {
          failedProducts.push({ productCode, error: '상품을 찾을 수 없습니다.' });
          continue;
        }
        const product = productRows[0];
        const [existingRows] = await connection.execute(
          'SELECT id FROM registered_products WHERE product_code = ? AND is_deleted = FALSE',
          [productCode]
        );
        if (existingRows.length > 0) {
          failedProducts.push({ productCode, error: '이미 등록된 상품입니다.' });
          continue;
        }
        const [insertResult] = await connection.execute(`
          INSERT INTO registered_products (product_code, product_name, price, product_url, 
          main_image, category, description, naver_ad_status, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', FALSE)
        `, [
          product.product_code, product.product_name, product.price, product.product_url, 
          product.main_image, product.category, product.description
        ]);
        const registeredProductId = insertResult.insertId;
        try {
          const naverResult = await NaverAdService.uploadProductToExistingAds({
            productId: registeredProductId, productName: product.product_name, price: product.price,
            productUrl: product.product_url, description: product.description
          });
          await connection.execute(`
            UPDATE registered_products SET naver_ad_status = 'uploaded', naver_ad_id = ?, naver_ad_group_id = ? WHERE id = ?
          `, [naverResult.adId, naverResult.adGroupId, registeredProductId]);
          await connection.execute(`
            INSERT INTO naver_ad_logs (product_id, action_type, status, request_data, response_data) VALUES (?, 'create', 'success', ?, ?)
          `, [registeredProductId, JSON.stringify({ product }), JSON.stringify(naverResult)]);
          registeredProducts.push({
            ...product, id: registeredProductId, naver_ad_status: 'uploaded',
            naver_ad_id: naverResult.adId, naver_ad_group_name: naverResult.adGroupName
          });
        } catch (naverError) {
          console.error('네이버 광고 업로드 실패:', naverError);
          await connection.execute(`
            UPDATE registered_products SET naver_ad_status = 'failed' WHERE id = ?
          `, [registeredProductId]);
          await connection.execute(`
            INSERT INTO naver_ad_logs (product_id, action_type, status, request_data, error_message) VALUES (?, 'create', 'failed', ?, ?)
          `, [registeredProductId, JSON.stringify({ product }), naverError.message]);
          registeredProducts.push({
            ...product, id: registeredProductId, naver_ad_status: 'failed', naver_error: naverError.message
          });
        }
      } catch (error) {
        console.error(`상품 ${productCode} 등록 실패:`, error);
        failedProducts.push({ productCode, error: error.message });
      }
    }
    await connection.commit();
    res.json({
      success: true, message: `${registeredProducts.length}개 상품이 기존 광고에 등록되었습니다.`,
      data: {
        registered: registeredProducts, failed: failedProducts,
        summary: { total: productCodes.length, success: registeredProducts.length, failed: failedProducts.length,
                   naverSuccess: registeredProducts.filter(p => p.naver_ad_status === 'uploaded').length,
                   naverFailed: registeredProducts.filter(p => p.naver_ad_status === 'failed').length }
      }
    });
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch (rollbackError) { console.error('롤백 실패:', rollbackError.message); } }
    console.error('상품 등록 실패:', error);
    res.status(500).json({ success: false, message: '상품 등록 중 오류가 발생했습니다.', error: error.message });
  } finally {
    if (connection) { connection.release(); }
  }
});

// ✅ (기존 코드) 등록된 상품 목록 조회 (삭제된 상품 제외)
router.get('/registered', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE is_deleted = FALSE';
    let queryParams = [];
    if (status) { whereClause += ' AND naver_ad_status = ?'; queryParams.push(status); }
    const [products] = await pool.execute(`
      SELECT id, product_code, product_name, price, product_url, main_image, category, description, naver_ad_status,
        naver_ad_id, naver_ad_group_id, registered_at, updated_at
      FROM registered_products ${whereClause} ORDER BY registered_at DESC LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), parseInt(offset)]);
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total FROM registered_products ${whereClause}
    `, queryParams);
    res.json({
      success: true, data: { products, pagination: { page: parseInt(page), limit: parseInt(limit), total: countResult[0].total, totalPages: Math.ceil(countResult[0].total / limit) } }
    });
  } catch (error) {
    console.error('등록된 상품 조회 실패:', error);
    res.status(500).json({ success: false, message: '등록된 상품 조회 중 오류가 발생했습니다.', error: error.message });
  }
});

// ✅ (기존 코드) 등록된 상품 수정 API
router.put('/registered/:id', async (req, res) => {
  const { id } = req.params;
  const { product_name, price, product_url, description } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [existingProduct] = await connection.execute('SELECT * FROM registered_products WHERE id = ? AND is_deleted = FALSE', [id]);
    if (existingProduct.length === 0) { return res.status(404).json({ success: false, message: '상품을 찾을 수 없습니다.' }); }
    await connection.execute(`
      UPDATE registered_products SET product_name = ?, price = ?, product_url = ?, description = ?, updated_at = NOW() WHERE id = ?
    `, [product_name, price, product_url, description, id]);
    if (existingProduct[0].naver_ad_id) {
      try {
        await NaverAdService.updateAd(existingProduct[0].naver_ad_id, {
          headline: NaverAdService.createHeadline(product_name),
          description: NaverAdService.createDescription(description, price),
          pc: { final: product_url }, mobile: { final: product_url }
        });
        await connection.execute(`
          INSERT INTO naver_ad_logs (product_id, action_type, status, request_data, response_data) VALUES (?, 'update', 'success', ?, ?)
        `, [id, JSON.stringify({ product_name, price, product_url, description }), JSON.stringify({ adId: existingProduct[0].naver_ad_id, updated: true })]);
        console.log('네이버 광고 업데이트 완료:', existingProduct[0].naver_ad_id);
      } catch (naverError) {
        console.error('네이버 광고 업데이트 실패:', naverError);
        await connection.execute(`
          INSERT INTO naver_ad_logs (product_id, action_type, status, request_data, error_message) VALUES (?, 'update', 'failed', ?, ?)
        `, [id, JSON.stringify({ product_name, price, product_url, description }), naverError.message]);
      }
    }
    await connection.commit();
    res.json({ success: true, message: '상품이 성공적으로 수정되었습니다.' });
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch (rollbackError) { console.error('롤백 실패:', rollbackError.message); } }
    console.error('상품 수정 실패:', error);
    res.status(500).json({ success: false, message: '상품 수정 중 오류가 발생했습니다.', error: error.message });
  } finally {
    if (connection) { connection.release(); }
  }
});

// ⭐ (기존 코드) 등록된 상품 삭제 API (소프트 삭제)
router.delete('/registered/:id', async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [existingProduct] = await connection.execute('SELECT * FROM registered_products WHERE id = ? AND is_deleted = FALSE', [id]);
    if (existingProduct.length === 0) { return res.status(404).json({ success: false, message: '상품을 찾을 수 없습니다.' }); }
    await connection.execute(`
      UPDATE registered_products SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW() WHERE id = ?
    `, [id]);
    if (existingProduct[0].naver_ad_id) {
      try {
        await NaverAdService.deleteAd(existingProduct[0].naver_ad_id);
        await connection.execute(`
          INSERT INTO naver_ad_logs (product_id, action_type, status, request_data, response_data) VALUES (?, 'delete', 'success', ?, ?)
        `, [id, JSON.stringify({ adId: existingProduct[0].naver_ad_id }), JSON.stringify({ deleted: true, deletedAt: new Date().toISOString() })]);
        console.log('네이버 광고 삭제 완료:', existingProduct[0].naver_ad_id);
      } catch (naverError) {
        console.error('네이버 광고 삭제 실패:', naverError);
        await connection.execute(`
          INSERT INTO naver_ad_logs (product_id, action_type, status, request_data, error_message) VALUES (?, 'delete', 'failed', ?, ?)
        `, [id, JSON.stringify({ adId: existingProduct[0].naver_ad_id }), naverError.message]);
      }
    }
    await connection.commit();
    res.json({
      success: true, message: '상품이 성공적으로 삭제되었습니다.',
      data: { deletedProduct: { id: existingProduct[0].id, product_name: existingProduct[0].product_name, product_code: existingProduct[0].product_code, deleted_at: new Date().toISOString() } }
    });
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch (rollbackError) { console.error('롤백 실패:', rollbackError.message); } }
    console.error('상품 삭제 실패:', error);
    res.status(500).json({ success: false, message: '상품 삭제 중 오류가 발생했습니다.', error: error.message });
  } finally {
    if (connection) { connection.release(); }
  }
});

// ✅ (기존 코드) 네이버 광고 상태 확인 API
router.get('/registered/:id/naver-status', async (req, res) => {
  const { id } = req.params;
  try {
    const statusCheck = await NaverAdService.comprehensiveAdCheck(id);
    if (statusCheck.success) {
      await pool.execute(`UPDATE registered_products SET naver_ad_status = ?, updated_at = NOW() WHERE id = ?`, [
        statusCheck.isFullyActive ? 'uploaded' : 'failed', id
      ]);
    }
    res.json({ success: true, data: statusCheck });
  } catch (error) {
    console.error('네이버 광고 상태 확인 실패:', error);
    res.status(500).json({ success: false, message: '네이버 광고 상태 확인 중 오류가 발생했습니다.', error: error.message });
  }
});

// ✅ (기존 코드) 신규 상품 목록 조회 API
router.get('/new', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const [products] = await pool.execute(`
      SELECT id, product_code, product_name, price, product_url, main_image, category, description, created_at
      FROM products WHERE product_code NOT LIKE 'REG%' ORDER BY created_at DESC LIMIT ? OFFSET ?
    `, [parseInt(limit), parseInt(offset)]);
    const [countResult] = await pool.execute(`SELECT COUNT(*) as total FROM products WHERE product_code NOT LIKE 'REG%'`);
    res.json({
      success: true, data: { products, pagination: { page: parseInt(page), limit: parseInt(limit), total: countResult[0].total, totalPages: Math.ceil(countResult[0].total / limit) } }
    });
  } catch (error) {
    console.error('신규 상품 조회 실패:', error);
    res.status(500).json({ success: false, message: '신규 상품 조회 중 오류가 발생했습니다.', error: error.message });
  }
});

// ✅ (기존 코드) 삭제된 상품 목록 조회 API (관리자용)
router.get('/deleted', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const [products] = await pool.execute(`
      SELECT id, product_code, product_name, price, product_url, main_image, category, description, registered_at, deleted_at
      FROM registered_products WHERE is_deleted = TRUE ORDER BY deleted_at DESC LIMIT ? OFFSET ?
    `, [parseInt(limit), parseInt(offset)]);
    const [countResult] = await pool.execute(`SELECT COUNT(*) as total FROM registered_products WHERE is_deleted = TRUE`);
    res.json({
      success: true, data: { products, pagination: { page: parseInt(page), limit: parseInt(limit), total: countResult[0].total, totalPages: Math.ceil(countResult[0].total / limit) } }
    });
  } catch (error) {
    console.error('삭제된 상품 조회 실패:', error);
    res.status(500).json({ success: false, message: '삭제된 상품 조회 중 오류가 발생했습니다.', error: error.message });
  }
});

// ⭐ (추가됨) 대시보드 및 피드 관리 통계 조회 API
router.get('/dashboard/stats', async (req, res) => {
    try {
      // ✅ registered_products 테이블 사용 확인
      const [regCountResult] = await pool.execute('SELECT COUNT(*) as count FROM registered_products WHERE is_deleted = FALSE');
      const [newCountResult] = await pool.execute('SELECT COUNT(*) as count FROM products WHERE DATE(created_at) = CURDATE() AND product_code NOT LIKE "REG%"');
      
      const totalRegistered = regCountResult[0].count;
      const todayNewCount = newCountResult[0].count;
      
      const latestEPFile = getLatestEPFile();
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
        epUrl = `https://modetour.name/ep/${latestEPFile.name}`; // ✅ Nginx 설정에 맞는 URL
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

// ⭐ (추가됨) 수동 피드 생성 API
router.post('/feed/generate', async (req, res) => {
  try {
    // ✅ registered_products 테이블 사용 확인
    const [products] = await pool.execute(
      'SELECT * FROM registered_products WHERE is_deleted = FALSE ORDER BY registered_at DESC'
    );
    if (products.length === 0) {
      return res.status(400).json({ success: false, message: '등록된 상품이 없어 피드를 생성할 수 없습니다.' });
    }
    
    const generateNumber = Date.now();
    const epFileName = `naver_ep_${generateNumber}.txt`;
    // ✅ 경로 확인: products.js는 'routes' 폴더에 있으므로, '..'로 상위 폴더(Backend)로 이동 후 'public/ep'
    const epDir = path.join(__dirname, '..', 'public', 'ep'); 
    const epFilePath = path.join(epDir, epFileName);

    if (!fs.existsSync(epDir)) {
      fs.mkdirSync(epDir, { recursive: true });
    }
    
    let epContent = '';
    let validProducts = 0;
    
    products.forEach(product => {
      const errors = validateTravelProductData(product);
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
        epUrl: `https://modetour.name/ep/${epFileName}`, // ✅ Nginx 설정에 맞는 URL
        generatedAt: new Date().toLocaleString('ko-KR')
      }
    });
  } catch (error) {
    console.error('EP 피드 생성 오류:', error);
    res.status(500).json({ success: false, message: 'EP 피드 생성 실패', error: error.message });
  }
});

module.exports = router;
