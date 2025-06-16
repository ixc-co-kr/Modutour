// services/NaverEPService.js
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

class NaverEPService {
  constructor() {
    this.epDirectory = './public/ep/';
    this.baseUrl = process.env.BASE_URL || 'http://localhost:5001';
    
    // EP 디렉토리 생성
    if (!fs.existsSync(this.epDirectory)) {
      fs.mkdirSync(this.epDirectory, { recursive: true });
    }
  }

  // 등록된 상품을 네이버 EP 형식으로 변환
  async generateNaverEP() {
    try {
      console.log('🚀 네이버 EP 생성 시작...');
      
      // 등록된 상품 조회 (삭제되지 않은 상품만)
      const [products] = await pool.execute(`
        SELECT 
          id, product_code, product_name, price, product_url,
          main_image, category, description, registered_at
        FROM registered_products 
        WHERE is_deleted = FALSE
        ORDER BY registered_at DESC
      `);

      if (products.length === 0) {
        console.log('⚠️ 등록된 상품이 없습니다.');
        return null;
      }

      console.log(`📊 ${products.length}개 상품을 EP로 변환 중...`);

      // 네이버 EP 형식으로 변환
      const epData = this.convertToNaverEP(products);
      
      // EP 파일 생성
      const epFileName = `naver_ep_${Date.now()}.txt`;
      const epFilePath = path.join(this.epDirectory, epFileName);
      
      // UTF-8 형식으로 저장 (BOM 없이)
      fs.writeFileSync(epFilePath, epData, 'utf8');
      
      const epUrl = `${this.baseUrl}/ep/${epFileName}`;
      
      console.log(`✅ 네이버 EP 생성 완료: ${epUrl}`);
      
      return {
        success: true,
        epUrl: epUrl,
        fileName: epFileName,
        productCount: products.length,
        filePath: epFilePath
      };

    } catch (error) {
      console.error('❌ 네이버 EP 생성 실패:', error);
      throw error;
    }
  }

  // 상품 데이터를 네이버 EP 형식으로 변환
  convertToNaverEP(products) {
    // 네이버 EP 3.0 헤더
    const headers = [
      'id', 'title', 'price_pc', 'link', 'image_link',
      'category_name1', 'category_name2', 'shipping', 'condition', 'brand', 'description'
    ];

    let epContent = headers.join('\t') + '\n';

    products.forEach((product) => {
      const row = [
        this.sanitizeField(product.product_code || `MODU_${product.id}`),
        this.sanitizeField(this.createProductTitle(product.product_name)),
        this.sanitizeField(this.extractNumericPrice(product.price)),
        this.sanitizeField(product.product_url),
        this.sanitizeField(product.main_image || ''),
        this.sanitizeField('여행/항공/숙박'),
        this.sanitizeField(''),
        this.sanitizeField('0'),
        this.sanitizeField('신상품'),
        this.sanitizeField('모두투어'),
        this.sanitizeField(this.createDescription(product.description, product.product_name))
      ];

      epContent += row.join('\t') + '\n';
    });

    return epContent;
  }

  createProductTitle(productName) {
    if (!productName) return '';
    let title = productName.trim();
    if (title.length > 100) {
      title = title.substring(0, 97) + '...';
    }
    return title.replace(/[\t\n\r]/g, ' ');
  }

  extractNumericPrice(price) {
    if (!price) return '0';
    const numericPrice = price.toString().replace(/[^0-9]/g, '');
    return numericPrice || '0';
  }

  createDescription(description, productName) {
    if (description && description.trim()) {
      let desc = description.trim();
      if (desc.length > 1000) {
        desc = desc.substring(0, 997) + '...';
      }
      return desc;
    }
    return `${productName} 상품입니다. 모두투어에서 제공하는 특가 여행 상품을 만나보세요.`;
  }

  sanitizeField(field) {
    if (!field) return '';
    return field.toString()
      .replace(/[\t\n\r]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  cleanupOldEPFiles() {
    try {
      const files = fs.readdirSync(this.epDirectory);
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

      files.forEach(file => {
        if (file.startsWith('naver_ep_') && file.endsWith('.txt')) {
          const filePath = path.join(this.epDirectory, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime.getTime() < sevenDaysAgo) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ 오래된 EP 파일 삭제: ${file}`);
          }
        }
      });
    } catch (error) {
      console.error('EP 파일 정리 실패:', error);
    }
  }

  async getEPStatus() {
    try {
      const [products] = await pool.execute(`
        SELECT COUNT(*) as total_products
        FROM registered_products 
        WHERE is_deleted = FALSE
      `);

      const files = fs.readdirSync(this.epDirectory)
        .filter(file => file.startsWith('naver_ep_') && file.endsWith('.txt'))
        .map(file => {
          const filePath = path.join(this.epDirectory, file);
          const stats = fs.statSync(filePath);
          return {
            fileName: file,
            url: `${this.baseUrl}/ep/${file}`,
            createdAt: stats.mtime,
            size: stats.size
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);

      return {
        totalProducts: products[0].total_products,
        epFiles: files,
        latestEP: files[0] || null
      };

    } catch (error) {
      console.error('EP 상태 확인 실패:', error);
      throw error;
    }
  }
}

module.exports = new NaverEPService();
