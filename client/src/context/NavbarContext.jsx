import { createContext, useContext, useState } from 'react';

const NavbarContext = createContext();

export function NavbarProvider({ children }) {
  const [hideNavbar, setHideNavbar] = useState(false);

  return (
    <NavbarContext.Provider value={{ hideNavbar, setHideNavbar }}>
      {children}
    </NavbarContext.Provider>
  );
}

export function useNavbar() {
  const context = useContext(NavbarContext);
  if (!context) {
    throw new Error('useNavbar must be used within NavbarProvider');
  }
  return context;
}
