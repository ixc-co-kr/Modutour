// src/utils/auth.ts
export const checkAuth = (): boolean => {
    const isAuthenticated = sessionStorage.getItem('isAuthenticated');
    
    if (!isAuthenticated || isAuthenticated !== 'true') {
      return false;
    }
    
    return true;
  };
  
  export const logout = (): void => {
    sessionStorage.clear();
    window.location.reload();
  };
  
  export const getUserId = (): string | null => {
    return sessionStorage.getItem('userId');
  };
  
  export const getLoginTime = (): string | null => {
    return sessionStorage.getItem('loginTime');
  };
  