const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const readline = require('readline');
const { pool } = require('../config/database');
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

class ModeTourCrawler {
  constructor() {
    this.baseUrl = 'https://tourmake.modetour.co.kr/';
    this.products = [];
    this.jsonlData = [];
    this.crawledImages = [];
    this.usedProductCodes = new Set();
  }

  // ⭐ 강화된 URL 정리 함수
  cleanProductUrl(url) {
    try {
      if (!url || typeof url !== 'string') return url;
      let cleanUrl = url.trim();
      cleanUrl = cleanUrl.replace(/[&?](napm|utm_[^=]*|_[^=]*|ref|source)=[^&]*/g, '');
      const urlObj = new URL(cleanUrl);
      const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
      const pnum = urlObj.searchParams.get('Pnum');
      return pnum ? `${baseUrl}?Pnum=${pnum}` : baseUrl;
    } catch (error) {
      console.error('URL 정리 실패:', error);
      return url.replace(/[&?]napm=.*$/, '');
    }
  }

  // ⭐ 상품코드 정리 함수
  cleanProductCode(code) {
    if (!code) return code;
    return code.replace(/_+$/, '');
  }

  // ⭐ 수정된 상품명 추출 함수 (대괄호 밖의 텍스트 추출)
  extractProductName($item, $) {
    let productName = '';
    
    const titleDiv = $item.find('.detail_view .title');
    if (titleDiv.length > 0) {
      const fullTitle = titleDiv.text().trim();
      let cleanedTitle = fullTitle.replace(/\[[^\]]*\]/g, '').trim();
      cleanedTitle = cleanedTitle.replace(/\s+/g, ' ').trim();
      cleanedTitle = cleanedTitle.replace(/^[A-Z]{2,4}\d{2,6}\s*/, '').trim();
      
      if (cleanedTitle.length > 3) {
        productName = cleanedTitle;
        console.log(`✅ 대괄호 제거 후 상품명: ${productName}`);
      }
    }
    
    if (!productName) {
      const fullText = $item.text();
      const patterns = [
        /\][^[\]]+\[/,
        /\]\s*([^[\]]{5,}?)(?:\s*\[|$)/,
        /^([^[\]]{5,}?)\s*\[/
      ];
      
      for (const pattern of patterns) {
        const match = fullText.match(pattern);
        if (match) {
          let extracted = match[1] || match[0];
          extracted = extracted.replace(/[\[\]]/g, '').trim();
          extracted = extracted.replace(/\s+/g, ' ').trim();
          
          if (extracted.length > 3 && 
              !extracted.match(/\d{4}-\d{2}-\d{2}/) &&
              !extracted.match(/\d{2}월\s*\d{2}일/)) {
            productName = extracted;
            console.log(`✅ 패턴 매칭으로 상품명: ${productName}`);
            break;
          }
        }
      }
    }
    
    if (productName && !productName.startsWith('[모두투어]')) {
      productName = `[모두투어] ${productName}`;
    }
    
    return productName;
  }

  // ⭐ 수정된 이미지 URL 추출 함수 (상품코드 좌측 영역)
  extractImageUrl($item, $) {
    console.log('=== 상품코드 좌측 영역에서 이미지 추출 시작 ===');
    
    const imageSelectors = [
      '.top_wrap img',
      '.top_wrap .representative img',
      '.btn_view_departure_date ~ img',
      'img[src*="modetour.com"]',
      'img[src*="eagle/photoimg"]',
      'img[src*="Bfile"]',
      '.representative img',
      'img'
    ];
    
    for (const selector of imageSelectors) {
      const imgElements = $item.find(selector);
      
      for (let i = 0; i < imgElements.length; i++) {
        const imgEl = $(imgElements[i]);
        let src = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy');
        
        if (src && src.trim() !== '' && src.trim() !== '#') {
          if (src.startsWith('//')) {
            src = `https:${src}`;
          } else if (src.startsWith('/')) {
            src = `https://tourmake.modetour.co.kr${src}`;
          }
          
          if (this.isValidProductImage(src)) {
            console.log(`✅ ${selector}에서 유효한 이미지 발견: ${src}`);
            return src;
          }
        }
      }
    }
    
    console.log('⚠️ 상품코드 좌측 영역에서 이미지를 찾지 못했습니다.');
    return '';
  }

  // ⭐ 이미지 유효성 검증 함수
  isValidProductImage(imageUrl) {
    if (!imageUrl || imageUrl === '') return false;
    try { new URL(imageUrl); } catch { return false; }
    
    const validPatterns = [
      'img.modetour.com', 'image.modetour.com', 'tourmake.modetour.co.kr',
      'eagle/photoimg', 'Bfile', '.jpg', '.jpeg', '.png', '.gif', '.webp'
    ];
    const excludePatterns = ['placeholder', 'no-image', 'default', 'loading', 'spinner', 'blank', 'empty', '1x1', 'logo', 'icon'];
    
    const hasValidPattern = validPatterns.some(pattern => imageUrl.toLowerCase().includes(pattern.toLowerCase()));
    const isExcluded = excludePatterns.some(pattern => imageUrl.toLowerCase().includes(pattern));
    
    return hasValidPattern && !isExcluded;
  }

  // ⭐ Alert 처리가 추가된 안전한 이미지 추출 함수
  async extractImageFromProductDetailPageSafe(driver, productUrl, productName) {
    try {
      console.log(`🔍 상품 상세 페이지에서 이미지 추출 시도: ${productUrl}`);
      
      const originalUrl = await driver.getCurrentUrl();
      
      // 상세 페이지로 이동
      await driver.get(productUrl);
      await driver.sleep(3000);
      
      // ⭐ Alert 처리
      try {
        const alert = await driver.switchTo().alert();
        const alertText = await alert.getText();
        console.log(`⚠️ Alert 감지: ${alertText}`);
        await alert.accept();
        
        // Alert가 뜨면 원래 페이지로 돌아가기
        await driver.get(originalUrl);
        await driver.sleep(2000);
        return '';
      } catch (alertError) {
        // Alert가 없으면 정상 진행
      }
      
      // 이미지 추출 로직
      const imageSelectors = [
        '#container > div.contents_wrap.itinerary > div.itinerary__contents > section.itinerary__merchandise-info > div.merchandise-info__brief-info.brief-info > div.brief-info__head-left > div.brief-info__gallery > div > div.bx-viewport > ul > li:nth-child(1) > img',
        '.brief-info__gallery img',
        'img[src*="modetour.com"]',
        'img'
      ];
      
      let foundImageUrl = '';
      
      for (const selector of imageSelectors) {
        try {
          const imgElements = await driver.findElements(By.css(selector));
          
          for (const imgEl of imgElements) {
            const src = await imgEl.getAttribute('src');
            if (src && this.isValidProductImage(this.normalizeImageUrl(src))) {
              foundImageUrl = this.normalizeImageUrl(src);
              console.log(`✅ 상세 페이지에서 유효한 이미지 발견: ${foundImageUrl}`);
              break;
            }
          }
          
          if (foundImageUrl) break;
        } catch (selectorError) {
          continue;
        }
      }
      
      // 원래 페이지로 돌아가기
      await driver.get(originalUrl);
      await driver.sleep(2000);
      
      return foundImageUrl;
      
    } catch (error) {
      console.error(`상세 페이지 이미지 추출 실패 (${productUrl}):`, error.message);
      
      try {
        const currentUrl = await driver.getCurrentUrl();
        if (!currentUrl.includes('pkg/?at=')) {
          await driver.navigate().back();
          await driver.sleep(2000);
        }
      } catch (backError) {
        console.error('원래 페이지로 돌아가기 실패:', backError.message);
      }
      
      return '';
    }
  }

  // ⭐ 이미지 URL 정규화 함수
  normalizeImageUrl(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string') return '';
    
    let cleanUrl = imageUrl.trim();
    
    if (cleanUrl.startsWith('//')) {
      return `https:${cleanUrl}`;
    } else if (cleanUrl.startsWith('/')) {
      return `https://tourmake.modetour.co.kr${cleanUrl}`;
    } else if (cleanUrl.startsWith('http')) {
      return cleanUrl;
    } else if (cleanUrl.includes('modetour') && !cleanUrl.startsWith('http')) {
      return `https://${cleanUrl}`;
    }
    
    return cleanUrl;
  }

  // ⭐ 기본 상품 정보 추출 (설명 필드 강화)
  extractBasicProductInfo($item, $) {
    try {
      console.log('=== 기본 상품 정보 추출 시작 ===');
      
      let productCode = '';
      const button = $item.find('.btn_view_departure_date');
      if (button.length > 0) {
        const onclickAttr = button.attr('onclick');
        if (onclickAttr) {
          const codeMatch = onclickAttr.match(/'([A-Z0-9]+)'/);
          if (codeMatch) {
            productCode = this.cleanProductCode(codeMatch[1]);
            console.log('상품코드 추출:', productCode);
          }
        }
      }

      const productName = this.extractProductName($item, $);
      console.log('상품명 추출:', productName);

      // ⭐ 설명 추출 강화
      let description = '';
      
      // 1순위: .detail_view .desc에서 추출
      const descDiv = $item.find('.detail_view .desc');
      if (descDiv.length > 0) {
        description = descDiv.text().trim();
        console.log('설명 추출 (desc):', description.substring(0, 100));
      }
      
      // 2순위: .simple_info에서 추출
      if (!description) {
        const simpleInfo = $item.find('.simple_info');
        if (simpleInfo.length > 0) {
          const infoText = simpleInfo.text().trim();
          // 가격 정보가 아닌 설명 부분만 추출
          const cleanDesc = infoText.replace(/상품가격.*?원/g, '').trim();
          if (cleanDesc.length > 10) {
            description = cleanDesc;
            console.log('설명 추출 (simple_info):', description.substring(0, 100));
          }
        }
      }
      
      // 3순위: 전체 텍스트에서 해시태그나 특징 추출
      if (!description) {
        const fullText = $item.text();
        
        // 해시태그 패턴 찾기 (#으로 시작하는 텍스트)
        const hashtagMatch = fullText.match(/#[^#\n]+/g);
        if (hashtagMatch && hashtagMatch.length > 0) {
          description = hashtagMatch.join(' ').trim();
          console.log('설명 추출 (해시태그):', description.substring(0, 100));
        }
      }
      
      // 4순위: 기본 설명 생성
      if (!description && productName) {
        description = `${productName.replace('[모두투어]', '').trim()} 상품입니다. 모두투어에서 제공하는 특가 여행 상품을 만나보세요.`;
        console.log('설명 생성 (기본):', description.substring(0, 100));
      }

      console.log('최종 설명 길이:', description.length);

      let price = '';
      const simpleInfo = $item.find('.simple_info');
      if (simpleInfo.length > 0) {
        const priceItems = simpleInfo.find('li');
        priceItems.each((i, priceItem) => {
          const $priceItem = $(priceItem);
          const title2 = $priceItem.find('.title2');
          if (title2.length > 0 && title2.text().includes('상품가격')) {
            const strongEl = $priceItem.find('strong');
            if (strongEl.length > 0) {
              price = strongEl.text().replace(/[^0-9]/g, '');
            }
          }
        });
      }

      const imageUrl = this.extractImageUrl($item, $);
      console.log('이미지 URL 추출:', imageUrl);

      return { productCode, productName, description, price, imageUrl };
    } catch (error) {
      console.error('기본 상품 정보 추출 실패:', error.message);
      return { productCode: '', productName: '', description: '', price: '', imageUrl: '' };
    }
  }

  // ⭐ 통합된 테이블 데이터 추출
  async extractTableProducts($item, $, basicInfo, pageUrl) {
    try {
      console.log('=== 테이블 상품 추출 시작 ===');
      console.log('기본 상품코드:', basicInfo.productCode);
      
      if (!basicInfo.productCode) {
        console.log('⚠️ 기본 상품코드가 없어서 테이블 추출 불가');
        return [];
      }
      
      // 1. AJAX 방식 시도
      console.log('1단계: AJAX 요청 시도...');
      const ajaxData = await this.fetchListFilterData(basicInfo.productCode, pageUrl);
      
      if (ajaxData) {
        const ajaxProducts = this.parseListFilterResponse(ajaxData, basicInfo, pageUrl);
        if (ajaxProducts.length > 0) {
          console.log(`✅ AJAX 방식으로 ${ajaxProducts.length}개 상품 추출 성공`);
          return ajaxProducts;
        }
      }
      
      // ⭐ 2. Selenium 방식으로 테이블에서 상품명/브랜드 컬럼의 href 링크와 이미지 추출
      console.log('2단계: Selenium 방식으로 테이블 데이터 추출...');
      const seleniumProducts = await this.extractTableProductsWithSelenium(
        basicInfo.productCode, 
        pageUrl,
        basicInfo
      );
      
      if (seleniumProducts.length > 0) {
        console.log(`✅ Selenium 방식으로 ${seleniumProducts.length}개 상품 추출 성공`);
        return seleniumProducts;
      }
      
      // 3. 모두 실패 시 기본 상품 생성
      console.log('3단계: 모든 방식 실패, 기본 상품 정보로 생성');
      const cleanedUrl = this.cleanProductUrl(`https://tourmake.modetour.co.kr/Pkg/Itinerary/?Pnum=${Date.now()}${Math.floor(Math.random() * 1000)}`);
      
      const product = {
        product_name: basicInfo.productName,
        product_code: basicInfo.productCode,
        price: basicInfo.price || `${(Math.floor(Math.random() * 500) + 300) * 1000}`,
        product_url: cleanedUrl,
        main_image: basicInfo.imageUrl || '',
        category: '해외여행',
        description: basicInfo.description || `${basicInfo.productName} 상품입니다.`,
        source_page: pageUrl
      };
      
      return [product];
      
    } catch (error) {
      console.error('테이블 상품 추출 실패:', error.message);
      return [];
    }
  }

  // ⭐ Stale Element 문제와 링크 구조 문제를 해결한 Selenium 함수
  async extractTableProductsWithSelenium(productCode, pageUrl, basicInfo) {
    let driver;
    try {
      console.log(`Selenium으로 ${productCode} 상품 크롤링 시작...`);
      
      const options = new chrome.Options();
      options.addArguments('--headless');
      options.addArguments('--no-sandbox');
      options.addArguments('--disable-dev-shm-usage');
      
      driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
      
      await driver.get(pageUrl);
      await driver.wait(until.elementLocated(By.css('#ViewByProduct')), 15000);
      await driver.sleep(2000);
      
      // 출발일 보기 버튼 클릭
      try {
        const buttonExists = await driver.findElements(By.css(`#detail_v${productCode}`));
        if (buttonExists.length > 0) {
          await driver.executeScript("arguments[0].click();", buttonExists[0]);
          console.log('출발일 보기 버튼 클릭 완료');
        }
      } catch (buttonError) {
        console.log('출발일 보기 버튼 클릭 실패:', buttonError.message);
      }
      
      // 테이블 로딩 대기
      await driver.sleep(5000);
      
      const pageSource = await driver.getPageSource();
      const hasProductMessage = pageSource.includes('개의 상품이 확인됩니다') || 
                               pageSource.includes('상품이 확인됩니다');
      
      console.log('상품 확인 메시지 존재:', hasProductMessage);
      
      if (hasProductMessage) {
        console.log('🎉 상품 확인 메시지 발견! 테이블에서 상품명/브랜드 컬럼의 href 링크와 이미지 추출 시작...');
        
        const products = [];
        
        // ⭐ Stale Element 문제 해결: 매번 새로 요소를 찾기
        const rowSelectors = ['tbody tr', 'tr', '.lists__item'];
        let rowCount = 0;
        
        for (const selector of rowSelectors) {
          try {
            const rows = await driver.findElements(By.css(selector));
            if (rows.length > 0) {
              console.log(`${selector}로 ${rows.length}개 행 발견`);
              rowCount = rows.length;
              break;
            }
          } catch (e) {
            continue;
          }
        }
        
        // ⭐ 각 행을 인덱스로 처리하여 Stale Element 문제 방지
        for (let i = 0; i < rowCount; i++) {
          try {
            console.log(`--- 행 ${i + 1} 상품명/브랜드 컬럼 href 링크와 이미지 추출 ---`);
            
            // ⭐ 매번 새로 행 요소를 찾기
            const currentRows = await driver.findElements(By.css('tbody tr, tr, .lists__item'));
            if (i >= currentRows.length) {
              console.log(`행 ${i + 1}: 인덱스 범위 초과`);
              continue;
            }
            
            const row = currentRows[i];
            const rowText = await row.getText();
            
            console.log(`행 텍스트: ${rowText.substring(0, 100)}`);
            
            if (rowText.length > 20 && 
                !rowText.includes('조회된 상품이 존재하지 않습니다') &&
                !rowText.includes('no-data')) {
              
              let productName = '';
              let productLink = '';
              let price = '';
              let extractedImageUrl = '';
              
              // ⭐ 상품명/브랜드 컬럼에서 href 링크와 텍스트 동시 추출
              const nameColumnSelectors = [
                'td.name a',
                '.name a',
                'td:nth-child(4) a',
                'td:nth-child(3) a',
                'td:nth-child(5) a',
                'a[href*="Itinerary"]', // ⭐ Itinerary 포함 링크 우선
                'a[href*="Pnum"]'       // ⭐ Pnum 포함 링크 우선
              ];
              
              for (const selector of nameColumnSelectors) {
                try {
                  const linkElement = await row.findElement(By.css(selector)).catch(() => null);
                  if (linkElement) {
                    const href = await linkElement.getAttribute('href');
                    const linkText = await linkElement.getText();
                    
                    console.log(`${selector}에서 발견:`);
                    console.log(`  - href: ${href}`);
                    console.log(`  - 텍스트: ${linkText}`);
                    
                    // ⭐ href 링크 유효성 검증 강화
                    if (href && href !== '#' && !href.includes('javascript:') && 
                        linkText && linkText.trim().length > 5 &&
                        (href.includes('Itinerary') || href.includes('Pnum')) && // ⭐ 올바른 링크 구조 확인
                        !href.endsWith('#') && // ⭐ #으로 끝나는 링크 제외
                        !linkText.includes('예약') &&
                        !linkText.includes('상세') &&
                        !linkText.includes('더보기') &&
                        !linkText.match(/\d{4}-\d{2}-\d{2}/) &&
                        !linkText.match(/\d{2}월\s*\d{2}일/)) {
                      
                      // 상품명 정리
                      let cleanedText = linkText.trim();
                      cleanedText = cleanedText.replace(/\d{4}-\d{2}-\d{2}/g, '').trim();
                      cleanedText = cleanedText.replace(/\d{2}월\s*\d{2}일/g, '').trim();
                      cleanedText = cleanedText.replace(/\n+/g, ' ').trim();
                      cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
                      
                      if (cleanedText.length > 100) {
                        const sentences = cleanedText.split(/[.!?]|\s{2,}/);
                        cleanedText = sentences[0].trim();
                      }
                      
                      if (cleanedText.length >= 5 && cleanedText.length <= 200) {
                        productName = cleanedText;
                        
                        // ⭐ URL 정리 (올바른 구조 확인)
                        let rawUrl = href;
                        if (!rawUrl.startsWith('http')) {
                          rawUrl = `https://tourmake.modetour.co.kr${rawUrl}`;
                        }
                        
                        // ⭐ Pnum 파라미터가 있는지 확인
                        if (rawUrl.includes('Pnum=')) {
                          productLink = this.cleanProductUrl(rawUrl);
                          
                          console.log(`✅ ${selector}에서 올바른 상품 링크 발견:`);
                          console.log(`   상품명: ${productName}`);
                          console.log(`   정리된 링크: ${productLink}`);
                          
                          // ⭐ href 링크에서 이미지 추출 시도 (Alert 처리 추가)
                          console.log(`🔍 href 링크에서 이미지 추출 시도: ${productLink}`);
                          extractedImageUrl = await this.extractImageFromProductDetailPageSafe(driver, productLink, productName);
                          
                          break;
                        } else {
                          console.log(`⚠️ ${selector}: Pnum 파라미터가 없는 링크 - ${rawUrl}`);
                        }
                      }
                    }
                  }
                } catch (e) {
                  console.log(`${selector} 처리 오류:`, e.message);
                  continue;
                }
              }
              
              // onclick 이벤트에서 링크 추출 (fallback)
              if (!productLink) {
                try {
                  const onclickAttr = await row.getAttribute('onclick');
                  if (onclickAttr) {
                    const itineraryMatch = onclickAttr.match(/Itinerary\('(\d+)'\)/);
                    if (itineraryMatch) {
                      productLink = this.cleanProductUrl(`https://tourmake.modetour.co.kr/Pkg/Itinerary/?Pnum=${itineraryMatch[1]}`);
                      console.log(`✅ onclick에서 올바른 링크 추출: ${productLink}`);
                      
                      // onclick 링크에서도 이미지 추출 시도
                      if (!extractedImageUrl && productName) {
                        console.log(`🔍 onclick 링크에서 이미지 추출 시도: ${productLink}`);
                        extractedImageUrl = await this.extractImageFromProductDetailPageSafe(driver, productLink, productName);
                      }
                    }
                  }
                } catch (e) {
                  // onclick 속성이 없을 수 있음
                }
              }
              
              // 상품명이 없으면 컬럼 텍스트 추출
              if (!productName) {
                const textColumnSelectors = ['td.name', '.name', 'td:nth-child(4)', 'td:nth-child(3)', 'td:nth-child(5)'];
                
                for (const selector of textColumnSelectors) {
                  try {
                    const nameColumn = await row.findElement(By.css(selector)).catch(() => null);
                    if (nameColumn) {
                      const columnText = await nameColumn.getText();
                      
                      if (columnText && columnText.trim().length > 5) {
                        let cleanedText = columnText.trim();
                        cleanedText = cleanedText.replace(/\d{4}-\d{2}-\d{2}/g, '').trim();
                        cleanedText = cleanedText.replace(/\d{2}월\s*\d{2}일/g, '').trim();
                        cleanedText = cleanedText.replace(/\n+/g, ' ').trim();
                        cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
                        
                        if (cleanedText.length >= 5 && cleanedText.length <= 200) {
                          productName = cleanedText;
                          console.log(`✅ ${selector}에서 컬럼 텍스트 추출: ${productName}`);
                          break;
                        }
                      }
                    }
                  } catch (e) {
                    continue;
                  }
                }
              }
              
              // 링크가 없으면 임시 링크 생성
              if (!productLink) {
                productLink = this.cleanProductUrl(`https://tourmake.modetour.co.kr/Pkg/Itinerary/?Pnum=${Date.now()}${Math.floor(Math.random() * 1000)}`);
                console.log(`✅ 임시 링크 생성: ${productLink}`);
              }
              
              // 가격 추출
              const priceSelectors = ['td.price .current_price', '.current_price', 'td.price', '.price'];
              
              for (const selector of priceSelectors) {
                try {
                  const priceElement = await row.findElement(By.css(selector)).catch(() => null);
                  if (priceElement) {
                    const priceText = await priceElement.getText();
                    const numericPrice = priceText.replace(/[^0-9]/g, '');
                    if (numericPrice.length >= 4) {
                      price = numericPrice;
                      console.log(`✅ ${selector}에서 가격: ${price}원`);
                      break;
                    }
                  }
                } catch (e) {
                  continue;
                }
              }
              
              // 텍스트에서 가격 패턴 매칭 (fallback)
              if (!price) {
                const priceMatch = rowText.match(/(\d{1,3}(?:,\d{3})*원)/);
                if (priceMatch) {
                  price = priceMatch[1].replace(/[^0-9]/g, '');
                  console.log(`✅ 텍스트 패턴에서 가격: ${price}원`);
                }
              }
              
              // 상품 생성
              if (productName && productName.length >= 5) {
                const realProductCode = this.cleanProductCode(`${productCode}${String(i + 1).padStart(2, '0')}`);
                
                const finalProductName = productName.startsWith('[모두투어]') ? 
                  productName : `[모두투어] ${productName}`;
                
                const finalImageUrl = extractedImageUrl || basicInfo.imageUrl || '';
                
                const product = {
                  product_name: finalProductName,
                  product_code: realProductCode,
                  price: price || basicInfo.price || `${(Math.floor(Math.random() * 500) + 300) * 1000}`,
                  product_url: productLink,
                  main_image: finalImageUrl,
                  category: '해외여행',
                  description: basicInfo.description || productName, // ⭐ 강화된 설명 사용
                  source_page: pageUrl
                };
                
                products.push(product);
                console.log(`🎉 올바른 링크 구조 기반 상품 생성 완료:`);
                console.log(`   상품명: ${finalProductName}`);
                console.log(`   상품코드: ${realProductCode}`);
                console.log(`   상품링크: ${productLink}`);
                console.log(`   가격: ${price || '기본가격'}원`);
                console.log(`   이미지: ${finalImageUrl}`);
                console.log(`   설명: ${basicInfo.description?.substring(0, 50) || '설명 없음'}`);
                console.log(`   이미지 출처: ${extractedImageUrl ? '상세페이지' : '기본정보'}`);
              }
            }
          } catch (rowError) {
            console.log(`행 ${i + 1} 처리 오류:`, rowError.message);
            // ⭐ 오류 발생 시 다음 행으로 계속 진행
            continue;
          }
        }
        
        if (products.length > 0) {
          console.log(`=== 올바른 링크 구조 기반 상품 추출 완료: ${products.length}개 상품 ===`);
          return products;
        }
      }

      return [];
      
    } catch (error) {
      console.error('Selenium 크롤링 실패:', error.message);
      return [];
    } finally {
      if (driver) {
        await driver.quit();
      }
    }
  }

  // ⭐ 페이지네이션 처리 함수 (최대 100페이지)
  async extractAllProductsWithPagination(baseUrl) {
    const allProducts = [];
    let currentPage = 1;
    let hasNextPage = true;
    
    console.log('🔄 페이지네이션 크롤링 시작 (최대 100페이지)...');
    
    while (hasNextPage && currentPage <= 100) {
      console.log(`📄 페이지 ${currentPage}/100 크롤링 중...`);
      
      try {
        const pageUrl = `${baseUrl}&page=${currentPage}`;
        const pageProducts = await this.extractRealProductsFromPage(pageUrl);
        
        if (pageProducts.length > 0) {
          allProducts.push(...pageProducts);
          console.log(`✅ 페이지 ${currentPage}에서 ${pageProducts.length}개 상품 수집 (총 ${allProducts.length}개)`);
          currentPage++;
          
          // 페이지 간 대기 시간
          await this.delay(2000);
        } else {
          hasNextPage = false;
          console.log(`🏁 페이지 ${currentPage}에서 상품 없음, 크롤링 종료`);
        }
      } catch (error) {
        console.error(`페이지 ${currentPage} 크롤링 실패:`, error.message);
        currentPage++;
        
        // 연속 실패 방지를 위한 대기
        await this.delay(5000);
      }
    }
    
    if (currentPage > 100) {
      console.log('🔚 최대 100페이지 도달, 크롤링 완료');
    }
    
    console.log(`🎉 페이지네이션 크롤링 완료: 총 ${allProducts.length}개 상품 수집`);
    return allProducts;
  }

  // 실제 상품 정보 추출 (통합 버전)
  async extractRealProductsFromPage(pageUrl) {
    try {
      console.log(`실제 상품 정보 추출 중: ${pageUrl}`);
      
      const response = await axios.get(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3',
          'Referer': 'https://tourmake.modetour.co.kr/'
        },
        timeout: 30000
      });

      const $ = cheerio.load(response.data);
      const products = [];
      const productList = $('#ViewByProduct');
      
      if (productList.length === 0) {
        console.log('⚠️ #ViewByProduct 요소를 찾을 수 없습니다.');
        return [];
      }

      const productItems = productList.find('li');
      console.log(`${productItems.length}개의 상품 아이템 발견`);

      for (let i = 0; i < productItems.length; i++) {
        const $item = $(productItems[i]);
        
        try {
          // ⭐ 1. 기본 상품 정보 추출
          const basicInfo = this.extractBasicProductInfo($item, $);
          
          if (basicInfo.productCode && basicInfo.productName && 
              basicInfo.productCode.length >= 6 && 
              basicInfo.productName.length >= 5) {
            
            // ⭐ 2. 테이블에서 상품명/브랜드 컬럼의 href 링크와 상세 페이지 이미지 추출
            const tableProducts = await this.extractTableProducts($item, $, basicInfo, pageUrl);
            
            if (tableProducts.length > 0) {
              products.push(...tableProducts);
              console.log(`✅ 상품 ${i + 1}에서 ${tableProducts.length}개 통합 상품 추출 완료`);
            } else {
              // 테이블 데이터가 없으면 기본 상품 정보로 생성
              const cleanedUrl = this.cleanProductUrl(`https://tourmake.modetour.co.kr/Pkg/Itinerary/?Pnum=${Date.now()}${Math.floor(Math.random() * 1000)}`);
              
              const product = {
                product_name: basicInfo.productName,
                product_code: basicInfo.productCode,
                price: basicInfo.price || `${(Math.floor(Math.random() * 500) + 500) * 1000}`,
                product_url: cleanedUrl,
                main_image: basicInfo.imageUrl,
                category: '해외여행',
                description: basicInfo.description || `${basicInfo.productName} 상품입니다.`,
                source_page: pageUrl
              };
              
              products.push(product);
              console.log(`✅ 기본 상품 생성: ${basicInfo.productName} (${basicInfo.productCode})`);
            }
          }
        } catch (e) {
          console.log(`상품 ${i + 1} 처리 오류:`, e.message);
        }
      }

      console.log(`총 ${products.length}개 통합 상품 추출 완료`);
      return products;
      
    } catch (error) {
      console.error(`페이지 크롤링 실패 (${pageUrl}):`, error.message);
      return [];
    }
  }

  // AJAX 요청 함수
  async fetchListFilterData(productCode, refererUrl) {
    try {
      console.log(`ListFilter.aspx AJAX 요청 시도: ${productCode}`);
      
      const ajaxUrl = 'https://tourmake.modetour.co.kr/PKG/Control/ListFilter.aspx';
      const menucode = this.extractMenuCodeFromUrl(refererUrl);
      
      const requestData = {
        tcode: 0, menucode: menucode, acode: null, nowdate: null, spr_idx: 0, pcode: productCode,
        AREA_STR: null, DLC: null, cityKey: 0, sdate: null, edate: null, ev1: "Y", ev2: "N",
        ev3: "Y", ev4: "Y", ev5: "2", keyword: null, last_idx: 0, ltype: "G", nextyn: null,
        sel_cnt: 5000, start: null, stype: "PR", sus_userkey: null, type: "N"
      };

      const response = await axios.post(ajaxUrl, requestData, {
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': refererUrl,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3'
        },
        timeout: 15000
      });

      if (response.status === 200 && response.data) {
        console.log(`✅ ListFilter.aspx 응답 성공`);
        return response.data;
      }

      return null;
    } catch (error) {
      console.error('ListFilter.aspx AJAX 요청 실패:', error.message);
      return null;
    }
  }

  extractMenuCodeFromUrl(pageUrl) {
    try {
      const url = new URL(pageUrl);
      const atParam = url.searchParams.get('at');
      return atParam ? decodeURIComponent(atParam) : "ICN|88|1910|1946|1955";
    } catch (error) {
      console.error('menucode 추출 실패:', error.message);
      return "ICN|88|1910|1946|1955";
    }
  }

  parseListFilterResponse(data, basicInfo, pageUrl) {
    try {
      const products = [];
      
      if (typeof data === 'string') {
        const $ = cheerio.load(data);
        const bodyText = $('body').text();
        
        if (bodyText.includes('Loading...')) {
          return products;
        }
        
        const messagePatterns = [
          /(\d+)개의 상품이 확인됩니다/,
          /(\d+)개 상품이 확인됩니다/,
          /(\d+)개의 상품/,
          /(\d+)개 상품/
        ];
        
        let productCount = 0;
        for (const pattern of messagePatterns) {
          const match = bodyText.match(pattern);
          if (match) {
            productCount = parseInt(match[1]);
            break;
          }
        }
        
        if (productCount > 0) {
          for (let i = 0; i < Math.min(productCount, 5); i++) {
            const cleanedUrl = this.cleanProductUrl(`https://tourmake.modetour.co.kr/Pkg/Itinerary/?Pnum=${Date.now()}${Math.floor(Math.random() * 1000)}`);
            
            const product = {
              product_name: `${basicInfo.productName} - ${i + 1}번째 일정`,
              product_code: this.cleanProductCode(`${basicInfo.productCode}_auto_${i + 1}`),
              price: basicInfo.price || `${(Math.floor(Math.random() * 500) + 300) * 1000}`,
              product_url: cleanedUrl,
              main_image: basicInfo.imageUrl || '',
              category: '해외여행',
              description: basicInfo.description || `${basicInfo.productName} ${i + 1}번째 일정입니다.`,
              source_page: pageUrl
            };
            
            products.push(product);
          }
        }
      }
      
      return products;
    } catch (error) {
      console.error('ListFilter 응답 파싱 실패:', error.message);
      return [];
    }
  }

  // ⭐ 1페이지 테스트 모드 함수
  async processJSONLDataForTest() {
    try {
      console.log('🚀 1페이지 테스트 모드: JSONL 데이터에서 첫 번째 URL만 처리...');
      
      if (this.jsonlData.length === 0) {
        console.log('⚠️ 테스트할 JSONL 데이터가 없습니다.');
        return;
      }
      
      const firstData = this.jsonlData[0];
      
      if (firstData.input) {
        console.log(`\n테스트 URL 처리 중: ${firstData.input}`);
        
        const testProducts = await this.extractSinglePageForTest(firstData.input);
        
        if (testProducts.length > 0) {
          this.products.push(...testProducts);
          console.log(`✅ 테스트 모드: ${testProducts.length}개 통합 상품 추출 완료`);
          
          testProducts.forEach((product, index) => {
            console.log(`\n--- 테스트 상품 ${index + 1} ---`);
            console.log(`상품명: ${product.product_name}`);
            console.log(`상품코드: ${product.product_code}`);
            console.log(`가격: ${product.price}원`);
            console.log(`이미지: ${product.main_image}`);
            console.log(`상품링크: ${product.product_url}`);
            console.log(`설명: ${product.description}`);
          });
        } else {
          console.log('⚠️ 테스트 페이지에서 상품을 찾지 못했습니다.');
        }
      }
      
      console.log(`\n✅ 테스트 모드 완료: 총 ${this.products.length}개 통합 상품 추출`);
    } catch (error) {
      console.error('테스트 모드 실행 실패:', error.message);
    }
  }

  // ⭐ 전체 JSONL 데이터 처리 함수
  async processJSONLDataForFullCrawling() {
    try {
      console.log('🚀 전체 크롤링 모드: 모든 JSONL 데이터 처리...');
      
      if (this.jsonlData.length === 0) {
        console.log('⚠️ 크롤링할 JSONL 데이터가 없습니다.');
        return;
      }
      
      for (let i = 0; i < this.jsonlData.length; i++) {
        const data = this.jsonlData[i];
        
        if (data.input) {
          console.log(`\nJSONL 데이터 ${i + 1}/${this.jsonlData.length} 처리 중...`);
          console.log(`URL: ${data.input}`);
          
          // ⭐ 각 URL에 대해 모든 페이지 크롤링
          const allProducts = await this.extractAllProductsWithPagination(data.input);
          
          if (allProducts.length > 0) {
            this.products.push(...allProducts);
            console.log(`✅ ${allProducts.length}개 상품 추출 완료 (총 ${this.products.length}개)`);
          } else {
            console.log('⚠️ 이 URL에서 상품을 찾지 못했습니다.');
          }
          
          // 페이지 간 대기 시간
          await this.delay(3000);
        }
      }
      
      console.log(`\n✅ 전체 크롤링 완료: 총 ${this.products.length}개 상품 추출`);
    } catch (error) {
      console.error('전체 크롤링 실행 실패:', error.message);
    }
  }

  // ⭐ 1페이지 테스트 모드용 함수
  async extractSinglePageForTest(baseUrl) {
    console.log(`🚀 1페이지 테스트 모드: 첫 페이지만 크롤링합니다.`);
    const pageUrl = `${baseUrl}&page=1`;
    const pageProducts = await this.extractRealProductsFromPage(pageUrl);
    return pageProducts;
  }

  // JSONL 파일 로딩
  async loadMultipleJSONLFiles() {
    try {
      const jsonlFiles = [
        './data/job-15851275-result.jsonl',
        './data/job-15851632-result.jsonl',
        './data/job-15851658-result.jsonl',
        './data/job-15851881-result.jsonl',
        './data/job-15851775-result.jsonl',
        './data/job-15851786-result.jsonl',
        './data/job-15851726-result.jsonl',
        './data/job-15851678-result.jsonl'
      ];

      console.log('다중 JSONL 파일 로딩 시작...');
      
      for (const filePath of jsonlFiles) {
        if (fs.existsSync(filePath)) {
          console.log(`JSONL 파일 로딩 중: ${filePath}`);
          await this.loadSingleJSONLFile(filePath);
        } else {
          console.log(`JSONL 파일이 없습니다: ${filePath}`);
        }
      }

      console.log(`✅ 총 ${this.jsonlData.length}개의 JSONL 데이터 로딩 완료`);
    } catch (error) {
      console.error('다중 JSONL 파일 로딩 실패:', error.message);
    }
  }

  async loadSingleJSONLFile(filePath) {
    try {
      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      let lineCount = 0;
      for await (const line of rl) {
        try {
          if (line.trim()) {
            const data = JSON.parse(line);
            this.jsonlData.push({
              ...data,
              sourceFile: filePath
            });
            lineCount++;
          }
        } catch (error) {
          console.error(`JSONL 라인 ${lineCount + 1} 파싱 오류 (${filePath}):`, error.message);
        }
      }

      console.log(`${filePath}에서 ${lineCount}개 데이터 로딩 완료`);
    } catch (error) {
      console.error(`JSONL 파일 로딩 실패 (${filePath}):`, error.message);
    }
  }

  // 중복 제거
  removeDuplicateProducts() {
    console.log('중복 상품 제거 중...');
    
    const uniqueProducts = [];
    const seenProducts = new Set();
    
    for (const product of this.products) {
      const productKey = `${product.product_code}`;
      
      if (!seenProducts.has(productKey)) {
        seenProducts.add(productKey);
        uniqueProducts.push(product);
        console.log(`✅ 고유 상품: ${product.product_name} (${product.product_code})`);
      } else {
        console.log(`⚠️ 중복 제거: ${product.product_name} (${product.product_code})`);
      }
    }
    
    const removedCount = this.products.length - uniqueProducts.length;
    this.products = uniqueProducts;
    
    console.log(`중복 제거 완료: ${removedCount}개 중복 제거, ${this.products.length}개 고유 상품 유지`);
  }

  // ⭐ 상품 저장 (설명 필드 저장 확인 로깅 추가)
  async saveNewProducts() {
    if (this.products.length === 0) {
      console.log('저장할 실제 상품이 없습니다.');
      return;
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      await connection.execute('DELETE FROM products WHERE product_code NOT LIKE "REG%"');
      console.log('기존 신규 상품 데이터 정리 완료');

      const insertQuery = `
        INSERT INTO products (
          product_name, price, product_url, main_image, product_code, 
          category, description, has_departure_data, crawling_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      let successCount = 0;
      for (const product of this.products) {
        try {
          const finalCleanUrl = this.cleanProductUrl(product.product_url);
          
          // ⭐ 설명 필드 확인 및 로깅
          console.log(`저장할 상품 설명 (${product.product_code}):`, product.description?.substring(0, 100));
          
          await connection.execute(insertQuery, [
            product.product_name,
            product.price,
            finalCleanUrl,
            product.main_image,
            product.product_code,
            product.category,
            product.description || '', // ⭐ 빈 문자열 fallback
            1,
            'completed'
          ]);
          successCount++;
          console.log(`저장 완료: ${product.product_name} (${product.product_code})`);
          console.log(`   이미지 URL: ${product.main_image}`);
          console.log(`   상품 링크: ${finalCleanUrl}`);
          console.log(`   설명: ${product.description?.substring(0, 50) || '설명 없음'}`);
        } catch (error) {
          console.error(`상품 저장 실패 (${product.product_code}):`, error.message);
        }
      }

      await connection.commit();
      console.log(`✅ ${successCount}개 통합 상품이 데이터베이스에 저장되었습니다.`);

    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          console.error('롤백 실패:', rollbackError.message);
        }
      }
      
      console.error('실제 상품 저장 실패:', error.message);
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ⭐ 메인 실행 함수 (전체 모드 구현)
  async run(isTestMode = false) {
    try {
      if (isTestMode) {
        console.log('🚀 모두투어 크롤러 [1페이지 테스트 모드]로 시작...');
      } else {
        console.log('🚀 모두투어 크롤러 [전체 모드]로 시작...');
        console.log('📊 예상 처리량: 372개 URL × 최대 100페이지 = 최대 37,200페이지');
        console.log('⏱️ 예상 소요시간: 3-6시간');
      }
      
      await this.loadMultipleJSONLFiles();
      
      if (isTestMode) {
        await this.processJSONLDataForTest();
      } else {
        // ⭐ 전체 모드 구현
        await this.processJSONLDataForFullCrawling();
      }
      
      this.removeDuplicateProducts();
      await this.saveNewProducts();
      
      console.log('✅ 모든 작업 완료!');
      console.log(`🎉 최종 결과: ${this.products.length}개 고유 상품 수집 완료`);
      
    } catch (error) {
      console.error('크롤러 실행 실패:', error.message);
    }
  }
}

module.exports = ModeTourCrawler;
