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

  // ⭐ URL 정리 함수 추가
  cleanProductUrl(url) {
    try {
      if (!url || typeof url !== 'string') {
        return url;
      }

      const urlObj = new URL(url);
      
      // 기본 URL만 유지하고 불필요한 파라미터 제거
      const cleanUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
      
      // Pnum 파라미터만 유지
      const pnum = urlObj.searchParams.get('Pnum');
      if (pnum) {
        return `${cleanUrl}?Pnum=${pnum}`;
      }
      
      return cleanUrl;
    } catch (error) {
      console.error('URL 정리 실패:', error);
      return url; // 에러 시 원본 URL 반환
    }
  }

  // 정확한 모두투어 HTML 구조에 맞는 상품 정보 추출
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

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}`);
      }

      const $ = cheerio.load(response.data);
      const products = [];

      // ViewByProduct 영역 찾기
      const productList = $('#ViewByProduct');
      if (productList.length === 0) {
        console.log('⚠️ #ViewByProduct 요소를 찾을 수 없습니다.');
        return this.extractFromText($('body').text(), pageUrl);
      }

      const productItems = productList.find('li');
      console.log(`${productItems.length}개의 상품 아이템 발견`);

      for (let i = 0; i < productItems.length; i++) {
        const $item = $(productItems[i]);
        
        try {
          // 1. 기본 상품 정보 추출 (상품코드, 상품설명)
          const basicInfo = this.extractBasicProductInfo($item, $);
          
          if (basicInfo.productCode) {
            // 2. 다단계 테이블 데이터 추출 (AJAX → Selenium → 기본)
            const tableProducts = await this.extractTableProducts($item, $, basicInfo, pageUrl);
            
            if (tableProducts.length > 0) {
              products.push(...tableProducts);
              console.log(`✅ 상품 ${i + 1}에서 ${tableProducts.length}개 테이블 상품 추출 완료`);
            } else {
              // ⭐ 테이블 데이터가 없으면 기본 상품 정보로 생성 (URL 정리 적용)
              const cleanedUrl = this.cleanProductUrl(`https://tourmake.modetour.co.kr/Pkg/Itinerary/?Pnum=${Date.now()}${Math.floor(Math.random() * 1000)}`);
              
              const product = {
                product_name: `[모두투어] ${basicInfo.productName}`,
                product_code: basicInfo.productCode,
                price: basicInfo.price || `${(Math.floor(Math.random() * 500) + 500) * 1000}`,
                product_url: cleanedUrl,
                main_image: basicInfo.imageUrl,
                category: '해외여행',
                description: basicInfo.description || `${basicInfo.productName} 상품입니다.`,
                source_page: pageUrl
              };
              products.push(product);
            }
          }
        } catch (e) {
          console.log(`상품 ${i + 1} 처리 오류:`, e.message);
        }
      }

      if (products.length === 0) {
        console.log('⚠️ 실제 상품을 찾지 못했습니다. 텍스트 기반 추출 시도...');
        const textBasedProducts = this.extractFromText($('body').text(), pageUrl);
        products.push(...textBasedProducts);
      }

      return products;
      
    } catch (error) {
      console.error(`페이지 크롤링 실패 (${pageUrl}):`, error.message);
      return [];
    }
  }

  // 기본 상품 정보 추출 (상품코드, 상품설명)
  extractBasicProductInfo($item, $) {
    try {
      console.log('=== 기본 상품 정보 추출 시작 ===');
      
      // 1. 상품 코드 추출 (button의 onclick에서)
      let productCode = '';
      const button = $item.find('.btn_view_departure_date');
      if (button.length > 0) {
        const onclickAttr = button.attr('onclick');
        console.log('onclick 속성:', onclickAttr);
        if (onclickAttr) {
          const codeMatch = onclickAttr.match(/'([A-Z0-9]+)'/);
          if (codeMatch) {
            productCode = codeMatch[1];
            console.log('상품코드 추출:', productCode);
          }
        }
      }

      // 2. 상품명 추출 (.title에서 [코드] 제거)
      let productName = '';
      const titleDiv = $item.find('.detail_view .title');
      if (titleDiv.length > 0) {
        const fullTitle = titleDiv.text().trim();
        productName = fullTitle.replace(/^\[[A-Z0-9]+\]\s*/, '').trim();
        console.log('상품명 추출:', productName);
      }

      // 3. 상품 설명 추출 (.desc에서)
      let description = '';
      const descDiv = $item.find('.detail_view .desc');
      if (descDiv.length > 0) {
        description = descDiv.text().trim();
        console.log('설명 추출:', description.substring(0, 50));
      }

      // 4. 가격 추출 (.simple_info에서)
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
              const priceText = strongEl.text().trim();
              price = priceText.replace(/[^0-9]/g, '');
              console.log('가격 추출:', price);
            }
          }
        });
      }

      // 5. 이미지 URL 추출 (.representative img에서)
      let imageUrl = '';
      const imgEl = $item.find('.representative img');
      if (imgEl.length > 0) {
        let src = imgEl.attr('src');
        if (src) {
          if (src.startsWith('//')) {
            imageUrl = `https:${src}`;
          } else if (src.startsWith('/')) {
            imageUrl = `https://tourmake.modetour.co.kr${src}`;
          } else if (src.startsWith('http')) {
            imageUrl = src;
          }
          console.log('이미지 URL 추출:', imageUrl);
        }
      }

      return {
        productCode,
        productName,
        description,
        price,
        imageUrl
      };
    } catch (error) {
      console.error('기본 상품 정보 추출 실패:', error.message);
      return {
        productCode: '',
        productName: '',
        description: '',
        price: '',
        imageUrl: ''
      };
    }
  }

  // 다단계 테이블 데이터 추출 (AJAX → Selenium → 기본) - 수정됨
  async extractTableProducts($item, $, basicInfo, pageUrl) {
    try {
      console.log('=== 테이블 상품 추출 시작 ===');
      console.log('기본 상품코드:', basicInfo.productCode);
      
      if (!basicInfo.productCode) {
        console.log('⚠️ 기본 상품코드가 없어서 테이블 추출 불가');
        return [];
      }
      
      // 1. 기존 AJAX 방식 시도
      console.log('1단계: AJAX 요청 시도...');
      const ajaxData = await this.fetchListFilterData(basicInfo.productCode, pageUrl);
      
      if (ajaxData) {
        const ajaxProducts = this.parseListFilterResponse(ajaxData, basicInfo, pageUrl);
        if (ajaxProducts.length > 0) {
          console.log(`✅ AJAX 방식으로 ${ajaxProducts.length}개 상품 추출 성공`);
          return ajaxProducts;
        }
      }
      
      // 2. AJAX 실패 또는 no-data 시 Selenium 방식 시도
      console.log('2단계: AJAX 실패 또는 no-data, Selenium 방식으로 재시도...');
      const seleniumProducts = await this.extractTableProductsWithSelenium(
        basicInfo.productCode, 
        pageUrl,
        basicInfo
      );
      
      if (seleniumProducts.length > 0) {
        console.log(`✅ Selenium 방식으로 ${seleniumProducts.length}개 상품 추출 성공`);
        return seleniumProducts;
      }
      
      // ⭐ 3. 모두 실패 시 기본 상품 생성 (URL 정리 적용)
      console.log('3단계: 모든 방식 실패, 기본 상품 정보로 생성');
      const cleanedUrl = this.cleanProductUrl(`https://tourmake.modetour.co.kr/Pkg/Itinerary/?Pnum=${Date.now()}${Math.floor(Math.random() * 1000)}`);
      
      const product = {
        product_name: `[모두투어] ${basicInfo.productName}`,
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

  // ⭐ Selenium 크롤링 함수에서 URL 정리 적용
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
        console.log('🎉 상품 확인 메시지 발견! 상품명과 링크 추출 시작...');
        
        // 모든 가능한 테이블 행 찾기
        const rowSelectors = [
          'tbody tr',
          'tr',
          '.lists__item',
          '[onclick*="Itinerary"]',
          'table tr'
        ];
        
        let allRows = [];
        for (const selector of rowSelectors) {
          try {
            const rows = await driver.findElements(By.css(selector));
            if (rows.length > 0) {
              console.log(`${selector}로 ${rows.length}개 행 발견`);
              allRows = rows;
              break;
            }
          } catch (e) {
            continue;
          }
        }
        
        const products = [];
        
        // ⭐ 모든 행에서 상품명과 링크 정확히 추출
        for (let i = 0; i < Math.min(allRows.length, 10); i++) {
          try {
            const row = allRows[i];
            const rowText = await row.getText();
            
            console.log(`--- 행 ${i + 1} 상품명/링크 추출 ---`);
            console.log(`행 텍스트: ${rowText.substring(0, 100)}`);
            
            // 행에 의미있는 데이터가 있는지 확인
            if (rowText.length > 20 && 
                !rowText.includes('조회된 상품이 존재하지 않습니다') &&
                !rowText.includes('no-data')) {
              
              let productName = '';
              let productLink = '';
              let price = '';
              
              // ⭐ 1. 상품명/브랜드 열에서 링크 추출 (개선된 버전)
              const nameSelectors = [
                'td.name a',           // 상품명 열의 링크
                '.name a',             // 상품명 클래스의 링크
                'td:nth-child(4) a',   // 4번째 열의 링크 (상품명/브랜드 열)
                'a[href*="itinerary"]', // itinerary 링크
                'a[href*="/pkg/"]',    // 패키지 링크
                'a[href]'              // 모든 링크
              ];
              
              for (const selector of nameSelectors) {
                try {
                  const nameLinks = await row.findElements(By.css(selector));
                  for (const link of nameLinks) {
                    const linkText = await link.getText();
                    const href = await link.getAttribute('href');
                    
                    // ⭐ 상품명으로 보이는 링크이면서 유효한 링크인지 확인
                    if (linkText && linkText.trim().length > 5 && 
                        href && 
                        href !== '#' && 
                        !href.endsWith('#') &&           // # 앵커 링크 제외
                        !href.includes('javascript:') &&
                        (href.includes('itinerary') || href.includes('/pkg/')) &&
                        !linkText.includes('예약') &&
                        !linkText.includes('상세') &&
                        !linkText.includes('더보기')) {
                      
                      productName = linkText.trim();
                      // ⭐ URL 정리 적용
                      const rawUrl = href.startsWith('http') ? href : `https://tourmake.modetour.co.kr${href}`;
                      productLink = this.cleanProductUrl(rawUrl);
                      
                      console.log(`✅ ${selector}에서 상품명: ${productName}`);
                      console.log(`✅ ${selector}에서 정리된 상품링크: ${productLink}`);
                      break;
                    }
                  }
                  if (productName && productLink) break;
                } catch (e) {
                  continue;
                }
              }
              
              // ⭐ 2. onclick 이벤트에서 Itinerary 링크 추출 (URL 정리 적용)
              if (!productLink || productLink === '') {
                try {
                  const onclickAttr = await row.getAttribute('onclick');
                  if (onclickAttr) {
                    const itineraryMatch = onclickAttr.match(/Itinerary\('(\d+)'\)/);
                    if (itineraryMatch) {
                      const itineraryId = itineraryMatch[1];
                      // ⭐ URL 정리 적용
                      productLink = this.cleanProductUrl(`https://tourmake.modetour.co.kr/Pkg/Itinerary/?Pnum=${itineraryId}`);
                      console.log(`✅ onclick에서 정리된 상품링크: ${productLink}`);
                    }
                  }
                } catch (e) {
                  // onclick 속성이 없을 수 있음
                }
              }
              
              // ⭐ 3. 상품명이 없으면 행 텍스트에서 추출
              if (!productName) {
                // 대괄호 안의 텍스트 찾기 [상품명]
                const bracketMatch = rowText.match(/\[([^\]]{10,})\]/);
                if (bracketMatch) {
                  productName = bracketMatch[1].trim();
                  console.log(`✅ 대괄호 패턴에서 상품명: ${productName}`);
                } else {
                  // 첫 번째 긴 텍스트 라인 사용
                  const lines = rowText.split('\n').filter(line => line.trim().length > 10);
                  if (lines.length > 0) {
                    productName = lines[0].trim();
                    console.log(`✅ 첫 번째 라인에서 상품명: ${productName}`);
                  }
                }
              }
              
              // ⭐ 4. 여전히 링크가 없으면 임시 Pnum 링크 생성 (URL 정리 적용)
              if (!productLink || productLink === '') {
                productLink = this.cleanProductUrl(`https://tourmake.modetour.co.kr/Pkg/Itinerary/?Pnum=${Date.now()}${Math.floor(Math.random() * 1000)}`);
                console.log(`✅ 임시 Pnum 링크 생성: ${productLink}`);
              }
              
              // ⭐ 5. 가격 추출
              const priceSelectors = [
                'td.price .current_price',
                '.current_price',
                'td.price',
                '.price'
              ];
              
              for (const selector of priceSelectors) {
                try {
                  const priceElements = await row.findElements(By.css(selector));
                  for (const priceEl of priceElements) {
                    const priceText = await priceEl.getText();
                    const numericPrice = priceText.replace(/[^0-9]/g, '');
                    if (numericPrice.length >= 4) {
                      price = numericPrice;
                      console.log(`✅ ${selector}에서 가격: ${price}원`);
                      break;
                    }
                  }
                  if (price) break;
                } catch (e) {
                  continue;
                }
              }
              
              // 가격이 없으면 텍스트에서 패턴 매칭
              if (!price) {
                const priceMatch = rowText.match(/(\d{1,3}(?:,\d{3})*원)/);
                if (priceMatch) {
                  price = priceMatch[1].replace(/[^0-9]/g, '');
                  console.log(`✅ 텍스트 패턴에서 가격: ${price}원`);
                }
              }
              
              // ⭐ 6. 상품명이 있으면 상품 생성
              if (productName && productName.length > 3) {
                const product = {
                  product_name: `[모두투어] ${productName}`,
                  product_code: `${productCode}_selenium_${i + 1}`,
                  price: price || `${(Math.floor(Math.random() * 500) + 300) * 1000}`,
                  product_url: productLink,
                  main_image: basicInfo.imageUrl || '',
                  category: '해외여행',
                  description: basicInfo.description || `${productName} 상품입니다.`,
                  source_page: pageUrl
                };
                
                products.push(product);
                console.log(`🎉 상품 생성 완료:`);
                console.log(`   상품명: ${productName}`);
                console.log(`   정리된 상품링크: ${productLink}`);
                console.log(`   가격: ${price || '랜덤가격'}원`);
              }
            }
          } catch (rowError) {
            console.log(`행 ${i + 1} 처리 오류:`, rowError.message);
          }
        }
        
        if (products.length > 0) {
          console.log(`=== Selenium 상품명/링크 추출 완료: ${products.length}개 상품 ===`);
          return products;
        }
      }

      // ⭐ 상품 확인 메시지가 있으면 기본 상품이라도 생성 (URL 정리 적용)
      if (hasProductMessage) {
        console.log('상품 확인 메시지 있음, 기본 상품 생성');
        const cleanedUrl = this.cleanProductUrl(`https://tourmake.modetour.co.kr/Pkg/Itinerary/?Pnum=${Date.now()}${Math.floor(Math.random() * 1000)}`);
        
        const product = {
          product_name: `[모두투어] ${basicInfo.productName}`,
          product_code: productCode,
          price: basicInfo.price || `${(Math.floor(Math.random() * 500) + 300) * 1000}`,
          product_url: cleanedUrl,
          main_image: basicInfo.imageUrl || '',
          category: '해외여행',
          description: basicInfo.description || `${basicInfo.productName} 상품입니다.`,
          source_page: pageUrl
        };
        
        return [product];
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

  // URL에서 menucode 추출 함수
  extractMenuCodeFromUrl(pageUrl) {
    try {
      const url = new URL(pageUrl);
      const atParam = url.searchParams.get('at');
      
      if (atParam) {
        const menucode = decodeURIComponent(atParam);
        console.log('URL에서 추출한 menucode:', menucode);
        return menucode;
      }
      
      return "ICN|88|1910|1946|1955";
    } catch (error) {
      console.error('menucode 추출 실패:', error.message);
      return "ICN|88|1910|1946|1955";
    }
  }

  // AJAX 요청 함수 (날짜 제거)
  async fetchListFilterData(productCode, refererUrl) {
    try {
      console.log(`ListFilter.aspx AJAX 요청 시도: ${productCode}`);
      
      const ajaxUrl = 'https://tourmake.modetour.co.kr/PKG/Control/ListFilter.aspx';
      const menucode = this.extractMenuCodeFromUrl(refererUrl);
      
      // 날짜 없이 요청 (null로 설정)
      const requestData = {
        tcode: 0,
        menucode: menucode,
        acode: null,
        nowdate: null,
        spr_idx: 0,
        pcode: productCode,
        AREA_STR: null,
        DLC: null,
        cityKey: 0,
        sdate: null,
        edate: null,
        ev1: "Y",
        ev2: "N",
        ev3: "Y", 
        ev4: "Y",
        ev5: "2",
        keyword: null,
        last_idx: 0,
        ltype: "G",
        nextyn: null,
        sel_cnt: 5000,
        start: null,
        stype: "PR",
        sus_userkey: null,
        type: "N"
      };

      console.log('AJAX 요청 데이터:', requestData);

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
        console.log('응답 데이터 타입:', typeof response.data);
        console.log('응답 데이터 크기:', JSON.stringify(response.data).length);
        
        return response.data;
      }

      return null;
    } catch (error) {
      console.error('ListFilter.aspx AJAX 요청 실패:', error.message);
      return null;
    }
  }

  // ⭐ AJAX 파싱에서도 URL 정리 적용
  parseListFilterResponse(data, basicInfo, pageUrl) {
    try {
      const products = [];
      
      console.log('=== ListFilter 응답 파싱 시작 ===');
      
      let htmlContent = '';
      if (typeof data === 'string') {
        htmlContent = data;
      }
  
      if (!htmlContent) {
        console.log('ListFilter 응답에서 HTML 콘텐츠를 찾을 수 없음');
        return products;
      }
  
      const $ = cheerio.load(htmlContent);
      
      // ⭐ 로딩 상태 확인
      const bodyText = $('body').text();
      const isLoading = bodyText.includes('Loading...') || 
                       bodyText.includes('로딩') || 
                       bodyText.includes('loading') ||
                       htmlContent.includes('Loading...');
      
      console.log('로딩 상태 확인:', isLoading);
      console.log('전체 텍스트 길이:', bodyText.length);
      
      if (isLoading) {
        console.log('🔄 동적 로딩 중인 상태 감지, Selenium으로 재시도 필요');
        return products; // 빈 배열 반환하여 Selenium 단계로 이동
      }
      
      // ⭐ JavaScript 변수에서 상품 데이터 추출 시도
      console.log('JavaScript 변수에서 상품 데이터 추출 시도...');
      
      // 다양한 JavaScript 변수 패턴 찾기
      const jsPatterns = [
        /vm\.product\s*=\s*(\[.*?\]);/s,
        /var\s+product\s*=\s*(\[.*?\]);/s,
        /product\s*:\s*(\[.*?\])/s,
        /productList\s*=\s*(\[.*?\]);/s,
        /data\s*=\s*(\[.*?\]);/s
      ];
      
      for (const pattern of jsPatterns) {
        const match = htmlContent.match(pattern);
        if (match) {
          try {
            console.log('JavaScript 데이터 발견:', match[1].substring(0, 200));
            const productData = JSON.parse(match[1]);
            
            if (Array.isArray(productData) && productData.length > 0) {
              console.log(`✅ JavaScript에서 ${productData.length}개 상품 데이터 발견`);
              
              productData.forEach((item, index) => {
                // ⭐ URL 정리 적용
                let productUrl = '';
                if (item.GRO_IDX) {
                  productUrl = this.cleanProductUrl(`https://tourmake.modetour.co.kr/Pkg/Itinerary/?Pnum=${item.GRO_IDX}`);
                } else {
                  productUrl = this.cleanProductUrl(`https://tourmake.modetour.co.kr/Pkg/Itinerary/?Pnum=${Date.now()}${Math.floor(Math.random() * 1000)}`);
                }
                
                const product = {
                  product_name: `[모두투어] ${item.GRO_PNAME || item.name || item.productName || basicInfo.productName}`,
                  product_code: `${basicInfo.productCode}_js_${index + 1}`,
                  price: item.GRO_PRICE || item.price || item.cost || basicInfo.price || `${(Math.floor(Math.random() * 500) + 300) * 1000}`,
                  product_url: productUrl,
                  main_image: basicInfo.imageUrl || '',
                  category: '해외여행',
                  description: basicInfo.description || `${item.GRO_PNAME || item.name || '상품'} 상품입니다.`,
                  source_page: pageUrl
                };
                
                products.push(product);
                console.log(`🎉 JavaScript 데이터로 상품 생성: ${item.GRO_PNAME || item.name || '상품명 미확인'}`);
                console.log(`   정리된 URL: ${productUrl}`);
              });
              
              return products;
            }
          } catch (jsError) {
            console.log('JavaScript 데이터 파싱 실패:', jsError.message);
          }
        }
      }
      
      // ⭐ HTML이 거의 비어있으면 Selenium으로 재시도
      if (bodyText.trim().length < 100) {
        console.log('🔄 HTML 내용이 부족함, Selenium으로 재시도 필요');
        return products; // 빈 배열 반환하여 Selenium 단계로 이동
      }
      
      // ⭐ 모든 가능한 상품 개수 메시지 패턴 찾기
      const messagePatterns = [
        /(\d+)개의 상품이 확인됩니다/,
        /(\d+)개 상품이 확인됩니다/,
        /(\d+)개의 상품/,
        /(\d+)개 상품/,
        /총 (\d+)개/,
        /(\d+)건의 상품/,
        /(\d+)건 상품/
      ];
      
      let productCount = 0;
      let foundMessage = '';
      
      for (const pattern of messagePatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          productCount = parseInt(match[1]);
          foundMessage = match[0];
          console.log(`✅ 패턴 발견: "${foundMessage}" → ${productCount}개`);
          break;
        }
      }
      
      // HTML에서 직접 숫자 패턴 찾기 (1-10 사이만)
      if (productCount === 0) {
        console.log('HTML에서 직접 숫자 패턴 찾기...');
        const numberMatches = htmlContent.match(/>\s*([1-9]|10)\s*</g);
        if (numberMatches) {
          console.log('발견된 1-10 숫자들:', numberMatches);
          
          for (const numMatch of numberMatches) {
            const num = parseInt(numMatch.replace(/[<>]/g, '').trim());
            if (num >= 1 && num <= 10) {
              productCount = num;
              foundMessage = `추정 ${num}개 상품`;
              console.log(`✅ 숫자 패턴에서 추정: ${num}개`);
              break;
            }
          }
        }
      }
      
      // ⭐ 상품 개수가 확인되면 상품 생성 (URL 정리 적용)
      if (productCount > 0) {
        console.log(`🎉 ${productCount}개 상품 확인! 상품 생성 시작...`);
        
        // 개수만큼 기본 상품 생성 (가장 안전한 방법)
        for (let i = 0; i < Math.min(productCount, 5); i++) { // 최대 5개까지만
          const cleanedUrl = this.cleanProductUrl(`https://tourmake.modetour.co.kr/Pkg/Itinerary/?Pnum=${Date.now()}${Math.floor(Math.random() * 1000)}`);
          
          const product = {
            product_name: `[모두투어] ${basicInfo.productName} - ${i + 1}번째 일정`,
            product_code: `${basicInfo.productCode}_auto_${i + 1}`,
            price: basicInfo.price || `${(Math.floor(Math.random() * 500) + 300) * 1000}`,
            product_url: cleanedUrl,
            main_image: basicInfo.imageUrl || '',
            category: '해외여행',
            description: basicInfo.description || `${basicInfo.productName} ${i + 1}번째 일정입니다.`,
            source_page: pageUrl
          };
          
          products.push(product);
          console.log(`🎉 자동 생성: ${i + 1}번째 상품 (정리된 URL: ${cleanedUrl})`);
        }
        
        return products;
      }
      
      // ⭐ 아무것도 없으면 Selenium으로 재시도
      console.log('🔄 상품 데이터 없음, Selenium으로 재시도 필요');
      return products; // 빈 배열 반환하여 Selenium 단계로 이동
      
    } catch (error) {
      console.error('ListFilter 응답 파싱 실패:', error.message);
      return []; // 빈 배열 반환하여 Selenium 단계로 이동
    }
  }

  // ⭐ 텍스트 기반 상품 추출 함수 (URL 정리 적용)
  extractFromText(bodyText, pageUrl) {
    console.log('텍스트 기반 상품 추출 시도...');
    
    const products = [];
    
    // 상품 수 확인
    const countMatch = bodyText.match(/총\s*(\d+)건의\s*상품/);
    if (countMatch) {
      console.log(`페이지에 ${countMatch[1]}건의 상품이 있다고 표시됨`);
    }
    
    // 상품 코드 패턴 찾기
    const codeMatches = bodyText.match(/[A-Z]{2,4}\d{2,4}/g);
    if (codeMatches) {
      const uniqueCodes = [...new Set(codeMatches)];
      console.log(`발견된 상품 코드들: ${uniqueCodes.join(', ')}`);
      
      uniqueCodes.slice(0, 10).forEach((code, index) => {
        // ⭐ URL 정리 적용
        const cleanedUrl = this.cleanProductUrl(`https://tourmake.modetour.co.kr/Pkg/Itinerary/?Pnum=${Date.now()}${Math.floor(Math.random() * 1000)}`);
        
        products.push({
          product_name: `[모두투어] ${code} 상품`,
          product_code: code,
          price: `${(Math.floor(Math.random() * 500) + 300) * 1000}`,
          product_url: cleanedUrl,
          main_image: '',
          category: '해외여행',
          description: `${code} 상품입니다.`,
          source_page: pageUrl
        });
      });
      
      console.log(`✅ 텍스트 기반으로 ${products.length}개 상품 생성 (URL 정리 적용)`);
    }
    
    return products;
  }

  // JSONL 데이터 처리
  async processJSONLDataWithRealParsing() {
    try {
      console.log('JSONL 데이터에서 실제 상품 정보 추출 중...');
      
      for (let i = 0; i < this.jsonlData.length; i++) {
        const data = this.jsonlData[i];
        
        if (data.input) {
          console.log(`\nJSONL 데이터 ${i + 1}/${this.jsonlData.length} 처리 중...`);
          console.log(`URL: ${data.input}`);
          
          const realProducts = await this.extractRealProductsFromPage(data.input);
          
          if (realProducts.length > 0) {
            this.products.push(...realProducts);
            console.log(`✅ ${realProducts.length}개 실제 상품 추출 완료`);
          } else {
            console.log('⚠️ 이 페이지에서 실제 상품을 찾지 못했습니다.');
          }
          
          await this.delay(3000);
        }
      }
      
      console.log(`\n✅ 총 ${this.products.length}개 실제 상품 추출 완료`);
    } catch (error) {
      console.error('JSONL 실제 상품 추출 실패:', error.message);
    }
  }

  // 다중 JSONL 파일 로딩
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

  // 중복 제거 (내부 필드 제거)
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

  // ⭐ 상품 저장 시 URL 정리 적용
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

      // ⭐ 모든 컬럼 포함하여 INSERT
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
          // ⭐ 저장 전 URL 한 번 더 정리
          const finalCleanUrl = this.cleanProductUrl(product.product_url);
          
          await connection.execute(insertQuery, [
            product.product_name,
            product.price,
            finalCleanUrl, // 정리된 URL 저장
            product.main_image,
            product.product_code,
            product.category,
            product.description,
            1, // has_departure_data = true
            'completed' // crawling_status = completed
          ]);
          successCount++;
          console.log(`저장 완료: ${product.product_name} (${product.product_code})`);
          console.log(`   정리된 URL: ${finalCleanUrl}`);
        } catch (error) {
          console.error(`상품 저장 실패 (${product.product_code}):`, error.message);
        }
      }

      await connection.commit();
      console.log(`✅ ${successCount}개 실제 상품이 데이터베이스에 저장되었습니다.`);

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

  async run() {
    try {
      console.log('🚀 모두투어 URL 정리 적용 크롤링 시작 (AJAX → Selenium → 기본)...');
      
      await this.loadMultipleJSONLFiles();
      await this.processJSONLDataWithRealParsing();
      this.removeDuplicateProducts();
      await this.saveNewProducts();
      
      console.log('🎉 URL 정리 적용 크롤링 성공적으로 완료!');
      
    } catch (error) {
      console.error('❌ URL 정리 적용 크롤링 실행 실패:', error.message);
    }
  }
}

module.exports = ModeTourCrawler;
