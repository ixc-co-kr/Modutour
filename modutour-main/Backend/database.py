import pymysql
import os
from dotenv import load_dotenv
import sys
import logging

# 환경 변수 로드
load_dotenv()

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 환경 변수 안전하게 가져오기
def get_env_var(key, default=None, var_type=str):
    """환경 변수를 안전하게 가져오는 함수"""
    value = os.getenv(key, default)
    if value is None:
        logger.warning(f"환경 변수 {key}가 설정되지 않았습니다.")
        return default
    
    # 문자열 정리 (공백, 백슬래시 제거)
    value = str(value).strip().replace('\\', '')
    
    if var_type == int:
        try:
            return int(value)
        except ValueError:
            logger.error(f"환경 변수 {key}의 값 '{value}'를 정수로 변환할 수 없습니다.")
            return default
    
    return value

# RDS 연결 정보
RDS_CONFIG = {
    'host': get_env_var('RDS_HOST'),
    'user': get_env_var('RDS_USER'),
    'password': get_env_var('RDS_PASSWORD'),
    'database': get_env_var('RDS_DATABASE'),
    'port': get_env_var('RDS_PORT', 3306, int),
    'charset': 'utf8mb4',
    'autocommit': True
}

def get_db_connection():
    """데이터베이스 연결을 반환합니다."""
    try:
        # 연결 정보 로깅 (비밀번호 제외)
        safe_config = {k: v for k, v in RDS_CONFIG.items() if k != 'password'}
        logger.info(f"RDS 연결 시도: {safe_config}")
        
        connection = pymysql.connect(**RDS_CONFIG)
        logger.info("RDS 연결 성공")
        return connection
    except pymysql.MySQLError as e:
        logger.error(f"RDS 연결 실패: {e}")
        return None
    except Exception as e:
        logger.error(f"예상치 못한 오류: {e}")
        return None

def create_tables():
    """필요한 테이블들을 생성합니다."""
    connection = get_db_connection()
    if not connection:
        logger.warning("데이터베이스 연결 실패로 테이블 생성을 건너뜁니다.")
        return False
    
    try:
        cursor = connection.cursor()
        
        # 상품 테이블 생성
        create_products_table = """
        CREATE TABLE IF NOT EXISTS products (
            id INT AUTO_INCREMENT PRIMARY KEY,
            product_name VARCHAR(500) NOT NULL,
            price DECIMAL(12, 2) NOT NULL,
            product_link TEXT,
            main_image_url TEXT,
            product_code VARCHAR(100) UNIQUE NOT NULL,
            category VARCHAR(100),
            description TEXT,
            source_site ENUM('naver', 'daum', 'manual') NOT NULL DEFAULT 'manual',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_category (category),
            INDEX idx_source_site (source_site),
            INDEX idx_created_at (created_at)
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        """
        
        # 크롤링 설정 테이블 생성
        create_crawling_settings_table = """
        CREATE TABLE IF NOT EXISTS crawling_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            setting_name VARCHAR(100) NOT NULL,
            setting_text TEXT NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_is_active (is_active),
            INDEX idx_updated_at (updated_at)
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        """
        
        # 크롤링 로그 테이블 생성
        create_crawling_logs_table = """
        CREATE TABLE IF NOT EXISTS crawling_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            source_site VARCHAR(50) NOT NULL,
            crawl_date DATE NOT NULL,
            total_products INT DEFAULT 0,
            success_count INT DEFAULT 0,
            error_count INT DEFAULT 0,
            status ENUM('running', 'success', 'failed', 'partial') DEFAULT 'running',
            error_message TEXT,
            keywords_used TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_crawl_date (crawl_date),
            INDEX idx_status (status)
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        """
        
        # 제외 설정 테이블 생성 (새로 추가)
        create_exclude_settings_table = """
        CREATE TABLE IF NOT EXISTS exclude_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            exclude_keywords TEXT,
            exclude_product_codes TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_is_active (is_active),
            INDEX idx_updated_at (updated_at)
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        """
        
        # 테이블 생성 실행
        cursor.execute(create_products_table)
        cursor.execute(create_crawling_settings_table)
        cursor.execute(create_crawling_logs_table)
        cursor.execute(create_exclude_settings_table)
        
        logger.info("모든 테이블 생성 완료")
        return True
        
    except pymysql.MySQLError as e:
        logger.error(f"테이블 생성 실패: {e}")
        return False
    finally:
        cursor.close()
        connection.close()

def test_connection():
    """데이터베이스 연결을 테스트합니다."""
    connection = get_db_connection()
    if connection:
        try:
            cursor = connection.cursor()
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            logger.info(f"연결 테스트 성공: {result}")
            return True
        except Exception as e:
            logger.error(f"연결 테스트 실패: {e}")
            return False
        finally:
            cursor.close()
            connection.close()
    return False

def save_crawling_setting(setting_name, setting_text):
    """크롤링 설정을 저장합니다."""
    connection = get_db_connection()
    if not connection:
        return False
    
    try:
        cursor = connection.cursor()
        
        # 기존 설정 비활성화
        cursor.execute("UPDATE crawling_settings SET is_active = FALSE")
        
        # 새 설정 저장
        insert_query = """
        INSERT INTO crawling_settings (setting_name, setting_text, is_active)
        VALUES (%s, %s, %s)
        """
        
        cursor.execute(insert_query, (setting_name, setting_text, True))
        setting_id = cursor.lastrowid
        connection.commit()
        
        logger.info(f"크롤링 설정 저장 완료: ID {setting_id}")
        return setting_id
        
    except pymysql.MySQLError as e:
        logger.error(f"크롤링 설정 저장 실패: {e}")
        connection.rollback()
        return False
    finally:
        cursor.close()
        connection.close()

def get_active_crawling_setting():
    """활성화된 크롤링 설정을 조회합니다."""
    connection = get_db_connection()
    if not connection:
        return None
    
    try:
        cursor = connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("""
            SELECT * FROM crawling_settings 
            WHERE is_active = TRUE 
            ORDER BY updated_at DESC 
            LIMIT 1
        """)
        
        setting = cursor.fetchone()
        return setting
        
    except pymysql.MySQLError as e:
        logger.error(f"크롤링 설정 조회 실패: {e}")
        return None
    finally:
        cursor.close()
        connection.close()

def save_crawling_log(source_site, total_products, success_count, error_count, status, keywords_used=None, error_message=None):
    """크롤링 로그를 저장합니다."""
    connection = get_db_connection()
    if not connection:
        return False
    
    try:
        cursor = connection.cursor()
        
        insert_query = """
        INSERT INTO crawling_logs 
        (source_site, crawl_date, total_products, success_count, error_count, status, keywords_used, error_message)
        VALUES (%s, CURDATE(), %s, %s, %s, %s, %s, %s)
        """
        
        cursor.execute(insert_query, (
            source_site, total_products, success_count, error_count, 
            status, keywords_used, error_message
        ))
        
        log_id = cursor.lastrowid
        connection.commit()
        
        logger.info(f"크롤링 로그 저장 완료: ID {log_id}")
        return log_id
        
    except pymysql.MySQLError as e:
        logger.error(f"크롤링 로그 저장 실패: {e}")
        connection.rollback()
        return False
    finally:
        cursor.close()
        connection.close()

def save_products_to_db(products):
    """크롤링한 상품들을 데이터베이스에 저장합니다."""
    if not products:
        return 0
    
    connection = get_db_connection()
    if not connection:
        return 0
    
    try:
        cursor = connection.cursor()
        
        insert_query = """
        INSERT INTO products 
        (product_name, price, product_link, main_image_url, product_code, category, description, source_site)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
        product_name = VALUES(product_name),
        price = VALUES(price),
        product_link = VALUES(product_link),
        main_image_url = VALUES(main_image_url),
        category = VALUES(category),
        description = VALUES(description),
        updated_at = CURRENT_TIMESTAMP
        """
        
        saved_count = 0
        for product in products:
            try:
                cursor.execute(insert_query, (
                    product['product_name'],
                    product['price'],
                    product.get('product_link', ''),
                    product.get('main_image_url', ''),
                    product['product_code'],
                    product.get('category', ''),
                    product.get('description', ''),
                    product.get('source_site', 'manual')
                ))
                saved_count += 1
            except pymysql.MySQLError as e:
                logger.error(f"상품 저장 실패: {product['product_code']} - {e}")
        
        connection.commit()
        logger.info(f"상품 {saved_count}개 저장 완료")
        return saved_count
        
    except pymysql.MySQLError as e:
        logger.error(f"상품 일괄 저장 실패: {e}")
        connection.rollback()
        return 0
    finally:
        cursor.close()
        connection.close()

# 제외 설정 관련 함수들 (새로 추가)
def save_exclude_setting(exclude_keywords, exclude_product_codes):
    """제외 설정을 저장합니다."""
    connection = get_db_connection()
    if not connection:
        return False
    
    try:
        cursor = connection.cursor()
        
        # 기존 설정 비활성화
        cursor.execute("UPDATE exclude_settings SET is_active = FALSE")
        
        # 새 설정 저장
        insert_query = """
        INSERT INTO exclude_settings (exclude_keywords, exclude_product_codes, is_active)
        VALUES (%s, %s, %s)
        """
        
        cursor.execute(insert_query, (exclude_keywords, exclude_product_codes, True))
        setting_id = cursor.lastrowid
        connection.commit()
        
        logger.info(f"제외 설정 저장 완료: ID {setting_id}")
        return setting_id
        
    except pymysql.MySQLError as e:
        logger.error(f"제외 설정 저장 실패: {e}")
        connection.rollback()
        return False
    finally:
        cursor.close()
        connection.close()

def get_active_exclude_setting():
    """활성화된 제외 설정을 조회합니다."""
    connection = get_db_connection()
    if not connection:
        return None
    
    try:
        cursor = connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("""
            SELECT * FROM exclude_settings 
            WHERE is_active = TRUE 
            ORDER BY updated_at DESC 
            LIMIT 1
        """)
        
        setting = cursor.fetchone()
        return setting
        
    except pymysql.MySQLError as e:
        logger.error(f"제외 설정 조회 실패: {e}")
        return None
    finally:
        cursor.close()
        connection.close()

def get_exclude_keywords():
    """활성화된 제외 키워드 목록을 반환합니다."""
    setting = get_active_exclude_setting()
    if setting and setting['exclude_keywords']:
        # 쉼표로 분리하고 공백 제거
        keywords = [keyword.strip() for keyword in setting['exclude_keywords'].split(',') if keyword.strip()]
        return keywords
    return []

def get_exclude_product_codes():
    """활성화된 제외 상품 코드 목록을 반환합니다."""
    setting = get_active_exclude_setting()
    if setting and setting['exclude_product_codes']:
        # 쉼표로 분리하고 공백 제거
        codes = [code.strip() for code in setting['exclude_product_codes'].split(',') if code.strip()]
        return codes
    return []

def is_product_excluded(product_name, product_code):
    """상품이 제외 대상인지 확인합니다."""
    # 제외 키워드 확인
    exclude_keywords = get_exclude_keywords()
    for keyword in exclude_keywords:
        if keyword.lower() in product_name.lower():
            logger.info(f"상품 제외됨 (키워드): {product_name} - 키워드: {keyword}")
            return True
    
    # 제외 상품 코드 확인
    exclude_codes = get_exclude_product_codes()
    for code in exclude_codes:
        if code.upper() in product_code.upper():
            logger.info(f"상품 제외됨 (코드): {product_code} - 코드: {code}")
            return True
    
    return False

def filter_excluded_products(products):
    """제외 설정에 따라 상품 목록을 필터링합니다."""
    if not products:
        return products
    
    filtered_products = []
    excluded_count = 0
    
    for product in products:
        if not is_product_excluded(product.get('product_name', ''), product.get('product_code', '')):
            filtered_products.append(product)
        else:
            excluded_count += 1
    
    if excluded_count > 0:
        logger.info(f"제외 설정에 따라 {excluded_count}개 상품이 필터링되었습니다.")
    
    return filtered_products

if __name__ == "__main__":
    # 환경 변수 확인
    print("환경 변수 확인:")
    for key in ['RDS_HOST', 'RDS_USER', 'RDS_DATABASE', 'RDS_PORT']:
        value = os.getenv(key)
        print(f"{key}: {value}")
    
    # 연결 테스트
    if test_connection():
        create_tables()
        print("데이터베이스 초기화 완료")
    else:
        print("데이터베이스 연결에 실패했습니다.")
