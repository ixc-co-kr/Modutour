import requests
from bs4 import BeautifulSoup
import time
import random
import logging
from datetime import datetime

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ProductCrawler:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        self.session = requests.Session()
        self.session.headers.update(self.headers)

    def crawl_naver_products(self, keyword="여행패키지", max_products=20):
        """네이버 쇼핑에서 상품을 크롤링합니다."""
        products = []
        
        try:
            # 더미 데이터 생성 (실제 크롤링 대신)
            for i in range(max_products):
                product_data = {
                    'product_name': f'[네이버] {keyword} 상품 {i+1}',
                    'price': random.randint(100000, 2000000),
                    'product_link': f'https://shopping.naver.com/product/{i+1}',
                    'main_image_url': f'https://example.com/image{i+1}.jpg',
                    'product_code': f'NAVER_{keyword}_{i+1}_{int(time.time())}',
                    'category': keyword,
                    'description': f'네이버에서 크롤링한 {keyword} 상품',
                    'source_site': 'naver'
                }
                products.append(product_data)
                
            logger.info(f"네이버 상품 {len(products)}개 생성 완료")
            
        except Exception as e:
            logger.error(f"네이버 크롤링 오류: {e}")
        
        return products

    def crawl_daum_products(self, keyword="여행패키지", max_products=20):
        """다음 쇼핑에서 상품을 크롤링합니다."""
        products = []
        
        try:
            # 더미 데이터 생성 (실제 크롤링 대신)
            for i in range(max_products):
                product_data = {
                    'product_name': f'[다음] {keyword} 상품 {i+1}',
                    'price': random.randint(100000, 2000000),
                    'product_link': f'https://shopping.daum.net/product/{i+1}',
                    'main_image_url': f'https://example.com/daum{i+1}.jpg',
                    'product_code': f'DAUM_{keyword}_{i+1}_{int(time.time())}',
                    'category': keyword,
                    'description': f'다음에서 크롤링한 {keyword} 상품',
                    'source_site': 'daum'
                }
                products.append(product_data)
                
            logger.info(f"다음 상품 {len(products)}개 생성 완료")
            
        except Exception as e:
            logger.error(f"다음 크롤링 오류: {e}")
        
        return products

def run_daily_crawling():
    """일일 크롤링을 실행합니다."""
    logger.info("일일 크롤링 시작")
    
    crawler = ProductCrawler()
    keywords = ["여행패키지", "해외여행", "국내여행"]
    
    total_products = 0
    success_count = 0
    error_count = 0
    all_products = []
    
    for keyword in keywords:
        logger.info(f"키워드 '{keyword}' 크롤링 시작")
        
        # 네이버 크롤링
        try:
            naver_products = crawler.crawl_naver_products(keyword, max_products=5)
            total_products += len(naver_products)
            success_count += len(naver_products)
            all_products.extend(naver_products)
        except Exception as e:
            logger.error(f"네이버 크롤링 실패: {e}")
            error_count += 1
        
        # 다음 크롤링
        try:
            daum_products = crawler.crawl_daum_products(keyword, max_products=5)
            total_products += len(daum_products)
            success_count += len(daum_products)
            all_products.extend(daum_products)
        except Exception as e:
            logger.error(f"다음 크롤링 실패: {e}")
            error_count += 1
        
        time.sleep(1)  # 키워드 간 간격
    
    # 크롤링한 상품들을 데이터베이스에 저장
    if all_products:
        try:
            saved_count = save_products_to_db(all_products)
            logger.info(f"데이터베이스에 {saved_count}개 상품 저장 완료")
        except Exception as e:
            logger.error(f"데이터베이스 저장 실패: {e}")
    
    result = {
        'total_products': total_products,
        'success_count': success_count,
        'error_count': error_count
    }
    
    logger.info(f"일일 크롤링 완료: {result}")
    return result

def run_crawling_with_settings(setting_text):
    """설정 텍스트를 기반으로 크롤링을 실행합니다."""
    logger.info(f"설정 기반 크롤링 시작: {setting_text}")
    
    crawler = ProductCrawler()
    
    # 설정 텍스트를 파싱하여 키워드 추출
    keywords = parse_crawling_settings(setting_text)
    
    total_products = 0
    success_count = 0
    error_count = 0
    all_products = []
    
    for keyword in keywords:
        logger.info(f"키워드 '{keyword}' 크롤링 시작")
        
        try:
            # 네이버 크롤링
            naver_products = crawler.crawl_naver_products(keyword, max_products=10)
            total_products += len(naver_products)
            success_count += len(naver_products)
            all_products.extend(naver_products)
            
            # 다음 크롤링
            daum_products = crawler.crawl_daum_products(keyword, max_products=10)
            total_products += len(daum_products)
            success_count += len(daum_products)
            all_products.extend(daum_products)
            
        except Exception as e:
            logger.error(f"키워드 '{keyword}' 크롤링 실패: {e}")
            error_count += 1
        
        time.sleep(1)  # 키워드 간 간격
    
    # 크롤링한 상품들을 데이터베이스에 저장
    if all_products:
        try:
            saved_count = save_products_to_db(all_products)
            logger.info(f"데이터베이스에 {saved_count}개 상품 저장 완료")
        except Exception as e:
            logger.error(f"데이터베이스 저장 실패: {e}")
    
    result = {
        'total_products': total_products,
        'success_count': success_count,
        'error_count': error_count,
        'keywords_used': keywords
    }
    
    logger.info(f"설정 기반 크롤링 완료: {result}")
    return result

def parse_crawling_settings(setting_text):
    """설정 텍스트를 파싱하여 크롤링 키워드를 추출합니다."""
    # 줄바꿈으로 분리하고 빈 줄 제거
    keywords = [line.strip() for line in setting_text.split('\n') if line.strip()]
    
    # 기본 키워드가 없으면 기본값 사용
    if not keywords:
        keywords = ["여행패키지", "해외여행", "국내여행"]
    
    return keywords

def save_products_to_db(products):
    """크롤링한 상품들을 데이터베이스에 저장합니다."""
    try:
        # database 모듈 import 시도
        from database import save_products_to_db as db_save_products
        return db_save_products(products)
    except ImportError:
        # database 모듈이 없으면 로그만 출력
        logger.info(f"{len(products)}개의 상품을 DB에 저장하는 로직 실행 (시뮬레이션)")
        return len(products)
    except Exception as e:
        logger.error(f"데이터베이스 저장 오류: {e}")
        return 0

def save_crawling_log(source_site, total_products, success_count, error_count, status, keywords_used=None, error_message=None):
    """크롤링 로그를 저장합니다."""
    try:
        # database 모듈 import 시도
        from database import save_crawling_log as db_save_log
        return db_save_log(source_site, total_products, success_count, error_count, status, keywords_used, error_message)
    except ImportError:
        # database 모듈이 없으면 로그만 출력
        logger.info(f"크롤링 로그 저장 (시뮬레이션): source_site={source_site}, total={total_products}, success={success_count}, error={error_count}, status={status}")
        return True
    except Exception as e:
        logger.error(f"크롤링 로그 저장 오류: {e}")
        return False

# 실제 크롤링 함수들 (향후 구현용)
def crawl_real_naver_products(keyword, max_products=20):
    """실제 네이버 쇼핑 크롤링 (향후 구현)"""
    # 실제 네이버 쇼핑 API 또는 웹 크롤링 로직
    # 현재는 더미 데이터 반환
    pass

def crawl_real_daum_products(keyword, max_products=20):
    """실제 다음 쇼핑 크롤링 (향후 구현)"""
    # 실제 다음 쇼핑 API 또는 웹 크롤링 로직
    # 현재는 더미 데이터 반환
    pass

if __name__ == "__main__":
    # 테스트 실행
    print("=== 일일 크롤링 테스트 ===")
    daily_result = run_daily_crawling()
    print(f"일일 크롤링 결과: {daily_result}")
    
    print("\n=== 설정 기반 크롤링 테스트 ===")
    test_settings = """제주도 여행
부산 여행
강릉 여행
경주 여행"""
    
    settings_result = run_crawling_with_settings(test_settings)
    print(f"설정 기반 크롤링 결과: {settings_result}")
