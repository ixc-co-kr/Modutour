from flask import Flask, jsonify, request
from flask_cors import CORS
import os
from dotenv import load_dotenv
import logging
from datetime import datetime
import threading
import schedule
import time
import pymysql

# 환경 변수 로드
load_dotenv()

# 안전한 import (파일이 없어도 실행되도록)
try:
    from database import get_db_connection, create_tables, test_connection, save_crawling_setting, get_active_crawling_setting, save_crawling_log, save_products_to_db, save_exclude_setting, get_active_exclude_setting
    DATABASE_AVAILABLE = True
except ImportError as e:
    print(f"Database 모듈 import 실패: {e}")
    DATABASE_AVAILABLE = False

try:
    from crawler import ProductCrawler, run_daily_crawling, run_crawling_with_settings
    CRAWLER_AVAILABLE = True
except ImportError as e:
    print(f"Crawler 모듈 import 실패: {e}")
    CRAWLER_AVAILABLE = False

application = Flask(__name__)

# CORS 설정 강화
CORS(application, 
     origins=[
         'http://localhost:3000',
         'http://localhost:5173',
         'https://localhost:5173',  # HTTPS도 허용
         'https://modetour.name'
     ],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization'],
     supports_credentials=True
)

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# OPTIONS 요청 처리 (Preflight)
@application.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = jsonify()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add('Access-Control-Allow-Headers', "*")
        response.headers.add('Access-Control-Allow-Methods', "*")
        return response

@application.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'message': 'ModuTour Backend API is running',
        'timestamp': datetime.now().isoformat(),
        'database_available': DATABASE_AVAILABLE,
        'crawler_available': CRAWLER_AVAILABLE
    })

@application.route('/api/products', methods=['GET'])
def get_products():
    try:
        # 쿼리 파라미터 추출
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        category = request.args.get('category', '', type=str)
        source_site = request.args.get('source_site', '', type=str)
        
        if DATABASE_AVAILABLE:
            # 제외 키워드 조회
            exclude_keywords = get_exclude_keywords()
            
            # 페이지네이션 계산
            offset = (page - 1) * per_page
            
            connection = get_db_connection()
            if not connection:
                return jsonify({'error': '데이터베이스 연결 실패'}), 500
            
            try:
                cursor = connection.cursor(pymysql.cursors.DictCursor)
                
                # WHERE 조건 구성
                where_conditions = []
                params = []
                
                if category:
                    where_conditions.append("category LIKE %s")
                    params.append(f'%{category}%')
                
                if source_site:
                    where_conditions.append("source_site = %s")
                    params.append(source_site)
                
                # 제외 키워드 조건 추가
                if exclude_keywords:
                    for keyword in exclude_keywords:
                        where_conditions.append("product_name NOT LIKE %s")
                        params.append(f'%{keyword}%')
                
                where_clause = ""
                if where_conditions:
                    where_clause = "WHERE " + " AND ".join(where_conditions)
                
                # 전체 개수 조회
                count_query = f"SELECT COUNT(*) as total FROM products {where_clause}"
                cursor.execute(count_query, params)
                total_count = cursor.fetchone()['total']
                
                # 상품 목록 조회
                query = f"""
                SELECT id, product_name, price, product_code, category, 
                       main_image_url, source_site, product_link, description,
                       DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') as updated_at
                FROM products 
                {where_clause}
                ORDER BY updated_at DESC
                LIMIT %s OFFSET %s
                """
                
                cursor.execute(query, params + [per_page, offset])
                products = cursor.fetchall()
                
                # 총 페이지 수 계산
                total_pages = (total_count + per_page - 1) // per_page
                
                return jsonify({
                    'products': products,
                    'pagination': {
                        'current_page': page,
                        'per_page': per_page,
                        'total_count': total_count,
                        'total_pages': total_pages
                    },
                    'success': True
                })
                
            except Exception as e:
                logger.error(f"상품 조회 오류: {e}")
                return jsonify({'error': '상품 조회 중 오류가 발생했습니다'}), 500
            finally:
                cursor.close()
                connection.close()
        else:
            # 더미 데이터 반환
            return jsonify({
                'products': [
                    {
                        'id': 1,
                        'product_name': '[테스트] 제주도 여행 패키지',
                        'price': 299000,
                        'product_code': 'TEST001',
                        'category': '국내여행'
                    }
                ],
                'pagination': {'current_page': 1, 'total_pages': 1},
                'success': True
            })
            
    except Exception as e:
        logger.error(f"API 오류: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다'}), 500

@application.route('/api/products', methods=['POST'])
def create_product():
    try:
        data = request.get_json()
        
        # 필수 필드 검증
        required_fields = ['product_name', 'price', 'product_code']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field}는 필수 항목입니다'}), 400
        
        if DATABASE_AVAILABLE:
            connection = get_db_connection()
            if not connection:
                return jsonify({'error': '데이터베이스 연결 실패'}), 500
            
            try:
                cursor = connection.cursor()
                
                insert_query = """
                INSERT INTO products (
                    product_name, price, product_link, 
                    main_image_url, product_code, category, 
                    description, source_site
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """
                
                cursor.execute(insert_query, (
                    data['product_name'],
                    data['price'],
                    data.get('product_link', ''),
                    data.get('main_image_url', ''),
                    data['product_code'],
                    data.get('category', ''),
                    data.get('description', ''),
                    data.get('source_site', 'manual')
                ))
                
                product_id = cursor.lastrowid
                connection.commit()
                
                return jsonify({
                    'message': '상품이 성공적으로 생성되었습니다',
                    'product_id': product_id,
                    'success': True
                }), 201
                
            except pymysql.Error as e:
                connection.rollback()
                logger.error(f"데이터베이스 오류: {e}")
                return jsonify({'error': '데이터베이스 저장 실패'}), 500
            finally:
                cursor.close()
                connection.close()
        else:
            # 데이터베이스 없이 성공 응답
            return jsonify({
                'message': '상품이 성공적으로 생성되었습니다 (로컬)',
                'product_id': 12345,
                'success': True
            }), 201
            
    except Exception as e:
        logger.error(f"API 오류: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다'}), 500

# 제외 설정 조회 API (데이터베이스 연동)
@application.route('/api/exclude-settings', methods=['GET'])
def get_exclude_settings():
    try:
        if DATABASE_AVAILABLE:
            setting = get_active_exclude_setting()
            return jsonify({
                'settings': setting,
                'success': True
            })
        else:
            return jsonify({
                'settings': {
                    'exclude_keywords': '',
                    'exclude_product_codes': ''
                },
                'success': True
            })
    except Exception as e:
        logger.error(f"제외 설정 조회 오류: {e}")
        return jsonify({'error': '설정 조회 실패'}), 500

# 제외 설정 저장 API (데이터베이스 연동)
@application.route('/api/exclude-settings', methods=['POST'])
def save_exclude_settings():
    try:
        data = request.get_json()
        
        if DATABASE_AVAILABLE:
            setting_id = save_exclude_setting(
                data.get('exclude_keywords', ''),
                data.get('exclude_product_codes', '')
            )
            
            if setting_id:
                return jsonify({
                    'message': '제외 설정이 저장되었습니다',
                    'setting_id': setting_id,
                    'success': True
                }), 201
            else:
                return jsonify({'error': '설정 저장 실패'}), 500
        else:
            # 데이터베이스 없이 성공 응답
            return jsonify({
                'message': '제외 설정이 저장되었습니다 (로컬)',
                'setting_id': 12345,
                'success': True
            }), 201
        
    except Exception as e:
        logger.error(f"제외 설정 저장 오류: {e}")
        return jsonify({'error': '설정 저장 실패'}), 500

# 크롤링 설정 조회 API
@application.route('/api/crawling/settings', methods=['GET'])
def get_crawling_settings():
    try:
        if DATABASE_AVAILABLE:
            setting = get_active_crawling_setting()
            return jsonify({
                'setting': setting,
                'success': True
            })
        else:
            return jsonify({
                'setting': None,
                'success': True,
                'message': '데이터베이스를 사용할 수 없습니다'
            })
        
    except Exception as e:
        logger.error(f"크롤링 설정 조회 오류: {e}")
        return jsonify({'error': '설정 조회 실패'}), 500

# 크롤링 설정 저장 API
@application.route('/api/crawling/settings', methods=['POST'])
def save_crawling_settings():
    try:
        data = request.get_json()
        
        if not data or 'setting_text' not in data:
            return jsonify({'error': '설정 텍스트가 필요합니다'}), 400
        
        if DATABASE_AVAILABLE:
            setting_id = save_crawling_setting(
                data.get('setting_name', 'default'),
                data['setting_text']
            )
            
            if setting_id:
                return jsonify({
                    'message': '크롤링 설정이 저장되었습니다',
                    'setting_id': setting_id,
                    'success': True
                }), 201
            else:
                return jsonify({'error': '설정 저장 실패'}), 500
        else:
            return jsonify({
                'message': '크롤링 설정이 저장되었습니다 (로컬)',
                'setting_id': 12345,
                'success': True
            }), 201
        
    except Exception as e:
        logger.error(f"크롤링 설정 저장 오류: {e}")
        return jsonify({'error': '설정 저장 실패'}), 500

# 설정 기반 크롤링 실행 API
@application.route('/api/crawling/execute', methods=['POST'])
def execute_crawling_with_settings():
    try:
        if DATABASE_AVAILABLE:
            # 최신 크롤링 설정 조회
            setting = get_active_crawling_setting()
            
            if not setting:
                return jsonify({'error': '활성화된 크롤링 설정이 없습니다'}), 400
            
            # 제외 상품 코드 조회
            exclude_codes = get_exclude_product_codes()
            
            # 설정값을 사용하여 크롤링 실행
            if CRAWLER_AVAILABLE:
                result = run_crawling_with_settings(setting['setting_text'], exclude_codes)
                
                # 크롤링 로그 저장
                save_crawling_log(
                    'mixed',
                    result['total_products'],
                    result['success_count'],
                    result['error_count'],
                    'success' if result['error_count'] == 0 else 'partial',
                    ', '.join(result['keywords_used'])
                )
                
                return jsonify({
                    'message': '설정 기반 크롤링이 완료되었습니다',
                    'result': result,
                    'success': True
                })
            else:
                return jsonify({'error': '크롤링 모듈을 사용할 수 없습니다'}), 503
        else:
            return jsonify({
                'message': '크롤링이 완료되었습니다 (시뮬레이션)',
                'result': {
                    'total_products': 10,
                    'success_count': 10,
                    'error_count': 0,
                    'keywords_used': ['여행패키지', '해외여행']
                },
                'success': True
            })
            
    except Exception as e:
        logger.error(f"크롤링 실행 오류: {e}")
        return jsonify({'error': '크롤링 실행 실패'}), 500

@application.route('/api/crawling/trigger', methods=['POST'])
def trigger_crawling():
    if CRAWLER_AVAILABLE:
        try:
            result = run_daily_crawling()
            return jsonify({
                'message': '크롤링이 완료되었습니다',
                'result': result,
                'success': True
            })
        except Exception as e:
            return jsonify({'error': f'크롤링 실행 오류: {e}'}), 500
    else:
        return jsonify({'error': '크롤링 모듈을 사용할 수 없습니다'}), 503

# 제외 키워드 조회 함수
def get_exclude_keywords():
    """활성화된 제외 키워드 목록을 반환합니다."""
    if not DATABASE_AVAILABLE:
        return []
    
    try:
        setting = get_active_exclude_setting()
        if setting and setting['exclude_keywords']:
            # 쉼표로 분리하고 공백 제거
            keywords = [keyword.strip() for keyword in setting['exclude_keywords'].split(',') if keyword.strip()]
            return keywords
        
        return []
        
    except Exception as e:
        logger.error(f"제외 키워드 조회 오류: {e}")
        return []

# 제외 상품 코드 조회 함수
def get_exclude_product_codes():
    """활성화된 제외 상품 코드 목록을 반환합니다."""
    if not DATABASE_AVAILABLE:
        return []
    
    try:
        setting = get_active_exclude_setting()
        if setting and setting['exclude_product_codes']:
            # 쉼표로 분리하고 공백 제거
            codes = [code.strip() for code in setting['exclude_product_codes'].split(',') if code.strip()]
            return codes
        
        return []
        
    except Exception as e:
        logger.error(f"제외 상품 코드 조회 오류: {e}")
        return []

# 404 에러 핸들러 추가
@application.errorhandler(404)
def not_found(error):
    return jsonify({
        'error': 'Not Found',
        'message': 'The requested URL was not found on the server',
        'status': 404
    }), 404

# 테스트용 라우트 목록 확인
@application.route('/routes')
def list_routes():
    import urllib
    output = []
    for rule in application.url_map.iter_rules():
        methods = ','.join(rule.methods)
        line = urllib.parse.unquote(f"{rule.endpoint}: {rule.rule} [{methods}]")
        output.append(line)
    
    return jsonify(output)

# 스케줄러 설정
def run_scheduler():
    if CRAWLER_AVAILABLE:
        schedule.every().day.at("02:00").do(run_daily_crawling)
        logger.info("크롤링 스케줄러 시작됨")
        
        while True:
            schedule.run_pending()
            time.sleep(60)

if __name__ == '__main__':
    # 데이터베이스 연결 테스트
    if DATABASE_AVAILABLE:
        if not test_connection():
            logger.warning("데이터베이스 연결 실패. 로컬 모드로 실행됩니다.")
        else:
            # 테이블 생성
            if not create_tables():
                logger.warning("테이블 생성 실패.")
    
    # 스케줄러 스레드 시작
    if CRAWLER_AVAILABLE:
        scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
        scheduler_thread.start()
    
    # Flask 서버 실행
    port = int(os.getenv('PORT', 5001))
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Flask 서버 시작: http://localhost:{port}")
    application.run(host='0.0.0.0', port=port, debug=debug_mode)
