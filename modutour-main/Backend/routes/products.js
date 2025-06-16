// routes/products.js (완전한 버전)
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const NaverAdService = require('../services/NaverEPService');

// 상품 등록 API
router.post('/register', async (req, res) => {
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
        // 1. 신규 상품 정보 조회
        const [productRows] = await connection.execute(
          'SELECT * FROM products WHERE product_code = ?',
          [productCode]
        );

        if (productRows.length === 0) {
          failedProducts.push({ productCode, error: '상품을 찾을 수 없습니다.' });
          continue;
        }

        const product = productRows[0];

        // 2. 이미 등록된 상품인지 확인
        const [existingRows] = await connection.execute(
          'SELECT id FROM registered_products WHERE product_code = ? AND is_deleted = FALSE',
          [productCode]
        );

        if (existingRows.length > 0) {
          failedProducts.push({ productCode, error: '이미 등록된 상품입니다.' });
          continue;
        }

        // 3. 등록된 상품 테이블에 저장
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

        const registeredProductId = insertResult.insertId;

        // 4. 기존 네이버 광고에 상품 업로드
        try {
          const naverResult = await NaverAdService.uploadProductToExistingAds({
            productId: registeredProductId,
            productName: product.product_name,
            price: product.price,
            productUrl: product.product_url,
            description: product.description
          });

          // 업로드 성공
          await connection.execute(`
            UPDATE registered_products 
            SET naver_ad_status = 'uploaded', 
                naver_ad_id = ?,
                naver_ad_group_id = ?
            WHERE id = ?
          `, [naverResult.adId, naverResult.adGroupId, registeredProductId]);

          // 성공 로그 저장
          await connection.execute(`
            INSERT INTO naver_ad_logs (
              product_id, action_type, status, request_data, response_data
            ) VALUES (?, 'create', 'success', ?, ?)
          `, [
            registeredProductId,
            JSON.stringify({ product }),
            JSON.stringify(naverResult)
          ]);

          registeredProducts.push({
            ...product,
            id: registeredProductId,
            naver_ad_status: 'uploaded',
            naver_ad_id: naverResult.adId,
            naver_ad_group_name: naverResult.adGroupName
          });

        } catch (naverError) {
          console.error('네이버 광고 업로드 실패:', naverError);

          await connection.execute(`
            UPDATE registered_products 
            SET naver_ad_status = 'failed'
            WHERE id = ?
          `, [registeredProductId]);

          // 실패 로그 저장
          await connection.execute(`
            INSERT INTO naver_ad_logs (
              product_id, action_type, status, request_data, error_message
            ) VALUES (?, 'create', 'failed', ?, ?)
          `, [
            registeredProductId,
            JSON.stringify({ product }),
            naverError.message
          ]);

          registeredProducts.push({
            ...product,
            id: registeredProductId,
            naver_ad_status: 'failed',
            naver_error: naverError.message
          });
        }

      } catch (error) {
        console.error(`상품 ${productCode} 등록 실패:`, error);
        failedProducts.push({ productCode, error: error.message });
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: `${registeredProducts.length}개 상품이 기존 광고에 등록되었습니다.`,
      data: {
        registered: registeredProducts,
        failed: failedProducts,
        summary: {
          total: productCodes.length,
          success: registeredProducts.length,
          failed: failedProducts.length,
          naverSuccess: registeredProducts.filter(p => p.naver_ad_status === 'uploaded').length,
          naverFailed: registeredProducts.filter(p => p.naver_ad_status === 'failed').length
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

// 등록된 상품 목록 조회 API (삭제된 상품 제외)
router.get('/registered', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE is_deleted = FALSE'; // ⭐ 삭제된 상품 제외
    let queryParams = [];

    if (status) {
      whereClause += ' AND naver_ad_status = ?';
      queryParams.push(status);
    }

    const [products] = await pool.execute(`
      SELECT 
        id, product_code, product_name, price, product_url,
        main_image, category, description, naver_ad_status,
        naver_ad_id, naver_ad_group_id, registered_at, updated_at
      FROM registered_products 
      ${whereClause}
      ORDER BY registered_at DESC 
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), parseInt(offset)]);

    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total FROM registered_products ${whereClause}
    `, queryParams);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
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

// 등록된 상품 수정 API
router.put('/registered/:id', async (req, res) => {
  const { id } = req.params;
  const { product_name, price, product_url, description } = req.body;
  
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    // 기존 상품 정보 조회
    const [existingProduct] = await connection.execute(
      'SELECT * FROM registered_products WHERE id = ? AND is_deleted = FALSE',
      [id]
    );
    
    if (existingProduct.length === 0) {
      return res.status(404).json({
        success: false,
        message: '상품을 찾을 수 없습니다.'
      });
    }
    
    // 상품 정보 업데이트
    await connection.execute(`
      UPDATE registered_products 
      SET product_name = ?, price = ?, product_url = ?, description = ?, updated_at = NOW()
      WHERE id = ?
    `, [product_name, price, product_url, description, id]);
    
    // 네이버 광고도 함께 업데이트 (선택사항)
    if (existingProduct[0].naver_ad_id) {
      try {
        await NaverAdService.updateAd(existingProduct[0].naver_ad_id, {
          headline: NaverAdService.createHeadline(product_name),
          description: NaverAdService.createDescription(description, price),
          pc: { final: product_url },
          mobile: { final: product_url }
        });
        
        // 네이버 광고 업데이트 로그 저장
        await connection.execute(`
          INSERT INTO naver_ad_logs (
            product_id, action_type, status, request_data, response_data
          ) VALUES (?, 'update', 'success', ?, ?)
        `, [
          id,
          JSON.stringify({ product_name, price, product_url, description }),
          JSON.stringify({ adId: existingProduct[0].naver_ad_id, updated: true })
        ]);
        
        console.log('네이버 광고 업데이트 완료:', existingProduct[0].naver_ad_id);
      } catch (naverError) {
        console.error('네이버 광고 업데이트 실패:', naverError);
        
        // 네이버 광고 업데이트 실패 로그 저장
        await connection.execute(`
          INSERT INTO naver_ad_logs (
            product_id, action_type, status, request_data, error_message
          ) VALUES (?, 'update', 'failed', ?, ?)
        `, [
          id,
          JSON.stringify({ product_name, price, product_url, description }),
          naverError.message
        ]);
      }
    }
    
    await connection.commit();
    
    res.json({
      success: true,
      message: '상품이 성공적으로 수정되었습니다.'
    });
    
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('롤백 실패:', rollbackError.message);
      }
    }
    console.error('상품 수정 실패:', error);
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

// ⭐ 등록된 상품 삭제 API (소프트 삭제)
router.delete('/registered/:id', async (req, res) => {
  const { id } = req.params;
  
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    // 기존 상품 정보 조회
    const [existingProduct] = await connection.execute(
      'SELECT * FROM registered_products WHERE id = ? AND is_deleted = FALSE',
      [id]
    );
    
    if (existingProduct.length === 0) {
      return res.status(404).json({
        success: false,
        message: '상품을 찾을 수 없습니다.'
      });
    }
    
    // ⭐ DB에서 실제 삭제하지 않고 is_deleted = TRUE로 표시 (소프트 삭제)
    await connection.execute(`
      UPDATE registered_products 
      SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW()
      WHERE id = ?
    `, [id]);
    
    // 네이버 광고 삭제 (선택사항)
    if (existingProduct[0].naver_ad_id) {
      try {
        await NaverAdService.deleteAd(existingProduct[0].naver_ad_id);
        
        // 네이버 광고 삭제 성공 로그 저장
        await connection.execute(`
          INSERT INTO naver_ad_logs (
            product_id, action_type, status, request_data, response_data
          ) VALUES (?, 'delete', 'success', ?, ?)
        `, [
          id,
          JSON.stringify({ adId: existingProduct[0].naver_ad_id }),
          JSON.stringify({ deleted: true, deletedAt: new Date().toISOString() })
        ]);
        
        console.log('네이버 광고 삭제 완료:', existingProduct[0].naver_ad_id);
      } catch (naverError) {
        console.error('네이버 광고 삭제 실패:', naverError);
        
        // 네이버 광고 삭제 실패 로그 저장
        await connection.execute(`
          INSERT INTO naver_ad_logs (
            product_id, action_type, status, request_data, error_message
          ) VALUES (?, 'delete', 'failed', ?, ?)
        `, [
          id,
          JSON.stringify({ adId: existingProduct[0].naver_ad_id }),
          naverError.message
        ]);
      }
    }
    
    await connection.commit();
    
    res.json({
      success: true,
      message: '상품이 성공적으로 삭제되었습니다.',
      data: {
        deletedProduct: {
          id: existingProduct[0].id,
          product_name: existingProduct[0].product_name,
          product_code: existingProduct[0].product_code,
          deleted_at: new Date().toISOString()
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

// 네이버 광고 상태 확인 API
router.get('/registered/:id/naver-status', async (req, res) => {
  const { id } = req.params;
  
  try {
    const statusCheck = await NaverAdService.comprehensiveAdCheck(id);
    
    // DB에 상태 업데이트
    if (statusCheck.success) {
      await pool.execute(`
        UPDATE registered_products 
        SET naver_ad_status = ?, updated_at = NOW()
        WHERE id = ?
      `, [
        statusCheck.isFullyActive ? 'uploaded' : 'failed',
        id
      ]);
    }
    
    res.json({
      success: true,
      data: statusCheck
    });
    
  } catch (error) {
    console.error('네이버 광고 상태 확인 실패:', error);
    res.status(500).json({
      success: false,
      message: '네이버 광고 상태 확인 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 신규 상품 목록 조회 API (기존)
router.get('/new', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const [products] = await pool.execute(`
      SELECT 
        id, product_code, product_name, price, product_url,
        main_image, category, description, created_at
      FROM products 
      WHERE product_code NOT LIKE 'REG%'
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [parseInt(limit), parseInt(offset)]);

    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total FROM products WHERE product_code NOT LIKE 'REG%'
    `);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
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

// 삭제된 상품 목록 조회 API (관리자용)
router.get('/deleted', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const [products] = await pool.execute(`
      SELECT 
        id, product_code, product_name, price, product_url,
        main_image, category, description, registered_at, deleted_at
      FROM registered_products 
      WHERE is_deleted = TRUE
      ORDER BY deleted_at DESC 
      LIMIT ? OFFSET ?
    `, [parseInt(limit), parseInt(offset)]);

    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total FROM registered_products WHERE is_deleted = TRUE
    `);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          totalPages: Math.ceil(countResult[0].total / limit)
        }
      }
    });

  } catch (error) {
    console.error('삭제된 상품 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '삭제된 상품 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
